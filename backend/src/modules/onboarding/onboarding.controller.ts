import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OnboardingService } from './onboarding.service';
import { ProgressTrackingService } from './services/progress-tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import {
  CreateOnboardingDto,
  ExtendOnboardingDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  UpdateChecklistItemDto,
} from './dto';
import { OnboardingStatus } from '@prisma/client';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly progressTrackingService: ProgressTrackingService,
  ) {}

  @Post()
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Create a new onboarding process' })
  @ApiResponse({ status: 201, description: 'Onboarding process created successfully.' })
  async create(@GetUser() user: any, @Body() dto: CreateOnboardingDto) {
    return this.onboardingService.create(user.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all onboarding processes with optional status/mentor filters' })
  @ApiQuery({ name: 'status', required: false, enum: OnboardingStatus })
  @ApiQuery({ name: 'mentorId', required: false })
  @ApiResponse({ status: 200, description: 'Onboardings list retrieved successfully.' })
  async findAll(
    @GetUser() user: any,
    @Query('status') status?: OnboardingStatus,
    @Query('mentorId') mentorId?: string,
  ) {
    return this.onboardingService.findAll(user.organizationId, { status, mentorId });
  }

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get milestone tracking statistics for dashboard' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved.' })
  async getMilestoneTrackingStats(@GetUser() user: any) {
    return this.progressTrackingService.getDashboardStats(user.organizationId);
  }

  @Get('dashboard/at-risk')
  @ApiOperation({ summary: 'Get list of developers at risk during onboarding' })
  @ApiResponse({ status: 200, description: 'At-risk developers list retrieved.' })
  async getAtRiskDevelopers(@GetUser() user: any) {
    return this.progressTrackingService.getAtRiskDevelopers(user.organizationId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get general onboarding dashboard stats' })
  @ApiResponse({ status: 200, description: 'Stats retrieved.' })
  async getDashboardStats(@GetUser() user: any) {
    return this.onboardingService.getDashboardStats(user.organizationId);
  }

  @Get('velocity')
  @ApiOperation({ summary: 'Get onboarding velocity comparison across teams' })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Velocity comparison stats retrieved.' })
  async getVelocityComparison(
    @GetUser() user: any,
    @Query('teamId') teamId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const filters: { teamId?: string; startDate?: Date; endDate?: Date } = {};
    if (teamId) filters.teamId = teamId;
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);

    return this.onboardingService.getVelocityComparison(user.organizationId, filters);
  }

  @Get('velocity/:userId')
  @ApiOperation({ summary: 'Get onboarding velocity metrics for an individual developer' })
  @ApiParam({ name: 'userId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'Developer velocity stats retrieved.' })
  async getDeveloperVelocity(@GetUser() user: any, @Param('userId') userId: string) {
    return this.onboardingService.getDeveloperVelocity(user.organizationId, userId);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Get onboarding checklists templates' })
  @ApiResponse({ status: 200, description: 'Templates list retrieved.' })
  async getTemplates(@GetUser() user: any) {
    return this.onboardingService.getTemplates(user.organizationId);
  }

  @Post('templates')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Create a new onboarding checklist template' })
  @ApiResponse({ status: 201, description: 'Checklist template created successfully.' })
  async createTemplate(@GetUser() user: any, @Body() dto: CreateTemplateDto) {
    return this.onboardingService.createTemplate(user.organizationId, dto);
  }

  @Get('templates/:id')
  @ApiOperation({ summary: 'Get onboarding template details by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template details retrieved.' })
  async getTemplate(@Param('id') id: string) {
    return this.onboardingService.getTemplate(id);
  }

  @Patch('templates/:id')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Update template details by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully.' })
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.onboardingService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Delete a template by ID' })
  @ApiParam({ name: 'id', description: 'Template ID' })
  @ApiResponse({ status: 200, description: 'Template successfully deleted.' })
  async deleteTemplate(@Param('id') id: string) {
    return this.onboardingService.deleteTemplate(id);
  }

  /**
   * Get detailed progress information for an individual developer
   * Returns milestone achievements, timing comparisons, and mentor information
   */
  @Get(':userId/progress')
  @ApiOperation({ summary: 'Get individual developer progress metrics' })
  @ApiParam({ name: 'userId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'Developer progress data retrieved.' })
  async getDeveloperProgress(@GetUser() user: any, @Param('userId') userId: string) {
    return this.progressTrackingService.getDeveloperProgress(userId, user.organizationId);
  }

  /**
   * Get milestone timeline for an individual developer
   * Returns milestones ordered by achievement timestamp with timing information
   */
  @Get(':userId/timeline')
  @ApiOperation({ summary: 'Get individual milestone timeline' })
  @ApiParam({ name: 'userId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'Milestone timeline entries retrieved.' })
  async getMilestoneTimeline(@GetUser() user: any, @Param('userId') userId: string) {
    return this.progressTrackingService.getMilestoneTimeline(userId);
  }

  /**
   * Get available mentors for assignment
   * Returns mentors who have fewer than 3 active mentees
   */
  @Get('mentors/available')
  @ApiOperation({ summary: 'Get list of available mentors for assignment' })
  @ApiResponse({ status: 200, description: 'Available mentors list retrieved.' })
  async getAvailableMentors(@GetUser() user: any) {
    return this.onboardingService.getAvailableMentors(user.organizationId);
  }

  /**
   * Get capacity information for a specific mentor
   * Returns current mentee count, available capacity, and active mentees
   */
  @Get('mentors/:mentorId/capacity')
  @ApiOperation({ summary: 'Get capacity status for a mentor' })
  @ApiParam({ name: 'mentorId', description: 'Mentor User ID' })
  @ApiResponse({ status: 200, description: 'Mentor capacity information retrieved.' })
  async getMentorCapacity(@GetUser() user: any, @Param('mentorId') mentorId: string) {
    return this.progressTrackingService.getMentorCapacity(mentorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get onboarding process details by ID' })
  @ApiParam({ name: 'id', description: 'Onboarding ID' })
  @ApiResponse({ status: 200, description: 'Onboarding details retrieved.' })
  async findById(@Param('id') id: string) {
    return this.onboardingService.findById(id);
  }

  @Patch(':id/mentor')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Assign a mentor to an onboarding process' })
  @ApiParam({ name: 'id', description: 'Onboarding ID' })
  @ApiResponse({ status: 200, description: 'Mentor successfully assigned.' })
  async assignMentor(@Param('id') id: string, @Body('mentorId') mentorId: string) {
    return this.onboardingService.assignMentor(id, mentorId);
  }

  @Patch(':id/extend')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Extend onboarding duration' })
  @ApiParam({ name: 'id', description: 'Onboarding ID' })
  @ApiResponse({ status: 200, description: 'Onboarding extended successfully.' })
  async extend(@Param('id') id: string, @Body() dto: ExtendOnboardingDto) {
    return this.onboardingService.extend(id, dto);
  }

  @Patch(':id/complete')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  @ApiOperation({ summary: 'Mark onboarding process as complete' })
  @ApiParam({ name: 'id', description: 'Onboarding ID' })
  @ApiResponse({ status: 200, description: 'Onboarding marked as complete.' })
  async complete(@Param('id') id: string) {
    return this.onboardingService.complete(id);
  }

  @Get(':id/checklist')
  @ApiOperation({ summary: 'Get onboarding checklist items status' })
  @ApiParam({ name: 'id', description: 'Onboarding ID' })
  @ApiResponse({ status: 200, description: 'Checklist items status list retrieved.' })
  async getChecklist(@Param('id') id: string) {
    return this.onboardingService.getChecklist(id);
  }

  @Patch(':id/checklist/:itemId')
  @ApiOperation({ summary: 'Update status of a specific checklist item' })
  @ApiParam({ name: 'id', description: 'Onboarding ID' })
  @ApiParam({ name: 'itemId', description: 'Checklist Item ID' })
  @ApiResponse({ status: 200, description: 'Checklist item updated successfully.' })
  async updateChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.onboardingService.updateChecklistItem(id, itemId, dto);
  }
}
