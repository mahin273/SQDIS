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
  UpdateOnboardingDto,
  ExtendOnboardingDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  UpdateChecklistItemDto,
} from './dto';
import { OnboardingStatus } from '@prisma/client';

@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingController {
  constructor(
    private readonly onboardingService: OnboardingService,
    private readonly progressTrackingService: ProgressTrackingService,
  ) {}

  @Post()
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async create(@GetUser() user: any, @Body() dto: CreateOnboardingDto) {
    return this.onboardingService.create(user.organizationId, dto);
  }

  @Get()
  async findAll(
    @GetUser() user: any,
    @Query('status') status?: OnboardingStatus,
    @Query('mentorId') mentorId?: string,
  ) {
    return this.onboardingService.findAll(user.organizationId, { status, mentorId });
  }

  @Get('dashboard/stats')
  async getMilestoneTrackingStats(@GetUser() user: any) {
    return this.progressTrackingService.getDashboardStats(user.organizationId);
  }

  @Get('dashboard/at-risk')
  async getAtRiskDevelopers(@GetUser() user: any) {
    return this.progressTrackingService.getAtRiskDevelopers(user.organizationId);
  }

  @Get('stats')
  async getDashboardStats(@GetUser() user: any) {
    return this.onboardingService.getDashboardStats(user.organizationId);
  }

  @Get('velocity')
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
  async getDeveloperVelocity(@GetUser() user: any, @Param('userId') userId: string) {
    return this.onboardingService.getDeveloperVelocity(user.organizationId, userId);
  }

  @Get('templates')
  async getTemplates(@GetUser() user: any) {
    return this.onboardingService.getTemplates(user.organizationId);
  }

  @Post('templates')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async createTemplate(@GetUser() user: any, @Body() dto: CreateTemplateDto) {
    return this.onboardingService.createTemplate(user.organizationId, dto);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.onboardingService.getTemplate(id);
  }

  @Patch('templates/:id')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.onboardingService.updateTemplate(id, dto);
  }

  @Delete('templates/:id')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async deleteTemplate(@Param('id') id: string) {
    return this.onboardingService.deleteTemplate(id);
  }

  /**
   * Get detailed progress information for an individual developer
   * Returns milestone achievements, timing comparisons, and mentor information
   *
   * @param user - Authenticated user (injected by JwtAuthGuard)
   * @param userId - ID of the developer whose progress to retrieve
   * @returns DeveloperProgressDto with milestone achievements and timing data
   * @throws NotFoundException if no onboarding found for the user
   * @throws UnauthorizedException if user doesn't have access to this organization's data
   *
   */
  @Get(':userId/progress')
  async getDeveloperProgress(@GetUser() user: any, @Param('userId') userId: string) {
    return this.progressTrackingService.getDeveloperProgress(userId, user.organizationId);
  }

  /**
   * Get milestone timeline for an individual developer
   * Returns milestones ordered by achievement timestamp with timing information
   *
   * @param user - Authenticated user (injected by JwtAuthGuard)
   * @param userId - ID of the developer whose timeline to retrieve
   * @returns Array of MilestoneTimelineEntryDto ordered by achievement date
   * @throws NotFoundException if no onboarding found for the user
   * @throws UnauthorizedException if user doesn't have access to this organization's data
   *
   */
  @Get(':userId/timeline')
  async getMilestoneTimeline(@GetUser() user: any, @Param('userId') userId: string) {
    return this.progressTrackingService.getMilestoneTimeline(userId);
  }

  /**
   * Get available mentors for assignment
   * Returns mentors who have fewer than 3 active mentees
   *
   * @param user - Authenticated user (injected by JwtAuthGuard)
   * @returns Array of MentorCapacityDto with mentor availability information
   * @throws UnauthorizedException if user doesn't have access to this organization's data
   *
   */
  @Get('mentors/available')
  async getAvailableMentors(@GetUser() user: any) {
    return this.onboardingService.getAvailableMentors(user.organizationId);
  }

  /**
   * Get capacity information for a specific mentor
   * Returns current mentee count, available capacity, and active mentees
   *
   * @param user - Authenticated user (injected by JwtAuthGuard)
   * @param mentorId - ID of the mentor whose capacity to retrieve
   * @returns MentorCapacityDto with mentor capacity information
   * @throws NotFoundException if mentor not found
   * @throws UnauthorizedException if user doesn't have access to this organization's data
   *
   */
  @Get('mentors/:mentorId/capacity')
  async getMentorCapacity(@GetUser() user: any, @Param('mentorId') mentorId: string) {
    return this.progressTrackingService.getMentorCapacity(mentorId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.onboardingService.findById(id);
  }

  @Patch(':id/mentor')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async assignMentor(@Param('id') id: string, @Body('mentorId') mentorId: string) {
    return this.onboardingService.assignMentor(id, mentorId);
  }

  @Patch(':id/extend')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async extend(@Param('id') id: string, @Body() dto: ExtendOnboardingDto) {
    return this.onboardingService.extend(id, dto);
  }

  @Patch(':id/complete')
  @Roles('ADMIN', 'OWNER', 'TEAM_LEAD')
  async complete(@Param('id') id: string) {
    return this.onboardingService.complete(id);
  }

  @Get(':id/checklist')
  async getChecklist(@Param('id') id: string) {
    return this.onboardingService.getChecklist(id);
  }

  @Patch(':id/checklist/:itemId')
  async updateChecklistItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.onboardingService.updateChecklistItem(id, itemId, dto);
  }
}
