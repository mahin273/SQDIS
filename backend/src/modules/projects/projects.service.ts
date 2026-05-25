import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { DataFilterService } from '../auth/services/data-filter.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Role } from '@prisma/client';

/**
 * Service for project management
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataFilterService: DataFilterService,
  ) {}

  /**
   * Get project metrics including commit breakdown, recent activity, and technical debt
   */
  async getProjectMetrics(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          select: { repositoryId: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const repoIds = project.repositories.map((pr) => pr.repositoryId);

    if (repoIds.length === 0) {
      return {
        totalCommits: 0,
        bugfixCommits: 0,
        featureCommits: 0,
        refactorCommits: 0,
        testCommits: 0,
        docsCommits: 0,
        coverage: 0,
        technicalDebt: { total: 0, todo: 0, fixme: 0, hack: 0, xxx: 0 },
        recentActivity: [],
        commitTrend: [],
      };
    }

    // Commit classification breakdown
    const commitCounts = await this.prisma.commit.groupBy({
      by: ['classification'],
      where: { repositoryId: { in: repoIds } },
      _count: { id: true },
    });

    const classificationMap: Record<string, number> = {};
    commitCounts.forEach((c) => {
      if (c.classification) {
        classificationMap[c.classification] = c._count.id;
      }
    });

    const totalCommits = await this.prisma.commit.count({
      where: { repositoryId: { in: repoIds } },
    });

    // Technical debt items
    const debtCounts = await this.prisma.debtItem.groupBy({
      by: ['markerType'],
      where: { repositoryId: { in: repoIds }, isResolved: false },
      _count: { id: true },
    });

    const debtMap: Record<string, number> = { TODO: 0, FIXME: 0, HACK: 0, XXX: 0 };
    let totalDebt = 0;
    debtCounts.forEach((d) => {
      debtMap[d.markerType] = d._count.id;
      totalDebt += d._count.id;
    });

    // Recent activity (last 20 commits)
    const recentCommits = await this.prisma.commit.findMany({
      where: { repositoryId: { in: repoIds } },
      orderBy: { committedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        sha: true,
        message: true,
        authorName: true,
        authorEmail: true,
        classification: true,
        committedAt: true,
        linesAdded: true,
        linesDeleted: true,
        developerId: true,
        repository: {
          select: { name: true },
        },
        developer: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    // Commit trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const commitsByDay = await this.prisma.commit.groupBy({
      by: ['committedAt'],
      where: {
        repositoryId: { in: repoIds },
        committedAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });

    // Aggregate by date
    const trendMap = new Map<string, number>();
    commitsByDay.forEach((c) => {
      const dateStr = c.committedAt.toISOString().split('T')[0];
      trendMap.set(dateStr, (trendMap.get(dateStr) || 0) + c._count.id);
    });

    const commitTrend = Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, commits: count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Average coverage
    const latestCoverages = await this.prisma.coverageReport.findMany({
      where: { repositoryId: { in: repoIds }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      distinct: ['repositoryId'],
      select: { coveragePercentage: true },
    });

    let avgCoverage = 0;
    if (latestCoverages.length > 0) {
      const sum = latestCoverages.reduce((acc, curr) => acc + (curr.coveragePercentage || 0), 0);
      avgCoverage = sum / latestCoverages.length;
    }

    return {
      totalCommits,
      bugfixCommits: classificationMap['BUGFIX'] || 0,
      featureCommits: classificationMap['FEATURE'] || 0,
      refactorCommits: classificationMap['REFACTOR'] || 0,
      testCommits: classificationMap['TEST'] || 0,
      docsCommits: classificationMap['DOCS'] || 0,
      coverage: Number(avgCoverage.toFixed(1)),
      technicalDebt: {
        total: totalDebt,
        todo: debtMap['TODO'],
        fixme: debtMap['FIXME'],
        hack: debtMap['HACK'],
        xxx: debtMap['XXX'],
      },
      recentActivity: recentCommits,
      commitTrend,
    };
  }

  /**
   * Get technical debt items for a project
   */
  async getTechnicalDebt(projectId: string, limit = 50) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        repositories: {
          select: { repositoryId: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const repoIds = project.repositories.map((pr) => pr.repositoryId);

    if (repoIds.length === 0) {
      return { items: [], total: 0 };
    }

    const [items, total] = await Promise.all([
      this.prisma.debtItem.findMany({
        where: { repositoryId: { in: repoIds }, isResolved: false },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          repository: { select: { name: true } },
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      }),
      this.prisma.debtItem.count({
        where: { repositoryId: { in: repoIds }, isResolved: false },
      }),
    ]);

    return { items, total };
  }

  /**
   * Create a new project
   */
  async create(dto: CreateProjectDto, organizationId: string) {
    // Check for duplicate project name within organization
    const existingProject = await this.prisma.project.findFirst({
      where: {
        organizationId,
        name: dto.name,
        isActive: true,
      },
    });

    if (existingProject) {
      throw new ConflictException('Project with this name already exists');
    }

    return this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        organizationId,
      },
      include: {
        _count: {
          select: {
            repositories: true,
            teamAssignments: {
              where: { endDate: null },
            },
          },
        },
      },
    });
  }

  /**
   * Find all projects for an organization with role-based filtering
   */
  async findAll(organizationId: string, userId: string, userRole: Role) {
    // Apply role-based filtering using DataFilterService
    const filter = await this.dataFilterService.createProjectFilter(
      userId,
      userRole,
      organizationId,
    );

    return this.prisma.project.findMany({
      where: {
        ...filter,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            repositories: true,
            teamAssignments: {
              where: { endDate: null },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Find project by ID
   */
  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        repositories: {
          include: {
            repository: {
              select: {
                id: true,
                name: true,
                fullName: true,
                isEnabled: true,
                lastSyncAt: true,
              },
            },
          },
        },
        teamAssignments: {
          where: { endDate: null },
          include: {
            team: {
              select: {
                id: true,
                name: true,
                description: true,
                // We might want to fetch DQS for teams here if schema allows, but relying on separate call or separate logic is fine.
                // For now, keeping it basic as per original
              },
            },
          },
        },
        _count: {
          select: {
            repositories: true,
            teamAssignments: {
              where: { endDate: null },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 1. Calculate aggregated metrics from repositories
    const repoIds = project.repositories.map((pr) => pr.repositoryId);

    let totalCommits = 0;
    let bugsFixes = 0;
    let totalCoverage = 0;
    let coverageCount = 0;

    if (repoIds.length > 0) {
      // Total commits
      totalCommits = await this.prisma.commit.count({
        where: { repositoryId: { in: repoIds } },
      });

      // Total bug fixes
      bugsFixes = await this.prisma.commit.count({
        where: {
          repositoryId: { in: repoIds },
          classification: 'BUGFIX',
        },
      });

      // Average coverage (fetch latest report for each repo)
      // This is a bit expensive if many repos, but for MVP it's okay.
      // Optimized way: select distinct on repositoryId order by createdAt desc
      const latestCoverages = await this.prisma.coverageReport.findMany({
        where: { repositoryId: { in: repoIds } },
        orderBy: { createdAt: 'desc' },
        distinct: ['repositoryId'],
        select: { coveragePercentage: true },
      });

      if (latestCoverages.length > 0) {
        const sum = latestCoverages.reduce((acc, curr) => acc + (curr.coveragePercentage || 0), 0);
        totalCoverage = sum / latestCoverages.length;
        coverageCount = latestCoverages.length;
      }
    }

    // 2. Fetch latest SQS Score and Trend
    // Assuming SQSScore is linked to projectId (if not, we might need to change schema or logic)
    // Based on schema comments: "References repository ID for now" - checking actual usage.
    // If it relies on project ID, we query by projectId.
    const latestSQS = await this.prisma.sQSScore.findFirst({
      where: { projectId: id },
      orderBy: { calculatedAt: 'desc' },
    });

    const previousSQS = await this.prisma.sQSScore.findFirst({
      where: {
        projectId: id,
        id: { not: latestSQS?.id || '' }, // Exclude the latest one
      },
      orderBy: { calculatedAt: 'desc' },
    });

    const sqs = latestSQS?.score || 0;
    const previousScore = previousSQS?.score || 0;
    const trend = latestSQS && previousSQS ? Number((sqs - previousScore).toFixed(1)) : 0;

    return {
      ...project,
      totalCommits,
      bugsFixes,
      coverage: Number(totalCoverage.toFixed(1)),
      sqs: Number(sqs.toFixed(1)),
      trend,
    };
  }

  /**
   * Update project
   */
  async update(id: string, dto: UpdateProjectDto) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== project.name) {
      const existingProject = await this.prisma.project.findFirst({
        where: {
          organizationId: project.organizationId,
          name: dto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingProject) {
        throw new ConflictException('Project with this name already exists');
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        _count: {
          select: {
            repositories: true,
            teamAssignments: {
              where: { endDate: null },
            },
          },
        },
      },
    });
  }

  /**
   * Delete project (soft delete)
   */
  async delete(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Soft delete - mark as inactive and end all team assignments
    await this.prisma.$transaction([
      // End all team assignments
      this.prisma.teamProjectAssignment.updateMany({
        where: {
          projectId: id,
          endDate: null,
        },
        data: {
          endDate: new Date(),
        },
      }),
      // Mark project as inactive
      this.prisma.project.update({
        where: { id },
        data: {
          isActive: false,
        },
      }),
    ]);
  }

  /**
   * Assign repository to project
   */
  async assignRepository(projectId: string, repositoryId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, isActive: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify repository exists and belongs to the same organization
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, organizationId },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    // Check if already assigned
    const existingAssignment = await this.prisma.projectRepository.findUnique({
      where: {
        projectId_repositoryId: {
          projectId,
          repositoryId,
        },
      },
    });

    if (existingAssignment) {
      throw new ConflictException('Repository is already assigned to this project');
    }

    return this.prisma.projectRepository.create({
      data: {
        projectId,
        repositoryId,
      },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
            isEnabled: true,
          },
        },
      },
    });
  }

  /**
   * Remove repository from project
   */
  async removeRepository(projectId: string, repositoryId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, isActive: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const assignment = await this.prisma.projectRepository.findUnique({
      where: {
        projectId_repositoryId: {
          projectId,
          repositoryId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Repository assignment not found');
    }

    await this.prisma.projectRepository.delete({
      where: { id: assignment.id },
    });
  }

  /**
   * Assign team to project
   */
  async assignTeam(projectId: string, teamId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, isActive: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Verify team exists and belongs to the same organization
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, organizationId, isActive: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Check if already assigned (active assignment)
    const existingAssignment = await this.prisma.teamProjectAssignment.findFirst({
      where: {
        projectId,
        teamId,
        endDate: null,
      },
    });

    if (existingAssignment) {
      throw new ConflictException('Team is already assigned to this project');
    }

    return this.prisma.teamProjectAssignment.create({
      data: {
        projectId,
        teamId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  /**
   * Remove team from project
   */
  async removeTeam(projectId: string, teamId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId, isActive: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const assignment = await this.prisma.teamProjectAssignment.findFirst({
      where: {
        projectId,
        teamId,
        endDate: null,
      },
    });

    if (!assignment) {
      throw new NotFoundException('Team assignment not found');
    }

    // Soft delete - mark with end date for historical tracking
    await this.prisma.teamProjectAssignment.update({
      where: { id: assignment.id },
      data: {
        endDate: new Date(),
      },
    });
  }

  /**
   * Verify user has access to project
   */
  async verifyProjectAccess(projectId: string, organizationId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
