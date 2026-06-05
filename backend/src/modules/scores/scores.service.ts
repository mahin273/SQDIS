import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma';
import {
  ScoresMlClientService,
  DQSFeatures,
  SQSFeatures,
  ModuleMetrics,
} from './services/scores-ml-client.service';
import { ScoresCacheService, CACHE_KEYS, CACHE_TTL } from './services/scores-cache.service';
import { DQSHistoryQueryDto, SQSHistoryQueryDto, ScoreType } from './dto';
import { ScoreJobData, ScoreJobType } from './types';
import { SCORE_QUEUE } from '../../config';
import { GitHubService } from '../github/github.service';
import { GitHubApiService } from '../github/services/github-api.service';

/**
 * Service for DQS and SQS score management
 */
@Injectable()
export class ScoresService {
  private readonly logger = new Logger(ScoresService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mlClient: ScoresMlClientService,
    private readonly cacheService: ScoresCacheService,
    @InjectQueue(SCORE_QUEUE) private readonly scoreQueue: Queue<ScoreJobData>,
    @Inject(forwardRef(() => GitHubService))
    private readonly githubService: GitHubService,
    @Inject(forwardRef(() => GitHubApiService))
    private readonly githubApiService: GitHubApiService,
  ) {}

  /**
   * Get developer DQS score
   *
   * @param developerId - Developer user ID
   * @param organizationId - Organization ID
   * @returns DQS score with breakdown
   */
  async getDQS(developerId: string, organizationId: string) {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.DQS_SCORE(developerId);
    const cached = await this.cacheService.get<{
      developerId: string;
      score: number;
      modelVersion: string;
      calculatedAt: Date;
      features: Record<string, number>;
      shapValues: Array<{ feature: string; impact: number }>;
    }>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for DQS score: ${developerId}`);
      return cached;
    }

    // Verify developer exists and belongs to organization
    const developer = await this.prisma.user.findFirst({
      where: {
        id: developerId,
        memberships: {
          some: { organizationId },
        },
      },
      include: {
        memberships: {
          where: { organizationId },
          select: { role: true },
        },
      },
    });

    if (!developer) {
      throw new NotFoundException(`Developer with ID ${developerId} not found in organization`);
    }

    // Get latest DQS score from database
    const latestScore = await this.prisma.dQSScore.findFirst({
      where: { developerId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (!latestScore) {
      // Calculate new score if none exists
      return this.calculateAndStoreDQS(developerId, organizationId);
    }

    const result = {
      developerId,
      score: latestScore.score,
      modelVersion: latestScore.modelVersion,
      calculatedAt: latestScore.calculatedAt,
      features: latestScore.featureValues as Record<string, number>,
      shapValues: latestScore.shapValues as Array<{
        feature: string;
        impact: number;
      }>,
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DQS_SCORE);

    return result;
  }

  /**
   * Get developer DQS history
   *
   * @param developerId - Developer user ID
   * @param organizationId - Organization ID
   * @param query - History query parameters
   * @returns Array of historical DQS scores
   */
  async getDQSHistory(developerId: string, organizationId: string, query: DQSHistoryQueryDto) {
    const { startDate, endDate, limit = 30 } = query;

    // Create cache key with query params
    const cacheKey = `${CACHE_KEYS.DQS_HISTORY(developerId)}:${startDate || ''}:${endDate || ''}:${limit}`;
    const cached = await this.cacheService.get<{
      developerId: string;
      history: Array<{
        id: string;
        score: number;
        modelVersion: string;
        calculatedAt: Date;
      }>;
      meta: {
        count: number;
        dateRange: { start: string | null; end: string | null };
      };
    }>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for DQS history: ${developerId}`);
      return cached;
    }

    // Verify developer exists and belongs to organization
    const developer = await this.prisma.user.findFirst({
      where: {
        id: developerId,
        memberships: {
          some: { organizationId },
        },
      },
    });

    if (!developer) {
      throw new NotFoundException(`Developer with ID ${developerId} not found in organization`);
    }

    const where: any = { developerId };

    if (startDate || endDate) {
      where.calculatedAt = {};
      if (startDate) {
        where.calculatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.calculatedAt.lte = new Date(endDate);
      }
    }

    const scores = await this.prisma.dQSScore.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        score: true,
        modelVersion: true,
        calculatedAt: true,
      },
    });

    const result = {
      developerId,
      history: scores,
      meta: {
        count: scores.length,
        dateRange: {
          start: startDate || null,
          end: endDate || null,
        },
      },
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DQS_HISTORY);

    return result;
  }

  /**
   * Get DQS SHAP explanation
   *
   * @param developerId - Developer user ID
   * @param organizationId - Organization ID
   * @returns SHAP explanation with top 5 features
   */
  async getDQSExplanation(developerId: string, organizationId: string) {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.DQS_EXPLANATION(developerId);
    const cached = await this.cacheService.get<{
      developerId: string;
      score: number;
      modelVersion: string;
      calculatedAt: Date;
      explanation: {
        topFeatures: Array<{ feature: string; impact: number }>;
        featureValues: Record<string, number>;
      };
    }>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for DQS explanation: ${developerId}`);
      return cached;
    }

    // Verify developer exists and belongs to organization
    const developer = await this.prisma.user.findFirst({
      where: {
        id: developerId,
        memberships: {
          some: { organizationId },
        },
      },
    });

    if (!developer) {
      throw new NotFoundException(`Developer with ID ${developerId} not found in organization`);
    }

    // Get latest DQS score with SHAP values
    const latestScore = await this.prisma.dQSScore.findFirst({
      where: { developerId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (!latestScore) {
      throw new NotFoundException(`No DQS score found for developer ${developerId}`);
    }

    const shapValues =
      (latestScore.shapValues as Array<{
        feature: string;
        impact: number;
      }>) || [];

    // Return top 5 SHAP features by absolute impact
    const topFeatures = shapValues
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 5);

    const result = {
      developerId,
      score: latestScore.score,
      modelVersion: latestScore.modelVersion,
      calculatedAt: latestScore.calculatedAt,
      explanation: {
        topFeatures,
        featureValues: latestScore.featureValues as Record<string, number>,
      },
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.DQS_EXPLANATION);

    return result;
  }

  /**
   * Get project SQS score
   *
   * @param projectId - Project ID (using repository ID for now)
   * @param organizationId - Organization ID
   * @returns SQS score with risky modules
   */
  async getSQS(projectId: string, organizationId: string) {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.SQS_SCORE(projectId);
    const cached = await this.cacheService.get<{
      projectId: string;
      score: number;
      modelVersion: string;
      calculatedAt: Date;
      riskyModules: Array<{ path: string; risk_level: string; reason: string }>;
      recommendations: string[];
    }>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for SQS score: ${projectId}`);
      return cached;
    }

    // For now, we use repository as project
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!repository) {
      throw new NotFoundException(`Project with ID ${projectId} not found in organization`);
    }

    // Get latest SQS score from database
    const latestScore = await this.prisma.sQSScore.findFirst({
      where: { projectId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (!latestScore) {
      // Calculate new score if none exists
      return this.calculateAndStoreSQS(projectId, organizationId);
    }

    const result = {
      projectId,
      score: latestScore.score,
      modelVersion: latestScore.modelVersion,
      calculatedAt: latestScore.calculatedAt,
      riskyModules: latestScore.riskyModules as Array<{
        path: string;
        risk_level: string;
        reason: string;
      }>,
      recommendations: latestScore.recommendations as string[],
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.SQS_SCORE);

    return result;
  }

  /**
   * Get project SQS history
   *
   * @param projectId - Project ID
   * @param organizationId - Organization ID
   * @param query - History query parameters
   * @returns Array of historical SQS scores
   */
  async getSQSHistory(projectId: string, organizationId: string, query: SQSHistoryQueryDto) {
    const { startDate, endDate, limit = 30 } = query;

    // Create cache key with query params
    const cacheKey = `${CACHE_KEYS.SQS_HISTORY(projectId)}:${startDate || ''}:${endDate || ''}:${limit}`;
    const cached = await this.cacheService.get<{
      projectId: string;
      history: Array<{
        id: string;
        score: number;
        modelVersion: string;
        calculatedAt: Date;
      }>;
      meta: {
        count: number;
        dateRange: { start: string | null; end: string | null };
      };
    }>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for SQS history: ${projectId}`);
      return cached;
    }

    // Verify project exists and belongs to organization
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!repository) {
      throw new NotFoundException(`Project with ID ${projectId} not found in organization`);
    }

    const where: any = { projectId };

    if (startDate || endDate) {
      where.calculatedAt = {};
      if (startDate) {
        where.calculatedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.calculatedAt.lte = new Date(endDate);
      }
    }

    const scores = await this.prisma.sQSScore.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        score: true,
        modelVersion: true,
        calculatedAt: true,
      },
    });

    const result = {
      projectId,
      history: scores,
      meta: {
        count: scores.length,
        dateRange: {
          start: startDate || null,
          end: endDate || null,
        },
      },
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.SQS_HISTORY);

    return result;
  }

  /**
   * Get risky modules for a project
   *
   * @param projectId - Project ID
   * @param organizationId - Organization ID
   * @returns List of risky modules
   */
  async getRiskyModules(projectId: string, organizationId: string) {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.SQS_RISKS(projectId);
    const cached = await this.cacheService.get<{
      projectId: string;
      riskyModules: Array<{ path: string; risk_level: string; reason: string }>;
      totalRiskyModules: number;
      highCriticalCount: number;
      calculatedAt: Date;
    }>(cacheKey);

    if (cached) {
      this.logger.debug(`Cache hit for SQS risks: ${projectId}`);
      return cached;
    }

    // Verify project exists and belongs to organization
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!repository) {
      throw new NotFoundException(`Project with ID ${projectId} not found in organization`);
    }

    // Get latest SQS score with risky modules
    const latestScore = await this.prisma.sQSScore.findFirst({
      where: { projectId },
      orderBy: { calculatedAt: 'desc' },
    });

    if (!latestScore) {
      return {
        projectId,
        riskyModules: [],
        message: 'No SQS score calculated yet',
      };
    }

    const riskyModules =
      (latestScore.riskyModules as Array<{
        path: string;
        risk_level: string;
        reason: string;
      }>) || [];

    // Filter to only HIGH and CRITICAL risk modules
    const highRiskModules = riskyModules.filter(
      (m) => m.risk_level === 'HIGH' || m.risk_level === 'CRITICAL',
    );

    const result = {
      projectId,
      riskyModules: highRiskModules,
      totalRiskyModules: riskyModules.length,
      highCriticalCount: highRiskModules.length,
      calculatedAt: latestScore.calculatedAt,
    };

    // Cache the result
    await this.cacheService.set(cacheKey, result, CACHE_TTL.SQS_RISKS);

    return result;
  }

  /**
   * Trigger score recalculation via queue
   *
   * @param entityId - Developer or Project ID
   * @param type - Score type (dqs or sqs)
   * @param organizationId - Organization ID
   * @returns Job enqueue result
   */
  async triggerRecalculation(entityId: string, type: ScoreType, organizationId: string) {
    const jobType = type === ScoreType.DQS ? ScoreJobType.DQS : ScoreJobType.SQS;

    const job = await this.enqueueScoreCalculation({
      entityId,
      type: jobType,
      organizationId,
      triggeredBy: 'manual',
    });

    return {
      message: `Score recalculation job enqueued`,
      jobId: job.id,
      entityId,
      type,
    };
  }

  /**
   * Enqueue a score calculation job
   *
   * @param data - Score job data
   * @returns The enqueued job
   */
  async enqueueScoreCalculation(data: ScoreJobData) {
    const jobId = `${data.type}-${data.entityId}`;

    this.logger.debug(
      `Enqueuing ${data.type.toUpperCase()} score calculation for ${data.entityId}`,
    );

    return this.scoreQueue.add(data.type, data, {
      jobId,
    });
  }

  /**
   * Trigger DQS recalculation for a developer after new commit
   *
   * @param developerId - Developer user ID
   * @param organizationId - Organization ID
   * @param commitId - Optional commit ID that triggered the recalculation
   */
  async triggerDQSRecalculationOnCommit(
    developerId: string,
    organizationId: string,
    commitId?: string,
  ) {
    return this.enqueueScoreCalculation({
      entityId: developerId,
      type: ScoreJobType.DQS,
      organizationId,
      triggeredBy: 'commit',
      commitId,
    });
  }

  /**
   * Trigger SQS recalculation for a project after new commit
   *
   * @param projectId - Project/Repository ID
   * @param organizationId - Organization ID
   * @param commitId - Optional commit ID that triggered the recalculation
   */
  async triggerSQSRecalculationOnCommit(
    projectId: string,
    organizationId: string,
    commitId?: string,
  ) {
    return this.enqueueScoreCalculation({
      entityId: projectId,
      type: ScoreJobType.SQS,
      organizationId,
      triggeredBy: 'commit',
      commitId,
    });
  }

  /**
   * Public method to calculate DQS score (used by processor)
   */
  async calculateDQS(developerId: string, organizationId: string) {
    return this.calculateAndStoreDQS(developerId, organizationId);
  }

  /**
   * Public method to calculate SQS score (used by processor)
   */
  async calculateSQS(projectId: string, organizationId: string) {
    return this.calculateAndStoreSQS(projectId, organizationId);
  }

  /**
   * Calculate and store DQS score for a developer
   *
   * @param developerId - Developer user ID
   * @param organizationId - Organization ID
   * @returns Calculated DQS score
   */
  private async calculateAndStoreDQS(developerId: string, organizationId: string) {
    this.logger.debug(`Calculating DQS for developer ${developerId}`);

    // Get previous score for comparison
    const previousScore = await this.prisma.dQSScore.findFirst({
      where: { developerId },
      orderBy: { calculatedAt: 'desc' },
      select: { score: true },
    });

    // Extract features for DQS calculation
    const features = await this.extractDQSFeatures(developerId, organizationId);

    // Check if we have sufficient data
    if (features.commit_count_30d < 5) {
      return {
        developerId,
        score: null,
        message: 'Insufficient data - minimum 5 commits in last 30 days required',
        features,
      };
    }

    // Call ML service for DQS prediction
    const mlResult = await this.mlClient.predictDQS(developerId, features);

    if (!mlResult) {
      this.logger.warn(`ML service unavailable for DQS calculation`);
      return {
        developerId,
        score: null,
        message: 'ML service unavailable',
        features,
      };
    }

    // Store the score
    const storedScore = await this.prisma.dQSScore.create({
      data: {
        developerId,
        score: mlResult.score,
        modelVersion: mlResult.model_version,
        featureValues: features as unknown as Prisma.InputJsonValue,
        shapValues: mlResult.shap_values as unknown as Prisma.InputJsonValue,
        calculatedAt: new Date(),
      },
    });

    // Invalidate cache for this developer
    await this.cacheService.invalidateDQS(developerId);

    // Publish score:updated event for real-time updates
    this.publishScoreCalculatedEvent(
      'developer',
      developerId,
      organizationId,
      previousScore?.score ?? null,
      mlResult.score,
      'dqs',
    );

    this.logger.log(`Stored DQS score ${mlResult.score} for developer ${developerId}`);

    return {
      developerId,
      score: storedScore.score,
      modelVersion: storedScore.modelVersion,
      calculatedAt: storedScore.calculatedAt,
      features,
      shapValues: mlResult.shap_values,
    };
  }

  /**
   * Extract file-level module metrics for project repositories
   */
  private async extractModuleMetrics(
    projectId: string,
    organizationId: string,
  ): Promise<ModuleMetrics[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Find all repositories assigned to project
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          select: { repositoryId: true },
        },
      },
    });

    let repositoryIds: string[] = [];
    if (project) {
      repositoryIds = project.repositories.map((pr) => pr.repositoryId);
    } else {
      repositoryIds = [projectId];
    }

    if (repositoryIds.length === 0) {
      return [];
    }

    // 1. Get aggregated file changes in the last 30 days grouped by file path
    const aggregations = await this.prisma.fileChange.groupBy({
      by: ['filePath'],
      where: {
        commit: {
          repositoryId: { in: repositoryIds },
          committedAt: { gte: thirtyDaysAgo },
        },
      },
      _sum: {
        additions: true,
        deletions: true,
        churnRatio: true,
      },
      _count: {
        id: true,
      },
    });

    // 2. Get bugfix counts grouped by file path
    const bugfixAggregations = await this.prisma.fileChange.groupBy({
      by: ['filePath'],
      where: {
        commit: {
          repositoryId: { in: repositoryIds },
          committedAt: { gte: thirtyDaysAgo },
          classification: 'BUGFIX',
        },
      },
      _count: {
        id: true,
      },
    });

    const fileMap = new Map<string, { additions: number; deletions: number; count: number; bugCount: number; churnSum: number }>();
    for (const agg of aggregations) {
      fileMap.set(agg.filePath, {
        additions: agg._sum.additions || 0,
        deletions: agg._sum.deletions || 0,
        count: agg._count.id || 0,
        bugCount: 0,
        churnSum: Number(agg._sum.churnRatio) || 0,
      });
    }

    for (const bugAgg of bugfixAggregations) {
      const existing = fileMap.get(bugAgg.filePath);
      if (existing) {
        existing.bugCount = bugAgg._count.id || 0;
      }
    }

    // 2. Get unresolved debt items
    const debtItems = await this.prisma.debtItem.findMany({
      where: {
        repositoryId: { in: repositoryIds },
        isResolved: false,
      },
      select: {
        filePath: true,
      },
    });

    const debtMap = new Map<string, number>();
    for (const item of debtItems) {
      debtMap.set(item.filePath, (debtMap.get(item.filePath) || 0) + 1);
    }

    // 3. Get file-level coverage metrics
    const coverageMap = new Map<string, number>();
    for (const repositoryId of repositoryIds) {
      const latestReport = await this.prisma.coverageReport.findFirst({
        where: {
          repositoryId,
          status: 'COMPLETED',
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });

      if (latestReport) {
        const coverageModules = await this.prisma.coverageModule.findMany({
          where: { reportId: latestReport.id },
          select: { modulePath: true, coveragePercentage: true },
        });
        for (const m of coverageModules) {
          coverageMap.set(m.modulePath, m.coveragePercentage);
        }
      }
    }

    // 4. Assemble metrics array
    const modules: ModuleMetrics[] = [];
    for (const [path, stats] of fileMap.entries()) {
      const churnRate = stats.count > 0 ? stats.churnSum / stats.count : 0;
      const coverage = coverageMap.get(path) ?? 100.0;
      const bugCount = stats.bugCount;
      const debtCount = debtMap.get(path) ?? 0;
      const loc = stats.additions + stats.deletions;

      modules.push({
        path,
        churn_rate: churnRate,
        coverage,
        bug_count: bugCount,
        debt_count: debtCount,
        lines_of_code: loc,
      });
    }

    return modules;
  }

  /**
   * Incrementally update the AST cache on the ML service for a specific commit's file changes.
   */
  async handleIncrementalASTUpdate(
    repositoryId: string,
    organizationId: string,
    commitDetail: {
      sha: string;
      files: Array<{
        filename: string;
        status: string;
        previous_filename?: string;
      }>;
    },
  ): Promise<void> {
    this.logger.debug(`Updating incremental AST cache for repository ${repositoryId} at commit ${commitDetail.sha}`);
    try {
      const repository = await this.prisma.repository.findUnique({
        where: { id: repositoryId },
        select: { fullName: true },
      });
      if (!repository) {
        this.logger.warn(`Repository ${repositoryId} not found for incremental AST update`);
        return;
      }

      const [owner, repo] = repository.fullName.split('/');
      const octokit = await this.githubService.getOctokitForOrganization(organizationId);

      const filesPayload: Array<{ path: string; content: string }> = [];

      for (const file of commitDetail.files) {
        if (file.status === 'removed') {
          filesPayload.push({
            path: file.filename,
            content: '',
          });
        } else if (file.status === 'renamed') {
          // Delete old filename path from cache
          if (file.previous_filename) {
            filesPayload.push({
              path: file.previous_filename,
              content: '',
            });
          }
          // Fetch content for the new filename
          try {
            const { data } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.filename,
              ref: commitDetail.sha,
            });

            if (data && 'content' in data && typeof data.content === 'string') {
              const content = Buffer.from(data.content, 'base64').toString('utf8');
              filesPayload.push({
                path: file.filename,
                content,
              });
            }
          } catch (fileErr) {
            this.logger.warn(`Failed to fetch file content for renamed ${file.filename} at ${commitDetail.sha}: ${fileErr}`);
          }
        } else if (file.status === 'added' || file.status === 'modified') {
          try {
            const { data } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.filename,
              ref: commitDetail.sha,
            });

            if (data && 'content' in data && typeof data.content === 'string') {
              const content = Buffer.from(data.content, 'base64').toString('utf8');
              filesPayload.push({
                path: file.filename,
                content,
              });
            }
          } catch (fileErr) {
            this.logger.warn(`Failed to fetch file content for ${file.filename} at ${commitDetail.sha}: ${fileErr}`);
          }
        }
      }

      if (filesPayload.length > 0) {
        await this.mlClient.analyzeCodeQuality({
          repository_id: repositoryId,
          files: filesPayload,
        });
        this.logger.debug(`Successfully uploaded ${filesPayload.length} changed files to AST cache for repo ${repositoryId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to run incremental AST update: ${error}`);
    }
  }

  /**
   * Calculate and store SQS score for a project
   *
   * @param projectId - Project ID
   * @param organizationId - Organization ID
   * @returns Calculated SQS score
   */
  private async calculateAndStoreSQS(projectId: string, organizationId: string) {
    this.logger.debug(`Calculating SQS for project ${projectId}`);

    // Get previous score for comparison
    const previousScore = await this.prisma.sQSScore.findFirst({
      where: { projectId },
      orderBy: { calculatedAt: 'desc' },
      select: { score: true },
    });

    // Extract features for SQS calculation
    const features = await this.extractSQSFeatures(projectId, organizationId);

    // Extract module-level metrics for risk identification
    const modules = await this.extractModuleMetrics(projectId, organizationId);

    // Retrieve repository IDs to run AST Code Quality static analysis
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          select: { repositoryId: true },
        },
      },
    });

    let repositoryIds: string[] = [];
    if (project) {
      repositoryIds = project.repositories.map((pr) => pr.repositoryId);
    } else {
      repositoryIds = [projectId];
    }

    let totalSecurityIssues = 0;
    let totalDependencyCycles = 0;
    let totalCodeSmells = 0;
    const astRecommendations: string[] = [];

    for (const repoId of repositoryIds) {
      try {
        // 1. Try to analyze with current warm filesystem cache (files: [])
        let qualityResult = await this.mlClient.analyzeCodeQuality({
          repository_id: repoId,
          files: [],
        });

        // 2. If result is null or has 0 files analyzed, cache is cold. Warm it up!
        if (!qualityResult || qualityResult.complexity.length === 0) {
          this.logger.log(`AST cache for repository ${repoId} is cold. Running full initial warm-up...`);
          
          const repository = await this.prisma.repository.findUnique({
            where: { id: repoId },
            select: { fullName: true }
          });
          
          if (repository) {
            const [owner, repoName] = repository.fullName.split('/');
            const octokit = await this.githubService.getOctokitForOrganization(organizationId);
            
            // Download up to 200 files for complete repository mapping
            const initialFiles = await this.githubApiService.fetchRepositoryCodeFiles(octokit, owner, repoName, 200);
            
            if (initialFiles.length > 0) {
              // Upload in chunks of 40 to avoid payload size/timeout limits
              const chunkSize = 40;
              for (let i = 0; i < initialFiles.length; i += chunkSize) {
                const chunk = initialFiles.slice(i, i + chunkSize);
                await this.mlClient.analyzeCodeQuality({
                  repository_id: repoId,
                  files: chunk,
                });
              }
              // Final query to get full integrated analysis
              qualityResult = await this.mlClient.analyzeCodeQuality({
                repository_id: repoId,
                files: [],
              });
            }
          }
        }

        // 3. Process and persist the AST analysis results
        if (qualityResult) {
          totalSecurityIssues += qualityResult.security.length;
          totalDependencyCycles += qualityResult.dependency_cycles.length;
          totalCodeSmells += qualityResult.code_smells.length;

          // Save file AST complexity metrics to PostgreSQL database using upsert
          if (qualityResult.complexity) {
            for (const comp of qualityResult.complexity) {
              try {
                await this.prisma.fileASTMetric.upsert({
                  where: {
                    repositoryId_filePath: {
                      repositoryId: repoId,
                      filePath: comp.path,
                    },
                  },
                  update: {
                    cyclomaticComplexity: comp.cyclomatic_complexity,
                    cognitiveComplexity: comp.cognitive_complexity,
                    maintainabilityIndex: comp.maintainability_index,
                  },
                  create: {
                    repositoryId: repoId,
                    filePath: comp.path,
                    cyclomaticComplexity: comp.cyclomatic_complexity,
                    cognitiveComplexity: comp.cognitive_complexity,
                    maintainabilityIndex: comp.maintainability_index,
                  },
                });
              } catch (dbErr) {
                this.logger.warn(`Failed to save AST metrics for file ${comp.path}: ${dbErr}`);
              }
            }
          }

          // Append security warnings to recommendations
          for (const issue of qualityResult.security) {
            const path = issue.path;
            const msg = issue.message;
            const severity = issue.severity;
            astRecommendations.push(`[${severity} SECURITY] in ${path}: ${msg}`);
          }

          // Append dependency cycles warnings
          for (const cycle of qualityResult.dependency_cycles) {
            astRecommendations.push(`[CIRCULAR DEPENDENCY] Cycle detected: ${cycle.files.join(' -> ')}`);
          }

          // Append taint tracking issues
          if (qualityResult.taint_issues) {
            for (const taint of qualityResult.taint_issues) {
              astRecommendations.push(
                `[CRITICAL TAINT] Variable '${taint.variable_name}' from source '${taint.source}' reaches dangerous sink '${taint.sink}' at line ${taint.line_number} in ${taint.path}`,
              );
            }
          }
        }
      } catch (err) {
        this.logger.warn(`AST analysis failed for repository ${repoId}: ${err}`);
      }
    }

    // Adjust features dynamically based on static code analysis debt
    // Security issue = 2 units, Dependency Cycle = 3 units, Code Smell = 1 unit
    const astDebtImpact = totalSecurityIssues * 2 + totalDependencyCycles * 3 + totalCodeSmells;
    features.debt_count += astDebtImpact;
    this.logger.log(`Adjusted SQS debt_count feature by adding +${astDebtImpact} AST findings`);

    // Call ML service for SQS prediction
    const mlResult = await this.mlClient.predictSQS(projectId, features, modules);

    if (!mlResult) {
      this.logger.warn(`ML service unavailable for SQS calculation`);
      return {
        projectId,
        score: null,
        message: 'ML service unavailable',
        features,
      };
    }

    // Prepend AST recommendations to the SQS model recommendations
    if (astRecommendations.length > 0) {
      mlResult.recommendations = [...astRecommendations, ...mlResult.recommendations];
    }

    // Store the score
    const storedScore = await this.prisma.sQSScore.create({
      data: {
        projectId,
        score: mlResult.score,
        modelVersion: mlResult.model_version,
        featureValues: features as unknown as Prisma.InputJsonValue,
        riskyModules: mlResult.risky_modules as unknown as Prisma.InputJsonValue,
        recommendations: mlResult.recommendations as unknown as Prisma.InputJsonValue,
        calculatedAt: new Date(),
      },
    });

    // Invalidate cache for this project
    await this.cacheService.invalidateSQS(projectId);

    // Publish score:updated event for real-time updates
    this.publishScoreCalculatedEvent(
      'project',
      projectId,
      organizationId,
      previousScore?.score ?? null,
      mlResult.score,
      'sqs',
    );

    this.logger.log(`Stored SQS score ${mlResult.score} for project ${projectId}`);

    return {
      projectId,
      score: storedScore.score,
      modelVersion: storedScore.modelVersion,
      calculatedAt: storedScore.calculatedAt,
      riskyModules: mlResult.risky_modules,
      recommendations: mlResult.recommendations,
    };
  }

  /**
   * Extract features for DQS calculation
   */
  private async extractDQSFeatures(
    developerId: string,
    organizationId: string,
  ): Promise<DQSFeatures> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get commit statistics for the developer
    const commits = await this.prisma.commit.findMany({
      where: {
        developerId,
        committedAt: { gte: thirtyDaysAgo },
        repository: { organizationId },
      },
      select: {
        classification: true,
        churnRatio: true,
        linesAdded: true,
        linesDeleted: true,
        repositoryId: true,
      },
    });

    const commitCount = commits.length;
    const bugfixCount = commits.filter((c) => c.classification === 'BUGFIX').length;
    const avgChurn =
      commitCount > 0 ? commits.reduce((sum, c) => sum + (c.churnRatio || 0), 0) / commitCount : 0;

    // Calculate bug fix ratio
    const bugFixRatio = commitCount > 0 ? bugfixCount / commitCount : 0;

    // Extract review metrics for DQS calculation
    // review metrics integrated into DQS calculation
    const reviewMetrics = await this.extractReviewMetrics(
      developerId,
      organizationId,
      thirtyDaysAgo,
    );

    // Calculate developer's average coverage in the last 30 days
    const committedRepoIds = [
      ...new Set(commits.map((c) => c.repositoryId).filter((id): id is string => !!id)),
    ];
    let avgCoverage = 0;
    if (committedRepoIds.length > 0) {
      const coverages = await Promise.all(
        committedRepoIds.map(async (repositoryId) => {
          return this.prisma.coverageReport.findFirst({
            where: {
              repositoryId,
              status: 'COMPLETED',
            },
            orderBy: { createdAt: 'desc' },
            select: { coveragePercentage: true },
          });
        })
      );
      const validCoverages = coverages.filter((c) => c !== null);
      if (validCoverages.length > 0) {
        avgCoverage =
          validCoverages.reduce((sum, c) => sum + (c.coveragePercentage || 0), 0) /
          validCoverages.length;
      }
    }

    return {
      commit_count_30d: commitCount,
      bug_fix_ratio: bugFixRatio,
      code_churn: avgChurn,
      coverage_avg: avgCoverage,
      review_count: reviewMetrics.reviewCount,
      review_turnaround_avg: reviewMetrics.avgTurnaroundHours,
    };
  }

  /**
   * Extract review metrics for a developer
   * review metrics weighted at 20% in DQS calculation
   *
   * @param developerId - Developer user ID
   * @param organizationId - Organization ID
   * @param since - Start date for metrics calculation
   * @returns Review metrics including count and average turnaround
   */
  private async extractReviewMetrics(
    developerId: string,
    organizationId: string,
    since: Date,
  ): Promise<{ reviewCount: number; avgTurnaroundHours: number }> {
    // Get reviews given by the developer in the time period
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewerId: developerId,
        submittedAt: { gte: since },
        repository: { organizationId },
      },
      select: {
        turnaroundMinutes: true,
      },
    });

    const reviewCount = reviews.length;

    // Calculate average turnaround time in hours
    // Lower turnaround is better for DQS
    let avgTurnaroundHours = 0;
    if (reviewCount > 0) {
      const totalMinutes = reviews.reduce((sum, r) => sum + (r.turnaroundMinutes || 0), 0);
      avgTurnaroundHours = totalMinutes / reviewCount / 60; // Convert minutes to hours
    }

    return {
      reviewCount,
      avgTurnaroundHours,
    };
  }

  /**
   * Extract features for SQS calculation
   *
   * This method aggregates data from all repositories assigned to a project.
   */
  private async extractSQSFeatures(
    projectId: string,
    organizationId: string,
  ): Promise<SQSFeatures> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // First, check if this is a Project ID or Repository ID
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          select: { repositoryId: true },
        },
      },
    });

    let repositoryIds: string[] = [];

    if (project) {
      // It's a project - get all assigned repository IDs
      repositoryIds = project.repositories.map((pr) => pr.repositoryId);
    } else {
      // It's a repository ID (backward compatibility)
      repositoryIds = [projectId];
    }

    if (repositoryIds.length === 0) {
      // No repositories assigned to project
      return {
        avg_dqs: 50,
        coverage: 0,
        churn_rate: 0,
        debt_count: 0,
        bug_density: 0,
      };
    }

    // Get commit statistics for all repositories in the project
    const commits = await this.prisma.commit.findMany({
      where: {
        repositoryId: { in: repositoryIds },
        committedAt: { gte: thirtyDaysAgo },
      },
      select: {
        developerId: true,
        classification: true,
        churnRatio: true,
      },
    });

    const commitCount = commits.length;
    const avgChurn =
      commitCount > 0 ? commits.reduce((sum, c) => sum + (c.churnRatio || 0), 0) / commitCount : 0;

    // Get unique developers
    const uniqueDeveloperIds = [
      ...new Set(commits.filter((c) => c.developerId).map((c) => c.developerId as string)),
    ];

    // Calculate average DQS of developers working on this project
    let avgDqs = 50; // Default
    if (uniqueDeveloperIds.length > 0) {
      const scores = await Promise.all(
        uniqueDeveloperIds.map(async (developerId) => {
          return this.prisma.dQSScore.findFirst({
            where: { developerId },
            orderBy: { calculatedAt: 'desc' },
            select: { score: true },
          });
        })
      );
      const developerScores = scores.filter((s) => s !== null);

      if (developerScores.length > 0) {
        avgDqs = developerScores.reduce((sum, s) => sum + s.score, 0) / developerScores.length;
      }
    }

    // Calculate bug density
    const bugfixCount = commits.filter((c) => c.classification === 'BUGFIX').length;
    const bugDensity = commitCount > 0 ? bugfixCount / commitCount : 0;

    // Get technical debt count
    const debtCount = await this.prisma.debtItem.count({
      where: {
        repositoryId: { in: repositoryIds },
        isResolved: false,
      },
    });

    // Get average coverage from latest coverage reports
    const coverages = await Promise.all(
      repositoryIds.map(async (repositoryId) => {
        return this.prisma.coverageReport.findFirst({
          where: {
            repositoryId,
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
          select: { coveragePercentage: true },
        });
      })
    );
    const latestCoverages = coverages.filter((c) => c !== null);

    let avgCoverage = 0;
    if (latestCoverages.length > 0) {
      avgCoverage =
        latestCoverages.reduce((sum, c) => sum + (c.coveragePercentage || 0), 0) /
        latestCoverages.length;
    }

    return {
      avg_dqs: avgDqs,
      coverage: avgCoverage,
      churn_rate: avgChurn,
      debt_count: debtCount,
      bug_density: bugDensity,
    };
  }

  /**
   * Publish score.calculated event for WebSocket real-time updates
   *
   * @param entityType - Type of entity (developer or project)
   * @param entityId - The entity ID
   * @param organizationId - The organization ID
   * @param oldScore - The previous score (null if first calculation)
   * @param newScore - The new calculated score
   * @param scoreType - Type of score (dqs or sqs)
   */
  private publishScoreCalculatedEvent(
    entityType: 'developer' | 'project',
    entityId: string,
    organizationId: string,
    oldScore: number | null,
    newScore: number,
    scoreType: 'dqs' | 'sqs',
  ): void {
    this.eventEmitter.emit('score.calculated', {
      entityType,
      entityId,
      organizationId,
      oldScore,
      newScore,
      scoreType,
    });

    this.logger.debug(
      `Published score.calculated event for ${entityType}:${entityId} (${scoreType}: ${oldScore ?? 'N/A'} -> ${newScore})`,
    );
  }
}
