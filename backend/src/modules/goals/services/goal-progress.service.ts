import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GoalStatus, ComparisonOp, Goal, KeyResult, MetricType } from '@prisma/client';

export interface GoalProgress {
  goalId: string;
  currentValue: number;
  targetValue: number;
  progressPercentage: number;
  status: GoalStatus;
  isAchieved: boolean;
  daysRemaining: number;
  expectedProgress: number;
  isOnTrack: boolean;
}

export interface KeyResultProgress {
  keyResultId: string;
  currentValue: number;
  targetValue: number;
  progressPercentage: number;
  weight: number;
}

/**
 * Service for calculating and tracking goal progress
 */
@Injectable()
export class GoalProgressService {
  private readonly logger = new Logger(GoalProgressService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Calculate progress for a goal
   */
  async calculateProgress(goalId: string): Promise<GoalProgress> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: { keyResults: true },
    });

    if (!goal) {
      throw new Error(`Goal with ID ${goalId} not found`);
    }

    const now = new Date();
    const startDate = new Date(goal.startDate);
    const endDate = new Date(goal.endDate);

    // Calculate days remaining
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    // Calculate progress percentage
    let progressPercentage: number;
    if (goal.keyResults.length > 0) {
      // For OKRs, calculate weighted average of key results
      progressPercentage = this.calculateOKRProgress(goal.keyResults);
    } else {
      // For simple goals, calculate based on current vs target
      progressPercentage = this.calculateSimpleProgress(
        goal.currentValue,
        goal.targetValue,
        goal.operator,
      );
    }

    // Calculate expected progress based on time elapsed
    const expectedProgress = totalDays > 0 ? Math.min(100, (daysElapsed / totalDays) * 100) : 100;

    // Determine if goal is achieved
    // For OKRs, check if all key results are achieved
    // For simple goals, use the comparison operator
    const isAchieved =
      goal.keyResults.length > 0
        ? this.isOKRAchieved(goal.keyResults)
        : this.checkAchievement(goal.currentValue, goal.targetValue, goal.operator);

    // Determine if on track
    const isOnTrack = progressPercentage >= expectedProgress * 0.8; // Within 80% of expected

    // Determine status
    let status = goal.status;
    if (isAchieved && status !== GoalStatus.ACHIEVED) {
      status = GoalStatus.ACHIEVED;
    } else if (!isOnTrack && status === GoalStatus.ACTIVE) {
      status = GoalStatus.AT_RISK;
    } else if (now > endDate && !isAchieved) {
      status = GoalStatus.FAILED;
    }

    return {
      goalId,
      currentValue: goal.currentValue,
      targetValue: goal.targetValue,
      progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
      status,
      isAchieved,
      daysRemaining,
      expectedProgress,
      isOnTrack,
    };
  }

  /**
   * Calculate progress for OKRs with key results as weighted average
   * calculate OKR progress as weighted average of key results
   *
   * The formula is: sum(keyResult.progress * keyResult.weight) / sum(keyResult.weight)
   * where keyResult.progress = (currentValue / targetValue) * 100
   *
   * @param keyResults - Array of key results for the OKR
   * @returns Progress percentage (0-100)
   */
  calculateOKRProgress(keyResults: KeyResult[]): number {
    if (keyResults.length === 0) return 0;

    const totalWeight = keyResults.reduce((sum, kr) => sum + kr.weight, 0);

    if (totalWeight === 0) return 0;

    const weightedProgress = keyResults.reduce((sum, kr) => {
      const progress = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
      return sum + progress * kr.weight;
    }, 0);

    return weightedProgress / totalWeight;
  }

  /**
   * Check if an OKR is achieved (all key results meet their targets)
   * update OKR progress when key result achieved
   *
   * @param keyResults - Array of key results for the OKR
   * @returns True if all key results have achieved their targets
   */
  isOKRAchieved(keyResults: KeyResult[]): boolean {
    if (keyResults.length === 0) return false;

    return keyResults.every((kr) => kr.currentValue >= kr.targetValue);
  }

  /**
   * Get detailed progress for each key result in an OKR
   * display objective with nested key results
   *
   * @param keyResults - Array of key results
   * @returns Array of key result progress details
   */
  getKeyResultsProgress(keyResults: KeyResult[]): Array<{
    id: string;
    description: string;
    currentValue: number;
    targetValue: number;
    progressPercentage: number;
    weight: number;
    isAchieved: boolean;
  }> {
    return keyResults.map((kr) => ({
      id: kr.id,
      description: kr.description,
      currentValue: kr.currentValue,
      targetValue: kr.targetValue,
      progressPercentage:
        kr.targetValue > 0
          ? Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100))
          : 0,
      weight: kr.weight,
      isAchieved: kr.currentValue >= kr.targetValue,
    }));
  }

  /**
   * Calculate simple goal progress based on comparison operator
   */
  private calculateSimpleProgress(
    currentValue: number,
    targetValue: number,
    operator: ComparisonOp,
  ): number {
    if (targetValue === 0) return currentValue > 0 ? 100 : 0;

    switch (operator) {
      case ComparisonOp.GT:
      case ComparisonOp.GTE:
        // For "greater than" goals, progress is current/target
        return (currentValue / targetValue) * 100;
      case ComparisonOp.LT:
      case ComparisonOp.LTE:
        // For "less than" goals, progress is inverse
        if (currentValue >= targetValue) return 0;
        return ((targetValue - currentValue) / targetValue) * 100;
      case ComparisonOp.EQ: {
        // For "equal" goals, progress is how close we are
        const diff = Math.abs(currentValue - targetValue);
        return Math.max(0, 100 - (diff / targetValue) * 100);
      }
      default:
        return (currentValue / targetValue) * 100;
    }
  }

  /**
   * Check if a goal is achieved based on comparison operator
   */
  checkAchievement(currentValue: number, targetValue: number, operator: ComparisonOp): boolean {
    switch (operator) {
      case ComparisonOp.GT:
        return currentValue > targetValue;
      case ComparisonOp.GTE:
        return currentValue >= targetValue;
      case ComparisonOp.LT:
        return currentValue < targetValue;
      case ComparisonOp.LTE:
        return currentValue <= targetValue;
      case ComparisonOp.EQ:
        return currentValue === targetValue;
      default:
        return false;
    }
  }

  /**
   * Update goal status and emit achievement event if achieved
   */
  async updateGoalStatus(goalId: string): Promise<void> {
    const progress = await this.calculateProgress(goalId);
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
    });

    if (!goal) return;

    const updateData: any = { status: progress.status };

    if (progress.isAchieved && goal.status !== GoalStatus.ACHIEVED) {
      updateData.achievedAt = new Date();

      // Emit achievement event
      this.eventEmitter.emit('goal.achieved', {
        goalId,
        ownerId: goal.ownerId,
        organizationId: goal.organizationId,
        teamId: goal.teamId,
        name: goal.name,
      });
    }

    await this.prisma.goal.update({
      where: { id: goalId },
      data: updateData,
    });
  }

  /**
   * Calculate key result progress
   */
  async calculateKeyResultProgress(keyResultId: string): Promise<KeyResultProgress> {
    const keyResult = await this.prisma.keyResult.findUnique({
      where: { id: keyResultId },
    });

    if (!keyResult) {
      throw new Error(`Key result with ID ${keyResultId} not found`);
    }

    const progressPercentage =
      keyResult.targetValue > 0 ? (keyResult.currentValue / keyResult.targetValue) * 100 : 0;

    return {
      keyResultId,
      currentValue: keyResult.currentValue,
      targetValue: keyResult.targetValue,
      progressPercentage: Math.min(100, Math.max(0, progressPercentage)),
      weight: keyResult.weight,
    };
  }

  /**
   * Cron job to update goal progress every hour
   * recalculate progress in real-time
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateAllGoalProgress(): Promise<void> {
    this.logger.log('Starting scheduled goal progress update');

    try {
      // Get all active goals
      const activeGoals = await this.prisma.goal.findMany({
        where: {
          status: { in: [GoalStatus.ACTIVE, GoalStatus.AT_RISK] },
        },
        include: {
          keyResults: true,
        },
      });

      this.logger.log(`Found ${activeGoals.length} active goals to update`);

      let updatedCount = 0;
      let atRiskCount = 0;
      let achievedCount = 0;

      for (const goal of activeGoals) {
        try {
          // Calculate current value from actual metrics
          const currentValue = await this.calculateCurrentValueFromMetrics(goal);

          // Update goal's current value
          await this.prisma.goal.update({
            where: { id: goal.id },
            data: { currentValue },
          });

          // Calculate progress and update status
          const progress = await this.calculateProgress(goal.id);

          // Flag goals as AT_RISK when behind schedule
          if (!progress.isOnTrack && goal.status === GoalStatus.ACTIVE) {
            await this.prisma.goal.update({
              where: { id: goal.id },
              data: { status: GoalStatus.AT_RISK },
            });
            atRiskCount++;
            this.logger.debug(`Goal ${goal.id} flagged as AT_RISK`);
          }

          // Check for achievement
          if (progress.isAchieved && goal.status !== GoalStatus.ACHIEVED) {
            await this.prisma.goal.update({
              where: { id: goal.id },
              data: {
                status: GoalStatus.ACHIEVED,
                achievedAt: new Date(),
              },
            });
            achievedCount++;

            // Emit achievement event
            this.eventEmitter.emit('goal.achieved', {
              goalId: goal.id,
              ownerId: goal.ownerId,
              organizationId: goal.organizationId,
              teamId: goal.teamId,
              name: goal.name,
            });

            this.logger.log(`Goal ${goal.id} achieved!`);
          }

          // Check for failed goals (past end date and not achieved)
          const now = new Date();
          if (now > goal.endDate && !progress.isAchieved && goal.status !== GoalStatus.FAILED) {
            await this.prisma.goal.update({
              where: { id: goal.id },
              data: { status: GoalStatus.FAILED },
            });
            this.logger.debug(`Goal ${goal.id} marked as FAILED`);
          }

          updatedCount++;
        } catch (error) {
          this.logger.error(`Error updating goal ${goal.id}: ${error.message}`);
        }
      }

      this.logger.log(
        `Goal progress update complete: ${updatedCount} updated, ${atRiskCount} flagged at-risk, ${achievedCount} achieved`,
      );
    } catch (error) {
      this.logger.error(`Error in scheduled goal progress update: ${error.message}`);
    }
  }

  /**
   * Calculate current value from actual metrics based on metric type
   * display current value vs target
   *
   * @param goal - The goal to calculate current value for
   * @returns The calculated current value from actual metrics
   */
  async calculateCurrentValueFromMetrics(
    goal: Goal & { keyResults: KeyResult[] },
  ): Promise<number> {
    const now = new Date();
    const startDate = new Date(goal.startDate);

    switch (goal.metricType) {
      case MetricType.DQS:
        return this.calculateDQSMetric(goal.ownerId, goal.teamId, goal.organizationId);

      case MetricType.COVERAGE:
        return this.calculateCoverageMetric(goal.projectId, goal.organizationId);

      case MetricType.BUG_COUNT:
        return this.calculateBugCountMetric(
          goal.ownerId,
          goal.teamId,
          goal.projectId,
          goal.organizationId,
          startDate,
          now,
        );

      case MetricType.COMMIT_COUNT:
        return this.calculateCommitCountMetric(
          goal.ownerId,
          goal.teamId,
          goal.projectId,
          goal.organizationId,
          startDate,
          now,
        );

      case MetricType.REVIEW_COUNT:
        return this.calculateReviewCountMetric(
          goal.ownerId,
          goal.teamId,
          goal.organizationId,
          startDate,
          now,
        );

      default:
        return goal.currentValue;
    }
  }

  /**
   * Calculate DQS metric for a developer or team
   */
  private async calculateDQSMetric(
    ownerId: string,
    teamId: string | null,
    organizationId: string,
  ): Promise<number> {
    if (teamId) {
      // Calculate team average DQS
      const teamMembers = await this.prisma.teamMembership.findMany({
        where: { teamId, leftAt: null },
        select: { userId: true },
      });

      if (teamMembers.length === 0) return 0;

      const memberIds = teamMembers.map((m) => m.userId);
      const scores = await Promise.all(
        memberIds.map(async (developerId) => {
          return this.prisma.dQSScore.findFirst({
            where: { developerId },
            orderBy: { calculatedAt: 'desc' },
          });
        })
      );
      const latestScores = scores.filter((s) => s !== null);

      if (latestScores.length === 0) return 0;

      const avgScore = latestScores.reduce((sum, s) => sum + s.score, 0) / latestScores.length;
      return Math.round(avgScore * 100) / 100;
    } else {
      // Get individual developer's latest DQS
      const latestScore = await this.prisma.dQSScore.findFirst({
        where: { developerId: ownerId },
        orderBy: { calculatedAt: 'desc' },
      });

      return latestScore?.score ?? 0;
    }
  }

  /**
   * Calculate coverage metric for a project
   */
  private async calculateCoverageMetric(
    projectId: string | null,
    organizationId: string,
  ): Promise<number> {
    if (!projectId) {
      return 0;
    }

    const projectRepos = await this.prisma.projectRepository.findMany({
      where: { projectId },
      select: { repositoryId: true },
    });

    if (projectRepos.length === 0) {
      return 0;
    }

    const repositoryIds = projectRepos.map((r) => r.repositoryId);

    const latestReports = await Promise.all(
      repositoryIds.map((repositoryId) =>
        this.prisma.coverageReport.findFirst({
          where: {
            repositoryId,
            status: 'COMPLETED',
          },
          orderBy: { createdAt: 'desc' },
          select: { coveragePercentage: true },
        }),
      ),
    );

    const validReports = latestReports.filter(
      (r) => r !== null && r.coveragePercentage !== null,
    );

    if (validReports.length === 0) {
      return 0;
    }

    const sumCoverage = validReports.reduce((sum, r) => sum + (r?.coveragePercentage ?? 0), 0);
    const avgCoverage = sumCoverage / validReports.length;

    return Math.round(avgCoverage * 100) / 100;
  }

  /**
   * Calculate bug count metric (bugfix commits)
   */
  private async calculateBugCountMetric(
    ownerId: string,
    teamId: string | null,
    projectId: string | null,
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const where: any = {
      classification: 'BUGFIX',
      committedAt: { gte: startDate, lte: endDate },
      repository: { organizationId },
    };

    if (teamId) {
      // Get team members
      const teamMembers = await this.prisma.teamMembership.findMany({
        where: { teamId, leftAt: null },
        select: { userId: true },
      });
      where.developerId = { in: teamMembers.map((m) => m.userId) };
    } else {
      where.developerId = ownerId;
    }

    if (projectId) {
      // Get repositories for the project
      const projectRepos = await this.prisma.projectRepository.findMany({
        where: { projectId },
        select: { repositoryId: true },
      });
      where.repositoryId = { in: projectRepos.map((r) => r.repositoryId) };
    }

    const count = await this.prisma.commit.count({ where });
    return count;
  }

  /**
   * Calculate commit count metric
   */
  private async calculateCommitCountMetric(
    ownerId: string,
    teamId: string | null,
    projectId: string | null,
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const where: any = {
      committedAt: { gte: startDate, lte: endDate },
      repository: { organizationId },
    };

    if (teamId) {
      // Get team members
      const teamMembers = await this.prisma.teamMembership.findMany({
        where: { teamId, leftAt: null },
        select: { userId: true },
      });
      where.developerId = { in: teamMembers.map((m) => m.userId) };
    } else {
      where.developerId = ownerId;
    }

    if (projectId) {
      // Get repositories for the project
      const projectRepos = await this.prisma.projectRepository.findMany({
        where: { projectId },
        select: { repositoryId: true },
      });
      where.repositoryId = { in: projectRepos.map((r) => r.repositoryId) };
    }

    const count = await this.prisma.commit.count({ where });
    return count;
  }

  /**
   * Calculate review count metric
   */
  private async calculateReviewCountMetric(
    ownerId: string,
    teamId: string | null,
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const where: any = {
      submittedAt: { gte: startDate, lte: endDate },
      repository: { organizationId },
    };

    if (teamId) {
      // Get team members
      const teamMembers = await this.prisma.teamMembership.findMany({
        where: { teamId, leftAt: null },
        select: { userId: true },
      });
      where.reviewerId = { in: teamMembers.map((m) => m.userId) };
    } else {
      where.reviewerId = ownerId;
    }

    const count = await this.prisma.review.count({ where });
    return count;
  }

  /**
   * Calculate progress percentage for a goal
   * compute percentage complete
   *
   * @param currentValue - Current metric value
   * @param targetValue - Target metric value
   * @param operator - Comparison operator
   * @returns Progress percentage (0-100)
   */
  calculateProgressPercentage(
    currentValue: number,
    targetValue: number,
    operator: ComparisonOp,
  ): number {
    return this.calculateSimpleProgress(currentValue, targetValue, operator);
  }

  /**
   * Check if a goal is at risk based on progress vs expected progress
   * flag as AT_RISK when behind schedule
   *
   * @param goalId - Goal ID
   * @returns Whether the goal is at risk
   */
  async isGoalAtRisk(goalId: string): Promise<boolean> {
    const progress = await this.calculateProgress(goalId);
    return !progress.isOnTrack;
  }

  /**
   * Get detailed progress for a goal including all metrics
   * display objective with nested key results
   *
   * @param goalId - Goal ID
   * @returns Detailed progress information including nested key results for OKRs
   */
  async getDetailedProgress(goalId: string): Promise<{
    goalId: string;
    name: string;
    description: string | null;
    metricType: MetricType;
    currentValue: number;
    targetValue: number;
    operator: ComparisonOp;
    progressPercentage: number;
    expectedProgress: number;
    status: GoalStatus;
    isAchieved: boolean;
    isOnTrack: boolean;
    daysRemaining: number;
    daysElapsed: number;
    totalDays: number;
    startDate: Date;
    endDate: Date;
    isOKR: boolean;
    keyResultsCount: number;
    keyResultsAchieved: number;
    keyResults?: Array<{
      id: string;
      description: string;
      currentValue: number;
      targetValue: number;
      progressPercentage: number;
      weight: number;
      isAchieved: boolean;
    }>;
  }> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: { keyResults: true },
    });

    if (!goal) {
      throw new Error(`Goal with ID ${goalId} not found`);
    }

    const now = new Date();
    const startDate = new Date(goal.startDate);
    const endDate = new Date(goal.endDate);

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.max(
      0,
      Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const progress = await this.calculateProgress(goalId);

    // Calculate key result progress if OKR using the dedicated method
    // display objective with nested key results
    const keyResultsProgress = this.getKeyResultsProgress(goal.keyResults);
    const keyResultsAchieved = keyResultsProgress.filter((kr) => kr.isAchieved).length;

    return {
      goalId: goal.id,
      name: goal.name,
      description: goal.description,
      metricType: goal.metricType,
      currentValue: goal.currentValue,
      targetValue: goal.targetValue,
      operator: goal.operator,
      progressPercentage: progress.progressPercentage,
      expectedProgress: progress.expectedProgress,
      status: progress.status,
      isAchieved: progress.isAchieved,
      isOnTrack: progress.isOnTrack,
      daysRemaining,
      daysElapsed,
      totalDays,
      startDate: goal.startDate,
      endDate: goal.endDate,
      // OKR-specific fields
      // display objective with nested key results
      isOKR: keyResultsProgress.length > 0,
      keyResultsCount: keyResultsProgress.length,
      keyResultsAchieved,
      keyResults: keyResultsProgress.length > 0 ? keyResultsProgress : undefined,
    };
  }
}
