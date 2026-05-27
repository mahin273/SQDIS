import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Res,
  Header,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '@prisma/client';
import { ReviewFiltersDto } from './dto/review-filters.dto';

@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * GET /api/reviews - List reviews with pagination and filters
   */
  @Get()
  async findAll(
    @GetUser() user: User & { organizationId: string },
    @Query() filters: ReviewFiltersDto,
  ) {
    return this.reviewsService.findAll(user.organizationId, filters, user.id);
  }

  /**
   * GET /api/reviews/pending - Get pending reviews for current user
   */
  @Get('pending')
  async getPendingReviews(@GetUser() user: User & { organizationId: string }) {
    return this.reviewsService.getPendingReviews(user.id, user.organizationId);
  }

  /**
   * GET /api/reviews/leaderboard - Get top reviewers with enhanced metrics
   */
  @Get('leaderboard')
  async getLeaderboard(
    @GetUser() user: User & { organizationId: string },
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getEnhancedLeaderboard(
      user.organizationId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * GET /api/reviews/analytics - Get comprehensive review analytics
   */
  @Get('analytics')
  async getAnalytics(
    @GetUser() user: User & { organizationId: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reviewsService.getAnalytics(user.organizationId, startDate, endDate);
  }

  /**
   * GET /api/reviews/quality-metrics - Get review quality metrics
   */
  @Get('quality-metrics')
  async getQualityMetrics(
    @GetUser() user: User & { organizationId: string },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.reviewsService.getQualityMetrics(user.organizationId, startDate, endDate);
  }

  /**
   * GET /api/reviews/activity-trend - Get review activity trend
   */
  @Get('activity-trend')
  async getActivityTrend(
    @GetUser() user: User & { organizationId: string },
    @Query('days') days?: string,
  ) {
    return this.reviewsService.getActivityTrend(
      user.organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }

  /**
   * GET /api/reviews/peak-times - Get peak review hours and days
   */
  @Get('peak-times')
  async getPeakTimes(@GetUser() user: User & { organizationId: string }) {
    return this.reviewsService.getPeakTimes(user.organizationId);
  }

  /**
   * GET /api/reviews/repositories - Get repositories with reviews for filtering
   */
  @Get('repositories')
  async getRepositoriesWithReviews(@GetUser() user: User & { organizationId: string }) {
    return this.reviewsService.getRepositoriesWithReviews(user.organizationId);
  }

  /**
   * GET /api/reviews/export - Export reviews to CSV
   */
  @Get('export')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename=reviews.csv')
  async exportReviews(
    @GetUser() user: User & { organizationId: string },
    @Query() filters: ReviewFiltersDto,
    @Res() res: Response,
  ) {
    const csv = await this.reviewsService.exportReviews(user.organizationId, filters, user.id);
    res.send(csv);
  }

  /**
   * GET /api/reviews/debt - Get team review debt
   */
  @Get('debt')
  async getTeamDebt(@Query('teamId') teamId: string) {
    if (!teamId) {
      throw new NotFoundException('Team ID is required');
    }
    return this.reviewsService.getTeamDebt(teamId);
  }

  /**
   * GET /api/reviews/stats/:developerId - Get developer review stats
   */
  @Get('stats/:developerId')
  async getDeveloperStats(
    @GetUser() user: User & { organizationId: string },
    @Param('developerId') developerId: string,
  ) {
    return this.reviewsService.getDeveloperStats(developerId, user.organizationId);
  }

  /**
   * GET /api/reviews/:id - Get review details
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    const review = await this.reviewsService.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }
}
