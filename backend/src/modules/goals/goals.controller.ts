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
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalTemplatesService } from './services/goal-templates.service';
import { GoalAchievementService } from './services/goal-achievement.service';
import { GoalHistoryService } from './services/goal-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
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

/**
 * Controller for quality goals and OKRs management
 */
@Controller('goals')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class GoalsController {
  constructor(
    private readonly goalsService: GoalsService,
    private readonly templatesService: GoalTemplatesService,
    private readonly achievementService: GoalAchievementService,
    private readonly historyService: GoalHistoryService,
  ) {}

  // ==================== GOAL ENDPOINTS ====================

  /**
   * Get goals dashboard with all active goals, progress bars, and at-risk highlighting
   * GET /api/goals/dashboard
   * display all active goals
   * include progress bars for each goal
   * support team, status, and metric filters
   * highlight at-risk goals
   */
  @Get('dashboard')
  async getDashboard(@Request() req: any, @Query() filters: GoalsDashboardFiltersDto) {
    return this.goalsService.getDashboard(req.user.organizationId, filters);
  }

  /**
   * Get all goals with filters
   * GET /api/goals
   */
  @Get()
  async findAll(@Request() req: any, @Query() filters: GoalFiltersDto) {
    return this.goalsService.findAll(req.user.organizationId, filters);
  }

  /**
   * Get goal history
   * GET /api/goals/history
   */
  @Get('history')
  async getHistory(@Request() req: any, @Query() filters: GoalFiltersDto) {
    return this.goalsService.getHistory(req.user.organizationId, filters);
  }

  /**
   * Get achievement history for the current user
   * GET /api/goals/achievements
   * show all past achievements
   */
  @Get('achievements')
  async getAchievements(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.achievementService.getAchievementHistory(
      req.user.id,
      req.user.organizationId,
      page || 1,
      limit || 20,
    );
  }

  // ==================== TEMPLATE ENDPOINTS ====================

  /**
   * Get all goal templates
   * GET /api/goals/templates
   */
  @Get('templates')
  async getTemplates(@Request() req: any) {
    return this.templatesService.findAll(req.user.organizationId);
  }

  /**
   * Create a goal template
   * POST /api/goals/templates
   */
  @Post('templates')
  async createTemplate(@Request() req: any, @Body() dto: CreateGoalTemplateDto) {
    return this.templatesService.create(req.user.organizationId, dto);
  }

  /**
   * Get a specific goal template
   * GET /api/goals/templates/:id
   */
  @Get('templates/:id')
  async getTemplate(@Request() req: any, @Param('id') id: string) {
    return this.templatesService.findById(id, req.user.organizationId);
  }

  /**
   * Update a goal template
   * PATCH /api/goals/templates/:id
   */
  @Patch('templates/:id')
  async updateTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGoalTemplateDto,
  ) {
    return this.templatesService.update(id, req.user.organizationId, dto);
  }

  /**
   * Delete a goal template
   * DELETE /api/goals/templates/:id
   */
  @Delete('templates/:id')
  async deleteTemplate(@Request() req: any, @Param('id') id: string) {
    return this.templatesService.delete(id, req.user.organizationId);
  }

  // ==================== HISTORY ENDPOINTS ====================

  /**
   * Get goal snapshots (historical data)
   * GET /api/goals/snapshots
   */
  @Get('snapshots')
  async getSnapshots(@Request() req: any, @Query() filters: GoalHistoryFiltersDto) {
    return this.historyService.getGoalHistory(req.user.organizationId, {
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
   * GET /api/goals/achievement-rate
   */
  @Get('achievement-rate')
  async getAchievementRate(
    @Request() req: any,
    @Query('teamId') teamId?: string,
    @Query('periodMonths') periodMonths?: number,
  ) {
    return this.historyService.calculateAchievementRateOverTime(
      req.user.organizationId,
      teamId,
      periodMonths || 12,
    );
  }

  /**
   * Get team achievement comparison
   * GET /api/goals/team-comparison
   * show team-by-team goal performance
   */
  @Get('team-comparison')
  async getTeamComparison(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.historyService.calculateTeamAchievementPercentages(
      req.user.organizationId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get goal history for reports
   * GET /api/goals/reports/history
   * include goal history in reports
   */
  @Get('reports/history')
  async getHistoryForReports(
    @Request() req: any,
    @Query('teamId') teamId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeTeamComparison') includeTeamComparison?: string,
  ) {
    return this.historyService.getGoalHistoryForReports(req.user.organizationId, {
      teamId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeTeamComparison: includeTeamComparison !== 'false',
    });
  }

  /**
   * Manually trigger snapshot for a goal
   * POST /api/goals/:id/snapshot
   * snapshot final state
   */
  @Post(':id/snapshot')
  async snapshotGoal(@Request() req: any, @Param('id') id: string) {
    // Verify goal belongs to organization
    await this.goalsService.findById(id, req.user.organizationId);
    return this.historyService.snapshotGoal(id);
  }

  // ==================== GOAL CRUD ENDPOINTS ====================

  /**
   * Create a new goal
   * POST /api/goals
   */
  @Post()
  async create(@Request() req: any, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(req.user.organizationId, req.user.id, dto);
  }

  /**
   * Get a specific goal
   * GET /api/goals/:id
   */
  @Get(':id')
  async findById(@Request() req: any, @Param('id') id: string) {
    return this.goalsService.findById(id, req.user.organizationId);
  }

  /**
   * Update a goal
   * PATCH /api/goals/:id
   */
  @Patch(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateGoalDto) {
    return this.goalsService.update(id, req.user.organizationId, dto);
  }

  /**
   * Delete a goal
   * DELETE /api/goals/:id
   */
  @Delete(':id')
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.goalsService.delete(id, req.user.organizationId);
  }

  /**
   * Get goal progress
   * GET /api/goals/:id/progress
   */
  @Get(':id/progress')
  async getProgress(@Request() req: any, @Param('id') id: string) {
    return this.goalsService.getProgress(id, req.user.organizationId);
  }

  /**
   * Get OKR summary for a goal
   * GET /api/goals/:id/okr-summary
   * Returns a summary of the OKR including overall progress
   * (weighted average) and individual key result progress.
   */
  @Get(':id/okr-summary')
  async getOKRSummary(@Request() req: any, @Param('id') id: string) {
    return this.goalsService.getOKRSummary(id, req.user.organizationId);
  }

  // ==================== KEY RESULT ENDPOINTS ====================

  /**
   * Add a key result to a goal
   * POST /api/goals/:id/key-results
   */
  @Post(':id/key-results')
  async addKeyResult(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateKeyResultDto,
  ) {
    return this.goalsService.addKeyResult(id, req.user.organizationId, dto);
  }

  /**
   * Update a key result
   * PATCH /api/goals/:goalId/key-results/:keyResultId
   */
  @Patch(':goalId/key-results/:keyResultId')
  async updateKeyResult(
    @Request() req: any,
    @Param('goalId') goalId: string,
    @Param('keyResultId') keyResultId: string,
    @Body() dto: UpdateKeyResultDto,
  ) {
    return this.goalsService.updateKeyResult(goalId, keyResultId, req.user.organizationId, dto);
  }

  /**
   * Delete a key result
   * DELETE /api/goals/:goalId/key-results/:keyResultId
   */
  @Delete(':goalId/key-results/:keyResultId')
  async deleteKeyResult(
    @Request() req: any,
    @Param('goalId') goalId: string,
    @Param('keyResultId') keyResultId: string,
  ) {
    return this.goalsService.deleteKeyResult(goalId, keyResultId, req.user.organizationId);
  }
}
