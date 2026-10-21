import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { ScoresService } from '../scores/scores.service';

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
  commitCount?: number;
  repositories?: Array<{ id: string; name: string; commitCount: number }>;
  lastActive?: Date | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface RepositoryContributionDto {
  repositoryId: string;
  repositoryName: string;
  commitCount: number;
  linesAdded: number;
  linesDeleted: number;
  percentage: number;
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
  repositoryBreakdown?: RepositoryContributionDto[];
  recentCommits: Array<{
    id: string;
    sha: string;
    message: string;
    committedAt: Date;
    linesAdded: number;
    linesDeleted: number;
    classification?: string | null;
    repositoryId?: string;
    repositoryName?: string;
  }>;
}

@Injectable()
export class DevelopersService {
  private readonly logger = new Logger(DevelopersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * Get all developers in an organization
   */
  async getDevelopers(organizationId: string): Promise<DeveloperDto[]> {
    if (!organizationId) {
      return [];
    }

    const [members, commitGroups, orgRepos] = await Promise.all([
      this.prisma.organizationMember.findMany({
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
                take: 2,
                select: { score: true, calculatedAt: true },
              },
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      }),
      this.prisma.commit.groupBy({
        by: ['developerId', 'repositoryId'],
        where: {
          repository: { organizationId },
          developerId: { not: null },
        },
        _count: { id: true },
      }),
      this.prisma.repository.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
    ]);

    const repoMap = new Map<string, string>();
    for (const r of orgRepos || []) {
      repoMap.set(r.id, r.name);
    }

    const commitMap = new Map<string, number>();
    const developerReposMap = new Map<string, Array<{ id: string; name: string; commitCount: number }>>();

    for (const cg of commitGroups || []) {
      if (cg.developerId) {
        const count = cg._count?.id || 0;
        commitMap.set(cg.developerId, (commitMap.get(cg.developerId) || 0) + count);

        if (cg.repositoryId) {
          const list = developerReposMap.get(cg.developerId) || [];
          list.push({
            id: cg.repositoryId,
            name: repoMap.get(cg.repositoryId) || 'Unknown',
            commitCount: count,
          });
          developerReposMap.set(cg.developerId, list);
        }
      }
    }

    return Promise.all(
      members.map(async (member) => {
        const user = member.user;
        const activeTeam = user.teamMemberships[0]?.team;
        let latestDqs = user.dqsScores[0]?.score ?? null;
        let lastActive = user.dqsScores[0]?.calculatedAt || null;
        let dqsTrend: number | null = null;

        if (
          user.dqsScores &&
          user.dqsScores.length >= 2 &&
          user.dqsScores[0]?.score !== null &&
          user.dqsScores[1]?.score !== null
        ) {
          dqsTrend = Number((user.dqsScores[0].score - user.dqsScores[1].score).toFixed(1));
        }

        if (latestDqs === null) {
          try {
            const calculated = await this.scoresService.calculateDQS(user.id, organizationId);
            if (calculated && calculated.score !== null) {
              latestDqs = calculated.score;
              lastActive = new Date();
            }
          } catch (error) {
            this.logger.warn(`Failed to auto-evaluate DQS for developer ${user.id}: ${error}`);
          }
        }

        const commitCount = commitMap.get(user.id) || 0;
        const repositories = developerReposMap.get(user.id) || [];

        return {
          id: user.id,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          avatarUrl: user.avatarUrl,
          role: member.role,
          teamId: activeTeam?.id || null,
          team: activeTeam || null,
          dqs: latestDqs,
          dqsTrend,
          commitCount,
          repositories,
          lastActive,
          status: 'ACTIVE',
        };
      }),
    );
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
    let latestDqs = user.dqsScores[0]?.score ?? null;
    let lastActive = user.dqsScores[0]?.calculatedAt || null;

    if (latestDqs === null) {
      try {
        const calculated = await this.scoresService.calculateDQS(developerId, organizationId);
        if (calculated && calculated.score !== null) {
          latestDqs = calculated.score;
          lastActive = new Date();
        }
      } catch (error) {
        this.logger.warn(`Failed to auto-evaluate DQS for developer ${developerId}: ${error}`);
      }
    }

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
      lastActive,
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
      repoCommitGroups,
      orgRepos,
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
        take: 12,
        select: {
          id: true,
          sha: true,
          message: true,
          committedAt: true,
          linesAdded: true,
          linesDeleted: true,
          classification: true,
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

      // Per-repository commit & churn breakdown
      this.prisma.commit.groupBy({
        by: ['repositoryId'],
        where: {
          developerId,
          repository: { organizationId },
        },
        _count: { id: true },
        _sum: { linesAdded: true, linesDeleted: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // Organization repositories for name mapping
      this.prisma.repository.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
    ]);

    // 3. Calculate coverage across contributed repositories
    let avgCoverage = 0;
    if (repoCommitGroups.length > 0) {
      const repoIds = repoCommitGroups
        .map((r) => r.repositoryId)
        .filter((id): id is string => Boolean(id));

      if (repoIds.length > 0) {
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
    }

    // 3b. Build empirical repository breakdown
    const repoNameMap = new Map<string, string>();
    for (const r of orgRepos || []) {
      repoNameMap.set(r.id, r.name);
    }

    const totalCommits = commitAgg._count.id || 0;
    const repositoryBreakdown: RepositoryContributionDto[] = (repoCommitGroups || []).map((rcg) => {
      const repoId = rcg.repositoryId || '';
      const cCount = rcg._count?.id || 0;
      const pct = totalCommits > 0 ? Number(((cCount / totalCommits) * 100).toFixed(1)) : 0;
      return {
        repositoryId: repoId,
        repositoryName: repoNameMap.get(repoId) || 'Unknown',
        commitCount: cCount,
        linesAdded: rcg._sum?.linesAdded || 0,
        linesDeleted: rcg._sum?.linesDeleted || 0,
        percentage: pct,
      };
    });

    // 4. Format DQS history points
    const formattedDqsScores = [...dqsScores];
    if (formattedDqsScores.length === 0) {
      try {
        const calculated = await this.scoresService.calculateDQS(developerId, organizationId);
        if (calculated && calculated.score !== null) {
          formattedDqsScores.push({
            score: calculated.score,
            calculatedAt: new Date(),
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to auto-evaluate DQS stats for developer ${developerId}: ${error}`);
      }
    }

    const dqsHistory = formattedDqsScores.map((s) => ({
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
      repositoryBreakdown,
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
