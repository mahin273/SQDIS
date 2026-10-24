import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Res,
  Header,
  Optional,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { DataFilterService } from '../auth/services/data-filter.service';
import { User } from '@prisma/client';
import { ReviewFiltersDto } from './dto/review-filters.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    @Optional() private readonly dataFilterService?: DataFilterService,
  ) {}

  /**
   * GET /api/reviews - List reviews with pagination and filters
   */
  @Get()
  @ApiOperation({ summary: 'List pull request reviews' })
  @ApiResponse({ status: 200, description: 'List of reviews retrieved.' })
  async findAll(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string; role?: string },
    @Query() filters: ReviewFiltersDto,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) {
      return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
    return this.reviewsService.findAll(organizationId, filters, user.id, user);
  }

  /**
   * GET /api/reviews/pending - Get pending reviews for current user
   */
  @Get('pending')
  @ApiOperation({ summary: 'Get pending reviews for current user' })
  @ApiResponse({ status: 200, description: 'Pending reviews retrieved.' })
  async getPendingReviews(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) return [];
    return this.reviewsService.getPendingReviews(user.id, organizationId);
  }

  /**
   * GET /api/reviews/leaderboard - Get top reviewers with enhanced metrics
   */
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top reviewers leaderboard' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Reviewers leaderboard retrieved.' })
  async getLeaderboard(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
    @Query('limit') limit?: string,
    @Query('repositoryId') repositoryId?: string,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) return [];
    return this.reviewsService.getEnhancedLeaderboard(
      organizationId,
      limit ? parseInt(limit, 10) : 10,
      repositoryId,
    );
  }

  /**
   * GET /api/reviews/analytics - Get comprehensive review analytics
   */
  @Get('analytics')
  @ApiOperation({ summary: 'Get PR review analytics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Review analytics retrieved.' })
  async getAnalytics(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('repositoryId') repositoryId?: string,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) {
      return {
        totalReviews: 0,
        approvedReviews: 0,
        changesRequestedReviews: 0,
        commentedReviews: 0,
        avgTurnaroundHours: 0,
        medianTurnaroundHours: 0,
        p90TurnaroundHours: 0,
        totalReviewComments: 0,
        avgCommentsPerReview: 0,
        thoroughReviewCount: 0,
        fastReviewCount: 0,
      };
    }
    return this.reviewsService.getAnalytics(organizationId, startDate, endDate, repositoryId);
  }

  /**
   * GET /api/reviews/quality-metrics - Get review quality metrics
   */
  @Get('quality-metrics')
  @ApiOperation({ summary: 'Get review quality metrics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Quality metrics retrieved.' })
  async getQualityMetrics(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('repositoryId') repositoryId?: string,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) {
      return {
        qualityScore: 0,
        avgDepthScore: 0,
        constructiveCommentRatio: 0,
        followUpDiscussionRate: 0,
        distribution: { detailed: 0, moderate: 0, brief: 0, rubberStamp: 0 },
      };
    }
    return this.reviewsService.getQualityMetrics(organizationId, startDate, endDate, repositoryId);
  }

  /**
   * GET /api/reviews/activity-trend - Get review activity trend
   */
  @Get('activity-trend')
  @ApiOperation({ summary: 'Get review activity trend over time' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Review activity trend retrieved.' })
  async getActivityTrend(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
    @Query('days') days?: string,
    @Query('repositoryId') repositoryId?: string,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) return [];
    return this.reviewsService.getActivityTrend(
      organizationId,
      days ? parseInt(days, 10) : 30,
      repositoryId,
    );
  }

  /**
   * GET /api/reviews/peak-times - Get peak review hours and days
   */
  @Get('peak-times')
  @ApiOperation({ summary: 'Get peak review activity days and hours' })
  @ApiQuery({ name: 'repositoryId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Peak time metrics retrieved.' })
  async getPeakTimes(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
    @Query('repositoryId') repositoryId?: string,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) return { peakDay: 'Monday', peakHour: 14, heatmap: [] };
    return this.reviewsService.getPeakTimes(organizationId, repositoryId);
  }

  /**
   * GET /api/reviews/repositories - Get repositories with reviews for filtering
   */
  @Get('repositories')
  @ApiOperation({ summary: 'Get repositories containing reviews' })
  @ApiResponse({ status: 200, description: 'List of repositories retrieved.' })
  async getRepositoriesWithReviews(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) return [];
    return this.reviewsService.getRepositoriesWithReviews(organizationId);
  }

  /**
   * GET /api/reviews/export - Export reviews to CSV
   */
  @Get('export')
  @ApiOperation({ summary: 'Export reviews list to CSV file' })
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=reviews.csv')
  @ApiResponse({ status: 200, description: 'CSV file returned.' })
  async exportReviews(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string; role?: string },
    @Query() filters: ReviewFiltersDto,
    @Res() res: Response,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) {
      res.send('');
      return;
    }
    const csv = await this.reviewsService.exportReviews(organizationId, filters, user.id, user);
    res.send(csv);
  }

  /**
   * GET /api/reviews/debt - Get team review debt
   */
  @Get('debt')
  @ApiOperation({ summary: 'Get team review debt' })
  @ApiQuery({ name: 'teamId', required: true })
  @ApiResponse({ status: 200, description: 'Team review debt info retrieved.' })
  async getTeamDebt(
    @Query('teamId') teamId: string,
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string },
  ) {
    if (!teamId) {
      throw new NotFoundException('Team ID is required');
    }
    const organizationId = orgId || user.organizationId;
    if (this.dataFilterService && organizationId) {
      await this.dataFilterService.verifyTeamAccess(teamId, organizationId, user);
    }
    return this.reviewsService.getTeamDebt(teamId);
  }

  /**
   * GET /api/reviews/stats/:developerId - Get developer review stats
   */
  @Get('stats/:developerId')
  @ApiOperation({ summary: 'Get review statistics for a developer' })
  @ApiParam({ name: 'developerId', description: 'Developer User ID' })
  @ApiResponse({ status: 200, description: 'Developer review stats retrieved.' })
  async getDeveloperStats(
    @GetOrganization() orgId: string | undefined,
    @GetUser() user: User & { organizationId?: string; role?: string },
    @Param('developerId') developerId: string,
  ) {
    const organizationId = orgId || user.organizationId;
    if (!organizationId) return null;
    return this.reviewsService.getDeveloperStats(developerId, organizationId, user);
  }

  /**
   * GET /api/reviews/:id - Get review details
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get review details by ID' })
  @ApiParam({ name: 'id', description: 'Review ID' })
  @ApiResponse({ status: 200, description: 'Review details retrieved.' })
  async findById(
    @Param('id') id: string,
    @GetOrganization() organizationId: string,
    @GetUser() user: any,
  ) {
    const review = await this.reviewsService.findById(id, organizationId, user);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }
}
