import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { ScoresService } from '../scores/scores.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * Get organization-wide dashboard statistics
   */
  async getOrganizationStats(organizationId: string) {
    // Get counts
    const [totalRepositories, totalTeams, totalProjects, totalCommits, bugFixCommits] =
      await Promise.all([
        this.prisma.repository.count({ where: { organizationId, isEnabled: true } }),
        this.prisma.team.count({ where: { organizationId, isActive: true } }),
        this.prisma.project.count({ where: { organizationId, isActive: true } }),
        this.prisma.commit.count({
          where: { repository: { organizationId } },
        }),
        this.prisma.commit.count({
          where: { repository: { organizationId }, classification: 'BUGFIX' },
        }),
      ]);

    // Get total developers (users who are members of this organization)
    const totalDevelopers = await this.prisma.organizationMember.count({
      where: { organizationId },
    });

    // Get average coverage from latest reports
    const repos = await this.prisma.repository.findMany({
      where: { organizationId, isEnabled: true },
      select: { id: true },
    });
    const repoIds = repos.map((r) => r.id);
    const coverages = await Promise.all(
      repoIds.map(async (repositoryId) => {
        return this.prisma.coverageReport.findFirst({
          where: { repositoryId, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          select: { coveragePercentage: true },
        });
      })
    );
    const latestCoverages = coverages.filter((c) => c !== null);

    const avgCoverage =
      latestCoverages.length > 0
        ? latestCoverages.reduce((sum, r) => sum + (r.coveragePercentage || 0), 0) /
          latestCoverages.length
        : 0;

    // Get organization-wide SQS (combining repositories and standalone projects)
    const projects = await this.prisma.project.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    // Resolve SQS score for each repository using dual-resolution (repo SQS -> parent project SQS)
    const repoScores = await Promise.all(
      repoIds.map(async (repositoryId) => {
        // 1. Direct repository SQS check
        let scoreRecord = await this.prisma.sQSScore.findFirst({
          where: { projectId: repositoryId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // 2. Fall back to parent project score if repo is linked to a project
        if (!scoreRecord && this.prisma.projectRepository?.findFirst) {
          const projectRepo = await this.prisma.projectRepository.findFirst({
            where: { repositoryId },
            select: { projectId: true },
          });

          if (projectRepo) {
            scoreRecord = await this.prisma.sQSScore.findFirst({
              where: { projectId: projectRepo.projectId },
              orderBy: { calculatedAt: 'desc' },
              select: { score: true },
            });
          }
        }

        // 3. On-demand calculation if repository has commits but no score yet
        if (!scoreRecord) {
          const commitCount = await this.prisma.commit.count({
            where: { repositoryId },
          });
          if (commitCount > 0) {
            try {
              const calculated = await this.scoresService.calculateSQS(repositoryId, organizationId);
              if (calculated && typeof calculated.score === 'number') {
                scoreRecord = { score: calculated.score };
              }
            } catch (calcErr) {
              this.logger.warn(`Failed on-demand SQS calculation for repository ${repositoryId}: ${calcErr}`);
            }
          }
        }

        return scoreRecord?.score ?? null;
      }),
    );

    // Also include any standalone projects that have a direct SQS score but no linked repositories
    let standaloneProjectIds = projectIds;
    if (this.prisma.projectRepository?.findMany && projectIds.length > 0) {
      const projectRepos = await this.prisma.projectRepository.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true },
      });
      const projectsWithRepos = new Set(projectRepos.map((pr) => pr.projectId));
      standaloneProjectIds = projectIds.filter((id) => !projectsWithRepos.has(id));
    }

    const projectScores = await Promise.all(
      standaloneProjectIds.map(async (projectId) => {
        const scoreRecord = await this.prisma.sQSScore.findFirst({
          where: { projectId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });
        return scoreRecord?.score ?? null;
      }),
    );

    const validScores = [...repoScores, ...projectScores].filter(
      (s): s is number => s !== null && s > 0,
    );

    const avgSQS =
      validScores.length > 0
        ? validScores.reduce((sum, score) => sum + score, 0) / validScores.length
        : 0;

    // Get risky modules count from alerts
    const riskyModulesCount = await this.prisma.alert.count({
      where: {
        organizationId,
        status: 'OPEN',
        severity: { in: ['HIGH', 'CRITICAL'] },
      },
    });

    return {
      totalRepositories,
      totalTeams,
      totalDevelopers,
      totalProjects,
      totalCommits,
      bugFixCommits,
      avgCoverage: Number(avgCoverage.toFixed(1)),
      avgSQS: Number(avgSQS.toFixed(1)),
      riskyModulesCount,
    };
  }

  /**
   * Get SQS trend over time for organization
   */
  async getSQSTrend(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [projects, repos] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId, isActive: true },
        select: { id: true },
      }),
      this.prisma.repository.findMany({
        where: { organizationId, isEnabled: true },
        select: { id: true },
      }),
    ]);

    const allEntityIds = Array.from(
      new Set([
        ...(projects || []).map((p) => p.id),
        ...(repos || []).map((r) => r.id),
      ]),
    );

    if (allEntityIds.length === 0) return [];

    const scores = await this.prisma.sQSScore.findMany({
      where: {
        projectId: { in: allEntityIds },
        calculatedAt: { gte: startDate },
      },
      orderBy: { calculatedAt: 'asc' },
      select: {
        score: true,
        calculatedAt: true,
      },
    });

    // Group by date and average
    const grouped = scores.reduce(
      (acc, s) => {
        const date = s.calculatedAt.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = { total: 0, count: 0 };
        acc[date].total += s.score || 0;
        acc[date].count += 1;
        return acc;
      },
      {} as Record<string, { total: number; count: number }>,
    );

    return Object.entries(grouped).map(([date, { total, count }]) => ({
      date,
      value: Number((total / count).toFixed(1)),
    }));
  }

  /**
   * Get commit activity trend
   */
  async getCommitTrend(organizationId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const commits = await this.prisma.commit.findMany({
      where: {
        repository: { organizationId },
        committedAt: { gte: startDate },
      },
      select: { committedAt: true },
    });

    // Group by date
    const grouped = commits.reduce(
      (acc, c) => {
        const date = c.committedAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, value: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get top repositories by SQS
   */
  async getTopRepositories(organizationId: string, limit: number = 5) {
    const repos = await this.prisma.repository.findMany({
      where: { organizationId, isEnabled: true },
      include: {
        _count: { select: { commits: true } },
      },
      take: 50,
    });

    // Get latest coverage and SQS for each repo
    const repoScores = await Promise.all(
      repos.map(async (repo) => {
        // 1. Direct repository SQS check
        let latestScore = await this.prisma.sQSScore.findFirst({
          where: { projectId: repo.id },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // 2. Fall back to parent project score if repo is linked to a project
        if (!latestScore) {
          const projectRepo = await this.prisma.projectRepository.findFirst({
            where: { repositoryId: repo.id },
            select: { projectId: true },
          });

          if (projectRepo) {
            latestScore = await this.prisma.sQSScore.findFirst({
              where: { projectId: projectRepo.projectId },
              orderBy: { calculatedAt: 'desc' },
              select: { score: true },
            });
          }
        }

        let sqs = latestScore?.score || 0;

        // 3. On-demand calculation if repository has commits but no score yet
        if (sqs === 0 && repo._count.commits > 0) {
          try {
            const calculated = await this.scoresService.calculateSQS(repo.id, organizationId);
            if (calculated && typeof calculated.score === 'number') {
              sqs = calculated.score;
            }
          } catch (calcErr) {
            this.logger.warn(`Failed on-demand SQS calculation for repository ${repo.id}: ${calcErr}`);
          }
        }

        const latestCoverage = await this.prisma.coverageReport.findFirst({
          where: { repositoryId: repo.id },
          orderBy: { createdAt: 'desc' },
          select: { coveragePercentage: true },
        });

        return {
          id: repo.id,
          name: repo.name,
          fullName: repo.fullName,
          sqs: Number(sqs.toFixed(1)),
          coverage: Number((latestCoverage?.coveragePercentage || 0).toFixed(1)),
          commits: repo._count.commits,
          commitCount: repo._count.commits,
        };
      }),
    );

    return repoScores.sort((a, b) => b.sqs - a.sqs).slice(0, limit);
  }

  /**
   * Get bottom repositories (needing attention)
   */
  async getBottomRepositories(organizationId: string, limit: number = 5) {
    const topRepos = await this.getTopRepositories(organizationId, 50);
    return topRepos
      .filter((r) => r.sqs > 0 || r.commits > 0)
      .sort((a, b) => a.sqs - b.sqs)
      .slice(0, limit);
  }

  /**
   * Get top developers by DQS
   */
  async getTopDevelopers(organizationId: string, limit: number = 5) {
    // Get organization members
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
      take: 50,
    });

    const devScores = await Promise.all(
      members.map(async (member) => {
        let latestScore = await this.prisma.dQSScore.findFirst({
          where: { developerId: member.userId },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // Auto-evaluate developer DQS if not yet persisted
        if (!latestScore) {
          try {
            const calculated = await this.scoresService.calculateDQS(
              member.userId,
              organizationId,
            );
            if (calculated && calculated.score !== null) {
              latestScore = { score: calculated.score };
            }
          } catch (error) {
            this.logger.warn(`Failed to auto-evaluate DQS for developer ${member.userId}: ${error}`);
          }
        }

        const commitCount = await this.prisma.commit.count({
          where: { developerId: member.userId },
        });

        const teamMember = await this.prisma.teamMembership.findFirst({
          where: { userId: member.userId, leftAt: null },
          include: { team: { select: { name: true } } },
        });

        return {
          id: member.user.id,
          name: member.user.name,
          email: member.user.email,
          avatarUrl: member.user.avatarUrl,
          dqs: Number((latestScore?.score || 0).toFixed(1)),
          commits: commitCount,
          commitCount,
          teamName: teamMember?.team?.name || null,
        };
      }),
    );

    return devScores
      .sort((a, b) => {
        if (b.dqs !== a.dqs) {
          return b.dqs - a.dqs;
        }
        return b.commits - a.commits;
      })
      .slice(0, limit);
  }

  /**
   * Get top teams by average DQS
   */
  async getTopTeams(organizationId: string, limit: number = 5) {
    const teams = await this.prisma.team.findMany({
      where: { organizationId, isActive: true },
      include: {
        memberships: {
          where: { leftAt: null },
          select: { userId: true },
        },
      },
    });

    const teamScores = await Promise.all(
      teams.map(async (team) => {
        const memberIds = team.memberships.map((m) => m.userId);

        if (memberIds.length === 0) {
          return {
            id: team.id,
            name: team.name,
            avgDqs: 0,
            memberCount: 0,
          };
        }

        const memberScores = await Promise.all(
          memberIds.map(async (developerId) => {
            return this.prisma.dQSScore.findFirst({
              where: { developerId },
              orderBy: { calculatedAt: 'desc' },
              select: { score: true },
            });
          })
        );
        const scores = memberScores.filter((s) => s !== null);

        const avgDqs =
          scores.length > 0
            ? scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
            : 0;

        return {
          id: team.id,
          name: team.name,
          avgDqs: Number(avgDqs.toFixed(1)),
          memberCount: team.memberships.length,
        };
      }),
    );

    return teamScores.sort((a, b) => b.avgDqs - a.avgDqs).slice(0, limit);
  }

  /**
   * Get unified engineering recent activity across commits, alerts, debt items, and releases
   */
  async getRecentActivity(
    organizationId: string,
    limit: number = 10,
    type?: string,
    page: number = 1,
  ) {
    const fetchLimit = Math.min(Math.max(limit, 1), 50);
    const currentPage = Math.max(page, 1);
    const filterType = type?.toLowerCase();
    const offset = (currentPage - 1) * fetchLimit;

    const shouldFetchCommits = !filterType || filterType === 'all' || filterType === 'commit';
    const shouldFetchAlerts = !filterType || filterType === 'all' || filterType === 'alert';
    const shouldFetchDebt = !filterType || filterType === 'all' || filterType === 'debt';
    const shouldFetchReleases = !filterType || filterType === 'all' || filterType === 'release';

    const [commitsCount, alertsCount, debtCount, releasesCount] = await Promise.all([
      shouldFetchCommits && this.prisma.commit?.count
        ? this.prisma.commit.count({ where: { repository: { organizationId } } })
        : Promise.resolve(0),
      shouldFetchAlerts && this.prisma.alert?.count
        ? this.prisma.alert.count({ where: { organizationId } })
        : Promise.resolve(0),
      shouldFetchDebt && this.prisma.debtItem?.count
        ? this.prisma.debtItem.count({ where: { repository: { organizationId } } })
        : Promise.resolve(0),
      shouldFetchReleases && this.prisma.release?.count
        ? this.prisma.release.count({ where: { organizationId } })
        : Promise.resolve(0),
    ]);

    const counts: Record<string, number> = {
      all: (commitsCount || 0) + (alertsCount || 0) + (debtCount || 0) + (releasesCount || 0),
      commit: commitsCount || 0,
      alert: alertsCount || 0,
      debt: debtCount || 0,
      release: releasesCount || 0,
    };

    const total = filterType && filterType in counts ? counts[filterType] : counts.all;

    const commitSkip = filterType === 'commit' ? offset : 0;
    const commitTake = filterType === 'commit' ? fetchLimit : Math.min(offset + fetchLimit, 100);

    const alertSkip = filterType === 'alert' ? offset : 0;
    const alertTake = filterType === 'alert' ? fetchLimit : Math.min(offset + fetchLimit, 50);

    const debtSkip = filterType === 'debt' ? offset : 0;
    const debtTake = filterType === 'debt' ? fetchLimit : Math.min(offset + fetchLimit, 50);

    const releaseSkip = filterType === 'release' ? offset : 0;
    const releaseTake = filterType === 'release' ? fetchLimit : Math.min(offset + fetchLimit, 50);

    const [commits, alerts, debtItems, releases] = await Promise.all([
      shouldFetchCommits && this.prisma.commit?.findMany
        ? this.prisma.commit.findMany({
            where: { repository: { organizationId } },
            orderBy: { committedAt: 'desc' },
            skip: commitSkip,
            take: commitTake,
            include: {
              developer: { select: { id: true, name: true, avatarUrl: true } },
              repository: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
      shouldFetchAlerts && this.prisma.alert?.findMany
        ? this.prisma.alert.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            skip: alertSkip,
            take: alertTake,
          })
        : Promise.resolve([]),
      shouldFetchDebt && this.prisma.debtItem?.findMany
        ? this.prisma.debtItem.findMany({
            where: { repository: { organizationId } },
            orderBy: { createdAt: 'desc' },
            skip: debtSkip,
            take: debtTake,
            include: {
              repository: { select: { id: true, name: true } },
              author: { select: { id: true, name: true } },
            },
          })
        : Promise.resolve([]),
      shouldFetchReleases && this.prisma.release?.findMany
        ? this.prisma.release.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            skip: releaseSkip,
            take: releaseTake,
          })
        : Promise.resolve([]),
    ]);

    const activities: any[] = [];

    // 1. Commits
    for (const c of commits) {
      const firstLine = (c.message || '').split('\n')[0].trim() || 'Commit updated';
      activities.push({
        id: c.id,
        type: 'commit',
        title: firstLine,
        description: c.message,
        message: c.message,
        repository: c.repository?.name || 'Repository',
        repositoryName: c.repository?.name || 'Repository',
        author: c.developer?.name || c.authorName || 'Contributor',
        authorAvatar: c.developer?.avatarUrl,
        timestamp: c.committedAt,
        metadata: {
          sha: c.sha,
          shortSha: c.sha ? c.sha.slice(0, 7) : undefined,
          classification: c.classification,
          linesAdded: c.linesAdded,
          linesDeleted: c.linesDeleted,
          filesChanged: c.filesChanged,
          anomalyFlag: c.anomalyFlag,
        },
      });
    }

    // 2. Quality Alerts
    for (const a of alerts) {
      activities.push({
        id: a.id,
        type: 'alert',
        title: a.message || 'Quality Gate Alert Triggered',
        description: `Severity: ${a.severity} · Status: ${a.status}`,
        message: a.message,
        repository: 'Quality Policy',
        repositoryName: 'Quality Policy',
        author: 'System Quality Gate',
        timestamp: a.createdAt,
        metadata: {
          severity: a.severity,
          status: a.status,
          alertType: a.type,
        },
      });
    }

    // 3. Technical Debt
    for (const d of debtItems) {
      activities.push({
        id: d.id,
        type: 'debt',
        title: `${d.markerType} Marker: ${d.content || 'Code debt detected'}`,
        description: `${d.filePath}:${d.lineNumber}`,
        message: d.content,
        repository: d.repository?.name || 'Repository',
        repositoryName: d.repository?.name || 'Repository',
        author: d.author?.name || 'Scanner',
        timestamp: d.createdAt,
        metadata: {
          markerType: d.markerType,
          isResolved: d.isResolved,
          filePath: d.filePath,
          lineNumber: d.lineNumber,
        },
      });
    }

    // 4. Releases
    for (const r of releases) {
      activities.push({
        id: r.id,
        type: 'release',
        title: `Release ${r.version} Deployed`,
        description: r.description || `Target Date: ${new Date(r.targetDate).toLocaleDateString()}`,
        message: r.description || `Release ${r.version}`,
        repository: 'Deployment Pipeline',
        repositoryName: 'Deployment Pipeline',
        author: 'Release Manager',
        timestamp: r.shippedAt || r.createdAt,
        metadata: {
          version: r.version,
          isRolledBack: r.isRolledBack,
          isActive: r.isActive,
        },
      });
    }

    // Sort chronologically descending
    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    const pagedActivities = (!filterType || filterType === 'all')
      ? activities.slice(offset, offset + fetchLimit)
      : activities.slice(0, fetchLimit);

    return {
      data: pagedActivities,
      total,
      page: currentPage,
      limit: fetchLimit,
      totalPages: Math.ceil(total / fetchLimit) || 1,
      counts,
    };
  }

  /**
   * Get alerts/notifications
   */
  async getAlerts(organizationId: string) {
    // Get open alerts
    const alerts = await this.prisma.alert.findMany({
      where: {
        organizationId,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get projects and repositories with low SQS
    const [projects, repos] = await Promise.all([
      this.prisma.project.findMany({
        where: { organizationId, isActive: true },
        select: { id: true, name: true },
      }),
      this.prisma.repository.findMany({
        where: { organizationId, isEnabled: true },
        select: { id: true, name: true },
      }),
    ]);

    const lowScoreEntities: Array<{ id: string; name: string; score: number; calculatedAt: Date }> =
      [];

    for (const project of projects || []) {
      const latestScore = await this.prisma.sQSScore.findFirst({
        where: { projectId: project.id },
        orderBy: { calculatedAt: 'desc' },
        select: { id: true, score: true, calculatedAt: true },
      });

      if (latestScore && latestScore.score < 50) {
        lowScoreEntities.push({
          id: latestScore.id,
          name: project.name,
          score: latestScore.score,
          calculatedAt: latestScore.calculatedAt,
        });
      }
    }

    for (const repo of repos || []) {
      const latestScore = await this.prisma.sQSScore.findFirst({
        where: { projectId: repo.id },
        orderBy: { calculatedAt: 'desc' },
        select: { id: true, score: true, calculatedAt: true },
      });

      if (latestScore && latestScore.score < 50) {
        lowScoreEntities.push({
          id: latestScore.id,
          name: repo.name,
          score: latestScore.score,
          calculatedAt: latestScore.calculatedAt,
        });
      }
    }

    const result = [
      ...alerts.map((a) => ({
        id: a.id,
        type: 'alert' as const,
        severity:
          a.severity === 'CRITICAL' || a.severity === 'HIGH'
            ? ('high' as const)
            : ('warning' as const),
        title: `${a.type}: ${a.severity}`,
        description: a.message,
        timestamp: a.createdAt,
      })),
      ...lowScoreEntities.slice(0, 5).map((s) => ({
        id: s.id,
        type: 'low_score' as const,
        severity: 'warning' as const,
        title: `Low SQS: ${s.name}`,
        description: `Score: ${s.score.toFixed(1)}`,
        timestamp: s.calculatedAt,
      })),
    ];

    return result
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }
}
