import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import {
  SprintReportDto,
  SprintComparisonDto,
  SprintCompareResponseDto,
  MetricChangeDto,
} from './dto/sprint-report.dto';

/**
 * Service for sprint management
 */
@Injectable()
export class SprintsService {
  private readonly logger = new Logger(SprintsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new sprint
   */
  async create(dto: CreateSprintDto, organizationId: string) {
    // Verify team exists and belongs to organization
    const team = await this.prisma.team.findFirst({
      where: {
        id: dto.teamId,
        organizationId,
        isActive: true,
      },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Validate dates
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping sprints for the same team
    const overlappingSprint = await this.prisma.sprint.findFirst({
      where: {
        teamId: dto.teamId,
        isActive: true,
        OR: [
          {
            // New sprint starts during existing sprint
            startDate: { lte: startDate },
            endDate: { gt: startDate },
          },
          {
            // New sprint ends during existing sprint
            startDate: { lt: endDate },
            endDate: { gte: endDate },
          },
          {
            // New sprint contains existing sprint
            startDate: { gte: startDate },
            endDate: { lte: endDate },
          },
        ],
      },
    });

    if (overlappingSprint) {
      throw new ConflictException(
        `Sprint dates overlap with existing sprint "${overlappingSprint.name}"`,
      );
    }

    return this.prisma.sprint.create({
      data: {
        name: dto.name,
        startDate,
        endDate,
        organizationId,
        teamId: dto.teamId,
        isActive: true,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get all sprints for an organization
   */
  async findAll(organizationId: string, teamId?: string) {
    const where: any = {
      organizationId,
      isActive: true,
    };

    if (teamId) {
      where.teamId = teamId;
    }

    return this.prisma.sprint.findMany({
      where,
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Get sprint by ID
   */
  async findById(id: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: { leftAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    return sprint;
  }

  /**
   * Update sprint
   */
  async update(id: string, dto: UpdateSprintDto) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    // Handle date updates with overlap validation
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      const startDate = dto.startDate ? new Date(dto.startDate) : sprint.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : sprint.endDate;

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }

      // Check for overlapping sprints (excluding current sprint)
      const overlappingSprint = await this.prisma.sprint.findFirst({
        where: {
          id: { not: id },
          teamId: sprint.teamId,
          isActive: true,
          OR: [
            {
              startDate: { lte: startDate },
              endDate: { gt: startDate },
            },
            {
              startDate: { lt: endDate },
              endDate: { gte: endDate },
            },
            {
              startDate: { gte: startDate },
              endDate: { lte: endDate },
            },
          ],
        },
      });

      if (overlappingSprint) {
        throw new ConflictException(
          `Sprint dates overlap with existing sprint "${overlappingSprint.name}"`,
        );
      }

      if (dto.startDate !== undefined) {
        updateData.startDate = startDate;
      }
      if (dto.endDate !== undefined) {
        updateData.endDate = endDate;
      }
    }

    return this.prisma.sprint.update({
      where: { id },
      data: updateData,
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Delete sprint (soft delete)
   */
  async delete(id: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    return this.prisma.sprint.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Verify sprint access
   */
  async verifySprintAccess(sprintId: string, organizationId: string) {
    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        organizationId,
      },
    });

    if (!sprint) {
      throw new ForbiddenException('Access denied to this sprint');
    }

    return sprint;
  }

  /**
   * Check if sprint dates overlap with existing sprints
   * Used for property testing
   */
  async checkOverlap(
    teamId: string,
    startDate: Date,
    endDate: Date,
    excludeSprintId?: string,
  ): Promise<boolean> {
    const where: any = {
      teamId,
      isActive: true,
      OR: [
        {
          startDate: { lte: startDate },
          endDate: { gt: startDate },
        },
        {
          startDate: { lt: endDate },
          endDate: { gte: endDate },
        },
        {
          startDate: { gte: startDate },
          endDate: { lte: endDate },
        },
      ],
    };

    if (excludeSprintId) {
      where.id = { not: excludeSprintId };
    }

    const overlapping = await this.prisma.sprint.findFirst({ where });
    return !!overlapping;
  }

  /**
   * Generate sprint report
   *
   * @param sprintId - Sprint ID
   * @returns Sprint report with all metrics
   */
  async generateReport(sprintId: string): Promise<SprintReportDto> {
    this.logger.debug(`Generating report for sprint ${sprintId}`);

    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            memberships: {
              where: { leftAt: null },
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // Check if we have an existing report
    const existingReport = await this.prisma.sprintReport.findFirst({
      where: { sprintId },
      orderBy: { generatedAt: 'desc' },
    });

    // If sprint is still active, always generate fresh data
    const now = new Date();
    const isActive = sprint.startDate <= now && sprint.endDate >= now;

    if (existingReport && !isActive) {
      // Return existing report for completed sprints
      return this.formatReportResponse(existingReport);
    }

    // Calculate fresh metrics
    const metrics = await this.calculateSprintMetrics(sprint);

    // Store the report
    const report = await this.prisma.sprintReport.create({
      data: {
        sprintId,
        totalCommits: metrics.totalCommits,
        bugfixCommits: metrics.bugfixCommits,
        featureCommits: metrics.featureCommits,
        refactorCommits: metrics.refactorCommits,
        testCommits: metrics.testCommits,
        docsCommits: metrics.docsCommits,
        bugsIntroduced: metrics.bugsIntroduced,
        bugsFixed: metrics.bugsFixed,
        avgDQS: metrics.avgDQS,
        coveragePct: metrics.coveragePct,
      },
    });

    this.logger.log(`Generated report for sprint ${sprintId}`);

    return this.formatReportResponse(report);
  }

  /**
   * Calculate sprint metrics from commits and team data
   */
  private async calculateSprintMetrics(sprint: any) {
    const teamMemberIds = sprint.team.memberships.map((m: any) => m.userId);

    // Get all commits within the sprint date range from team members
    const commits = await this.prisma.commit.findMany({
      where: {
        developerId: { in: teamMemberIds },
        committedAt: {
          gte: sprint.startDate,
          lte: sprint.endDate,
        },
        repository: {
          organizationId: sprint.organizationId,
        },
      },
      select: {
        classification: true,
      },
    });

    // Calculate commit counts by classification
    const classificationCounts = this.calculateCommitClassificationCounts(commits);

    // Calculate bug metrics
    const bugMetrics = this.calculateBugMetrics(classificationCounts);

    // Calculate average DQS for team members
    const avgDQS = await this.calculateAverageDQS(teamMemberIds);

    // Calculate sprint coverage based on team projects
    const assignments = await this.prisma.teamProjectAssignment.findMany({
      where: {
        teamId: sprint.teamId,
      },
      select: { projectId: true },
    });

    const projectIds = assignments.map((a) => a.projectId);

    let coveragePct = 0;
    if (projectIds.length > 0) {
      const projectRepos = await this.prisma.projectRepository.findMany({
        where: { projectId: { in: projectIds } },
        select: { repositoryId: true },
      });

      const repositoryIds = [...new Set(projectRepos.map((r) => r.repositoryId))];

      if (repositoryIds.length > 0) {
        const latestReports = await Promise.all(
          repositoryIds.map((repositoryId) =>
            this.prisma.coverageReport.findFirst({
              where: {
                repositoryId,
                status: 'COMPLETED',
                createdAt: { lte: sprint.endDate },
              },
              orderBy: { createdAt: 'desc' },
              select: { coveragePercentage: true },
            }),
          ),
        );

        const validReports = latestReports.filter(
          (r) => r !== null && r.coveragePercentage !== null,
        );

        if (validReports.length > 0) {
          const sumCoverage = validReports.reduce((sum, r) => sum + (r?.coveragePercentage ?? 0), 0);
          coveragePct = Math.round((sumCoverage / validReports.length) * 100) / 100;
        }
      }
    }

    return {
      totalCommits: commits.length,
      ...classificationCounts,
      ...bugMetrics,
      avgDQS,
      coveragePct,
    };
  }

  /**
   * Calculate commit counts by classification
   */
  private calculateCommitClassificationCounts(commits: Array<{ classification: string | null }>) {
    const counts = {
      bugfixCommits: 0,
      featureCommits: 0,
      refactorCommits: 0,
      testCommits: 0,
      docsCommits: 0,
      unclassifiedCommits: 0,
    };

    for (const commit of commits) {
      switch (commit.classification) {
        case 'BUGFIX':
          counts.bugfixCommits++;
          break;
        case 'FEATURE':
          counts.featureCommits++;
          break;
        case 'REFACTOR':
          counts.refactorCommits++;
          break;
        case 'TEST':
          counts.testCommits++;
          break;
        case 'DOCS':
          counts.docsCommits++;
          break;
        default:
          counts.unclassifiedCommits++;
      }
    }

    return counts;
  }

  /**
   * Calculate bug metrics
   *
   * Note: Bugs introduced is estimated from the ratio of bugfix commits
   * (each bugfix indicates a bug that existed). Bugs fixed equals bugfix commits.
   */
  private calculateBugMetrics(classificationCounts: {
    bugfixCommits: number;
    featureCommits: number;
    refactorCommits: number;
    testCommits: number;
    docsCommits: number;
    unclassifiedCommits: number;
  }) {
    // Bugs fixed = number of bugfix commits
    const bugsFixed = classificationCounts.bugfixCommits;

    // Bugs introduced is estimated based on feature commits
    // Assumption: ~10% of feature commits introduce bugs that need fixing
    const bugsIntroduced = Math.round(classificationCounts.featureCommits * 0.1);

    return {
      bugsIntroduced,
      bugsFixed,
    };
  }

  /**
   * Calculate average DQS for team members
   */
  private async calculateAverageDQS(memberIds: string[]): Promise<number> {
    if (memberIds.length === 0) {
      return 0;
    }

    // Get latest DQS score for each team member
    const scores = await Promise.all(
      memberIds.map(async (userId) => {
        const latestScore = await this.prisma.dQSScore.findFirst({
          where: { developerId: userId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });
        return latestScore?.score ?? null;
      }),
    );

    // Filter out null scores and calculate average
    const validScores = scores.filter((s): s is number => s !== null);

    if (validScores.length === 0) {
      return 0;
    }

    const sum = validScores.reduce((acc, score) => acc + score, 0);
    return Math.round((sum / validScores.length) * 100) / 100;
  }

  /**
   * Format report response
   */
  private formatReportResponse(report: any): SprintReportDto {
    return {
      id: report.id,
      sprintId: report.sprintId,
      totalCommits: report.totalCommits,
      classificationBreakdown: {
        bugfix: report.bugfixCommits,
        feature: report.featureCommits,
        refactor: report.refactorCommits,
        test: report.testCommits,
        docs: report.docsCommits,
        unclassified:
          report.totalCommits -
          report.bugfixCommits -
          report.featureCommits -
          report.refactorCommits -
          report.testCommits -
          report.docsCommits,
      },
      bugMetrics: {
        bugsIntroduced: report.bugsIntroduced,
        bugsFixed: report.bugsFixed,
        bugDebt: report.bugsIntroduced - report.bugsFixed,
      },
      qualityMetrics: {
        avgDQS: report.avgDQS,
        coveragePct: report.coveragePct,
      },
      generatedAt: report.generatedAt,
    };
  }

  /**
   * Compare multiple sprints
   *
   * @param sprintIds - Array of sprint IDs to compare
   * @param organizationId - Organization ID for access verification
   * @returns Sprint comparison with metrics and changes
   */
  async compareSprints(
    sprintIds: string[],
    organizationId: string,
  ): Promise<SprintCompareResponseDto> {
    if (sprintIds.length < 2) {
      throw new BadRequestException('At least 2 sprints are required for comparison');
    }

    if (sprintIds.length > 5) {
      throw new BadRequestException('Maximum 5 sprints can be compared at once');
    }

    // Verify all sprints exist and belong to the organization
    const sprints = await this.prisma.sprint.findMany({
      where: {
        id: { in: sprintIds },
        organizationId,
      },
      orderBy: { startDate: 'asc' },
    });

    if (sprints.length !== sprintIds.length) {
      throw new NotFoundException('One or more sprints not found');
    }

    // Get or generate reports for each sprint
    const sprintComparisons: SprintComparisonDto[] = await Promise.all(
      sprints.map(async (sprint) => {
        const report = await this.getOrGenerateReport(sprint.id);
        return {
          sprintId: sprint.id,
          sprintName: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          totalCommits: report.totalCommits,
          bugfixCommits: report.classificationBreakdown.bugfix,
          featureCommits: report.classificationBreakdown.feature,
          bugsIntroduced: report.bugMetrics.bugsIntroduced,
          bugsFixed: report.bugMetrics.bugsFixed,
          avgDQS: report.qualityMetrics.avgDQS,
          coveragePct: report.qualityMetrics.coveragePct,
        };
      }),
    );

    const response: SprintCompareResponseDto = {
      sprints: sprintComparisons,
    };

    // Calculate changes if comparing exactly 2 sprints
    if (sprintComparisons.length === 2) {
      const [previous, current] = sprintComparisons;
      response.changes = {
        totalCommits: this.calculateMetricChange(current.totalCommits, previous.totalCommits, true),
        bugfixCommits: this.calculateMetricChange(
          current.bugfixCommits,
          previous.bugfixCommits,
          false, // More bugfixes might indicate more bugs
        ),
        featureCommits: this.calculateMetricChange(
          current.featureCommits,
          previous.featureCommits,
          true,
        ),
        bugsIntroduced: this.calculateMetricChange(
          current.bugsIntroduced,
          previous.bugsIntroduced,
          false, // Less bugs introduced is better
        ),
        bugsFixed: this.calculateMetricChange(
          current.bugsFixed,
          previous.bugsFixed,
          true, // More bugs fixed is better
        ),
        avgDQS: this.calculateMetricChange(current.avgDQS, previous.avgDQS, true),
        coveragePct: this.calculateMetricChange(current.coveragePct, previous.coveragePct, true),
      };
    }

    return response;
  }

  /**
   * Get existing report or generate new one
   */
  private async getOrGenerateReport(sprintId: string): Promise<SprintReportDto> {
    const existingReport = await this.prisma.sprintReport.findFirst({
      where: { sprintId },
      orderBy: { generatedAt: 'desc' },
    });

    if (existingReport) {
      return this.formatReportResponse(existingReport);
    }

    return this.generateReport(sprintId);
  }

  /**
   * Calculate metric change between two values
   */
  private calculateMetricChange(
    current: number,
    previous: number,
    higherIsBetter: boolean,
  ): MetricChangeDto {
    const diff = current - previous;
    let changePercent = 0;

    if (previous !== 0) {
      changePercent = Math.round((diff / previous) * 100 * 100) / 100;
    } else if (current !== 0) {
      changePercent = 100; // From 0 to something is 100% increase
    }

    let direction: 'up' | 'down' | 'unchanged';
    if (diff > 0) {
      direction = 'up';
    } else if (diff < 0) {
      direction = 'down';
    } else {
      direction = 'unchanged';
    }

    // Determine if the change is positive (green) or negative (red)
    let isPositive: boolean;
    if (direction === 'unchanged') {
      isPositive = true;
    } else if (higherIsBetter) {
      isPositive = direction === 'up';
    } else {
      isPositive = direction === 'down';
    }

    return {
      current,
      previous,
      changePercent,
      direction,
      isPositive,
    };
  }

  // ==================== NEW FEATURES ====================

  /**
   * Get sprint velocity trend across multiple sprints
   * Feature 1: Sprint Velocity Chart
   */
  async getVelocityTrend(organizationId: string, teamId?: string, limit = 10) {
    const where: any = {
      organizationId,
      isActive: true,
    };
    if (teamId) where.teamId = teamId;

    const sprints = await this.prisma.sprint.findMany({
      where,
      orderBy: { startDate: 'desc' },
      take: limit,
      include: {
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    const velocityData = sprints.reverse().map((sprint) => {
      const report = sprint.reports[0];
      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        totalCommits: report?.totalCommits || 0,
        featureCommits: report?.featureCommits || 0,
        avgDQS: report?.avgDQS || 0,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      };
    });

    const velocities = velocityData.map((d) => d.totalCommits);
    const avgVelocity =
      velocities.length > 0
        ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length)
        : 0;

    // Calculate trend
    let velocityTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (velocities.length >= 3) {
      const recent = velocities.slice(-3);
      const older = velocities.slice(0, -3);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg =
        older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

      if (recentAvg > olderAvg * 1.1) velocityTrend = 'increasing';
      else if (recentAvg < olderAvg * 0.9) velocityTrend = 'decreasing';
    }

    // Simple prediction based on moving average
    const predictedNextVelocity =
      velocities.length >= 3
        ? Math.round(velocities.slice(-3).reduce((a, b) => a + b, 0) / 3)
        : avgVelocity;

    return {
      sprints: velocityData,
      avgVelocity,
      velocityTrend,
      predictedNextVelocity,
    };
  }

  /**
   * Get sprint burndown data
   * Feature 2: Sprint Burndown/Burnup Chart
   */
  async getBurndown(sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            memberships: {
              where: { leftAt: null },
              select: { userId: true },
            },
          },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const teamMemberIds = sprint.team.memberships.map((m) => m.userId);
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const now = new Date();
    const currentDate = now < endDate ? now : endDate;

    // Get commits per day
    const commits = await this.prisma.commit.findMany({
      where: {
        developerId: { in: teamMemberIds },
        committedAt: {
          gte: startDate,
          lte: currentDate,
        },
        repository: {
          organizationId: sprint.organizationId,
        },
      },
      select: {
        committedAt: true,
      },
      orderBy: { committedAt: 'asc' },
    });

    // Calculate total days and ideal burndown
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalWork = sprint.reports[0]?.totalCommits || commits.length || 100; // Estimate if no report

    // Group commits by day
    const commitsByDay: Record<string, number> = {};
    for (const commit of commits) {
      const dateKey = commit.committedAt.toISOString().split('T')[0];
      commitsByDay[dateKey] = (commitsByDay[dateKey] || 0) + 1;
    }

    // Generate burndown data
    const burndownData: Array<{
      date: string;
      idealRemaining: number;
      actualRemaining: number;
      completed: number;
    }> = [];

    let completedSoFar = 0;
    const currentDateObj = new Date(startDate);

    while (currentDateObj <= currentDate) {
      const dateKey = currentDateObj.toISOString().split('T')[0];
      const dayNumber = Math.ceil(
        (currentDateObj.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      completedSoFar += commitsByDay[dateKey] || 0;
      const idealRemaining = Math.max(0, totalWork - (totalWork / totalDays) * dayNumber);
      const actualRemaining = Math.max(0, totalWork - completedSoFar);

      burndownData.push({
        date: dateKey,
        idealRemaining: Math.round(idealRemaining),
        actualRemaining,
        completed: completedSoFar,
      });

      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }

    // Calculate if on track
    const lastData = burndownData[burndownData.length - 1];
    const isOnTrack = lastData ? lastData.actualRemaining <= lastData.idealRemaining : true;

    // Project completion date
    let projectedCompletion: string | null = null;
    if (burndownData.length >= 2 && lastData && lastData.actualRemaining > 0) {
      const avgDailyCompletion = completedSoFar / burndownData.length;
      if (avgDailyCompletion > 0) {
        const daysToComplete = Math.ceil(lastData.actualRemaining / avgDailyCompletion);
        const projectedDate = new Date(currentDate);
        projectedDate.setDate(projectedDate.getDate() + daysToComplete);
        projectedCompletion = projectedDate.toISOString().split('T')[0];
      }
    }

    return {
      sprintId,
      totalWork,
      completedWork: completedSoFar,
      remainingWork: totalWork - completedSoFar,
      burndownData,
      projectedCompletion,
      isOnTrack,
    };
  }

  /**
   * Get sprint health indicators
   * Feature 4: Sprint Health Indicators
   */
  async getSprintHealth(sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            memberships: {
              where: { leftAt: null },
              select: { userId: true },
            },
          },
        },
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const teamMemberIds = sprint.team.memberships.map((m) => m.userId);
    const report = sprint.reports[0];

    // Calculate indicators
    const bugIntroductionRate = report
      ? (report.bugsIntroduced / Math.max(report.totalCommits, 1)) * 100
      : 0;

    const dqsTrend = report?.avgDQS || 0;

    // Get review turnaround for team
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewerId: { in: teamMemberIds },
        submittedAt: {
          gte: sprint.startDate,
          lte: sprint.endDate,
        },
      },
      select: { turnaroundMinutes: true },
    });

    const avgReviewTurnaround =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.turnaroundMinutes || 0), 0) / reviews.length
        : 0;

    // Get code churn
    const commits = await this.prisma.commit.findMany({
      where: {
        developerId: { in: teamMemberIds },
        committedAt: {
          gte: sprint.startDate,
          lte: sprint.endDate,
        },
      },
      select: { linesAdded: true, linesDeleted: true },
    });

    const totalLines = commits.reduce((sum, c) => sum + c.linesAdded + c.linesDeleted, 0);
    const codeChurn = commits.length > 0 ? totalLines / commits.length : 0;

    // Commit frequency (commits per day)
    const sprintDays = Math.ceil(
      (sprint.endDate.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const commitFrequency = sprintDays > 0 ? commits.length / sprintDays : 0;

    // Determine status for each indicator
    const getStatus = (
      value: number,
      thresholds: { good: number; warning: number },
      inverse = false,
    ) => {
      if (inverse) {
        if (value <= thresholds.good) return 'good' as const;
        if (value <= thresholds.warning) return 'warning' as const;
        return 'critical' as const;
      }
      if (value >= thresholds.good) return 'good' as const;
      if (value >= thresholds.warning) return 'warning' as const;
      return 'critical' as const;
    };

    const indicators = {
      bugIntroductionRate: {
        value: Math.round(bugIntroductionRate * 100) / 100,
        status: getStatus(bugIntroductionRate, { good: 5, warning: 15 }, true),
      },
      dqsTrend: {
        value: dqsTrend,
        status: getStatus(dqsTrend, { good: 80, warning: 60 }),
      },
      reviewTurnaround: {
        value: Math.round(avgReviewTurnaround),
        status: getStatus(avgReviewTurnaround, { good: 240, warning: 480 }, true), // 4h good, 8h warning
      },
      codeChurn: {
        value: Math.round(codeChurn),
        status: getStatus(codeChurn, { good: 200, warning: 500 }, true),
      },
      commitFrequency: {
        value: Math.round(commitFrequency * 10) / 10,
        status: getStatus(commitFrequency, { good: 2, warning: 1 }),
      },
    };

    // Calculate overall health score
    const statusScores = { good: 100, warning: 50, critical: 0 };
    const healthScore = Math.round(
      Object.values(indicators).reduce((sum, ind) => sum + statusScores[ind.status], 0) / 5,
    );

    const overallHealth =
      healthScore >= 70 ? 'healthy' : healthScore >= 40 ? 'at_risk' : 'critical';

    // Generate recommendations
    const recommendations: string[] = [];
    if (indicators.bugIntroductionRate.status !== 'good') {
      recommendations.push('Consider adding more code reviews to reduce bug introduction rate');
    }
    if (indicators.dqsTrend.status !== 'good') {
      recommendations.push('Focus on code quality practices to improve DQS scores');
    }
    if (indicators.reviewTurnaround.status !== 'good') {
      recommendations.push('Review turnaround time is high - consider distributing review load');
    }
    if (indicators.codeChurn.status !== 'good') {
      recommendations.push(
        'High code churn detected - ensure requirements are clear before coding',
      );
    }
    if (indicators.commitFrequency.status !== 'good') {
      recommendations.push('Commit frequency is low - encourage smaller, more frequent commits');
    }

    return {
      sprintId,
      overallHealth,
      healthScore,
      indicators,
      recommendations,
    };
  }

  /**
   * Get developer contributions for a sprint
   * Feature 6: Developer Contribution Breakdown
   */
  async getDeveloperContributions(sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            memberships: {
              where: { leftAt: null },
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const contributions = await Promise.all(
      sprint.team.memberships.map(async (membership) => {
        const userId = membership.userId;

        // Get commits
        const commits = await this.prisma.commit.findMany({
          where: {
            developerId: userId,
            committedAt: {
              gte: sprint.startDate,
              lte: sprint.endDate,
            },
            repository: { organizationId: sprint.organizationId },
          },
          select: {
            classification: true,
            linesAdded: true,
            linesDeleted: true,
          },
        });

        // Get reviews given
        const reviewsGiven = await this.prisma.review.count({
          where: {
            reviewerId: userId,
            submittedAt: {
              gte: sprint.startDate,
              lte: sprint.endDate,
            },
          },
        });

        // Get reviews received (on their PRs)
        // Note: This is simplified - in real implementation, you'd track PR authors
        const reviewsReceived = 0;

        // Get latest DQS
        const latestDQS = await this.prisma.dQSScore.findFirst({
          where: { developerId: userId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        const featureCommits = commits.filter((c) => c.classification === 'FEATURE').length;
        const bugfixCommits = commits.filter((c) => c.classification === 'BUGFIX').length;
        const linesAdded = commits.reduce((sum, c) => sum + c.linesAdded, 0);
        const linesDeleted = commits.reduce((sum, c) => sum + c.linesDeleted, 0);

        return {
          developerId: userId,
          developerName: membership.user.name,
          avatarUrl: membership.user.avatarUrl,
          totalCommits: commits.length,
          featureCommits,
          bugfixCommits,
          reviewsGiven,
          reviewsReceived,
          avgDQS: latestDQS?.score || 0,
          linesAdded,
          linesDeleted,
        };
      }),
    );

    const totalCommits = contributions.reduce((sum, c) => sum + c.totalCommits, 0);
    const totalReviews = contributions.reduce((sum, c) => sum + c.reviewsGiven, 0);

    return {
      sprintId,
      contributions: contributions.sort((a, b) => b.totalCommits - a.totalCommits),
      totalCommits,
      totalReviews,
    };
  }

  /**
   * Get sprint timeline for Gantt view
   * Feature 7: Sprint Timeline/Gantt View
   */
  async getSprintTimeline(organizationId: string, months = 3) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const sprints = await this.prisma.sprint.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { startDate: { gte: startDate, lte: endDate } },
          { endDate: { gte: startDate, lte: endDate } },
          { startDate: { lte: startDate }, endDate: { gte: endDate } },
        ],
      },
      include: {
        team: { select: { id: true, name: true } },
        reports: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
      orderBy: { startDate: 'asc' },
    });

    // Get unique teams with colors
    const teamColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    const teamsMap = new Map<string, { id: string; name: string; color: string }>();

    sprints.forEach((sprint, index) => {
      if (!teamsMap.has(sprint.teamId)) {
        teamsMap.set(sprint.teamId, {
          id: sprint.teamId,
          name: sprint.team.name,
          color: teamColors[teamsMap.size % teamColors.length],
        });
      }
    });

    const now = new Date();
    const timelineSprints = sprints.map((sprint) => {
      const isActive = sprint.startDate <= now && sprint.endDate >= now;
      const isCompleted = sprint.endDate < now;

      // Calculate progress
      let progress = 0;
      if (isCompleted) {
        progress = 100;
      } else if (isActive) {
        const totalDuration = sprint.endDate.getTime() - sprint.startDate.getTime();
        const elapsed = now.getTime() - sprint.startDate.getTime();
        progress = Math.round((elapsed / totalDuration) * 100);
      }

      return {
        id: sprint.id,
        name: sprint.name,
        teamId: sprint.teamId,
        teamName: sprint.team.name,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: isActive ? 'active' : isCompleted ? 'completed' : 'planned',
        progress,
        avgDQS: sprint.reports[0]?.avgDQS || 0,
      };
    });

    return {
      sprints: timelineSprints,
      teams: Array.from(teamsMap.values()),
      dateRange: { start: startDate, end: endDate },
    };
  }

  // ==================== SPRINT GOALS ====================

  /**
   * Create a sprint goal
   * Feature 5: Sprint Goals/Targets
   */
  async createGoal(
    sprintId: string,
    dto: { title: string; description?: string; metricType: string; targetValue: number },
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException('Sprint not found');

    return this.prisma.sprintGoal.create({
      data: {
        sprintId,
        title: dto.title,
        description: dto.description,
        metricType: dto.metricType as any,
        targetValue: dto.targetValue,
      },
    });
  }

  /**
   * Get sprint goals with current progress
   */
  async getGoals(sprintId: string) {
    const goals = await this.prisma.sprintGoal.findMany({
      where: { sprintId },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate current values for each goal
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            memberships: { where: { leftAt: null }, select: { userId: true } },
          },
        },
        reports: { orderBy: { generatedAt: 'desc' }, take: 1 },
      },
    });

    if (!sprint) return [];

    const report = sprint.reports[0];

    return goals.map((goal) => {
        let currentValue = goal.currentValue;

        // Calculate current value based on metric type
        switch (goal.metricType) {
          case 'DQS':
            currentValue = report?.avgDQS || 0;
            break;
          case 'COMMITS':
            currentValue = report?.totalCommits || 0;
            break;
          case 'BUGS_FIXED':
            currentValue = report?.bugsFixed || 0;
            break;
          case 'FEATURE_COMMITS':
            currentValue = report?.featureCommits || 0;
            break;
          case 'COVERAGE':
            currentValue = report?.coveragePct || 0;
            break;
        }

        const progress =
          goal.targetValue > 0
            ? Math.min(100, Math.round((currentValue / goal.targetValue) * 100))
            : 0;

        const status = progress >= 100 ? 'ACHIEVED' : progress > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';

        return {
          id: goal.id,
          sprintId: goal.sprintId,
          title: goal.title,
          description: goal.description,
          metricType: goal.metricType,
          targetValue: goal.targetValue,
          currentValue,
          progress,
          status,
        };
      });
  }

  /**
   * Delete a sprint goal
   */
  async deleteGoal(goalId: string) {
    return this.prisma.sprintGoal.delete({ where: { id: goalId } });
  }

  // ==================== RETROSPECTIVES ====================

  /**
   * Create or update sprint retrospective
   * Feature 9: Sprint Retrospective Notes
   */
  async upsertRetrospective(
    sprintId: string,
    dto: {
      wentWell?: string[];
      needsImprovement?: string[];
      actionItems?: string[];
      notes?: string;
    },
  ) {
    const sprint = await this.prisma.sprint.findUnique({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException('Sprint not found');

    return this.prisma.sprintRetrospective.upsert({
      where: { sprintId },
      create: {
        sprintId,
        wentWell: dto.wentWell || [],
        needsImprovement: dto.needsImprovement || [],
        actionItems: dto.actionItems || [],
        notes: dto.notes,
      },
      update: {
        wentWell: dto.wentWell,
        needsImprovement: dto.needsImprovement,
        actionItems: dto.actionItems,
        notes: dto.notes,
      },
    });
  }

  /**
   * Get sprint retrospective
   */
  async getRetrospective(sprintId: string) {
    return this.prisma.sprintRetrospective.findUnique({
      where: { sprintId },
    });
  }

  // ==================== CARRY-OVERS ====================

  /**
   * Create a carry-over item
   * Feature 10: Sprint Carry-over Tracking
   */
  async createCarryOver(
    fromSprintId: string,
    dto: { toSprintId: string; description: string; reason?: string },
  ) {
    const [fromSprint, toSprint] = await Promise.all([
      this.prisma.sprint.findUnique({ where: { id: fromSprintId } }),
      this.prisma.sprint.findUnique({ where: { id: dto.toSprintId } }),
    ]);

    if (!fromSprint) throw new NotFoundException('Source sprint not found');
    if (!toSprint) throw new NotFoundException('Target sprint not found');

    return this.prisma.sprintCarryOver.create({
      data: {
        fromSprintId,
        toSprintId: dto.toSprintId,
        description: dto.description,
        reason: dto.reason,
      },
      include: {
        fromSprint: { select: { name: true } },
        toSprint: { select: { name: true } },
      },
    });
  }

  /**
   * Get carry-overs for a sprint
   */
  async getCarryOvers(sprintId: string) {
    const [carryOversFrom, carryOversTo] = await Promise.all([
      this.prisma.sprintCarryOver.findMany({
        where: { fromSprintId: sprintId },
        include: {
          toSprint: { select: { id: true, name: true } },
        },
      }),
      this.prisma.sprintCarryOver.findMany({
        where: { toSprintId: sprintId },
        include: {
          fromSprint: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      carriedOut: carryOversFrom.map((c) => ({
        id: c.id,
        fromSprintId: c.fromSprintId,
        fromSprintName: 'Current Sprint',
        toSprintId: c.toSprintId,
        toSprintName: c.toSprint.name,
        description: c.description,
        reason: c.reason,
        createdAt: c.createdAt,
      })),
      carriedIn: carryOversTo.map((c) => ({
        id: c.id,
        fromSprintId: c.fromSprintId,
        fromSprintName: c.fromSprint.name,
        toSprintId: c.toSprintId,
        toSprintName: 'Current Sprint',
        description: c.description,
        reason: c.reason,
        createdAt: c.createdAt,
      })),
    };
  }

  /**
   * Delete a carry-over item
   */
  async deleteCarryOver(carryOverId: string) {
    return this.prisma.sprintCarryOver.delete({ where: { id: carryOverId } });
  }
}
