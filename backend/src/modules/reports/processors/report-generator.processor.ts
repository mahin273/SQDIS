/* eslint-disable*/
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma';
import { FileStorageService } from '../services/file-storage.service';
import { PdfGeneratorService, PdfReportData } from '../services/pdf-generator.service';
import { REPORT_QUEUE, ReportType, ReportScope, ReportStatus } from '../constants';
import { stringify } from 'csv-stringify/sync';

/**
 * Job data interface for report generation
 */
interface ReportJobData {
  reportId: string;
  type: ReportType;
  scope: ReportScope;
  organizationId: string;
  teamId?: string;
  projectId?: string;
  repositoryId?: string;
  developerId?: string;
  startDate: string;
  endDate: string;
}

/**
 * BullMQ processor for report generation jobs
 */
@Processor(REPORT_QUEUE)
export class ReportGeneratorProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGeneratorProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorageService: FileStorageService,
    private readonly pdfGeneratorService: PdfGeneratorService,
  ) {
    super();
  }

  /**
   * Process report generation job
   */
  async process(job: Job<ReportJobData>): Promise<void> {
    const { reportId, type } = job.data;
    this.logger.log(`Processing report generation job: ${reportId}`);

    try {
      // Update status to processing
      await this.updateReportStatus(reportId, ReportStatus.PROCESSING);

      // Gather comprehensive report data based on scope and db telemetry
      const reportData = await this.gatherReportData(job.data);

      // Generate file based on type
      let fileBuffer: Buffer;
      let filename: string;

      if (type === ReportType.PDF) {
        fileBuffer = await this.pdfGeneratorService.generatePdf(reportData as PdfReportData);
        filename = this.generateFilename(reportData.title, 'pdf');
      } else {
        const csvContent = this.generateCsvReport(reportData);
        fileBuffer = Buffer.from(csvContent, 'utf-8');
        filename = this.generateFilename(reportData.title, 'csv');
      }

      // Save file to storage
      const filePath = await this.fileStorageService.saveFile(
        fileBuffer,
        filename,
        job.data.organizationId,
      );

      // Update report with file info
      await this.updateReportStatus(reportId, ReportStatus.COMPLETED, {
        filename,
        filePath,
        fileSize: fileBuffer.length,
      });

      this.logger.log(`Report ${reportId} generated successfully: ${filename}`);
    } catch (error) {
      this.logger.error(`Failed to generate report ${reportId}`, error);
      await this.updateReportStatus(reportId, ReportStatus.FAILED, {
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Gather report data based on scope
   */
  private async gatherReportData(jobData: ReportJobData): Promise<any> {
    const { scope, organizationId, teamId, projectId, repositoryId, developerId, startDate, endDate } = jobData;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const baseData = {
      title: '',
      organizationName: '',
      scope: scope || ReportScope.ORGANIZATION,
      dateRange: { start, end },
      generatedAt: new Date(),
      developers: [] as any[],
      summary: {
        totalCommits: 0,
        totalDevelopers: 0,
        avgDQS: null as number | null,
        totalBugfixes: 0,
        totalFeatures: 0,
        totalRefactors: 0,
      },
    };

    // Get organization name
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    baseData.organizationName = org?.name || 'Organization';

    // Resolve effective repositories for this scope
    let effectiveRepoIds: string[] = [];
    if (repositoryId) {
      effectiveRepoIds = [repositoryId];
    } else if (projectId) {
      const projRepos = await this.prisma.projectRepository.findMany({
        where: { projectId },
        select: { repositoryId: true },
      });
      effectiveRepoIds = projRepos.map((r) => r.repositoryId);
    } else {
      const orgRepos = await this.prisma.repository.findMany({
        where: { organizationId },
        select: { id: true },
      });
      effectiveRepoIds = orgRepos.map((r) => r.id);
    }

    // Gather global telemetry (SQS, coverage, debt, PRs/reviews)
    const telemetry = await this.gatherQualityIntelligence(organizationId, start, end, effectiveRepoIds);
    Object.assign(baseData, telemetry);

    switch (scope) {
      case ReportScope.ORGANIZATION:
        return this.gatherOrganizationData(baseData, organizationId, start, end, effectiveRepoIds);
      case ReportScope.TEAM:
        return this.gatherTeamData(baseData, teamId!, start, end, organizationId, effectiveRepoIds);
      case ReportScope.PROJECT:
        return this.gatherProjectData(baseData, projectId!, start, end);
      case ReportScope.DEVELOPER:
        return this.gatherDeveloperData(baseData, developerId!, start, end, organizationId, effectiveRepoIds);
      case ReportScope.REPOSITORY:
        return this.gatherRepositoryData(baseData, repositoryId!, start, end);
      default:
        return baseData;
    }
  }

  /**
   * Gather organization-wide report data
   */
  private async gatherOrganizationData(
    baseData: any,
    organizationId: string,
    start: Date,
    end: Date,
    effectiveRepoIds: string[],
  ) {
    baseData.title = `Executive Quality Audit - ${baseData.organizationName}`;

    // Get all developers in organization
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const developerData = await Promise.all(
      members.map((m) =>
        this.getDeveloperMetrics(m.user.id, m.user.name, m.user.email, start, end, organizationId, effectiveRepoIds),
      ),
    );

    baseData.developers = developerData.filter((d) => d.totalCommits > 0);

    // If no commits in window, keep real zero-commit records for members instead of fabricating data
    if (baseData.developers.length === 0 && members.length > 0) {
      baseData.developers = developerData;
    }

    baseData.summary = this.calculateSummary(baseData.developers);
    return baseData;
  }

  /**
   * Gather team-specific report data
   */
  private async gatherTeamData(
    baseData: any,
    teamId: string,
    start: Date,
    end: Date,
    organizationId: string,
    effectiveRepoIds: string[],
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        memberships: {
          where: { leftAt: null },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    baseData.title = `Team Quality Report - ${team?.name || 'Engineering Team'}`;
    baseData.teamName = team?.name;

    const developerData = await Promise.all(
      (team?.memberships || []).map((m) =>
        this.getDeveloperMetrics(m.user.id, m.user.name, m.user.email, start, end, organizationId, effectiveRepoIds),
      ),
    );

    baseData.developers = developerData.filter((d) => d.totalCommits > 0);
    if (baseData.developers.length === 0 && (team?.memberships || []).length > 0) {
      baseData.developers = developerData;
    }
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
  }

  /**
   * Gather project-specific report data
   */
  private async gatherProjectData(baseData: any, projectId: string, start: Date, end: Date) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          include: {
            repository: true,
          },
        },
      },
    });

    baseData.title = `Project Quality Report - ${project?.name || 'Project'}`;
    baseData.projectName = project?.name;

    const repoIds = project?.repositories.map((r) => r.repositoryId) || [];

    // Get commits for project repositories
    const commits = await this.prisma.commit.findMany({
      where: {
        repositoryId: { in: repoIds },
        committedAt: { gte: start, lte: end },
        developerId: { not: null },
      },
      include: {
        developer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Group by developer
    const developerMap = new Map<string, any>();
    for (const commit of commits) {
      if (!commit.developer) continue;
      const devId = commit.developer.id;
      if (!developerMap.has(devId)) {
        developerMap.set(devId, {
          id: devId,
          name: commit.developer.name,
          email: commit.developer.email,
          totalCommits: 0,
          bugfixCommits: 0,
          featureCommits: 0,
          refactorCommits: 0,
          linesAdded: 0,
          linesDeleted: 0,
          dqsScore: null,
        });
      }
      const dev = developerMap.get(devId)!;
      dev.totalCommits++;
      if (commit.classification === 'BUGFIX') dev.bugfixCommits++;
      else if (commit.classification === 'FEATURE') dev.featureCommits++;
      else dev.refactorCommits = (dev.refactorCommits || 0) + 1;
      dev.linesAdded += commit.linesAdded || 0;
      dev.linesDeleted += commit.linesDeleted || 0;
    }

    // Get DQS scores bounded by end date
    for (const [devId, dev] of developerMap) {
      const dqs = await this.prisma.dQSScore.findFirst({
        where: { developerId: devId, calculatedAt: { lte: end } },
        orderBy: { calculatedAt: 'desc' },
        select: { score: true },
      });
      dev.dqsScore = dqs ? Math.round(dqs.score * 10) / 10 : null;
    }

    baseData.developers = Array.from(developerMap.values());
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
  }

  /**
   * Gather repository-specific report data
   */
  private async gatherRepositoryData(baseData: any, repositoryId: string, start: Date, end: Date) {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        name: true,
        fullName: true,
      },
    });

    baseData.title = `Repository Quality Audit - ${repository?.fullName || repository?.name || 'Repository'}`;
    baseData.repositoryName = repository?.fullName || repository?.name;

    // Get commits for this repository
    const commits = await this.prisma.commit.findMany({
      where: {
        repositoryId,
        committedAt: { gte: start, lte: end },
        developerId: { not: null },
      },
      include: {
        developer: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Group by developer
    const developerMap = new Map<string, any>();
    for (const commit of commits) {
      if (!commit.developer) continue;
      const devId = commit.developer.id;
      if (!developerMap.has(devId)) {
        developerMap.set(devId, {
          id: devId,
          name: commit.developer.name,
          email: commit.developer.email,
          totalCommits: 0,
          bugfixCommits: 0,
          featureCommits: 0,
          refactorCommits: 0,
          linesAdded: 0,
          linesDeleted: 0,
          dqsScore: null,
        });
      }
      const dev = developerMap.get(devId)!;
      dev.totalCommits++;
      if (commit.classification === 'BUGFIX') dev.bugfixCommits++;
      else if (commit.classification === 'FEATURE') dev.featureCommits++;
      else dev.refactorCommits = (dev.refactorCommits || 0) + 1;
      dev.linesAdded += commit.linesAdded || 0;
      dev.linesDeleted += commit.linesDeleted || 0;
    }

    // Get DQS scores bounded by end date
    for (const [devId, dev] of developerMap) {
      const dqs = await this.prisma.dQSScore.findFirst({
        where: { developerId: devId, calculatedAt: { lte: end } },
        orderBy: { calculatedAt: 'desc' },
        select: { score: true },
      });
      dev.dqsScore = dqs ? Math.round(dqs.score * 10) / 10 : null;
    }

    baseData.developers = Array.from(developerMap.values());
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
  }

  /**
   * Gather individual developer report data
   */
  private async gatherDeveloperData(
    baseData: any,
    developerId: string,
    start: Date,
    end: Date,
    organizationId: string,
    effectiveRepoIds: string[],
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: developerId },
      select: { id: true, name: true, email: true },
    });

    baseData.title = `Developer Quality Scorecard - ${user?.name || 'Developer'}`;

    const developerMetrics = await this.getDeveloperMetrics(
      developerId,
      user?.name || 'Developer',
      user?.email || '',
      start,
      end,
      organizationId,
      effectiveRepoIds,
    );

    baseData.developers = [developerMetrics];
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
  }

  /**
   * Gather deep system telemetry across SQS, Coverage, Debt, and PRs
   */
  private async gatherQualityIntelligence(
    organizationId: string,
    start: Date,
    end: Date,
    repositoryIds?: string[],
  ) {
    // 1. Resolve relevant repositories belonging to this organization
    const orgRepos = await this.prisma.repository.findMany({
      where: {
        organizationId,
        ...(repositoryIds && repositoryIds.length > 0 ? { id: { in: repositoryIds } } : {}),
      },
      select: { id: true },
    });
    const effectiveRepoIds = orgRepos.map((r) => r.id);

    // Also find projects belonging to this organization for project-level SQS scores
    const orgProjects = await this.prisma.project.findMany({
      where: { organizationId },
      select: { id: true },
    });
    const orgProjectIds = orgProjects.map((p) => p.id);
    const targetEntityIds = Array.from(new Set([...effectiveRepoIds, ...orgProjectIds]));

    // SQS: Filtered strictly to organization repositories or projects and date range
    let sqs: { score: number | null; grade: string; riskyModulesCount: number } | null = null;
    if (targetEntityIds.length > 0) {
      const latestSqs = await this.prisma.sQSScore.findFirst({
        where: {
          projectId: { in: targetEntityIds },
          calculatedAt: { lte: end },
        },
        orderBy: { calculatedAt: 'desc' },
      });

      if (latestSqs) {
        const s = Math.round(latestSqs.score * 10) / 10;
        let g = 'C';
        if (s >= 90) g = 'A+';
        else if (s >= 80) g = 'A';
        else if (s >= 70) g = 'B';
        else if (s >= 60) g = 'C';
        else g = 'D';

        const riskyCount = Array.isArray(latestSqs.riskyModules) ? latestSqs.riskyModules.length : 0;
        sqs = { score: s, grade: g, riskyModulesCount: riskyCount };
      }
    }

    // Coverage: Filtered strictly to organization repositories and completed status within date range
    let coverage: { percentage: number | null; linesTotal: number; linesCovered: number } | null = null;
    if (effectiveRepoIds.length > 0) {
      const latestCoverage = await this.prisma.coverageReport.findFirst({
        where: {
          repositoryId: { in: effectiveRepoIds },
          status: 'COMPLETED',
          createdAt: { lte: end },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (latestCoverage && latestCoverage.coveragePercentage !== null) {
        coverage = {
          percentage: Math.round(latestCoverage.coveragePercentage * 10) / 10,
          linesTotal: latestCoverage.linesTotal || 0,
          linesCovered: latestCoverage.linesCovered || 0,
        };
      }
    }

    // Technical Debt: Filtered strictly to organization repositories
    let technicalDebt = {
      totalItems: 0,
      unresolvedItems: 0,
      resolvedItems: 0,
      todoCount: 0,
      fixmeCount: 0,
      hackCount: 0,
      topHotspots: [] as { file: string; count: number }[],
    };

    if (effectiveRepoIds.length > 0) {
      const debtItems = await this.prisma.debtItem.findMany({
        where: {
          repositoryId: { in: effectiveRepoIds },
          createdAt: { lte: end },
        },
        select: {
          markerType: true,
          isResolved: true,
          filePath: true,
        },
      });

      const unresolved = debtItems.filter((d) => !d.isResolved);
      const fileCounts: Record<string, number> = {};
      for (const item of unresolved) {
        fileCounts[item.filePath] = (fileCounts[item.filePath] || 0) + 1;
      }
      const topHotspots = Object.entries(fileCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([file, count]) => ({ file, count }));

      technicalDebt = {
        totalItems: debtItems.length,
        unresolvedItems: unresolved.length,
        resolvedItems: debtItems.filter((d) => d.isResolved).length,
        todoCount: debtItems.filter((d) => d.markerType === 'TODO').length,
        fixmeCount: debtItems.filter((d) => d.markerType === 'FIXME').length,
        hackCount: debtItems.filter((d) => (d.markerType as string) === 'XXX' || (d.markerType as string) === 'HACK').length,
        topHotspots,
      };
    }

    // Pull Requests and Reviews: Filtered strictly to organization repositories and window
    let reviewsAndPrs = {
      totalPrs: 0,
      mergedPrs: 0,
      totalReviews: 0,
      avgTurnaroundHours: null as number | null,
    };

    if (effectiveRepoIds.length > 0) {
      const pullRequests = await this.prisma.pullRequest.findMany({
        where: {
          repositoryId: { in: effectiveRepoIds },
          createdAt: { gte: start, lte: end },
        },
        select: { id: true, merged: true },
      });

      const reviews = await this.prisma.review.findMany({
        where: {
          repositoryId: { in: effectiveRepoIds },
          createdAt: { gte: start, lte: end },
        },
        select: { id: true, turnaroundMinutes: true },
      });

      const validMinutes = reviews.filter((r) => r.turnaroundMinutes !== null && r.turnaroundMinutes! > 0);
      const avgHours =
        validMinutes.length > 0
          ? Math.round(
              (validMinutes.reduce((s, r) => s + r.turnaroundMinutes!, 0) / validMinutes.length / 60) * 10,
            ) / 10
          : null;

      reviewsAndPrs = {
        totalPrs: pullRequests.length,
        mergedPrs: pullRequests.filter((p) => p.merged).length,
        totalReviews: reviews.length,
        avgTurnaroundHours: avgHours,
      };
    }

    return { sqs, coverage, technicalDebt, reviewsAndPrs };
  }

  /**
   * Get metrics for a single developer
   */
  private async getDeveloperMetrics(
    developerId: string,
    name: string,
    email: string,
    start: Date,
    end: Date,
    organizationId?: string,
    repositoryIds?: string[],
  ) {
    const commitWhere: any = {
      developerId,
      committedAt: { gte: start, lte: end },
    };
    if (repositoryIds && repositoryIds.length > 0) {
      commitWhere.repositoryId = { in: repositoryIds };
    } else if (organizationId) {
      commitWhere.repository = { organizationId };
    }

    const commits = await this.prisma.commit.findMany({
      where: commitWhere,
      select: {
        classification: true,
        linesAdded: true,
        linesDeleted: true,
      },
    });

    const dqsWhere: any = { developerId };
    if (end) {
      dqsWhere.calculatedAt = { lte: end };
    }
    const dqs = await this.prisma.dQSScore.findFirst({
      where: dqsWhere,
      orderBy: { calculatedAt: 'desc' },
      select: { score: true },
    });

    const reviewWhere: any = {
      reviewerId: developerId,
      submittedAt: { gte: start, lte: end },
    };
    if (repositoryIds && repositoryIds.length > 0) {
      reviewWhere.repositoryId = { in: repositoryIds };
    } else if (organizationId) {
      reviewWhere.repository = { organizationId };
    }

    const reviews = await this.prisma.review.count({
      where: reviewWhere,
    });

    return {
      id: developerId,
      name,
      email,
      totalCommits: commits.length,
      bugfixCommits: commits.filter((c) => c.classification === 'BUGFIX').length,
      featureCommits: commits.filter((c) => c.classification === 'FEATURE').length,
      refactorCommits: commits.filter((c) => c.classification === 'REFACTOR').length,
      testCommits: commits.filter((c) => c.classification === 'TEST').length,
      docsCommits: commits.filter((c) => c.classification === 'DOCS').length,
      linesAdded: commits.reduce((sum, c) => sum + (c.linesAdded || 0), 0),
      linesDeleted: commits.reduce((sum, c) => sum + (c.linesDeleted || 0), 0),
      reviewsGiven: reviews,
      dqsScore: dqs ? Math.round(dqs.score * 10) / 10 : null,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(developers: any[]) {
    const totalCommits = developers.reduce((sum, d) => sum + d.totalCommits, 0);
    const totalBugfixes = developers.reduce((sum, d) => sum + d.bugfixCommits, 0);
    const totalFeatures = developers.reduce((sum, d) => sum + d.featureCommits, 0);
    const totalRefactors = developers.reduce((sum, d) => sum + (d.refactorCommits || 0), 0);
    const validScores = developers.filter((d) => d.dqsScore !== null && d.dqsScore !== undefined);
    const avgDQS =
      validScores.length > 0
        ? Math.round((validScores.reduce((sum, d) => sum + d.dqsScore, 0) / validScores.length) * 10) / 10
        : null;

    return {
      totalCommits,
      totalDevelopers: developers.length,
      avgDQS,
      totalBugfixes,
      totalFeatures,
      totalRefactors,
    };
  }

  /**
   * Generate CSV report enriched with SQS and technical debt
   */
  private generateCsvReport(data: any): string {
    const metadata = [
      [data.title],
      ['Organization', data.organizationName],
      ['Report Scope', data.scope || 'ORGANIZATION'],
      ['Start Date', this.formatDate(data.dateRange.start)],
      ['End Date', this.formatDate(data.dateRange.end)],
      ['Generated', this.formatDate(data.generatedAt)],
      [],
      ['Executive Summary'],
      ['System Quality Score (SQS)', data.sqs && data.sqs.score !== null ? `${data.sqs.score}/100 (Grade ${data.sqs.grade})` : 'N/A'],
      ['Codebase Test Coverage', data.coverage && data.coverage.percentage !== null ? `${data.coverage.percentage}%` : 'N/A'],
      ['Open Technical Debt Items', data.technicalDebt ? data.technicalDebt.unresolvedItems : 0],
      ['Review Turnaround SLA (Hours)', data.reviewsAndPrs && data.reviewsAndPrs.avgTurnaroundHours !== null ? `${data.reviewsAndPrs.avgTurnaroundHours}` : 'N/A'],
      ['Total Developers', data.summary.totalDevelopers],
      ['Total Commits', data.summary.totalCommits],
      ['Average DQS', data.summary.avgDQS !== null && data.summary.avgDQS !== undefined ? data.summary.avgDQS.toFixed(1) : 'N/A'],
      ['Total Features', data.summary.totalFeatures],
      ['Total Bugfixes', data.summary.totalBugfixes],
      [],
    ];

    const headers = [
      'Developer Name',
      'Email',
      'Total Commits',
      'Feature Commits',
      'Bugfix Commits',
      'Refactor Commits',
      'Test Commits',
      'Docs Commits',
      'Lines Added',
      'Lines Deleted',
      'Reviews Given',
      'DQS Score',
    ];

    const rows = data.developers.map((dev: any) => [
      dev.name,
      dev.email,
      dev.totalCommits,
      dev.featureCommits,
      dev.bugfixCommits,
      dev.refactorCommits || 0,
      dev.testCommits || 0,
      dev.docsCommits || 0,
      dev.linesAdded,
      dev.linesDeleted,
      dev.reviewsGiven || 0,
      dev.dqsScore !== null ? dev.dqsScore.toFixed(1) : 'N/A',
    ]);

    return stringify([...metadata, headers, ...rows]);
  }

  /**
   * Update report status in database
   */
  private async updateReportStatus(
    reportId: string,
    status: ReportStatus,
    data?: { filename?: string; filePath?: string; fileSize?: number; errorMessage?: string },
  ): Promise<void> {
    const updateData: any = { status };

    if (status === ReportStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (data) {
      Object.assign(updateData, data);
    }

    await this.prisma.report.update({
      where: { id: reportId },
      data: updateData,
    });
  }

  /**
   * Generate filename with timestamp
   */
  private generateFilename(title: string, extension: string): string {
    const sanitized = title
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
      .substring(0, 50);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `report_${sanitized}_${timestamp}.${extension}`;
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<ReportJobData>) {
    this.logger.log(`Report job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ReportJobData>, error: Error) {
    this.logger.error(`Report job ${job.id} failed: ${error.message}`);
  }
}
