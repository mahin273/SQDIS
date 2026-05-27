import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards';
import { GetOrganization } from '../auth/decorators';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get organization-wide statistics
   */
  @Get('stats')
  @ApiOperation({ summary: 'Get organization-wide dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Organization stats retrieved successfully.' })
  async getStats(@GetOrganization() organizationId: string) {
    return this.dashboardService.getOrganizationStats(organizationId);
  }

  /**
   * Get SQS trend over time
   */
  @Get('sqs-trend')
  @ApiOperation({ summary: 'Get SQS trend over time for organization' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days of trend history' })
  @ApiResponse({ status: 200, description: 'SQS trend retrieved successfully.' })
  async getSQSTrend(@GetOrganization() organizationId: string, @Query('days') days?: string) {
    return this.dashboardService.getSQSTrend(organizationId, days ? parseInt(days) : 30);
  }

  /**
   * Get commit activity trend
   */
  @Get('commit-trend')
  @ApiOperation({ summary: 'Get commit activity trend' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days of trend history' })
  @ApiResponse({ status: 200, description: 'Commit trend retrieved successfully.' })
  async getCommitTrend(@GetOrganization() organizationId: string, @Query('days') days?: string) {
    return this.dashboardService.getCommitTrend(organizationId, days ? parseInt(days) : 30);
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
  ) {
    return this.dashboardService.getTopRepositories(organizationId, limit ? parseInt(limit) : 5);
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
  ) {
    return this.dashboardService.getBottomRepositories(organizationId, limit ? parseInt(limit) : 5);
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
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getTopDevelopers(organizationId, limit ? parseInt(limit) : 5);
  }

  /**
   * Get top teams by average DQS
   */
  @Get('top-teams')
  @ApiOperation({ summary: 'Get top teams by average DQS' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of teams to return' })
  @ApiResponse({ status: 200, description: 'Top teams list retrieved successfully.' })
  async getTopTeams(@GetOrganization() organizationId: string, @Query('limit') limit?: string) {
    return this.dashboardService.getTopTeams(organizationId, limit ? parseInt(limit) : 5);
  }

  /**
   * Get recent activity
   */
  @Get('recent-activity')
  @ApiOperation({ summary: 'Get recent repository activity' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Max number of activities to return' })
  @ApiResponse({ status: 200, description: 'Recent activity list retrieved successfully.' })
  async getRecentActivity(
    @GetOrganization() organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboardService.getRecentActivity(organizationId, limit ? parseInt(limit) : 10);
  }

  /**
   * Get alerts/notifications
   */
  @Get('alerts')
  @ApiOperation({ summary: 'Get open organization alerts' })
  @ApiResponse({ status: 200, description: 'Alerts list retrieved successfully.' })
  async getAlerts(@GetOrganization() organizationId: string) {
    return this.dashboardService.getAlerts(organizationId);
  }
}
