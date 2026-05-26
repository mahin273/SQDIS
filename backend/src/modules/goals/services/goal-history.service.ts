import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma';
import { GoalStatus, MetricType, ComparisonOp } from '@prisma/client';
import { GoalProgressService } from './goal-progress.service';

/**
 * Interface for goal snapshot data
 */
export interface GoalSnapshotData {
  goalId: string;
  organizationId: string;
  ownerId: string;
  teamId: string | null;
  projectId: string | null;
  name: string;
  description: string | null;
  metricType: MetricType;
  targetValue: number;
  finalValue: number;
  operator: ComparisonOp;
  startDate: Date;
  endDate: Date;
  finalStatus: GoalStatus;
  progressPercentage: number;
  wasAchieved: boolean;
}

/**
 * Interface for achievement rate calculation
 */
export interface AchievementRate {
  period: string;
  totalGoals: number;
  achievedGoals: number;
  failedGoals: number;
  achievementRate: number;
}

/**
 * Interface for team achievement comparison
 */
export interface TeamAchievementComparison {
  teamId: string;
  teamName: string;
  totalGoals: number;
  achievedGoals: number;
  achievementRate: number;
}

/**
 * Service for managing goal historical tracking
 */
@Injectable()
export class GoalHistoryService {
  private readonly logger = new Logger(GoalHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly progressService: GoalProgressService,
  ) {}

  /**
   * Snapshot goal state when period ends
   * snapshot final state when goal period ends
   *
   * @param goalId - The goal ID to snapshot
   * @returns The created snapshot
   */
  async snapshotGoal(goalId: string): Promise<GoalSnapshotData> {
    const goal = await this.prisma.goal.findUnique({
      where: { id: goalId },
      include: { keyResults: true },
    });

    if (!goal) {
      throw new Error(`Goal with ID ${goalId} not found`);
    }

    // Calculate final progress
    const progress = await this.progressService.calculateProgress(goalId);

    const snapshotData: GoalSnapshotData = {
      goalId: goal.id,
      organizationId: goal.organizationId,
      ownerId: goal.ownerId,
      teamId: goal.teamId,
      projectId: goal.projectId,
      name: goal.name,
      description: goal.description,
      metricType: goal.metricType,
      targetValue: goal.targetValue,
      finalValue: goal.currentValue,
      operator: goal.operator,
      startDate: goal.startDate,
      endDate: goal.endDate,
      finalStatus: progress.status,
      progressPercentage: progress.progressPercentage,
      wasAchieved: progress.isAchieved,
    };

    // Create the snapshot in the database
    await this.prisma.goalSnapshot.create({
      data: snapshotData,
    });

    this.logger.log(`Created snapshot for goal ${goalId}`);

    return snapshotData;
  }

