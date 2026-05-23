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
    const { reportId, type, scope } = job.data;
    this.logger.log(`Processing report generation job: ${reportId}`);

    try {
      // Update status to processing
      await this.updateReportStatus(reportId, ReportStatus.PROCESSING);

      // Gather report data based on scope
      const reportData = await this.gatherReportData(job.data);

      // Generate file based on type
      let fileBuffer: Buffer;
      let filename: string;

      if (type === ReportType.PDF) {
        // Use the enhanced PDF generator service
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
    const { scope, organizationId, teamId, projectId, developerId, startDate, endDate } = jobData;
    const start = new Date(startDate);
    const end = new Date(endDate);

    const baseData = {
      title: '',
      organizationName: '',
      dateRange: { start, end },
      generatedAt: new Date(),
      developers: [] as any[],
      summary: {
        totalCommits: 0,
        totalDevelopers: 0,
        avgDQS: 0,
        totalBugfixes: 0,
        totalFeatures: 0,
      },
    };

    // Get organization name
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });
    baseData.organizationName = org?.name || 'Unknown';

    switch (scope) {
      case ReportScope.ORGANIZATION:
        return this.gatherOrganizationData(baseData, organizationId, start, end);
      case ReportScope.TEAM:
        return this.gatherTeamData(baseData, teamId!, start, end);
      case ReportScope.PROJECT:
        return this.gatherProjectData(baseData, projectId!, start, end);
      case ReportScope.DEVELOPER:
        return this.gatherDeveloperData(baseData, developerId!, start, end);
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
  ) {
    baseData.title = `Organization Report - ${baseData.organizationName}`;

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
        this.getDeveloperMetrics(m.user.id, m.user.name, m.user.email, start, end),
      ),
    );

    baseData.developers = developerData.filter((d) => d.totalCommits > 0);
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
  }

  /**
   * Gather team-specific report data
   */
  private async gatherTeamData(baseData: any, teamId: string, start: Date, end: Date) {
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

    baseData.title = `Team Report - ${team?.name || 'Unknown'}`;
    baseData.teamName = team?.name;

    const developerData = await Promise.all(
      (team?.memberships || []).map((m) =>
        this.getDeveloperMetrics(m.user.id, m.user.name, m.user.email, start, end),
      ),
    );

    baseData.developers = developerData.filter((d) => d.totalCommits > 0);
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

    baseData.title = `Project Report - ${project?.name || 'Unknown'}`;
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
          linesAdded: 0,
          linesDeleted: 0,
          dqsScore: null,
        });
      }
      const dev = developerMap.get(devId)!;
      dev.totalCommits++;
      if (commit.classification === 'BUGFIX') dev.bugfixCommits++;
      if (commit.classification === 'FEATURE') dev.featureCommits++;
      dev.linesAdded += commit.linesAdded || 0;
      dev.linesDeleted += commit.linesDeleted || 0;
    }

    // Get DQS scores
    for (const [devId, dev] of developerMap) {
      const dqs = await this.prisma.dQSScore.findFirst({
        where: { developerId: devId },
        orderBy: { calculatedAt: 'desc' },
        select: { score: true },
      });
      dev.dqsScore = dqs?.score ?? null;
    }

    baseData.developers = Array.from(developerMap.values());
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
  }

  /**
   * Gather individual developer report data
   */
  private async gatherDeveloperData(baseData: any, developerId: string, start: Date, end: Date) {
    const user = await this.prisma.user.findUnique({
      where: { id: developerId },
      select: { id: true, name: true, email: true },
    });

    baseData.title = `Developer Report - ${user?.name || 'Unknown'}`;

    const developerMetrics = await this.getDeveloperMetrics(
      developerId,
      user?.name || 'Unknown',
      user?.email || '',
      start,
      end,
    );

    baseData.developers = [developerMetrics];
    baseData.summary = this.calculateSummary(baseData.developers);

    return baseData;
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
  ) {
    const commits = await this.prisma.commit.findMany({
      where: {
        developerId,
        committedAt: { gte: start, lte: end },
      },
      select: {
        classification: true,
        linesAdded: true,
        linesDeleted: true,
      },
    });

    const dqs = await this.prisma.dQSScore.findFirst({
      where: { developerId },
      orderBy: { calculatedAt: 'desc' },
      select: { score: true },
    });

    const reviews = await this.prisma.review.count({
      where: {
        reviewerId: developerId,
        submittedAt: { gte: start, lte: end },
      },
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
      dqsScore: dqs?.score ?? null,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(developers: any[]) {
    const totalCommits = developers.reduce((sum, d) => sum + d.totalCommits, 0);
    const totalBugfixes = developers.reduce((sum, d) => sum + d.bugfixCommits, 0);
    const totalFeatures = developers.reduce((sum, d) => sum + d.featureCommits, 0);
    const validScores = developers.filter((d) => d.dqsScore !== null);
    const avgDQS =
      validScores.length > 0
        ? validScores.reduce((sum, d) => sum + d.dqsScore, 0) / validScores.length
        : 0;

    return {
      totalCommits,
      totalDevelopers: developers.length,
      avgDQS: Math.round(avgDQS * 100) / 100,
      totalBugfixes,
      totalFeatures,
    };
  }

  /**
   * Generate CSV report
   */
  private generateCsvReport(data: any): string {
    const metadata = [
      [data.title],
      ['Organization', data.organizationName],
      ['Start Date', this.formatDate(data.dateRange.start)],
      ['End Date', this.formatDate(data.dateRange.end)],
      ['Generated', this.formatDate(data.generatedAt)],
      [],
      ['Summary'],
      ['Total Developers', data.summary.totalDevelopers],
      ['Total Commits', data.summary.totalCommits],
      ['Average DQS', data.summary.avgDQS.toFixed(1)],
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
