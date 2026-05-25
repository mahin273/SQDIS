import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { SprintsService } from './sprints.service';
import { SprintAutoGenerationService } from './services/sprint-auto-generation.service';
import { SprintExportService } from './services/sprint-export.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { SprintReportDto, SprintCompareResponseDto } from './dto/sprint-report.dto';
import {
  VelocityTrendDto,
  SprintBurndownDto,
  SprintHealthDto,
  SprintContributionsDto,
  SprintTimelineResponseDto,
  CreateSprintGoalDto,
  SprintGoalDto,
  CreateRetrospectiveDto,
  SprintRetrospectiveDto,
  CreateCarryOverDto,
  SprintCarryOverDto,
} from './dto/sprint-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { OrganizationsService } from '../organizations/organizations.service';
import { TeamsService } from '../teams/teams.service';
import { Role } from '@prisma/client';

/**
 * Controller for sprint management
 */
@ApiTags('Sprints')
@Controller('sprints')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SprintsController {
  constructor(
    private readonly sprintsService: SprintsService,
    private readonly sprintAutoGenerationService: SprintAutoGenerationService,
    private readonly sprintExportService: SprintExportService,
    private readonly organizationsService: OrganizationsService,
    private readonly teamsService: TeamsService,
  ) {}

  /**
   * Create a new sprint
   */
  @Post()
  @ApiOperation({ summary: 'Create a new sprint' })
  @ApiResponse({
    status: 201,
    description: 'Sprint created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid sprint dates',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to create sprints',
  })
  @ApiResponse({
    status: 404,
    description: 'Team not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Sprint dates overlap with existing sprint',
  })
  async create(
    @Body() dto: CreateSprintDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    // Check if user is OWNER, ADMIN, or Team Lead of the specified team
    const isTeamLead = await this.teamsService.isTeamLead(dto.teamId, userId);
    if (!isTeamLead) {
      await this.organizationsService.verifyUserRole(organizationId, userId, [
        Role.OWNER,
        Role.ADMIN,
        Role.TEAM_LEAD,
      ]);
    }

    return this.sprintsService.create(dto, organizationId);
  }

  /**
   * Get all sprints for the current organization
   */
  @Get()
  @ApiOperation({ summary: 'Get all sprints for the current organization' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Filter by team ID' })
  @ApiResponse({
    status: 200,
    description: 'List of sprints',
  })
  async findAll(
    @Query('teamId') teamId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    return this.sprintsService.findAll(organizationId, teamId);
  }

  /**
   * Get sprint by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get sprint by ID' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({
    status: 200,
    description: 'Sprint details',
  })
  @ApiResponse({
    status: 404,
    description: 'Sprint not found',
  })
  async findOne(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.findById(id);
  }

  /**
   * Update sprint
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({
    status: 200,
    description: 'Sprint updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid sprint dates',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to update this sprint',
  })
  @ApiResponse({
    status: 404,
    description: 'Sprint not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Sprint dates overlap with existing sprint',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSprintDto,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    const sprint = await this.sprintsService.verifySprintAccess(id, organizationId);

    // Check if user is OWNER, ADMIN, or Team Lead of the sprint's team
    const isTeamLead = await this.teamsService.isTeamLead(sprint.teamId, userId);
    if (!isTeamLead) {
      await this.organizationsService.verifyUserRole(organizationId, userId, [
        Role.OWNER,
        Role.ADMIN,
      ]);
    }

    return this.sprintsService.update(id, dto);
  }

  /**
   * Delete sprint (soft delete)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({
    status: 204,
    description: 'Sprint deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to delete this sprint',
  })
  @ApiResponse({
    status: 404,
    description: 'Sprint not found',
  })
  async delete(
    @Param('id') id: string,
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    const sprint = await this.sprintsService.verifySprintAccess(id, organizationId);

    // Check if user is OWNER, ADMIN, or Team Lead of the sprint's team
    const isTeamLead = await this.teamsService.isTeamLead(sprint.teamId, userId);
    if (!isTeamLead) {
      await this.organizationsService.verifyUserRole(organizationId, userId, [
        Role.OWNER,
        Role.ADMIN,
      ]);
    }

    return this.sprintsService.delete(id);
  }

  /**
   * Get sprint report
   */
  @Get(':id/report')
  @ApiOperation({ summary: 'Get sprint report with quality metrics' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({
    status: 200,
    description: 'Sprint report with all metrics',
    type: SprintReportDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Sprint not found',
  })
  async getReport(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<SprintReportDto> {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.generateReport(id);
  }

  /**
   * Compare multiple sprints
   */
  @Get('compare')
  @ApiOperation({ summary: 'Compare multiple sprints side-by-side' })
  @ApiQuery({
    name: 'sprintIds',
    description: 'Comma-separated sprint IDs to compare (2-5 sprints)',
    example: 'sprint-id-1,sprint-id-2',
  })
  @ApiResponse({
    status: 200,
    description: 'Sprint comparison with metrics and changes',
    type: SprintCompareResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid number of sprints (must be 2-5)',
  })
  @ApiResponse({
    status: 404,
    description: 'One or more sprints not found',
  })
  async compareSprints(
    @Query('sprintIds') sprintIds: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<SprintCompareResponseDto> {
    const ids = sprintIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);
    return this.sprintsService.compareSprints(ids, organizationId);
  }

  /**
   * Trigger sprint auto-generation check (admin only)
   */
  @Post('auto-generate')
  @ApiOperation({ summary: 'Manually trigger sprint report auto-generation for ended sprints' })
  @ApiResponse({
    status: 200,
    description: 'Auto-generation triggered successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'User does not have permission to trigger auto-generation',
  })
  async triggerAutoGeneration(
    @GetUser('id') userId: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<{ processed: number }> {
    // Only OWNER and ADMIN can trigger auto-generation
    await this.organizationsService.verifyUserRole(organizationId, userId, [
      Role.OWNER,
      Role.ADMIN,
    ]);

    return this.sprintAutoGenerationService.triggerSprintEndCheck();
  }

  /**
   * Export sprint report as PDF
   */
  @Get(':id/export/pdf')
  @ApiOperation({ summary: 'Export sprint report as PDF' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiProduces('application/pdf')
  @ApiResponse({
    status: 200,
    description: 'PDF file download',
  })
  @ApiResponse({
    status: 404,
    description: 'Sprint not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to generate PDF export',
  })
  async exportPdf(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    const sprintDetails = await this.sprintsService.findById(id);
    const pdfBuffer = await this.sprintExportService.exportPdf(id);
    const filename = this.sprintExportService.generateFilename(sprintDetails.name, 'pdf');

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  /**
   * Export sprint report as CSV
   */
  @Get(':id/export/csv')
  @ApiOperation({ summary: 'Export sprint report as CSV' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiProduces('text/csv')
  @ApiResponse({
    status: 200,
    description: 'CSV file download',
  })
  @ApiResponse({
    status: 404,
    description: 'Sprint not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to generate CSV export',
  })
  async exportCsv(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    const sprintDetails = await this.sprintsService.findById(id);
    const csvContent = await this.sprintExportService.exportCsv(id);
    const filename = this.sprintExportService.generateFilename(sprintDetails.name, 'csv');

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': Buffer.byteLength(csvContent),
    });

    res.send(csvContent);
  }

  // ==================== NEW ANALYTICS ENDPOINTS ====================

  /**
   * Get velocity trend across sprints
   * Feature 1: Sprint Velocity Chart
   */
  @Get('analytics/velocity')
  @ApiOperation({ summary: 'Get sprint velocity trend' })
  @ApiQuery({ name: 'teamId', required: false, description: 'Filter by team ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of sprints to include' })
  @ApiResponse({ status: 200, description: 'Velocity trend data', type: VelocityTrendDto })
  async getVelocityTrend(
    @GetUser('organizationId') organizationId: string,
    @Query('teamId') teamId?: string,
    @Query('limit') limit?: string,
  ): Promise<VelocityTrendDto> {
    return this.sprintsService.getVelocityTrend(
      organizationId,
      teamId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * Get sprint timeline for Gantt view
   * Feature 7: Sprint Timeline/Gantt View
   */
  @Get('analytics/timeline')
  @ApiOperation({ summary: 'Get sprint timeline for Gantt view' })
  @ApiQuery({ name: 'months', required: false, description: 'Number of months to include' })
  @ApiResponse({ status: 200, description: 'Sprint timeline data' })
  async getSprintTimeline(
    @GetUser('organizationId') organizationId: string,
    @Query('months') months?: string,
  ) {
    return this.sprintsService.getSprintTimeline(organizationId, months ? parseInt(months, 10) : 3);
  }

  /**
   * Get sprint burndown data
   * Feature 2: Sprint Burndown/Burnup Chart
   */
  @Get(':id/burndown')
  @ApiOperation({ summary: 'Get sprint burndown chart data' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Burndown chart data', type: SprintBurndownDto })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async getBurndown(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<SprintBurndownDto> {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.getBurndown(id);
  }

  /**
   * Get sprint health indicators
   * Feature 4: Sprint Health Indicators
   */
  @Get(':id/health')
  @ApiOperation({ summary: 'Get sprint health indicators' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint health data' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async getSprintHealth(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.getSprintHealth(id);
  }

  /**
   * Get developer contributions for a sprint
   * Feature 6: Developer Contribution Breakdown
   */
  @Get(':id/contributions')
  @ApiOperation({ summary: 'Get developer contributions for a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({
    status: 200,
    description: 'Developer contributions',
    type: SprintContributionsDto,
  })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async getDeveloperContributions(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ): Promise<SprintContributionsDto> {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.getDeveloperContributions(id);
  }

  // ==================== SPRINT GOALS ====================

  /**
   * Create a sprint goal
   * Feature 5: Sprint Goals/Targets
   */
  @Post(':id/goals')
  @ApiOperation({ summary: 'Create a sprint goal' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 201, description: 'Goal created successfully' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async createGoal(
    @Param('id') id: string,
    @Body() dto: CreateSprintGoalDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.createGoal(id, dto);
  }

  /**
   * Get sprint goals
   */
  @Get(':id/goals')
  @ApiOperation({ summary: 'Get sprint goals with progress' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint goals' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async getGoals(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.getGoals(id);
  }

  /**
   * Delete a sprint goal
   */
  @Delete('goals/:goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sprint goal' })
  @ApiParam({ name: 'goalId', description: 'Goal ID' })
  @ApiResponse({ status: 204, description: 'Goal deleted successfully' })
  async deleteGoal(@Param('goalId') goalId: string) {
    return this.sprintsService.deleteGoal(goalId);
  }

  // ==================== RETROSPECTIVES ====================

  /**
   * Create or update sprint retrospective
   * Feature 9: Sprint Retrospective Notes
   */
  @Put(':id/retrospective')
  @ApiOperation({ summary: 'Create or update sprint retrospective' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Retrospective saved' })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async upsertRetrospective(
    @Param('id') id: string,
    @Body() dto: CreateRetrospectiveDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.upsertRetrospective(id, dto);
  }

  /**
   * Get sprint retrospective
   */
  @Get(':id/retrospective')
  @ApiOperation({ summary: 'Get sprint retrospective' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint retrospective', type: SprintRetrospectiveDto })
  async getRetrospective(
    @Param('id') id: string,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.getRetrospective(id);
  }

  // ==================== CARRY-OVERS ====================

  /**
   * Create a carry-over item
   * Feature 10: Sprint Carry-over Tracking
   */
  @Post(':id/carry-overs')
  @ApiOperation({ summary: 'Create a carry-over item' })
  @ApiParam({ name: 'id', description: 'Source Sprint ID' })
  @ApiResponse({ status: 201, description: 'Carry-over created', type: SprintCarryOverDto })
  @ApiResponse({ status: 404, description: 'Sprint not found' })
  async createCarryOver(
    @Param('id') id: string,
    @Body() dto: CreateCarryOverDto,
    @GetUser('organizationId') organizationId: string,
  ) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.createCarryOver(id, dto);
  }

  /**
   * Get carry-overs for a sprint
   */
  @Get(':id/carry-overs')
  @ApiOperation({ summary: 'Get carry-overs for a sprint' })
  @ApiParam({ name: 'id', description: 'Sprint ID' })
  @ApiResponse({ status: 200, description: 'Sprint carry-overs' })
  async getCarryOvers(@Param('id') id: string, @GetUser('organizationId') organizationId: string) {
    await this.sprintsService.verifySprintAccess(id, organizationId);
    return this.sprintsService.getCarryOvers(id);
  }

  /**
   * Delete a carry-over item
   */
  @Delete('carry-overs/:carryOverId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a carry-over item' })
  @ApiParam({ name: 'carryOverId', description: 'Carry-over ID' })
  @ApiResponse({ status: 204, description: 'Carry-over deleted successfully' })
  async deleteCarryOver(@Param('carryOverId') carryOverId: string) {
    return this.sprintsService.deleteCarryOver(carryOverId);
  }
}
