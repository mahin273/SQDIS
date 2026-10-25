import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  Optional,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import { GoalAchievementService } from './services/goal-achievement.service';
import { GoalHistoryService } from './services/goal-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { DataFilterService } from '../auth/services/data-filter.service';
import {
  CreateGoalDto,
  UpdateGoalDto,
  GoalFiltersDto,
  GoalsDashboardFiltersDto,
  CreateKeyResultDto,
  UpdateKeyResultDto,
  CreateGoalTemplateDto,
  UpdateGoalTemplateDto,
  GoalHistoryFiltersDto,
} from './dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';

/**
 * Controller for quality goals and OKRs management
 */
@ApiTags('Goals')
@ApiBearerAuth()
@Controller('goals')
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly templatesService: GoalTemplatesService,
    private readonly achievementService: GoalAchievementService,
    private readonly historyService: GoalHistoryService,
    @Optional() private readonly dataFilterService?: DataFilterService,
  ) {}

  private getOrgId(req: any): string {
    return (
      req.organizationId ||
      req.headers?.['x-organization-id'] ||
      req.user?.organizationId
    );
  }

  private async verifyGoalItemAccess(goalId: string, orgId: string, user?: any) {
    const goal = await this.goalsService.findById(goalId, orgId);
    if (!this.dataFilterService || !user) return goal;
    if ((goal as any)?.teamId) {
      await this.dataFilterService.verifyTeamAccess((goal as any).teamId, orgId, user);
    }
    if ((goal as any)?.projectId) {
      await this.dataFilterService.verifyProjectAccess((goal as any).projectId, orgId, user);
    }
    return goal;
  }

  // ==================== GOAL ENDPOINTS ====================

  /**
   * Get goals dashboard with all active goals, progress bars, and at-risk highlighting
   */
  @Get('dashboard')
  @ApiOperation({ summary: 'Get goals dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard stats and active goals list retrieved successfully.' })
  async getDashboard(@Request() req: any, @Query() filters: GoalsDashboardFiltersDto) {
    const orgId = this.getOrgId(req);
    if (filters.teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(filters.teamId, orgId, req.user);
    }
    if (filters.ownerId && this.dataFilterService) {
      await this.dataFilterService.verifyDeveloperAccess(filters.ownerId, orgId, req.user);
    }
    return this.goalsService.getDashboard(orgId, filters);
  }

  /**
   * Get all goals with filters
   */
  @Get()
  @ApiOperation({ summary: 'Get all goals with filters' })
  @ApiResponse({ status: 200, description: 'Goals list retrieved successfully.' })
  async findAll(@Request() req: any, @Query() filters: GoalFiltersDto) {
    const orgId = this.getOrgId(req);
    if (filters.teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(filters.teamId, orgId, req.user);
    }
    if (filters.projectId && this.dataFilterService) {
      await this.dataFilterService.verifyProjectAccess(filters.projectId, orgId, req.user);
    }
    return this.goalsService.findAll(orgId, filters);
  }

  /**
   * Get goal history
   */
  @Get('history')
  @ApiOperation({ summary: 'Get history of goals' })
  @ApiResponse({ status: 200, description: 'Goals history retrieved successfully.' })
  async getHistory(@Request() req: any, @Query() filters: GoalFiltersDto) {
    const orgId = this.getOrgId(req);
    if (filters.teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(filters.teamId, orgId, req.user);
    }
    if (filters.projectId && this.dataFilterService) {
      await this.dataFilterService.verifyProjectAccess(filters.projectId, orgId, req.user);
    }
    return this.goalsService.getHistory(orgId, filters);
  }

  /**
   * Get achievement history for the current user
   */
  @Get('achievements')
  @ApiOperation({ summary: 'Get user goal achievements' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Achievement history retrieved successfully.' })
  async getAchievements(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.achievementService.getAchievementHistory(
      req.user.id,
      this.getOrgId(req),
      page || 1,
      limit || 20,
    );
  }

  // ==================== TEMPLATE ENDPOINTS ====================

  /**
   * Get all goal templates
   */
  @Get('templates')
  @ApiOperation({ summary: 'Get all goal templates' })
  @ApiResponse({ status: 200, description: 'Goal templates list retrieved successfully.' })
  async getTemplates(@Request() req: any) {
    return this.templatesService.findAll(this.getOrgId(req));
  }

  /**
   * Create a goal template
   */
  @Post('templates')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Create a new goal template' })
  @ApiResponse({ status: 201, description: 'Goal template created successfully.' })
  async createTemplate(@Request() req: any, @Body() dto: CreateGoalTemplateDto) {
    return this.templatesService.create(this.getOrgId(req), dto);
  }

  /**
   * Get a specific goal template
   */
  @Get('templates/:id')
  @ApiOperation({ summary: 'Get goal template details by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template details retrieved.' })
  async getTemplate(@Request() req: any, @Param('id') id: string) {
    return this.templatesService.findById(id, this.getOrgId(req));
  }

  /**
   * Update a goal template
   */
  @Patch('templates/:id')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Update goal template details by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully.' })
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGoalTemplateDto,
  ) {
    return this.templatesService.update(id, this.getOrgId(req), dto);
  }

  /**
   * Delete a goal template
   */
  @Delete('templates/:id')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a goal template' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully.' })
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    return this.templatesService.delete(id, this.getOrgId(req));
  }

  // ==================== HISTORY ENDPOINTS ====================

  /**
   * Get goal snapshots (historical data)
   */
  @Get('snapshots')
  @ApiOperation({ summary: 'Get historical goal snapshots' })
  @ApiResponse({ status: 200, description: 'Snapshots list retrieved.' })
  async getSnapshots(@Request() req: any, @Query() filters: GoalHistoryFiltersDto) {
    const orgId = this.getOrgId(req);
    if (filters.teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(filters.teamId, orgId, req.user);
    }
    if (filters.ownerId && this.dataFilterService) {
      await this.dataFilterService.verifyDeveloperAccess(filters.ownerId, orgId, req.user);
    }
    return this.historyService.getGoalHistory(orgId, {
      teamId: filters.teamId,
      ownerId: filters.ownerId,
      metricType: filters.metricType,
      wasAchieved: filters.wasAchieved,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      page: filters.page,
      limit: filters.limit,
    });
  }

  /**
   * Get achievement rate over time
   */
  @Get('achievement-rate')
  @ApiOperation({ summary: 'Get goal achievement rate over time' })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'periodMonths', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Achievement rate analytics retrieved.' })
  async getAchievementRate(
    @Request() req: any,
    @Query('teamId') teamId?: string,
    @Query('periodMonths') periodMonths?: number,
  ) {
    const orgId = this.getOrgId(req);
    if (teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(teamId, orgId, req.user);
    }
    return this.historyService.calculateAchievementRateOverTime(
      orgId,
      teamId,
      periodMonths || 12,
    );
  }

  /**
   * Get team achievement comparison
   */
  @Get('team-comparison')
  @ApiOperation({ summary: 'Get team achievement comparison data' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Team comparison statistics retrieved.' })
  async getTeamComparison(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.historyService.calculateTeamAchievementPercentages(
      this.getOrgId(req),
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get goal history for reports
   */
  @Get('reports/history')
  @ApiOperation({ summary: 'Get goal history structured for reports' })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'includeTeamComparison', required: false })
  @ApiResponse({ status: 200, description: 'Goal history report data retrieved.' })
  async getHistoryForReports(
    @Request() req: any,
    @Query('teamId') teamId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeTeamComparison') includeTeamComparison?: string,
  ) {
    const orgId = this.getOrgId(req);
    if (teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(teamId, orgId, req.user);
    }
    return this.historyService.getGoalHistoryForReports(orgId, {
      teamId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeTeamComparison: includeTeamComparison !== 'false',
    });
  }

  /**
   * Manually trigger snapshot for a goal
   */
  @Post(':id/snapshot')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Trigger a snapshot record for a goal' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 201, description: 'Snapshot successfully created.' })
  async snapshotGoal(@Request() req: any, @Param('id') id: string) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(id, orgId, req.user);
    return this.historyService.snapshotGoal(id);
  }

  // ==================== GOAL CRUD ENDPOINTS ====================

  /**
   * Create a new goal
   */
  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Create a new quality goal / OKR' })
  @ApiResponse({ status: 201, description: 'Goal successfully created.' })
  async create(@Request() req: any, @Body() dto: CreateGoalDto) {
    const orgId = this.getOrgId(req);
    if (dto.teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(dto.teamId, orgId, req.user);
    }
    if (dto.projectId && this.dataFilterService) {
      await this.dataFilterService.verifyProjectAccess(dto.projectId, orgId, req.user);
    }
    return this.goalsService.create(orgId, req.user.id, dto);
  }

  /**
   * Get a specific goal
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get goal details by ID' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal details retrieved.' })
  async findById(@Request() req: any, @Param('id') id: string) {
    const orgId = this.getOrgId(req);
    return this.verifyGoalItemAccess(id, orgId, req.user);
  }

  /**
   * Update a goal
   */
  @Patch(':id')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Update goal details by ID' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal updated successfully.' })
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(id, orgId, req.user);
    if (dto.teamId && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(dto.teamId, orgId, req.user);
    }
    if (dto.projectId && this.dataFilterService) {
      await this.dataFilterService.verifyProjectAccess(dto.projectId, orgId, req.user);
    }
    return this.goalsService.update(id, orgId, dto);
  }

  /**
   * Delete a goal
   */
  @Delete(':id')
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete a goal' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Goal deleted successfully.' })
  async delete(@Request() req: any, @Param('id') id: string) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(id, orgId, req.user);
    return this.goalsService.delete(id, orgId);
  }

  /**
   * Get goal progress
   */
  @Get(':id/progress')
  @ApiOperation({ summary: 'Get real-time goal progress' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'Current progress metrics retrieved.' })
  async getProgress(@Request() req: any, @Param('id') id: string) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(id, orgId, req.user);
    return this.goalsService.getProgress(id, orgId);
  }

  /**
   * Get OKR summary for a goal
   */
  @Get(':id/okr-summary')
  @ApiOperation({ summary: 'Get OKR summary (weighted progress & key results)' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 200, description: 'OKR summary retrieved.' })
  async getOKRSummary(@Request() req: any, @Param('id') id: string) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(id, orgId, req.user);
    return this.goalsService.getOKRSummary(id, orgId);
  }

  // ==================== KEY RESULT ENDPOINTS ====================

  /**
   * Add a key result to a goal
   */
  @Post(':id/key-results')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Add a new key result to a goal' })
  @ApiParam({ name: 'id', description: 'Goal ID' })
  @ApiResponse({ status: 201, description: 'Key result successfully added.' })
  async addKeyResult(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateKeyResultDto,
  ) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(id, orgId, req.user);
    return this.goalsService.addKeyResult(id, orgId, dto);
  }

  /**
   * Update a key result
   */
  @Patch(':goalId/key-results/:keyResultId')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Update a key result detail' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiParam({ name: 'keyResultId', description: 'Key Result ID' })
  @ApiResponse({ status: 200, description: 'Key result updated successfully.' })
  async updateKeyResult(
    @Request() req: any,
    @Param('goalId') goalId: string,
    @Param('keyResultId') keyResultId: string,
    @Body() dto: UpdateKeyResultDto,
  ) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(goalId, orgId, req.user);
    return this.goalsService.updateKeyResult(goalId, keyResultId, orgId, dto);
  }

  /**
   * Delete a key result
   */
  @Delete(':goalId/key-results/:keyResultId')
  @Roles(Role.OWNER, Role.ADMIN, Role.TEAM_LEAD)
  @ApiOperation({ summary: 'Delete a key result from a goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiParam({ name: 'keyResultId', description: 'Key Result ID' })
  @ApiResponse({ status: 200, description: 'Key result deleted successfully.' })
  async deleteKeyResult(
    @Request() req: any,
    @Param('goalId') goalId: string,
    @Param('keyResultId') keyResultId: string,
  ) {
    const orgId = this.getOrgId(req);
    await this.verifyGoalItemAccess(goalId, orgId, req.user);
    return this.goalsService.deleteKeyResult(goalId, keyResultId, orgId);
  }
}