  /**
   * Cron job to snapshot goals when their period ends
   * Runs daily at midnight to check for ended goals
   * snapshot final state when goal period ends
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async snapshotEndedGoals(): Promise<void> {
    this.logger.log('Starting daily goal snapshot check');

    try {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Find goals that ended yesterday and haven't been snapshotted
      const endedGoals = await this.prisma.goal.findMany({
        where: {
          endDate: {
            gte: yesterday,
            lt: now,
          },
          status: {
            in: [GoalStatus.ACTIVE, GoalStatus.AT_RISK, GoalStatus.ACHIEVED, GoalStatus.FAILED],
          },
        },
      });

      this.logger.log(`Found ${endedGoals.length} goals that ended yesterday`);

      for (const goal of endedGoals) {
        try {
          // Check if snapshot already exists
          const existingSnapshot = await this.prisma.goalSnapshot.findFirst({
            where: { goalId: goal.id },
          });

          if (!existingSnapshot) {
            await this.snapshotGoal(goal.id);
          }
        } catch (error) {
          this.logger.error(`Error snapshotting goal ${goal.id}: ${error.message}`);
        }
      }

      this.logger.log('Daily goal snapshot check complete');
    } catch (error) {
      this.logger.error(`Error in daily goal snapshot check: ${error.message}`);
    }
  }

  /**
   * Calculate achievement rate over time
   * show achievement rate over time
   *
   * @param organizationId - Organization ID
   * @param teamId - Optional team ID filter
   * @param periodMonths - Number of months to look back (default 12)
   * @returns Array of achievement rates by period
   */
  async calculateAchievementRateOverTime(
    organizationId: string,
    teamId?: string,
    periodMonths: number = 12,
  ): Promise<AchievementRate[]> {
    const results: AchievementRate[] = [];
    const now = new Date();

    for (let i = 0; i < periodMonths; i++) {
      const periodEnd = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);

      const where: any = {
        organizationId,
        snapshotAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      };

      if (teamId) {
        where.teamId = teamId;
      }

      const [totalGoals, achievedGoals, failedGoals] = await Promise.all([
        this.prisma.goalSnapshot.count({ where }),
        this.prisma.goalSnapshot.count({ where: { ...where, wasAchieved: true } }),
        this.prisma.goalSnapshot.count({ where: { ...where, wasAchieved: false } }),
      ]);

      const achievementRate = totalGoals > 0 ? (achievedGoals / totalGoals) * 100 : 0;

      results.push({
        period: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}`,
        totalGoals,
        achievedGoals,
        failedGoals,
        achievementRate: Math.round(achievementRate * 100) / 100,
      });
    }

    // Reverse to show oldest first
    return results.reverse();
  }

  /**
   * Calculate team achievement percentages
   * compute team achievement percentages
   *
   * @param organizationId - Organization ID
   * @param startDate - Start date for the period
   * @param endDate - End date for the period
   * @returns Array of team achievement comparisons
   */
  async calculateTeamAchievementPercentages(
    organizationId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<TeamAchievementComparison[]> {
    const where: any = {
      organizationId,
      teamId: { not: null },
    };

    if (startDate && endDate) {
      where.snapshotAt = {
        gte: startDate,
        lte: endDate,
      };
    }

    // Get all snapshots with team IDs
    const snapshots = await this.prisma.goalSnapshot.findMany({
      where,
      select: {
        teamId: true,
        wasAchieved: true,
      },
    });

    // Group by team
    const teamStats = new Map<string, { total: number; achieved: number }>();

    for (const snapshot of snapshots) {
      if (!snapshot.teamId) continue;

      const stats = teamStats.get(snapshot.teamId) || { total: 0, achieved: 0 };
      stats.total++;
      if (snapshot.wasAchieved) {
        stats.achieved++;
      }
      teamStats.set(snapshot.teamId, stats);
    }

    // Get team names
    const teamIds = Array.from(teamStats.keys());
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    });

    const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

    // Build result
    const results: TeamAchievementComparison[] = [];

    for (const [teamId, stats] of teamStats) {
      results.push({
        teamId,
        teamName: teamNameMap.get(teamId) || 'Unknown Team',
        totalGoals: stats.total,
        achievedGoals: stats.achieved,
        achievementRate:
          stats.total > 0 ? Math.round((stats.achieved / stats.total) * 10000) / 100 : 0,
      });
    }

    // Sort by achievement rate descending
    return results.sort((a, b) => b.achievementRate - a.achievementRate);
  }

  /**
   * Get goal history with snapshots
   * show achievement rate over time
   *
   * @param organizationId - Organization ID
   * @param filters - Optional filters
   * @returns Paginated goal snapshots with metadata
   */
  async getGoalHistory(
    organizationId: string,
    filters: {
      teamId?: string;
      ownerId?: string;
      metricType?: MetricType;
      wasAchieved?: boolean;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const {
      teamId,
      ownerId,
      metricType,
      wasAchieved,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };

    if (teamId) where.teamId = teamId;
    if (ownerId) where.ownerId = ownerId;
    if (metricType) where.metricType = metricType;
    if (wasAchieved !== undefined) where.wasAchieved = wasAchieved;
    if (startDate || endDate) {
      where.snapshotAt = {};
      if (startDate) where.snapshotAt.gte = startDate;
      if (endDate) where.snapshotAt.lte = endDate;
    }

    const [snapshots, total] = await Promise.all([
      this.prisma.goalSnapshot.findMany({
        where,
        orderBy: { snapshotAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goalSnapshot.count({ where }),
    ]);

    // Calculate overall achievement rate for the filtered results
    const achievedCount = await this.prisma.goalSnapshot.count({
      where: { ...where, wasAchieved: true },
    });

    const achievementRate = total > 0 ? (achievedCount / total) * 100 : 0;

    return {
      data: snapshots,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        achievementRate: Math.round(achievementRate * 100) / 100,
      },
    };
  }

  /**
   * Get goal history for reports
   * include goal history in reports
   *
   * @param organizationId - Organization ID
   * @param options - Report options
   * @returns Report data with goal history
   */
  async getGoalHistoryForReports(
    organizationId: string,
    options: {
      teamId?: string;
      startDate?: Date;
      endDate?: Date;
      includeTeamComparison?: boolean;
    } = {},
  ) {
    const { teamId, startDate, endDate, includeTeamComparison = true } = options;

    // Get snapshots for the period
    const where: any = { organizationId };
    if (teamId) where.teamId = teamId;
    if (startDate || endDate) {
      where.snapshotAt = {};
      if (startDate) where.snapshotAt.gte = startDate;
      if (endDate) where.snapshotAt.lte = endDate;
    }

    const snapshots = await this.prisma.goalSnapshot.findMany({
      where,
      orderBy: { snapshotAt: 'desc' },
    });

    // Calculate summary statistics
    const totalGoals = snapshots.length;
    const achievedGoals = snapshots.filter((s) => s.wasAchieved).length;
    const failedGoals = snapshots.filter((s) => !s.wasAchieved).length;
    const achievementRate = totalGoals > 0 ? (achievedGoals / totalGoals) * 100 : 0;

    // Calculate average progress
    const avgProgress =
      totalGoals > 0 ? snapshots.reduce((sum, s) => sum + s.progressPercentage, 0) / totalGoals : 0;

    // Group by metric type
    const byMetricType = new Map<MetricType, { total: number; achieved: number }>();
    for (const snapshot of snapshots) {
      const stats = byMetricType.get(snapshot.metricType) || { total: 0, achieved: 0 };
      stats.total++;
      if (snapshot.wasAchieved) stats.achieved++;
      byMetricType.set(snapshot.metricType, stats);
    }

    const metricTypeBreakdown = Array.from(byMetricType.entries()).map(([type, stats]) => ({
      metricType: type,
      totalGoals: stats.total,
      achievedGoals: stats.achieved,
      achievementRate:
        stats.total > 0 ? Math.round((stats.achieved / stats.total) * 10000) / 100 : 0,
    }));

    // Get team comparison if requested
    let teamComparison: TeamAchievementComparison[] = [];
    if (includeTeamComparison) {
      teamComparison = await this.calculateTeamAchievementPercentages(
        organizationId,
        startDate,
        endDate,
      );
    }

    return {
      summary: {
        totalGoals,
        achievedGoals,
        failedGoals,
        achievementRate: Math.round(achievementRate * 100) / 100,
        averageProgress: Math.round(avgProgress * 100) / 100,
      },
      metricTypeBreakdown,
      teamComparison,
      goals: snapshots.map((s) => ({
        goalId: s.goalId,
        name: s.name,
        metricType: s.metricType,
        targetValue: s.targetValue,
        finalValue: s.finalValue,
        progressPercentage: s.progressPercentage,
        wasAchieved: s.wasAchieved,
        finalStatus: s.finalStatus,
        startDate: s.startDate,
        endDate: s.endDate,
        snapshotAt: s.snapshotAt,
      })),
    };
  }
}
