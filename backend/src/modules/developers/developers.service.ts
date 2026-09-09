import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma';

export interface DeveloperDto {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: string;
  teamId?: string | null;
  team?: { id: string; name: string } | null;
  dqs?: number | null;
  dqsTrend?: number | null;
  lastActive?: Date | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface DeveloperStatsDto {
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  dqs: number;
  dqsHistory: Array<{ date: string; score: number }>;
  commits: number;
  insertions: number;
  deletions: number;
  reviewsGiven: number;
  reviewsReceived: number;
  avgReviewTurnaround: number;
  codeCoverage: number;
  techDebtIntroduced: number;
  techDebtResolved: number;
  teams: Array<{ id: string; name: string }>;
  recentCommits: Array<{
    id: string;
    sha: string;
    message: string;
    committedAt: Date;
    linesAdded: number;
    linesDeleted: number;
    repositoryId?: string;
    repositoryName?: string;
  }>;
}

@Injectable()
export class DevelopersService {
  private readonly logger = new Logger(DevelopersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all developers in an organization
   */
  async getDevelopers(organizationId: string): Promise<DeveloperDto[]> {
    if (!organizationId) {
      return [];
    }

    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          include: {
            teamMemberships: {
              where: { leftAt: null },
              include: { team: { select: { id: true, name: true } } },
            },
            dqsScores: {
              orderBy: { calculatedAt: 'desc' },
              take: 1,
              select: { score: true, calculatedAt: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return members.map((member) => {
      const user = member.user;
      const activeTeam = user.teamMemberships[0]?.team;
      const latestDqs = user.dqsScores[0]?.score ?? null;

      return {
        id: user.id,
        name: user.name || user.email.split('@')[0],
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: member.role,
        teamId: activeTeam?.id || null,
        team: activeTeam || null,
        dqs: latestDqs,
        dqsTrend: null,
        lastActive: user.dqsScores[0]?.calculatedAt || null,
        status: 'ACTIVE',
      };
    });
  }

  /**
   * Get a specific developer profile by user ID
   */
  async getDeveloperById(developerId: string, organizationId: string): Promise<DeveloperDto> {
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId: developerId, organizationId },
      include: {
        user: {
          include: {
            teamMemberships: {
              where: { leftAt: null },
              include: { team: { select: { id: true, name: true } } },
            },
            dqsScores: {
              orderBy: { calculatedAt: 'desc' },
              take: 1,
              select: { score: true, calculatedAt: true },
            },
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException(`Developer with ID ${developerId} not found in organization`);
    }

    const user = member.user;
    const activeTeam = user.teamMemberships[0]?.team;

    return {
      id: user.id,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: member.role,
      teamId: activeTeam?.id || null,
      team: activeTeam || null,
      dqs: user.dqsScores[0]?.score ?? null,
      dqsTrend: null,
      lastActive: user.dqsScores[0]?.calculatedAt || null,
      status: 'ACTIVE',
    };
  }

  /**
   * Get detailed statistics and performance analytics for a developer
   */
  async getDeveloperStats(developerId: string, organizationId: string): Promise<DeveloperStatsDto> {
    // 1. Verify membership
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId: developerId, organizationId },
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

    if (!member) {
      throw new NotFoundException(`Developer with ID ${developerId} not found in organization`);
    }

    const user = member.user;

    // 2. Concurrently execute aggregations across telemetry tables
    const [
      dqsScores,
      commitAgg,
      recentCommits,
      reviewsGiven,
      debtIntroducedCount,
      debtResolvedCount,
      distinctRepos,
    ] = await Promise.all([
      // DQS score history (ordered ascending by date for line chart)
      this.prisma.dQSScore.findMany({
        where: { developerId },
        orderBy: { calculatedAt: 'asc' },
        select: { score: true, calculatedAt: true },
        take: 30,
      }),

      // Commit volume & lines churned
      this.prisma.commit.aggregate({
        where: {
          developerId,
          repository: { organizationId },
        },
        _count: { id: true },
        _sum: { linesAdded: true, linesDeleted: true },
      }),

      // Recent commits
      this.prisma.commit.findMany({
        where: {
          developerId,
          repository: { organizationId },
        },
        orderBy: { committedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          sha: true,
          message: true,
          committedAt: true,
          linesAdded: true,
          linesDeleted: true,
          repositoryId: true,
          repository: { select: { name: true } },
        },
      }),

      // Code reviews given
      this.prisma.review.findMany({
        where: {
          reviewerId: developerId,
          repository: { organizationId },
        },
        select: { turnaroundMinutes: true },
      }),

      // Technical debt introduced
      this.prisma.debtItem.count({
        where: {
          authorId: developerId,
          repository: { organizationId },
        },
      }),

      // Technical debt resolved
      this.prisma.debtItem.count({
        where: {
          resolverId: developerId,
          repository: { organizationId },
          isResolved: true,
        },
      }),

      // Distinct repositories contributed to
      this.prisma.commit.findMany({
        where: {
          developerId,
          repository: { organizationId },
        },
        distinct: ['repositoryId'],
        select: { repositoryId: true },
      }),
    ]);

    // 3. Calculate coverage across contributed repositories
    let avgCoverage = 0;
    if (distinctRepos.length > 0) {
      const repoIds = distinctRepos.map((r) => r.repositoryId);
      const coverageReports = await this.prisma.coverageReport.findMany({
        where: { repositoryId: { in: repoIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['repositoryId'],
        select: { coveragePercentage: true },
      });

      if (coverageReports.length > 0) {
        const total = coverageReports.reduce((sum, r) => sum + (r.coveragePercentage || 0), 0);
        avgCoverage = Math.round((total / coverageReports.length) * 100) / 100;
      }
    }

    // 4. Format DQS history points
    const dqsHistory = dqsScores.map((s) => ({
      date: s.calculatedAt.toISOString(),
      score: s.score,
    }));
    const latestDqs = dqsHistory.length > 0 ? dqsHistory[dqsHistory.length - 1].score : 0;

    // 5. Calculate avg review turnaround
    const avgTurnaround = reviewsGiven.length > 0
      ? Math.round(reviewsGiven.reduce((acc, r) => acc + (r.turnaroundMinutes || 0), 0) / reviewsGiven.length)
      : 0;

    const teams = user.teamMemberships.map((tm) => tm.team);

    return {
      userId: developerId,
      name: user.name || user.email.split('@')[0],
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: member.role,
      dqs: latestDqs,
      dqsHistory,
      commits: commitAgg._count.id || 0,
      insertions: commitAgg._sum.linesAdded || 0,
      deletions: commitAgg._sum.linesDeleted || 0,
      reviewsGiven: reviewsGiven.length,
      reviewsReceived: 0,
      avgReviewTurnaround: avgTurnaround,
      codeCoverage: avgCoverage,
      techDebtIntroduced: debtIntroducedCount,
      techDebtResolved: debtResolvedCount,
      teams,
      recentCommits: recentCommits.map((c) => ({
        id: c.id,
        sha: c.sha,
        message: c.message,
        committedAt: c.committedAt,
        linesAdded: c.linesAdded,
        linesDeleted: c.linesDeleted,
        repositoryId: c.repositoryId,
        repositoryName: c.repository?.name,
      })),
    };
  }
}
