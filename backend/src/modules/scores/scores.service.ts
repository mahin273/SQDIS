import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma';
import {
  ScoresMlClientService,
  DQSFeatures,
  SQSFeatures,
} from './services/scores-ml-client.service';
import { ScoresCacheService, CACHE_KEYS, CACHE_TTL } from './services/scores-cache.service';
import { DQSHistoryQueryDto, SQSHistoryQueryDto, ScoreType } from './dto';
import { ScoreJobData, ScoreJobType } from './types';
import { SCORE_QUEUE } from '../../config';

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
    const jobId = `${data.type}-${data.entityId}-${Date.now()}`;

    this.logger.debug(
      `Enqueuing ${data.type.toUpperCase()} score calculation for ${data.entityId}`,
    );

    return this.scoreQueue.add(data.type, data, {
      jobId,
      // Deduplicate jobs for the same entity within 5 minutes
      deduplication: {
        id: `${data.type}-${data.entityId}`,
      },
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

    // Call ML service for SQS prediction
    const mlResult = await this.mlClient.predictSQS(projectId, features);

    if (!mlResult) {
      this.logger.warn(`ML service unavailable for SQS calculation`);
      return {
        projectId,
        score: null,
        message: 'ML service unavailable',
        features,
      };
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
