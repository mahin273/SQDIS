import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { CacheService, CACHE_TTL, CACHE_PREFIX } from '../../cache';
import {
  LeaderboardQueryDto,
  LeaderboardResponseDto,
  LeaderboardEntryDto,
  LeaderboardSortField,
  SortOrder,
  TimePeriod,
  TeamLeaderboardResponseDto,
  TeamLeaderboardEntryDto,
} from '../dto/leaderboard.dto';

/**
 * Service for developer and team leaderboard functionality
 */
@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  private getDateRange(period: TimePeriod): {
    startDate: Date;
    endDate: Date;
    previousStartDate: Date;
  } {
    const endDate = new Date();
    let startDate: Date;
    let previousStartDate: Date;

    switch (period) {
      case TimePeriod.WEEK:
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.MONTH:
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.QUARTER:
        startDate = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        previousStartDate = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case TimePeriod.ALL:
      default:
        startDate = new Date(0);
        previousStartDate = new Date(0);
        break;
    }

    return { startDate, endDate, previousStartDate };
  }

  async getLeaderboard(
    organizationId: string,
    query: LeaderboardQueryDto,
  ): Promise<LeaderboardResponseDto> {
    const { teamId, sortBy, sortOrder, period } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const cacheKey = this.buildCacheKey(organizationId, query);

    const cached = await this.cacheService.get<LeaderboardResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for leaderboard: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for leaderboard: ${cacheKey}`);

    const developers = await this.getDevelopersWithMetrics(
      organizationId,
      teamId,
      period || TimePeriod.MONTH,
    );
    const sortedDevelopers = this.sortDevelopers(developers, sortBy, sortOrder);

    const total = sortedDevelopers.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedDevelopers = sortedDevelopers.slice(skip, skip + limit);

    const entries: LeaderboardEntryDto[] = paginatedDevelopers.map((dev, index) => ({
      ...dev,
      rank: skip + index + 1,
    }));

    const result: LeaderboardResponseDto = {
      entries,
      total,
      page,
      limit,
      totalPages,
      period: period || TimePeriod.MONTH,
      cachedAt: new Date(),
    };

    await this.cacheService.set(cacheKey, result, CACHE_TTL.LEADERBOARD);

    return result;
  }

  private async getDevelopersWithMetrics(
    organizationId: string,
    teamId?: string,
    period: TimePeriod = TimePeriod.MONTH,
  ): Promise<Omit<LeaderboardEntryDto, 'rank'>[]> {
    const { startDate, endDate, previousStartDate } = this.getDateRange(period);

    const memberWhere: any = { organizationId };

    if (teamId) {
      memberWhere.user = {
        teamMemberships: {
          some: { teamId, leftAt: null },
        },
      };
    }

    const members = await this.prisma.organizationMember.findMany({
      where: memberWhere,
      include: {
        user: {
          include: {
            teamMemberships: {
              where: { leftAt: null },
              include: { team: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    const developersWithMetrics = await Promise.all(
      members.map(async (member) => {
        const userId = member.userId;
        const user = member.user;

        // Get commit statistics
        const commits = await this.prisma.commit.findMany({
          where: {
            developerId: userId,
            committedAt: { gte: startDate, lte: endDate },
            repository: { organizationId },
          },
          select: {
            classification: true,
            churnRatio: true,
            committedAt: true,
          },
          orderBy: { committedAt: 'desc' },
        });

        const commitCount = commits.length;
        const bugFixCount = commits.filter((c) => c.classification === 'BUGFIX').length;
        const featureCount = commits.filter((c) => c.classification === 'FEATURE').length;
        const refactorCount = commits.filter((c) => c.classification === 'REFACTOR').length;
        const testCount = commits.filter((c) => c.classification === 'TEST').length;
        const docsCount = commits.filter((c) => c.classification === 'DOCS').length;
        const avgChurn =
          commitCount > 0
            ? commits.reduce((sum, c) => sum + (c.churnRatio || 0), 0) / commitCount
            : 0;

        const streak = this.calculateStreak(commits.map((c) => c.committedAt));

        // Get latest DQS score
        const latestDqs = await this.prisma.dQSScore.findFirst({
          where: { developerId: userId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // Get previous period DQS for trend
        const previousDqs = await this.prisma.dQSScore.findFirst({
          where: {
            developerId: userId,
            calculatedAt: { lt: startDate, gte: previousStartDate },
          },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        const dqsTrend =
          latestDqs?.score && previousDqs?.score
            ? Math.round((latestDqs.score - previousDqs.score) * 10) / 10
            : null;

        // Get review statistics (reviews given by this user)
        const reviewsGiven = await this.prisma.review.count({
          where: {
            reviewerId: userId,
            submittedAt: { gte: startDate, lte: endDate },
          },
        });

        // Get reviews received (reviews on PRs authored by this user)
        // Since Review doesn't have pullRequest relation, we count reviews where the user is mentioned
        // For now, we'll use a simpler approach - count reviews on repos where user has commits
        const reviewsReceived = await this.prisma.review.count({
          where: {
            reviewerId: { not: userId },
            submittedAt: { gte: startDate, lte: endDate },
            repository: {
              organizationId,
              commits: {
                some: { developerId: userId },
              },
            },
          },
        });

        // PR merge rate - we don't have a PullRequest model, so we'll estimate from commits
        // For now, set to 100% if user has commits, 0% otherwise
        const prMergeRate = commitCount > 0 ? 100 : 0;

        // Average review turnaround (in hours) - for reviews given by this user
        const reviewsWithTurnaround = await this.prisma.review.findMany({
          where: {
            reviewerId: userId,
            submittedAt: { gte: startDate, lte: endDate },
            turnaroundMinutes: { not: null },
          },
          select: { turnaroundMinutes: true },
        });

        let avgReviewTurnaround: number | null = null;
        if (reviewsWithTurnaround.length > 0) {
          const totalMinutes = reviewsWithTurnaround.reduce(
            (sum, r) => sum + (r.turnaroundMinutes || 0),
            0,
          );
          avgReviewTurnaround =
            Math.round((totalMinutes / reviewsWithTurnaround.length / 60) * 10) / 10;
        }

        const teamIds = user.teamMemberships.map((tm) => tm.team.id);
        const teamNames = user.teamMemberships.map((tm) => tm.team.name);

        return {
          developerId: userId,
          developerName: user.name,
          developerEmail: user.email,
          avatarUrl: user.avatarUrl,
          dqs: latestDqs?.score ?? null,
          dqsTrend,
          commitCount,
          bugFixCount,
          featureCount,
          refactorCount,
          testCount,
          docsCount,
          churn: Math.round(avgChurn * 10000) / 10000,
          coverage: 0,
          reviewsGiven,
          reviewsReceived,
          prMergeRate,
          avgReviewTurnaround,
          streak,
          teamIds,
          teamNames,
        };
      }),
    );

    return developersWithMetrics;
  }

  private calculateStreak(commitDates: Date[]): number {
    if (commitDates.length === 0) return 0;

    const uniqueDays = new Set(commitDates.map((d) => new Date(d).toISOString().split('T')[0]));
    const sortedDays = Array.from(uniqueDays).sort().reverse();

    if (sortedDays.length === 0) return 0;

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
      return 0;
    }

    let streak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const currentDate = new Date(sortedDays[i - 1]);
      const prevDate = new Date(sortedDays[i]);
      const diffDays = Math.floor(
        (currentDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  async getTeamLeaderboard(
    organizationId: string,
    query: LeaderboardQueryDto,
  ): Promise<TeamLeaderboardResponseDto> {
    const { period } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const cacheKey = `team_${this.buildCacheKey(organizationId, query)}`;

    const cached = await this.cacheService.get<TeamLeaderboardResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const { startDate, endDate, previousStartDate } = this.getDateRange(period || TimePeriod.MONTH);

    const teams = await this.prisma.team.findMany({
      where: { organizationId, isActive: true },
      include: {
        memberships: {
          where: { leftAt: null },
          include: { user: { select: { id: true } } },
        },
      },
    });

    const teamEntries = await Promise.all(
      teams.map(async (team) => {
        const memberIds = team.memberships.map((m) => m.user.id);
        const memberCount = memberIds.length;

        if (memberCount === 0) {
          return {
            teamId: team.id,
            teamName: team.name,
            memberCount: 0,
            avgDqs: null,
            dqsTrend: null,
            totalCommits: 0,
            sprintVelocity: null,
            avgReviewTurnaround: null,
            technicalDebtReduction: null,
            goalCompletionRate: null,
          };
        }

        const totalCommits = await this.prisma.commit.count({
          where: {
            developerId: { in: memberIds },
            committedAt: { gte: startDate, lte: endDate },
            repository: { organizationId },
          },
        });

        const dqsScores = await this.prisma.dQSScore.findMany({
          where: { developerId: { in: memberIds } },
          orderBy: { calculatedAt: 'desc' },
          distinct: ['developerId'],
          select: { score: true },
        });

        const avgDqs =
          dqsScores.length > 0
            ? Math.round((dqsScores.reduce((sum, s) => sum + s.score, 0) / dqsScores.length) * 10) /
              10
            : null;

        const previousDqsScores = await this.prisma.dQSScore.findMany({
          where: {
            developerId: { in: memberIds },
            calculatedAt: { lt: startDate, gte: previousStartDate },
          },
          orderBy: { calculatedAt: 'desc' },
          distinct: ['developerId'],
          select: { score: true },
        });

        const previousAvgDqs =
          previousDqsScores.length > 0
            ? previousDqsScores.reduce((sum, s) => sum + s.score, 0) / previousDqsScores.length
            : null;

        const dqsTrend =
          avgDqs !== null && previousAvgDqs !== null
            ? Math.round((avgDqs - previousAvgDqs) * 10) / 10
            : null;

        const reviewsWithTurnaround = await this.prisma.review.findMany({
          where: {
            reviewerId: { in: memberIds },
            submittedAt: { gte: startDate, lte: endDate },
            turnaroundMinutes: { not: null },
          },
          select: { turnaroundMinutes: true },
        });

        let avgReviewTurnaround: number | null = null;
        if (reviewsWithTurnaround.length > 0) {
          const totalMinutes = reviewsWithTurnaround.reduce(
            (sum, r) => sum + (r.turnaroundMinutes || 0),
            0,
          );
          avgReviewTurnaround =
            Math.round((totalMinutes / reviewsWithTurnaround.length / 60) * 10) / 10;
        }

        const goals = await this.prisma.goal.findMany({
          where: {
            teamId: team.id,
            createdAt: { gte: startDate, lte: endDate },
          },
          select: { status: true },
        });

        const goalCompletionRate =
          goals.length > 0
            ? Math.round((goals.filter((g) => g.status === 'ACHIEVED').length / goals.length) * 100)
            : null;

        return {
          teamId: team.id,
          teamName: team.name,
          memberCount,
          avgDqs,
          dqsTrend,
          totalCommits,
          sprintVelocity: null,
          avgReviewTurnaround,
          technicalDebtReduction: null,
          goalCompletionRate,
        };
      }),
    );

    const sortedTeams = [...teamEntries].sort((a, b) => {
      const aValue = a.avgDqs ?? -Infinity;
      const bValue = b.avgDqs ?? -Infinity;
      return bValue - aValue;
    });

    const total = sortedTeams.length;
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;
    const paginatedTeams = sortedTeams.slice(skip, skip + limit);

    const entries: TeamLeaderboardEntryDto[] = paginatedTeams.map((team, index) => ({
      ...team,
      rank: skip + index + 1,
    }));

    const result: TeamLeaderboardResponseDto = {
      entries,
      total,
      page,
      limit,
      totalPages,
      period: period || TimePeriod.MONTH,
      cachedAt: new Date(),
    };

    await this.cacheService.set(cacheKey, result, CACHE_TTL.LEADERBOARD);

    return result;
  }

  private sortDevelopers(
    developers: Omit<LeaderboardEntryDto, 'rank'>[],
    sortBy: LeaderboardSortField = LeaderboardSortField.DQS,
    sortOrder: SortOrder = SortOrder.DESC,
  ): Omit<LeaderboardEntryDto, 'rank'>[] {
    const multiplier = sortOrder === SortOrder.DESC ? -1 : 1;

    return [...developers].sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case LeaderboardSortField.DQS:
          aValue = a.dqs ?? -Infinity;
          bValue = b.dqs ?? -Infinity;
          break;
        case LeaderboardSortField.COMMIT_COUNT:
          aValue = a.commitCount;
          bValue = b.commitCount;
          break;
        case LeaderboardSortField.BUG_FIX_COUNT:
          aValue = a.bugFixCount;
          bValue = b.bugFixCount;
          break;
        case LeaderboardSortField.CHURN:
          aValue = a.churn;
          bValue = b.churn;
          break;
        case LeaderboardSortField.COVERAGE:
          aValue = a.coverage;
          bValue = b.coverage;
          break;
        case LeaderboardSortField.REVIEWS_GIVEN:
          aValue = a.reviewsGiven;
          bValue = b.reviewsGiven;
          break;
        case LeaderboardSortField.PR_MERGE_RATE:
          aValue = a.prMergeRate;
          bValue = b.prMergeRate;
          break;
        case LeaderboardSortField.STREAK:
          aValue = a.streak;
          bValue = b.streak;
          break;
        default:
          aValue = a.dqs ?? -Infinity;
          bValue = b.dqs ?? -Infinity;
      }

      return (aValue - bValue) * multiplier;
    });
  }

  private buildCacheKey(organizationId: string, query: LeaderboardQueryDto): string {
    const parts = [
      CACHE_PREFIX.LEADERBOARD,
      organizationId,
      query.teamId || 'all',
      query.sortBy || LeaderboardSortField.DQS,
      query.sortOrder || SortOrder.DESC,
      query.period || TimePeriod.MONTH,
      `p${query.page || 1}`,
      `l${query.limit || 20}`,
    ];
    return parts.join(':');
  }

  async invalidateLeaderboardCache(organizationId: string): Promise<void> {
    const pattern = `${CACHE_PREFIX.LEADERBOARD}:${organizationId}:*`;
    await this.cacheService.deletePattern(pattern);
    this.logger.debug(`Invalidated leaderboard cache for organization: ${organizationId}`);
  }
}
