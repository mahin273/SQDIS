import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards';
import { GetOrganization } from '../auth/decorators';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get organization-wide statistics
   */
  @Get('stats')
  async getStats(@GetOrganization() organizationId: string) {
    return this.dashboardService.getOrganizationStats(organizationId);
  }

  /**
   * Get SQS trend over time
   */
  @Get('sqs-trend')
  async getSQSTrend(@GetOrganization() organizationId: string, @Query('days') days?: string) {
    return this.dashboardService.getSQSTrend(organizationId, days ? parseInt(days) : 30);
  }

  /**
   * Get commit activity trend
   */
  @Get('commit-trend')
  async getCommitTrend(@GetOrganization() organizationId: string, @Query('days') days?: string) {
    return this.dashboardService.getCommitTrend(organizationId, days ? parseInt(days) : 30);
  }

  /**
   * Get top repositories by SQS
   */
  @Get('top-repositories')
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
  async getTopTeams(@GetOrganization() organizationId: string, @Query('limit') limit?: string) {
    return this.dashboardService.getTopTeams(organizationId, limit ? parseInt(limit) : 5);
  }

  /**
   * Get recent activity
   */
  @Get('recent-activity')
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
  async getAlerts(@GetOrganization() organizationId: string) {
    return this.dashboardService.getAlerts(organizationId);
  }
}
