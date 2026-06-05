import { Injectable, Logger, Inject, forwardRef, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma';
import { GitHubService } from '../github/github.service';
import { GitHubApiService } from '../github/services/github-api.service';
import { MlClientService } from './services';
import { ScoresService } from '../scores/scores.service';
import { DebtService } from '../debt/debt.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { AlertsService } from '../alerts/alerts.service';
import { ParsedCommitData } from '../github/dto/webhook-payload.dto';
import { ProcessedCommitResult, FileChangeData, GitHubCommitDetail } from './types';
import { parseFileChanges, calculateCommitChurnRatio } from './utils';
import { CommitFiltersDto, CommitStatsQueryDto, HeatmapQueryDto } from './dto';
import { Prisma, CommitClassification, MilestoneType } from '@prisma/client';

/**
 * Service for processing and storing commit data
 */
@Injectable()
export class CommitsService {
  private readonly logger = new Logger(CommitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => GitHubService))
    private readonly githubService: GitHubService,
    @Inject(forwardRef(() => GitHubApiService))
    private readonly githubApiService: GitHubApiService,
    private readonly mlClientService: MlClientService,
    @Inject(forwardRef(() => ScoresService))
    private readonly scoresService: ScoresService,
    @Inject(forwardRef(() => DebtService))
    private readonly debtService: DebtService,
    @Inject(forwardRef(() => OnboardingService))
    private readonly onboardingService: OnboardingService,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
  ) {}

  /**
   * Process a commit from webhook data
   *
   * @param commit - Parsed commit data from webhook
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @returns Processed commit result
   */
  async processCommit(
    commit: ParsedCommitData,
    repositoryId: string,
    organizationId: string,
  ): Promise<ProcessedCommitResult> {
    this.logger.debug(`Processing commit ${commit.sha}`);

    // Check if commit already exists
    const existingCommit = await this.prisma.commit.findUnique({
      where: {
        repositoryId_sha: {
          repositoryId,
          sha: commit.sha,
        },
      },
    });

    if (existingCommit) {
      this.logger.debug(`Commit ${commit.sha} already exists, skipping`);
      return this.mapCommitToResult(existingCommit, []);
    }

    // Fetch detailed commit information from GitHub API
    const commitDetail = await this.fetchCommitDetail(
      organizationId,
      commit.repositoryFullName,
      commit.sha,
    );

    // Parse file changes and calculate churn ratios
    const fileChanges = parseFileChanges(commitDetail.files);

    // Calculate overall commit churn ratio
    const churnRatio = calculateCommitChurnRatio(
      commitDetail.stats.additions,
      commitDetail.stats.deletions,
    );

    // Attempt developer attribution
    const developerId = await this.attributeDeveloper(
      commit.authorEmail,
      commit.authorName,
      organizationId,
    );

    // Classify the commit using ML service
    const classification = await this.classifyCommit(
      commit.message,
      commitDetail.files.map((f) => f.filename),
      commitDetail.stats.additions,
      commitDetail.stats.deletions,
    );

    // Detect anomaly using ML service
    const anomalyResult = await this.detectAnomaly(
      commit.sha,
      commitDetail.stats.additions + commitDetail.stats.deletions,
      commitDetail.files.length,
      commit.timestamp,
      churnRatio,
    );

    // Store commit and file changes in database
    const savedCommit = await this.prisma.commit.create({
      data: {
        repositoryId,
        developerId,
        sha: commit.sha,
        message: commit.message,
        authorEmail: commit.authorEmail,
        authorName: commit.authorName,
        classification,
        linesAdded: commitDetail.stats.additions,
        linesDeleted: commitDetail.stats.deletions,
        filesChanged: commitDetail.files.length,
        churnRatio,
        anomalyFlag: anomalyResult?.is_anomaly ?? false,
        anomalyScore: anomalyResult?.anomaly_score ?? null,
        committedAt: commit.timestamp,
        fileChanges: {
          create: fileChanges.map((fc) => ({
            filePath: fc.filePath,
            additions: fc.additions,
            deletions: fc.deletions,
            churnRatio: fc.churnRatio,
          })),
        },
      },
      include: {
        fileChanges: true,
      },
    });

    // Run incremental AST cache update on FastAPI asynchronously
    this.scoresService
      .handleIncrementalASTUpdate(repositoryId, organizationId, {
        sha: commit.sha,
        files: commitDetail.files.map((f) => ({
          filename: f.filename,
          status: f.status,
          previous_filename: f.previous_filename,
        })),
      })
      .catch((err) => {
        this.logger.warn(`Failed to run incremental AST cache update: ${err}`);
      });

    // Create alert on anomaly detection
    if (anomalyResult?.is_anomaly) {
      this.logger.warn(
        `Anomaly detected in commit ${commit.sha}: score=${anomalyResult.anomaly_score}, severity=${anomalyResult.severity}`,
      );

      // Create alert with commit context
      await this.createAnomalyAlert(
        organizationId,
        savedCommit.id,
        commit.sha,
        anomalyResult.anomaly_score,
        anomalyResult.severity,
        anomalyResult.model_version,
      );
    }

    this.logger.log(
      `Stored commit ${commit.sha}: ${savedCommit.filesChanged} files, ` +
        `${savedCommit.linesAdded}+ ${savedCommit.linesDeleted}-, ` +
        `churn=${churnRatio.toFixed(3)}${anomalyResult?.is_anomaly ? ', ANOMALY' : ''}`,
    );

    // Scan for technical debt markers in the commit
    await this.scanCommitForDebt(savedCommit.id, repositoryId, developerId, commitDetail.files);

    // Trigger score recalculation on new commits
    await this.triggerScoreRecalculation(savedCommit.id, repositoryId, developerId, organizationId);

    // Track onboarding milestones for the developer
    if (developerId) {
      await this.trackOnboardingMilestones(developerId, classification);
    }

    // Publish commit:new event for real-time updates
    this.publishCommitProcessedEvent(
      savedCommit.id,
      commit.sha,
      repositoryId,
      organizationId,
      developerId ?? undefined,
      commit.authorName,
      commit.authorEmail,
      classification,
      commit.message,
      commit.timestamp,
    );

    return this.mapCommitToResult(savedCommit, fileChanges);
  }

  /**
   * Publish commit.processed event for WebSocket real-time updates
   *
   * @param commitId - The commit ID
   * @param sha - The commit SHA
   * @param repositoryId - The repository ID
   * @param organizationId - The organization ID
   * @param developerId - The developer ID (optional, may be null for unmapped commits)
   * @param authorName - The commit author name
   * @param authorEmail - The commit author email
   * @param classification - The commit classification
   * @param message - The commit message
   * @param timestamp - The commit timestamp
   */
  private publishCommitProcessedEvent(
    commitId: string,
    sha: string,
    repositoryId: string,
    organizationId: string,
    developerId: string | undefined,
    authorName: string,
    authorEmail: string,
    classification: CommitClassification | null,
    message: string,
    timestamp: Date,
  ): void {
    this.eventEmitter.emit('commit.processed', {
      commitId,
      sha,
      repositoryId,
      organizationId,
      developerId,
      authorName,
      authorEmail,
      classification: classification || null,
      message,
      timestamp,
    });

    this.logger.debug(`Published commit.processed event for ${sha}`);
  }

  /**
   * Track onboarding milestones based on commit classification
   *
   * @param developerId - The developer ID
   * @param classification - The commit classification
   */
  private async trackOnboardingMilestones(
    developerId: string,
    classification: CommitClassification | null,
  ): Promise<void> {
    try {
      // Always record FIRST_COMMIT milestone
      await this.onboardingService.recordMilestone(developerId, MilestoneType.FIRST_COMMIT);

      // Record classification-specific milestones
      if (classification === CommitClassification.BUGFIX) {
        await this.onboardingService.recordMilestone(developerId, MilestoneType.FIRST_BUGFIX);
      } else if (classification === CommitClassification.FEATURE) {
        await this.onboardingService.recordMilestone(developerId, MilestoneType.FIRST_FEATURE);
      }
    } catch (error) {
      // Log but don't fail commit processing if milestone tracking fails
      this.logger.warn(
        `Failed to track onboarding milestones for developer ${developerId}: ${error}`,
      );
    }
  }

  /**
   * Create an alert when anomaly is detected in commit processing
   *
   * @param organizationId - Organization ID
   * @param commitId - Commit ID that triggered the anomaly
   * @param commitSha - Commit SHA for message context
   * @param anomalyScore - Anomaly score from ML service (0-1)
   * @param severity - Severity level from ML service
   */
  private async createAnomalyAlert(
    organizationId: string,
    commitId: string,
    commitSha: string,
    anomalyScore: number,
    severity: string,
    modelVersion?: string,
  ): Promise<void> {
    try {
      await this.alertsService.createAnomalyAlert({
        organizationId,
        commitId,
        commitSha,
        anomalyScore,
        severity,
        modelVersion: modelVersion || '1.0.0',
      });

      this.logger.debug(`Created anomaly alert for commit ${commitSha}`);
    } catch (error) {
      // Log but don't fail commit processing if alert creation fails
      this.logger.warn(`Failed to create anomaly alert for commit ${commitSha}: ${error}`);
    }
  }

  /**
   * Scan a commit for technical debt markers
   *
   * @param commitId - The commit ID
   * @param repositoryId - The repository ID
   * @param developerId - The developer ID (if attributed)
   * @param files - Array of file changes from GitHub API
   */
  private async scanCommitForDebt(
    commitId: string,
    repositoryId: string,
    developerId: string | null,
    files: Array<{ filename: string; patch?: string }>,
  ): Promise<void> {
    try {
      // Prepare file patches for scanning
      const filePatches = files
        .filter((f) => f.patch) // Only files with patches
        .map((f) => ({
          filePath: f.filename,
          patch: f.patch!,
        }));

      if (filePatches.length === 0) {
        return;
      }

      // Scan for debt markers
      const debtItems = await this.debtService.scanCommit(
        commitId,
        repositoryId,
        developerId,
        filePatches,
      );

      if (debtItems.length > 0) {
        this.logger.debug(`Found ${debtItems.length} debt markers in commit ${commitId}`);
      }
    } catch (error) {
      // Log but don't fail commit processing if debt scanning fails
      this.logger.warn(`Failed to scan commit ${commitId} for debt markers: ${error}`);
    }
  }

  /**
   * Trigger score recalculation after a new commit is processed
   *
   * @param commitId - The processed commit ID
   * @param repositoryId - Repository ID
   * @param developerId - Developer ID (if attributed)
   * @param organizationId - Organization ID
   */
  private async triggerScoreRecalculation(
    commitId: string,
    repositoryId: string,
    developerId: string | null,
    organizationId: string,
  ): Promise<void> {
    try {
      // Find all projects that contain this repository
      const projectRepos = await this.prisma.projectRepository.findMany({
        where: { repositoryId },
        select: { projectId: true },
      });

      // Trigger SQS recalculation for each project that contains this repository
      for (const pr of projectRepos) {
        await this.scoresService.triggerSQSRecalculationOnCommit(
          pr.projectId,
          organizationId,
          commitId,
        );
      }

      // If no projects contain this repo, still calculate SQS for the repository itself
      // (for backward compatibility)
      if (projectRepos.length === 0) {
        await this.scoresService.triggerSQSRecalculationOnCommit(
          repositoryId,
          organizationId,
          commitId,
        );
      }

      // Trigger DQS recalculation for the developer if attributed
      if (developerId) {
        await this.scoresService.triggerDQSRecalculationOnCommit(
          developerId,
          organizationId,
          commitId,
        );
      }

      this.logger.debug(`Enqueued score recalculation jobs for commit ${commitId}`);
    } catch (error) {
      // Log but don't fail commit processing if score recalculation fails
      this.logger.warn(`Failed to enqueue score recalculation for commit ${commitId}: ${error}`);
    }
  }

  /**
   * Fetch commit details from GitHub API
   */
  private async fetchCommitDetail(
    organizationId: string,
    fullName: string,
    sha: string,
  ): Promise<GitHubCommitDetail> {
    const [owner, repo] = fullName.split('/');
    const octokit = await this.githubService.getOctokitForOrganization(organizationId);

    return this.githubApiService.fetchCommitDetails(octokit, owner, repo, sha);
  }

  /**
   * Classify a commit using the ML service
   *
   * @param message - Commit message
   * @param filesChanged - List of file paths changed
   * @param additions - Number of lines added
   * @param deletions - Number of lines deleted
   * @returns CommitClassification or null if classification fails
   */
  private async classifyCommit(
    message: string,
    filesChanged: string[],
    additions: number,
    deletions: number,
  ): Promise<CommitClassification | null> {
    try {
      const result = await this.mlClientService.classifyCommit(
        message,
        filesChanged,
        additions,
        deletions,
      );

      if (result && result.classification) {
        // Map the classification string to the Prisma enum
        const classificationMap: Record<string, CommitClassification> = {
          BUGFIX: CommitClassification.BUGFIX,
          FEATURE: CommitClassification.FEATURE,
          REFACTOR: CommitClassification.REFACTOR,
          TEST: CommitClassification.TEST,
          DOCS: CommitClassification.DOCS,
        };

        const classification = classificationMap[result.classification];
        if (classification) {
          this.logger.debug(
            `Classified commit as ${classification} with confidence ${result.confidence}`,
          );
          return classification;
        }
      }

      this.logger.debug('Could not classify commit, leaving classification as null');
      return null;
    } catch (error) {
      this.logger.warn(`Failed to classify commit: ${error}`);
      return null;
    }
  }

  /**
   * Attempt to attribute commit to a developer based on email
   *
   * @param authorEmail - Commit author email
   * @param authorName - Commit author name
   * @param organizationId - Organization ID
   * @returns Developer user ID if found, null otherwise
   */
  private async attributeDeveloper(
    authorEmail: string,
    authorName: string,
    organizationId: string,
  ): Promise<string | null> {
    // First, try to find user by primary email
    const userByEmail = await this.prisma.user.findUnique({
      where: { email: authorEmail },
      include: {
        memberships: {
          where: { organizationId },
        },
      },
    });

    if (userByEmail && userByEmail.memberships.length > 0) {
      return userByEmail.id;
    }

    // Try to find by email alias
    const alias = await this.prisma.emailAlias.findUnique({
      where: { email: authorEmail },
      include: {
        user: {
          include: {
            memberships: {
              where: { organizationId },
            },
          },
        },
      },
    });

    if (alias?.isVerified && alias.user.memberships.length > 0) {
      return alias.user.id;
    }

    // No match found - add to unmapped emails list
    await this.trackUnmappedEmail(authorEmail, authorName, organizationId);

    this.logger.debug(`Could not attribute commit author ${authorEmail} to any developer`);
    return null;
  }

  /**
   * Track an unmapped email in the organization
   *
   * @param email - The unmapped email address
   * @param authorName - The commit author name
   * @param organizationId - Organization ID
   */
  private async trackUnmappedEmail(
    email: string,
    authorName: string,
    organizationId: string,
  ): Promise<void> {
    try {
      await this.prisma.unmappedEmail.upsert({
        where: {
          organizationId_email: {
            organizationId,
            email,
          },
        },
        update: {
          commitCount: { increment: 1 },
          lastSeenAt: new Date(),
          // Update author name if not set
          authorName: authorName || undefined,
        },
        create: {
          organizationId,
          email,
          authorName: authorName || null,
          commitCount: 1,
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      });
      this.logger.debug(`Tracked unmapped email ${email} for organization ${organizationId}`);
    } catch (error) {
      // Log but don't fail commit processing if unmapped email tracking fails
      this.logger.warn(`Failed to track unmapped email ${email}: ${error}`);
    }
  }

  /**
   * Map a commit entity to ProcessedCommitResult
   */
  private mapCommitToResult(
    commit: {
      id: string;
      sha: string;
      linesAdded: number;
      linesDeleted: number;
      filesChanged: number;
      churnRatio: number | null;
      developerId: string | null;
      classification?: CommitClassification | null;
    },
    fileChanges: FileChangeData[],
  ): ProcessedCommitResult {
    return {
      commitId: commit.id,
      sha: commit.sha,
      linesAdded: commit.linesAdded,
      linesDeleted: commit.linesDeleted,
      filesChanged: commit.filesChanged,
      churnRatio: commit.churnRatio ?? 0,
      fileChanges,
      developerId: commit.developerId,
      classification: commit.classification ?? null,
    };
  }

  /**
   * Detect anomaly in a commit using the ML service
   *
   * Property 12: Anomaly Severity Mapping
   * For any anomaly score, the severity SHALL be mapped to exactly one of
   * {LOW, MEDIUM, HIGH, CRITICAL} based on defined thresholds.
   *
   * @param commitSha - The commit SHA
   * @param linesChanged - Total lines added + deleted
   * @param filesChanged - Number of files changed
   * @param committedAt - Commit timestamp
   * @param churnRatio - Code churn ratio
   * @returns Anomaly detection result or null if service unavailable
   */
  private async detectAnomaly(
    commitSha: string,
    linesChanged: number,
    filesChanged: number,
    committedAt: Date,
    churnRatio: number,
  ): Promise<{
    is_anomaly: boolean;
    anomaly_score: number;
    severity: string;
    model_version?: string;
  } | null> {
    try {
      // Extract hour of day from commit timestamp
      const timeOfDay = committedAt.getUTCHours();

      const result = await this.mlClientService.detectAnomaly(
        commitSha,
        linesChanged,
        filesChanged,
        timeOfDay,
        churnRatio,
      );

      if (result) {
        this.logger.debug(
          `Anomaly detection for ${commitSha}: is_anomaly=${result.is_anomaly}, score=${result.anomaly_score}, severity=${result.severity}`,
        );
      }

      return result;
    } catch (error) {
      this.logger.warn(`Failed to detect anomaly for commit ${commitSha}: ${error}`);
      return null;
    }
  }

  /**
   * Calculate churn ratio for a file based on additions and deletions
   *
   * Property 7: Churn Ratio Non-Negative
   * For any file change with non-negative additions and deletions,
   * the calculated churn ratio shall be non-negative.
   *
   * @param additions - Number of lines added
   * @param deletions - Number of lines deleted
   * @returns Churn ratio (always >= 0)
   */
  calculateChurnRatio(additions: number, deletions: number): number {
    return calculateCommitChurnRatio(additions, deletions);
  }

  /**
   * Find all commits with pagination and filters
   *
   * @param filters - Filter and pagination options
   * @returns Paginated list of commits
   */
  async findAll(filters: CommitFiltersDto) {
    const {
      organizationId,
      repositoryId,
      developerId,
      classification,
      startDate,
      endDate,
      search,
      anomalyOnly,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.CommitWhereInput = {};

    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    if (organizationId) {
      where.repository = {
        organizationId,
      };
    }

    if (developerId) {
      where.developerId = developerId;
    }

    if (classification) {
      where.classification = classification;
    }

    if (startDate || endDate) {
      where.committedAt = {};
      if (startDate) {
        where.committedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.committedAt.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { authorName: { contains: search, mode: 'insensitive' } },
        { authorEmail: { contains: search, mode: 'insensitive' } },
        { sha: { startsWith: search } },
      ];
    }

    if (anomalyOnly) {
      where.anomalyFlag = true;
    }

    // Execute query with count
    const [commits, total] = await Promise.all([
      this.prisma.commit.findMany({
        where,
        skip,
        take: limit,
        orderBy: { committedAt: 'desc' },
        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
          developer: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.commit.count({ where }),
    ]);

    return {
      data: commits,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find a commit by ID with full details
   *
   * @param id - Commit ID
   * @returns Commit with file changes
   */
  async findById(id: string) {
    const commit = await this.prisma.commit.findUnique({
      where: { id },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
            organizationId: true,
          },
        },
        developer: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        fileChanges: {
          orderBy: { churnRatio: 'desc' },
        },
      },
    });

    if (!commit) {
      throw new NotFoundException(`Commit with ID ${id} not found`);
    }

    return commit;
  }

  /**
   * Get commit statistics for an organization or repository
   *
   * @param query - Statistics query parameters
   * @returns Commit statistics
   */
  async getStatistics(query: CommitStatsQueryDto) {
    const { organizationId, repositoryId, developerId, startDate, endDate } = query;

    // Build where clause
    const where: Prisma.CommitWhereInput = {};

    if (repositoryId) {
      where.repositoryId = repositoryId;
    }

    if (organizationId) {
      where.repository = {
        organizationId,
      };
    }

    if (developerId) {
      where.developerId = developerId;
    }

    if (startDate || endDate) {
      where.committedAt = {};
      if (startDate) {
        where.committedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.committedAt.lte = new Date(endDate);
      }
    }

    // Get aggregate statistics
    const [totalCommits, aggregates, classificationCounts, anomalyCount] = await Promise.all([
      this.prisma.commit.count({ where }),
      this.prisma.commit.aggregate({
        where,
        _sum: {
          linesAdded: true,
          linesDeleted: true,
          filesChanged: true,
        },
        _avg: {
          churnRatio: true,
          linesAdded: true,
          linesDeleted: true,
        },
      }),
      this.prisma.commit.groupBy({
        by: ['classification'],
        where,
        _count: true,
      }),
      this.prisma.commit.count({
        where: { ...where, anomalyFlag: true },
      }),
    ]);

    // Calculate rolling averages (7-day, 30-day, 90-day)
    const now = new Date();
    const rollingAverages = await this.calculateRollingAverages(where, now);

    // Transform classification counts to object
    const classificationBreakdown = classificationCounts.reduce(
      (acc, item) => {
        const key = item.classification || 'UNCLASSIFIED';
        acc[key] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalCommits,
      totalLinesAdded: aggregates._sum.linesAdded || 0,
      totalLinesDeleted: aggregates._sum.linesDeleted || 0,
      totalFilesChanged: aggregates._sum.filesChanged || 0,
      averageChurnRatio: aggregates._avg.churnRatio || 0,
      averageLinesAdded: aggregates._avg.linesAdded || 0,
      averageLinesDeleted: aggregates._avg.linesDeleted || 0,
      classificationBreakdown,
      anomalyCount,
      rollingAverages,
    };
  }

  /**
   * Calculate rolling averages for commits
   */
  private async calculateRollingAverages(baseWhere: Prisma.CommitWhereInput, now: Date) {
    const periods = [
      { name: '7d', days: 7 },
      { name: '30d', days: 30 },
      { name: '90d', days: 90 },
    ];

    const results: Record<string, { commits: number; avgChurn: number }> = {};

    for (const period of periods) {
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - period.days);

      const where: Prisma.CommitWhereInput = {
        ...baseWhere,
        committedAt: {
          gte: startDate,
          lte: now,
        },
      };

      const [count, aggregate] = await Promise.all([
        this.prisma.commit.count({ where }),
        this.prisma.commit.aggregate({
          where,
          _avg: { churnRatio: true },
        }),
      ]);

      results[period.name] = {
        commits: count,
        avgChurn: aggregate._avg.churnRatio || 0,
      };
    }

    return results;
  }

  /**
   * Get churn heatmap data for a repository
   *
   * @param query - Heatmap query parameters
   * @returns File churn data for heatmap visualization
   */
  async getHeatmapData(query: HeatmapQueryDto) {
    const { repositoryId, startDate, endDate, limit = 50 } = query;

    // Verify repository exists
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { id: true, name: true, fullName: true, organizationId: true },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${repositoryId} not found`);
    }

    // Build date filter for file changes
    const commitFilter: Prisma.CommitWhereInput = {
      repositoryId,
    };

    if (startDate || endDate) {
      commitFilter.committedAt = {};
      if (startDate) {
        commitFilter.committedAt.gte = new Date(startDate);
      }
      if (endDate) {
        commitFilter.committedAt.lte = new Date(endDate);
      }
    }

    const dateFilter: Prisma.FileChangeWhereInput = {
      commit: commitFilter,
    };

    // Aggregate file changes by file path
    const fileChanges = await this.prisma.fileChange.groupBy({
      by: ['filePath'],
      where: dateFilter,
      _count: true,
      _sum: {
        additions: true,
        deletions: true,
      },
      _avg: {
        churnRatio: true,
      },
      orderBy: {
        _count: {
          filePath: 'desc',
        },
      },
      take: limit,
    });

    // Get bug correlation data (commits with bugfix classification)
    const bugfixCommits = await this.prisma.commit.findMany({
      where: {
        repositoryId,
        classification: 'BUGFIX',
        ...(startDate || endDate
          ? {
              committedAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {}),
      },
      select: {
        fileChanges: {
          select: { filePath: true },
        },
      },
    });

    // Count bug occurrences per file
    const bugCountByFile: Record<string, number> = {};
    for (const commit of bugfixCommits) {
      for (const fc of commit.fileChanges) {
        bugCountByFile[fc.filePath] = (bugCountByFile[fc.filePath] || 0) + 1;
      }
    }

    // Transform to heatmap data
    const heatmapData = fileChanges.map((fc) => ({
      filePath: fc.filePath,
      changeCount: fc._count,
      totalAdditions: fc._sum.additions || 0,
      totalDeletions: fc._sum.deletions || 0,
      averageChurnRatio: fc._avg.churnRatio || 0,
      bugCount: bugCountByFile[fc.filePath] || 0,
      // Calculate intensity based on churn and bug correlation
      intensity: this.calculateHeatmapIntensity(
        fc._avg.churnRatio || 0,
        fc._count,
        bugCountByFile[fc.filePath] || 0,
      ),
    }));

    return {
      repository: {
        id: repository.id,
        name: repository.name,
        fullName: repository.fullName,
      },
      files: heatmapData,
      meta: {
        totalFiles: fileChanges.length,
        dateRange: {
          start: startDate || null,
          end: endDate || null,
        },
      },
    };
  }

  /**
   * Calculate heatmap intensity based on churn ratio, change frequency, and bug correlation
   * Returns a value between 0 and 1
   */
  private calculateHeatmapIntensity(
    avgChurnRatio: number,
    changeCount: number,
    bugCount: number,
  ): number {
    // Normalize factors (these thresholds can be adjusted)
    const churnFactor = Math.min(avgChurnRatio / 0.5, 1); // Cap at 50% churn
    const changeFactor = Math.min(changeCount / 20, 1); // Cap at 20 changes
    const bugFactor = Math.min(bugCount / 5, 1); // Cap at 5 bugs

    // Weighted combination
    const intensity = churnFactor * 0.3 + changeFactor * 0.3 + bugFactor * 0.4;

    return Math.min(Math.max(intensity, 0), 1);
  }

  /**
   * Validate email format and length
   *
   * @param email - Email address to validate
   * @returns true if email is valid, false otherwise
   */
  private isValidEmail(email: string): boolean {
    if (!email || email.length > 255) return false;
    if (!email.includes('@')) return false;
    return true;
  }

  /**
   * Extract GitHub username from noreply email
   *
   * Supports two GitHub noreply email formats:
   * - username@users.noreply.github.com
   * - id+username@users.noreply.github.com
   *
   * @param email - Email address to parse
   * @returns GitHub username if noreply email, null otherwise
   */
  private extractGitHubUsername(email: string): string | null {
    // Match: username@users.noreply.github.com
    // Match: id+username@users.noreply.github.com
    const match = email.match(/^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/);
    return match ? match[1] : null;
  }

  /**
   * Check if error is a Prisma unique constraint violation
   *
   * @param error - Error object to check
   * @returns true if error is a unique constraint violation
   */
  private isUniqueConstraintViolation(error: any): boolean {
    return error && typeof error === 'object' && 'code' in error && error.code === 'P2002'; // Prisma unique constraint error
  }

  /**
   * Create a new user account with transaction support
   *
   * @param tx - Prisma transaction client
   * @param email - User email address
   * @param name - User name (falls back to email prefix if not provided)
   * @returns Created user
   */
  private async createUser(
    tx: Prisma.TransactionClient,
    email: string,
    name: string,
  ): Promise<{ id: string; email: string; name: string }> {
    return await tx.user.create({
      data: {
        email,
        name: name || email.split('@')[0], // Fallback to email prefix
        passwordHash: null, // Auto-created users have no password
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
  }

  /**
   * Create organization membership with duplicate handling
   *
   * @param tx - Prisma transaction client
   * @param userId - User ID
   * @param organizationId - Organization ID
   */
  private async createOrganizationMembership(
    tx: Prisma.TransactionClient,
    userId: string,
    organizationId: string,
  ): Promise<void> {
    try {
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId,
          role: 'DEVELOPER',
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        // Membership already exists, continue
        this.logger.debug(`Membership already exists for user ${userId}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Create email alias for GitHub noreply emails
   *
   * @param userId - User ID
   * @param email - Email address to alias
   * @param source - Source of the email alias
   */
  private async createEmailAlias(
    userId: string,
    email: string,
    source: 'GITHUB_OAUTH' | 'ADMIN_ASSIGNED',
  ): Promise<void> {
    try {
      await this.prisma.emailAlias.create({
        data: {
          userId,
          email,
          isVerified: true,
          source,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        this.logger.debug(`Email alias already exists: ${email}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Remove email from unmapped emails table
   *
   * @param tx - Prisma transaction client
   * @param email - Email address to remove
   * @param organizationId - Organization ID
   */
  private async removeFromUnmappedEmails(
    tx: Prisma.TransactionClient,
    email: string,
    organizationId: string,
  ): Promise<void> {
    try {
      await tx.unmappedEmail.delete({
        where: {
          organizationId_email: {
            organizationId,
            email,
          },
        },
      });
    } catch (error) {
      // Ignore if not found
      this.logger.debug(`No unmapped email record to delete for ${email}`);
    }
  }

  /**
   * Handle GitHub noreply email by checking for existing users with matching GitHub username
   *
   * @param noreplyEmail - GitHub noreply email address
   * @param authorName - Commit author name
   * @param githubUsername - Extracted GitHub username
   * @param organizationId - Organization ID
   * @returns User if found or created, null otherwise
   */
  private async handleGitHubNoreplyEmail(
    noreplyEmail: string,
    authorName: string,
    githubUsername: string,
    organizationId: string,
  ): Promise<{ id: string; email: string; name: string } | null> {
    try {
      // Check if user with this GitHub username already exists in the organization
      // We look for users whose email contains the GitHub username or who have a matching githubId
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email: { contains: githubUsername, mode: 'insensitive' } },
            { githubId: { not: null } }, // Would need GitHub ID lookup in future enhancement
          ],
          memberships: {
            some: { organizationId },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (existingUser) {
        // Create email alias for noreply email and link to existing user
        await this.createEmailAlias(existingUser.id, noreplyEmail, 'GITHUB_OAUTH');
        this.logger.debug(
          `Linked GitHub noreply email ${noreplyEmail} to existing user ${existingUser.id}`,
        );
        return existingUser;
      }

      // No existing user found, create new user with noreply email
      // This will be handled by the caller (autoDiscoverContributor)
      return null;
    } catch (error) {
      this.logger.error(`Failed to handle GitHub noreply email ${noreplyEmail}:`, error);
      return null;
    }
  }
}
