import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, OrganizationGuard } from '../auth/guards';
import { GetOrganization, GetUser } from '../auth/decorators';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get organization-wide statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get organization-wide dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Organization stats retrieved successfully.' })
  async getStats(
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    return this.dashboardService.getOrganizationStats(organizationId, user);
  }

  /**
   * Get SQS trend over time
   */
  @Get('sqs-trend')
  @ApiOperation({ summary: 'Get SQS trend over time for organization' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days of trend history' })
  @ApiResponse({ status: 200, description: 'SQS trend retrieved successfully.' })
  async getSQSTrend(
    @GetOrganization() organizationId: string,
    @Query('days') days?: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getSQSTrend(organizationId, days ? parseInt(days) : 30, user);
  }

  /**
   * Get commit activity trend
   */
  @Get('commit-trend')
  @ApiOperation({ summary: 'Get commit activity trend' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days of trend history' })
  @ApiResponse({ status: 200, description: 'Commit trend retrieved successfully.' })
  async getCommitTrend(
    @GetOrganization() organizationId: string,
    @Query('days') days?: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getCommitTrend(organizationId, days ? parseInt(days) : 30, user);
  }

  /**
   * Get top repositories by SQS
   */
  @Get('top-repositories')
  @ApiOperation({ summary: 'Get top repositories by SQS' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of repositories to return' })
  @ApiResponse({ status: 200, description: 'Top repositories list retrieved successfully.' })
  async getTopRepositories(
    @GetOrganization() organizationId: string,
    @Query('limit') limit?: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getTopRepositories(organizationId, limit ? parseInt(limit) : 5, user);
  }

  /**
   * Get bottom repositories (needing attention)
   */
  @Get('bottom-repositories')
  @ApiOperation({ summary: 'Get bottom repositories needing attention' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of repositories to return' })
  @ApiResponse({ status: 200, description: 'Bottom repositories list retrieved successfully.' })
  async getBottomRepositories(
    @GetOrganization() organizationId: string,
    @Query('limit') limit?: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getBottomRepositories(organizationId, limit ? parseInt(limit) : 5, user);
  }

  /**
   * Get top developers by DQS
   */
  @Get('top-developers')
  @ApiOperation({ summary: 'Get top developers by DQS' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of developers to return' })
  @ApiResponse({ status: 200, description: 'Top developers list retrieved successfully.' })
  async getTopDevelopers(
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getTopDevelopers(organizationId, limit ? parseInt(limit) : 5, user);
  }

  /**
   * Get top teams by average DQS
   */
  @Get('top-teams')
  @ApiOperation({ summary: 'Get top teams by average DQS' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of teams to return' })
  @ApiResponse({ status: 200, description: 'Top teams list retrieved successfully.' })
  async getTopTeams(
    @GetOrganization() organizationId: string,
    @Query('limit') limit?: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getTopTeams(organizationId, limit ? parseInt(limit) : 5, user);
  }

  /**
   * Get recent activity
   */
  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent repository activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of activities to return' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number for pagination' })
  @ApiQuery({ name: 'type', required: false, type: String, description: 'Optional activity type filter (commit, alert, debt, release)' })
  @ApiResponse({ status: 200, description: 'Recent activity list retrieved successfully.' })
  async getRecentActivity(
    @GetOrganization() organizationId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('type') type?: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getRecentActivity(
      organizationId,
      limit ? parseInt(limit, 10) : 10,
      type,
      page ? parseInt(page, 10) : 1,
      user,
    );
  }

  /**
   * Get alerts/notifications
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get open organization alerts' })
  @ApiResponse({ status: 200, description: 'Alerts list retrieved successfully.' })
  async getAlerts(
    @GetOrganization() organizationId: string,
    @GetUser() user?: any,
  ) {
    return this.dashboardService.getAlerts(organizationId, user);
  }
}
