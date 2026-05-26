import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GoalProgressService } from './services/goal-progress.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import {
  CreateGoalDto,
  UpdateGoalDto,
  GoalFiltersDto,
  GoalsDashboardFiltersDto,
  CreateKeyResultDto,
  UpdateKeyResultDto,
} from './dto';
import { GoalStatus } from '@prisma/client';

/**
 * Service for managing quality goals and OKRs
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly progressService: GoalProgressService,
    private readonly templatesService: GoalTemplatesService,
  ) {}

  /**
   * Get all goals with filters and pagination
   */
  async findAll(organizationId: string, filters: GoalFiltersDto) {
    const {
      teamId,
      projectId,
      ownerId,
      metricType,
      status,
      isPublic,
      includeKeyResults,
      page = 1,
      limit = 20,
    } = filters;

    const where: any = { organizationId };

    if (teamId) where.teamId = teamId;
    if (projectId) where.projectId = projectId;
    if (ownerId) where.ownerId = ownerId;
    if (metricType) where.metricType = metricType;
    if (status) where.status = status;
    if (isPublic !== undefined) where.isPublic = isPublic;

    const [goals, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true },
          },
          keyResults: includeKeyResults || false,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goal.count({ where }),
    ]);

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await this.progressService.calculateProgress(goal.id);
        return {
          ...goal,
          progress: {
            percentage: progress.progressPercentage,
            isOnTrack: progress.isOnTrack,
            daysRemaining: progress.daysRemaining,
          },
        };
      }),
    );

    return {
      data: goalsWithProgress,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get goals dashboard with all active goals, progress bars, and at-risk highlighting
   *
   * @param organizationId - Organization ID
   * @param filters - Dashboard filters (team, status, metric)
   * @returns Dashboard data with goals, progress, and summary statistics
   */
  async getDashboard(organizationId: string, filters: GoalsDashboardFiltersDto) {
    const {
      teamId,
      status,
      metricType,
      ownerId,
      includePersonal = true,
      includeTeam = true,
      page = 1,
      limit = 50,
    } = filters;

    // Build where clause for active goals by default
    const where: any = {
      organizationId,
      // Default to showing active and at-risk goals for dashboard
      status: status || { in: [GoalStatus.ACTIVE, GoalStatus.AT_RISK] },
    };

    // Apply team filter
    if (teamId) {
      where.teamId = teamId;
    }

    // Apply metric type filter
    //  support metric filter
    if (metricType) {
      where.metricType = metricType;
    }

    // Apply owner filter
    if (ownerId) {
      where.ownerId = ownerId;
    }

    // Handle personal vs team goals filtering
    if (!includePersonal && includeTeam) {
      where.teamId = { not: null };
    } else if (includePersonal && !includeTeam) {
      where.teamId = null;
    }

    // Fetch goals with related data
    const [goals, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          project: {
            select: { id: true, name: true },
          },
          keyResults: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: [
          // Sort at-risk goals first
          { status: 'asc' },
          { endDate: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goal.count({ where }),
    ]);

    // Fetch team information separately if teamId exists
    const teamIds = [...new Set(goals.filter((g) => g.teamId).map((g) => g.teamId as string))];
    const teams =
      teamIds.length > 0
        ? await this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true },
          })
        : [];
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    // Calculate progress for each goal and build dashboard items
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await this.progressService.calculateProgress(goal.id);

        // Calculate key result progress for OKRs
        const keyResultsWithProgress = goal.keyResults.map((kr) => ({
          id: kr.id,
          description: kr.description,
          currentValue: kr.currentValue,
          targetValue: kr.targetValue,
          weight: kr.weight,
          progressPercentage:
            kr.targetValue > 0
              ? Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100))
              : 0,
          isAchieved: kr.currentValue >= kr.targetValue,
        }));

        const keyResultsAchieved = keyResultsWithProgress.filter((kr) => kr.isAchieved).length;

        return {
          id: goal.id,
          name: goal.name,
          description: goal.description,
          metricType: goal.metricType,
          currentValue: goal.currentValue,
          targetValue: goal.targetValue,
          operator: goal.operator,
          startDate: goal.startDate,
          endDate: goal.endDate,
          isPublic: goal.isPublic,
          owner: goal.owner,
          team: goal.teamId ? teamMap.get(goal.teamId) || null : null,
          project: goal.project,
          // Progress bar data
          progress: {
            percentage: progress.progressPercentage,
            expectedProgress: progress.expectedProgress,
            isOnTrack: progress.isOnTrack,
            daysRemaining: progress.daysRemaining,
          },
          // Status and at-risk highlighting
          status: progress.status,
          isAtRisk: progress.status === GoalStatus.AT_RISK || !progress.isOnTrack,
          isAchieved: progress.isAchieved,
          // OKR-specific data
          isOKR: goal.keyResults.length > 0,
          keyResultsCount: goal.keyResults.length,
          keyResultsAchieved,
          keyResults: goal.keyResults.length > 0 ? keyResultsWithProgress : undefined,
        };
      }),
    );

    // Calculate summary statistics
    const atRiskGoals = goalsWithProgress.filter((g) => g.isAtRisk);
    const onTrackGoals = goalsWithProgress.filter((g) => !g.isAtRisk && !g.isAchieved);
    const achievedGoals = goalsWithProgress.filter((g) => g.isAchieved);

    // Get counts by status for the entire organization (not just current page)
    const [activeCount, atRiskCount, achievedCount, failedCount] = await Promise.all([
      this.prisma.goal.count({ where: { organizationId, status: GoalStatus.ACTIVE } }),
      this.prisma.goal.count({ where: { organizationId, status: GoalStatus.AT_RISK } }),
      this.prisma.goal.count({ where: { organizationId, status: GoalStatus.ACHIEVED } }),
      this.prisma.goal.count({ where: { organizationId, status: GoalStatus.FAILED } }),
    ]);

    return {
      // Goals data with progress bars
      data: goalsWithProgress,
      // Summary statistics
      summary: {
        total,
        atRiskCount: atRiskGoals.length,
        onTrackCount: onTrackGoals.length,
        achievedCount: achievedGoals.length,
        // Organization-wide counts
        organizationStats: {
          active: activeCount,
          atRisk: atRiskCount,
          achieved: achievedCount,
          failed: failedCount,
        },
      },
      // Pagination metadata
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a specific goal by ID
   */
  async findById(id: string, organizationId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id, organizationId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        project: {
          select: { id: true, name: true },
        },
        keyResults: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!goal) {
      throw new NotFoundException(`Goal with ID ${id} not found`);
    }

    const progress = await this.progressService.calculateProgress(id);

    // Calculate key result progress for OKRs
    const keyResultsWithProgress = goal.keyResults.map((kr) => ({
      ...kr,
      progressPercentage:
        kr.targetValue > 0
          ? Math.min(100, Math.max(0, (kr.currentValue / kr.targetValue) * 100))
          : 0,
      isAchieved: kr.currentValue >= kr.targetValue,
    }));

    const keyResultsAchieved = keyResultsWithProgress.filter((kr) => kr.isAchieved).length;

    return {
      ...goal,
      keyResults: keyResultsWithProgress,
      // OKR-specific fields
      isOKR: goal.keyResults.length > 0,
      keyResultsCount: goal.keyResults.length,
      keyResultsAchieved,
      progress: {
        percentage: progress.progressPercentage,
        isOnTrack: progress.isOnTrack,
        daysRemaining: progress.daysRemaining,
        expectedProgress: progress.expectedProgress,
        isAchieved: progress.isAchieved,
      },
    };
  }

  /**
   * Create a new goal
   */
  async create(organizationId: string, ownerId: string, dto: CreateGoalDto) {
    let metricType = dto.metricType;
    let targetValue = dto.targetValue;
    let operator = dto.operator;
    let endDate: Date;
    const startDate = new Date(dto.startDate);

    // Pre-fill from template if templateId is provided
    if (dto.templateId) {
      const template = await this.templatesService.findById(dto.templateId, organizationId);

      // Use template values as defaults, but allow overrides from dto
      metricType = dto.metricType ?? template.metricType;
      targetValue = dto.targetValue ?? template.targetValue;
      operator = dto.operator ?? template.operator;

      // Calculate end date from template duration if not provided
      if (dto.endDate) {
        endDate = new Date(dto.endDate);
      } else {
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + template.durationDays);
      }
    } else {
      // Validate required fields when not using template
      if (!metricType) {
        throw new BadRequestException('metricType is required when not using a template');
      }
      if (targetValue === undefined || targetValue === null) {
        throw new BadRequestException('targetValue is required when not using a template');
      }
      if (!operator) {
        throw new BadRequestException('operator is required when not using a template');
      }
      if (!dto.endDate) {
        throw new BadRequestException('endDate is required when not using a template');
      }
      endDate = new Date(dto.endDate);
    }

    // Validate dates
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate team exists if provided
    if (dto.teamId) {
      const team = await this.prisma.team.findFirst({
        where: { id: dto.teamId, organizationId },
      });
      if (!team) {
        throw new NotFoundException(`Team with ID ${dto.teamId} not found`);
      }
    }

    // Validate project exists if provided
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, organizationId },
      });
      if (!project) {
        throw new NotFoundException(`Project with ID ${dto.projectId} not found`);
      }
    }

    // Create goal with key results if provided
    const goal = await this.prisma.goal.create({
      data: {
        organizationId,
        ownerId,
        teamId: dto.teamId,
        projectId: dto.projectId,
        name: dto.name,
        description: dto.description,
        metricType,
        targetValue,
        operator,
        startDate,
        endDate,
        isPublic: dto.isPublic ?? true,
        status: GoalStatus.ACTIVE,
        keyResults: dto.keyResults
          ? {
              create: dto.keyResults.map((kr) => ({
                description: kr.description,
                targetValue: kr.targetValue,
                weight: kr.weight ?? 1,
              })),
            }
          : undefined,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        keyResults: true,
      },
    });

    return goal;
  }

  /**
   * Update an existing goal
   */
  async update(id: string, organizationId: string, dto: UpdateGoalDto) {
    const goal = await this.findById(id, organizationId);

    // Validate dates if provided
    if (dto.startDate || dto.endDate) {
      const startDate = dto.startDate ? new Date(dto.startDate) : goal.startDate;
      const endDate = dto.endDate ? new Date(dto.endDate) : goal.endDate;

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const updatedGoal = await this.prisma.goal.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        keyResults: true,
      },
    });

    // Update status based on progress
    await this.progressService.updateGoalStatus(id);

    return updatedGoal;
  }

  /**
   * Delete a goal
   */
  async delete(id: string, organizationId: string) {
    await this.findById(id, organizationId);

    await this.prisma.goal.delete({
      where: { id },
    });

    return { success: true, message: 'Goal deleted successfully' };
  }

  /**
   * Get goal progress with detailed metrics
   */
  async getProgress(id: string, organizationId: string) {
    await this.findById(id, organizationId);
    return this.progressService.getDetailedProgress(id);
  }

  /**
   * Add a key result to a goal
   */
  async addKeyResult(goalId: string, organizationId: string, dto: CreateKeyResultDto) {
    await this.findById(goalId, organizationId);

    const keyResult = await this.prisma.keyResult.create({
      data: {
        goalId,
        description: dto.description,
        targetValue: dto.targetValue,
        weight: dto.weight ?? 1,
      },
    });

    return keyResult;
  }

  /**
   * Update a key result
   * update OKR progress when key result achieved
   * When a key result's currentValue is updated, this method:
   * 1. Updates the key result record
   * 2. Recalculates the OKR progress (weighted average)
   * 3. Checks if the OKR is now achieved (all key results met)
   * 4. Emits achievement event if the OKR is achieved
   */
  async updateKeyResult(
    goalId: string,
    keyResultId: string,
    organizationId: string,
    dto: UpdateKeyResultDto,
  ) {
    const goal = await this.findById(goalId, organizationId);

    const keyResult = await this.prisma.keyResult.findFirst({
      where: { id: keyResultId, goalId },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key result with ID ${keyResultId} not found`);
    }

    // Check if this update will achieve the key result
    const wasAchieved = keyResult.currentValue >= keyResult.targetValue;
    const willBeAchieved =
      dto.currentValue !== undefined
        ? dto.currentValue >= (dto.targetValue ?? keyResult.targetValue)
        : wasAchieved;

    const updatedKeyResult = await this.prisma.keyResult.update({
      where: { id: keyResultId },
      data: dto,
    });

    // Calculate progress percentage for the updated key result
    const progressPercentage =
      updatedKeyResult.targetValue > 0
        ? Math.min(
            100,
            Math.max(0, (updatedKeyResult.currentValue / updatedKeyResult.targetValue) * 100),
          )
        : 0;

    // Update goal status based on new progress
    // This will check if all key results are achieved and emit achievement event
    await this.progressService.updateGoalStatus(goalId);

    // Emit key result achievement event if newly achieved
    if (!wasAchieved && willBeAchieved) {
      this.eventEmitter.emit('keyResult.achieved', {
        keyResultId,
        goalId,
        description: updatedKeyResult.description,
        ownerId: goal.ownerId,
        organizationId,
      });
    }

    return {
      ...updatedKeyResult,
      progressPercentage,
      isAchieved: updatedKeyResult.currentValue >= updatedKeyResult.targetValue,
    };
  }

  /**
   * Delete a key result
   */
  async deleteKeyResult(goalId: string, keyResultId: string, organizationId: string) {
    await this.findById(goalId, organizationId);

    const keyResult = await this.prisma.keyResult.findFirst({
      where: { id: keyResultId, goalId },
    });

    if (!keyResult) {
      throw new NotFoundException(`Key result with ID ${keyResultId} not found`);
    }

    await this.prisma.keyResult.delete({
      where: { id: keyResultId },
    });

    // Recalculate goal status after removing key result
    await this.progressService.updateGoalStatus(goalId);

    return { success: true, message: 'Key result deleted successfully' };
  }

  /**
   * Get OKR summary for a goal
   *
   * Returns a summary of the OKR including:
   * - Overall progress (weighted average of key results)
   * - Number of key results achieved vs total
   * - Individual key result progress
   */
  async getOKRSummary(goalId: string, organizationId: string) {
    const goal = await this.findById(goalId, organizationId);

    if (goal.keyResults.length === 0) {
      return {
        isOKR: false,
        message: 'This goal does not have key results (not an OKR)',
      };
    }

    const keyResultsProgress = goal.keyResults.map((kr) => ({
      id: kr.id,
      description: kr.description,
      currentValue: kr.currentValue,
      targetValue: kr.targetValue,
      progressPercentage: kr.progressPercentage,
      weight: kr.weight,
      isAchieved: kr.isAchieved,
    }));

    const totalWeight = keyResultsProgress.reduce((sum, kr) => sum + kr.weight, 0);
    const weightedProgress = keyResultsProgress.reduce((sum, kr) => {
      return sum + kr.progressPercentage * kr.weight;
    }, 0);
    const overallProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;

    return {
      isOKR: true,
      goalId: goal.id,
      objectiveName: goal.name,
      objectiveDescription: goal.description,
      overallProgress: Math.min(100, Math.max(0, overallProgress)),
      keyResultsTotal: keyResultsProgress.length,
      keyResultsAchieved: keyResultsProgress.filter((kr) => kr.isAchieved).length,
      isAchieved: goal.progress.isAchieved,
      status: goal.status,
      keyResults: keyResultsProgress,
    };
  }

  /**
   * Get goal history for an organization
   */
  async getHistory(organizationId: string, filters: GoalFiltersDto) {
    const { teamId, page = 1, limit = 20 } = filters;

    const where: any = {
      organizationId,
      status: { in: [GoalStatus.ACHIEVED, GoalStatus.FAILED] },
    };

    if (teamId) where.teamId = teamId;

    const [goals, total] = await Promise.all([
      this.prisma.goal.findMany({
        where,
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
        },
        orderBy: { achievedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goal.count({ where }),
    ]);

    // Calculate achievement rate
    const achievedCount = await this.prisma.goal.count({
      where: { ...where, status: GoalStatus.ACHIEVED },
    });

    const achievementRate = total > 0 ? (achievedCount / total) * 100 : 0;

    return {
      data: goals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        achievementRate,
      },
    };
  }
}
