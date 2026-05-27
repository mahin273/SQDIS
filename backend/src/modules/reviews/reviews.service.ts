// Reviews Service - Fixed mergedAt null error
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma';
import {
  ReviewFilters,
  ReviewStats,
  ReviewerRanking,
  ReviewDebt,
  PaginatedResult,
  ReviewQualityMetrics,
  ReviewActivityData,
  ReviewAnalytics,
} from './interfaces/review.interfaces';
import {
  Review,
  ReviewComment,
  TurnaroundClass,
  CommentClass,
  MilestoneType,
} from '@prisma/client';
import {
  ParsedReviewData,
  ParsedReviewCommentData,
  ParsedPullRequestData,
} from '../github/dto/webhook-payload.dto';
import { ProcessedReviewResult } from './processors/review.processor';
import { ProcessedReviewCommentResult } from './processors/review-comment.processor';
import { OnboardingService } from '../onboarding/onboarding.service';
import {
  ReviewSubmittedEvent,
  PrMergedEvent,
} from '../onboarding/interfaces/milestone-events.interface';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OnboardingService))
    private readonly onboardingService: OnboardingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Find all reviews with pagination and filters (enhanced with view types)
   */
  async findAll(
    organizationId: string,
    filters: ReviewFilters,
    currentUserId?: string,
  ): Promise<PaginatedResult<Review>> {
    const {
      page = 1,
      limit = 20,
      repositoryId,
      reviewerId,
      prAuthorId,
      state,
      turnaroundClass,
      startDate,
      endDate,
      viewType,
      teamId,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      repository: { organizationId },
    };

    // Apply view type filters
    if (viewType === 'my_reviews' && currentUserId) {
      where.reviewerId = currentUserId;
    } else if (viewType === 'reviews_on_my_prs' && currentUserId) {
      where.prAuthorId = currentUserId;
    } else if (viewType === 'team' && teamId) {
      where.reviewer = {
        teamMemberships: {
          some: { teamId, leftAt: null },
        },
      };
    }

    if (repositoryId) where.repositoryId = repositoryId;
    if (reviewerId && viewType !== 'my_reviews') where.reviewerId = reviewerId;
    if (prAuthorId && viewType !== 'reviews_on_my_prs') where.prAuthorId = prAuthorId;
    if (state) where.state = state;
    if (turnaroundClass) where.turnaroundClass = turnaroundClass;
    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate);
      if (endDate) where.submittedAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { submittedAt: 'desc' },
        include: {
          reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } },
          repository: { select: { id: true, name: true, fullName: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get review quality metrics for an organization
   */
  async getQualityMetrics(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ReviewQualityMetrics> {
    const where: any = {
      review: { repository: { organizationId } },
      deletedAt: null,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const comments = await this.prisma.reviewComment.findMany({
      where,
      select: {
        commentClass: true,
        reviewId: true,
      },
    });

    const reviewWhere: any = {
      repository: { organizationId },
    };
    if (startDate || endDate) {
      reviewWhere.submittedAt = {};
      if (startDate) reviewWhere.submittedAt.gte = new Date(startDate);
      if (endDate) reviewWhere.submittedAt.lte = new Date(endDate);
    }

    const totalReviews = await this.prisma.review.count({ where: reviewWhere });

    const commentClassification = {
      CONSTRUCTIVE: comments.filter((c) => c.commentClass === 'CONSTRUCTIVE').length,
      NITPICK: comments.filter((c) => c.commentClass === 'NITPICK').length,
      NEUTRAL: comments.filter((c) => c.commentClass === 'NEUTRAL').length,
    };

    const totalComments = comments.length;
    const avgCommentsPerReview = totalReviews > 0 ? totalComments / totalReviews : 0;

    // Review depth score: weighted average (constructive=3, neutral=1, nitpick=0.5)
    const reviewDepthScore =
      totalComments > 0
        ? (commentClassification.CONSTRUCTIVE * 3 +
            commentClassification.NEUTRAL * 1 +
            commentClassification.NITPICK * 0.5) /
          totalComments
        : 0;

    return {
      totalComments,
      avgCommentsPerReview: Math.round(avgCommentsPerReview * 10) / 10,
      commentClassification,
      reviewDepthScore: Math.round(reviewDepthScore * 100) / 100,
    };
  }

  /**
   * Get review activity trend over time
   */
  async getActivityTrend(organizationId: string, days = 30): Promise<ReviewActivityData[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const reviews = await this.prisma.review.findMany({
      where: {
        repository: { organizationId },
        submittedAt: { gte: startDate },
      },
      select: {
        submittedAt: true,
        turnaroundMinutes: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    // Group by date
    const activityByDate: Record<string, { count: number; totalTurnaround: number }> = {};

    for (const review of reviews) {
      if (!review.submittedAt) continue;
      const dateKey = review.submittedAt.toISOString().split('T')[0];
      if (!activityByDate[dateKey]) {
        activityByDate[dateKey] = { count: 0, totalTurnaround: 0 };
      }
      activityByDate[dateKey].count++;
      activityByDate[dateKey].totalTurnaround += review.turnaroundMinutes || 0;
    }

    // Fill in missing dates
    const result: ReviewActivityData[] = [];
    const currentDate = new Date(startDate);
    const endDate = new Date();

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const data = activityByDate[dateKey] || { count: 0, totalTurnaround: 0 };
      result.push({
        date: dateKey,
        reviewCount: data.count,
        avgTurnaroundMinutes: data.count > 0 ? Math.round(data.totalTurnaround / data.count) : 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }

  /**
   * Get peak review hours and days
   */
  async getPeakTimes(organizationId: string): Promise<{
    peakHours: { hour: number; count: number }[];
    peakDays: { day: string; count: number }[];
  }> {
    const reviews = await this.prisma.review.findMany({
      where: {
        repository: { organizationId },
      },
      select: {
        submittedAt: true,
      },
    });

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<string, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const review of reviews) {
      if (!review.submittedAt) continue;
      const hour = review.submittedAt.getHours();
      const day = dayNames[review.submittedAt.getDay()];

      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    }

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    const peakDays = dayNames.map((day) => ({
      day,
      count: dayCounts[day] || 0,
    }));

    return { peakHours, peakDays };
  }

  /**
   * Get comprehensive review analytics
   */
  async getAnalytics(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ReviewAnalytics> {
    const [stats, qualityMetrics, activityTrend, peakTimes] = await Promise.all([
      this.getOrganizationStats(organizationId, startDate, endDate),
      this.getQualityMetrics(organizationId, startDate, endDate),
      this.getActivityTrend(organizationId, 30),
      this.getPeakTimes(organizationId),
    ]);

    return {
      stats,
      qualityMetrics,
      activityTrend,
      peakHours: peakTimes.peakHours,
      peakDays: peakTimes.peakDays,
    };
  }

  /**
   * Get organization-wide review statistics
   */
  async getOrganizationStats(
    organizationId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<ReviewStats> {
    const where: any = {
      repository: { organizationId },
    };

    if (startDate || endDate) {
      where.submittedAt = {};
      if (startDate) where.submittedAt.gte = new Date(startDate);
      if (endDate) where.submittedAt.lte = new Date(endDate);
    }

    const reviews = await this.prisma.review.findMany({
      where,
      select: {
        state: true,
        turnaroundMinutes: true,
        turnaroundClass: true,
      },
    });

    const totalReviews = reviews.length;
    const approvedReviews = reviews.filter((r) => r.state === 'APPROVED').length;
    const avgTurnaround =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.turnaroundMinutes || 0), 0) / reviews.length
        : 0;

    const turnaroundDistribution = {
      FAST: reviews.filter((r) => r.turnaroundClass === 'FAST').length,
      NORMAL: reviews.filter((r) => r.turnaroundClass === 'NORMAL').length,
      SLOW: reviews.filter((r) => r.turnaroundClass === 'SLOW').length,
    };

    return {
      totalReviews,
      approvalRate: totalReviews > 0 ? Math.round((approvedReviews / totalReviews) * 100) : 0,
      avgTurnaroundMinutes: Math.round(avgTurnaround),
      turnaroundDistribution,
    };
  }

  /**
   * Get enhanced top reviewers leaderboard with more metrics
   */
  async getEnhancedLeaderboard(organizationId: string, limit = 10): Promise<ReviewerRanking[]> {
    const reviewers = await this.prisma.review.groupBy({
      by: ['reviewerId'],
      where: {
        repository: { organizationId },
        reviewerId: { not: null },
      },
      _count: { id: true },
      _avg: { turnaroundMinutes: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const rankings: ReviewerRanking[] = [];
    for (const reviewer of reviewers) {
      if (!reviewer.reviewerId) continue;

      const [user, approvedCount, comments] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: reviewer.reviewerId },
          select: { id: true, name: true, email: true, avatarUrl: true },
        }),
        this.prisma.review.count({
          where: {
            reviewerId: reviewer.reviewerId,
            repository: { organizationId },
            state: 'APPROVED',
          },
        }),
        this.prisma.reviewComment.count({
          where: {
            authorId: reviewer.reviewerId,
            commentClass: 'CONSTRUCTIVE',
            deletedAt: null,
          },
        }),
      ]);

      if (user) {
        rankings.push({
          reviewer: user,
          reviewCount: reviewer._count.id,
          avgTurnaroundMinutes: Math.round(reviewer._avg.turnaroundMinutes || 0),
          approvalRate:
            reviewer._count.id > 0 ? Math.round((approvedCount / reviewer._count.id) * 100) : 0,
          constructiveComments: comments,
        });
      }
    }

    return rankings;
  }

  /**
   * Export reviews to CSV format
   */
  async exportReviews(
    organizationId: string,
    filters: ReviewFilters,
    currentUserId?: string,
  ): Promise<string> {
    // Get all reviews without pagination for export
    const exportFilters = { ...filters, page: 1, limit: 10000 };
    const result = await this.findAll(organizationId, exportFilters, currentUserId);

    const headers = [
      'ID',
      'PR Title',
      'PR Number',
      'Repository',
      'Reviewer',
      'State',
      'Turnaround (minutes)',
      'Turnaround Class',
      'Submitted At',
      'PR URL',
    ];

    const rows = result.data.map((review: any) => [
      review.id,
      `"${(review.prTitle || '').replace(/"/g, '""')}"`,
      review.prNumber,
      review.repository?.name || '',
      review.reviewer?.name || '',
      review.state,
      review.turnaroundMinutes,
      review.turnaroundClass,
      review.submittedAt,
      review.prUrl || '',
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  /**
   * Get list of repositories with reviews for filtering
   */
  async getRepositoriesWithReviews(
    organizationId: string,
  ): Promise<{ id: string; name: string; fullName: string }[]> {
    const repos = await this.prisma.repository.findMany({
      where: {
        organizationId,
        reviews: { some: {} },
      },
      select: {
        id: true,
        name: true,
        fullName: true,
      },
      orderBy: { name: 'asc' },
    });

    return repos;
  }

  /**
   * Find a review by ID
   */
  async findById(id: string): Promise<Review | null> {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        reviewer: { select: { id: true, name: true, email: true, avatarUrl: true } },
        repository: { select: { id: true, name: true, fullName: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  /**
   * Get pending reviews for a user
   */
  async getPendingReviews(userId: string, organizationId: string): Promise<Review[]> {
    return this.prisma.review.findMany({
      where: {
        reviewerId: userId,
        state: 'PENDING',
        repository: { organizationId },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        repository: { select: { id: true, name: true, fullName: true } },
      },
    });
  }

  /**
   * Get developer review statistics
   */
  async getDeveloperStats(developerId: string, organizationId: string): Promise<ReviewStats> {
    const reviews = await this.prisma.review.findMany({
      where: {
        reviewerId: developerId,
        repository: { organizationId },
      },
      select: {
        state: true,
        turnaroundMinutes: true,
        turnaroundClass: true,
        submittedAt: true,
      },
    });

    const totalReviews = reviews.length;
    const approvedReviews = reviews.filter((r) => r.state === 'APPROVED').length;
    const avgTurnaround =
      reviews.length > 0
        ? reviews.reduce((sum, r) => sum + (r.turnaroundMinutes || 0), 0) / reviews.length
        : 0;

    const turnaroundDistribution = {
      FAST: reviews.filter((r) => r.turnaroundClass === 'FAST').length,
      NORMAL: reviews.filter((r) => r.turnaroundClass === 'NORMAL').length,
      SLOW: reviews.filter((r) => r.turnaroundClass === 'SLOW').length,
    };

    return {
      totalReviews,
      approvalRate: totalReviews > 0 ? (approvedReviews / totalReviews) * 100 : 0,
      avgTurnaroundMinutes: avgTurnaround,
      turnaroundDistribution,
    };
  }

  /**
   * Get top reviewers leaderboard
   */
  async getLeaderboard(organizationId: string, limit = 10): Promise<ReviewerRanking[]> {
    const reviewers = await this.prisma.review.groupBy({
      by: ['reviewerId'],
      where: {
        repository: { organizationId },
        reviewerId: { not: null },
      },
      _count: { id: true },
      _avg: { turnaroundMinutes: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const rankings: ReviewerRanking[] = [];
    for (const reviewer of reviewers) {
      if (!reviewer.reviewerId) continue;

      const user = await this.prisma.user.findUnique({
        where: { id: reviewer.reviewerId },
        select: { id: true, name: true, email: true, avatarUrl: true },
      });

      if (user) {
        rankings.push({
          reviewer: user,
          reviewCount: reviewer._count.id,
          avgTurnaroundMinutes: reviewer._avg.turnaroundMinutes || 0,
        });
      }
    }

    return rankings;
  }

  /**
   * Get team review debt (PRs awaiting review over 24 hours)
   */
  async getTeamDebt(teamId: string): Promise<ReviewDebt> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingReviews = await this.prisma.review.findMany({
      where: {
        state: 'PENDING',
        createdAt: { lt: twentyFourHoursAgo },
        reviewer: {
          teamMemberships: {
            some: { teamId, leftAt: null },
          },
        },
      },
      include: {
        reviewer: { select: { id: true, name: true, avatarUrl: true } },
        repository: { select: { id: true, name: true } },
      },
    });

    const debtByAssignee: Record<string, { reviewer: any; count: number; oldestAge: number }> = {};

    for (const review of pendingReviews) {
      if (!review.reviewerId) continue;

      const ageHours = (Date.now() - review.createdAt.getTime()) / (1000 * 60 * 60);

      if (!debtByAssignee[review.reviewerId]) {
        debtByAssignee[review.reviewerId] = {
          reviewer: review.reviewer,
          count: 0,
          oldestAge: 0,
        };
      }

      debtByAssignee[review.reviewerId].count++;
      debtByAssignee[review.reviewerId].oldestAge = Math.max(
        debtByAssignee[review.reviewerId].oldestAge,
        ageHours,
      );
    }

    return {
      totalPending: pendingReviews.length,
      debtByAssignee: Object.values(debtByAssignee),
    };
  }

  /**
   * Process a review webhook from GitHub
   */
  async processReviewWebhook(payload: {
    action: string;
    review: {
      id: number;
      user: { id: number; login: string };
      state: string;
      submitted_at: string;
      body?: string;
    };
    pull_request: {
      id: number;
      number: number;
      title: string;
      html_url: string;
      created_at: string;
      user: { id: number; login: string };
    };
    repository: { id: number };
  }): Promise<Review | null> {
    const { review, pull_request, repository: repoPayload } = payload;

    // Find the repository
    const repository = await this.prisma.repository.findFirst({
      where: { githubId: repoPayload.id },
    });

    if (!repository) return null;

    // Find reviewer by GitHub ID
    const reviewer = await this.prisma.user.findFirst({
      where: { githubId: String(review.user.id) },
    });

    // Calculate turnaround time
    const prCreatedAt = new Date(pull_request.created_at);
    const reviewSubmittedAt = new Date(review.submitted_at);
    const turnaroundMinutes = Math.round(
      (reviewSubmittedAt.getTime() - prCreatedAt.getTime()) / (1000 * 60),
    );

    // Classify turnaround
    const turnaroundClass = this.classifyTurnaround(turnaroundMinutes);

    // Map GitHub state to our ReviewState enum
    const state = this.mapGitHubState(review.state);

    // Upsert the review
    return this.prisma.review.upsert({
      where: {
        repositoryId_githubReviewId: {
          repositoryId: repository.id,
          githubReviewId: review.id,
        },
      },
      create: {
        repositoryId: repository.id,
        reviewerId: reviewer?.id,
        githubReviewId: review.id,
        githubPrId: pull_request.id,
        prNumber: pull_request.number,
        prTitle: pull_request.title,
        prUrl: pull_request.html_url,
        state,
        body: review.body,
        turnaroundMinutes,
        turnaroundClass,
        submittedAt: reviewSubmittedAt,
      },
      update: {
        state,
        body: review.body,
        turnaroundMinutes,
        turnaroundClass,
        submittedAt: reviewSubmittedAt,
      },
    });
  }

  /**
   * Process a review from the BullMQ queue
   * This method is called by the ReviewProcessor worker
   *
   * @param review - Parsed review data from webhook
   * @param repositoryId - Internal repository ID
   * @returns Processed review result
   */
  async processReviewFromQueue(
    review: ParsedReviewData,
    repositoryId: string,
  ): Promise<ProcessedReviewResult> {
    this.logger.log(`Processing review ${review.reviewId} for PR #${review.pullRequestNumber}`);

    // Find reviewer by GitHub ID
    const reviewer = await this.prisma.user.findFirst({
      where: { githubId: String(review.reviewerId) },
    });

    // Get repository for organizationId
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: { organizationId: true },
    });

    // Calculate turnaround time from PR creation to review submission
    const turnaroundMinutes = this.calculateTurnaroundMinutes(
      review.pullRequestCreatedAt,
      review.submittedAt,
    );

    // Classify turnaround based on requirements
    // FAST: < 4 hours, NORMAL: 4-24 hours, SLOW: > 24 hours
    const turnaroundClass = this.classifyTurnaround(turnaroundMinutes);

    // Map GitHub state to our ReviewState enum
    const state = this.mapGitHubState(review.state);

    // Upsert the review record
    const savedReview = await this.prisma.review.upsert({
      where: {
        repositoryId_githubReviewId: {
          repositoryId,
          githubReviewId: review.reviewId,
        },
      },
      create: {
        repositoryId,
        reviewerId: reviewer?.id,
        githubReviewId: review.reviewId,
        githubPrId: review.pullRequestNumber, // Using PR number as we don't have PR ID in parsed data
        prNumber: review.pullRequestNumber,
        prTitle: review.pullRequestTitle,
        prUrl: `https://github.com/${review.repositoryFullName}/pull/${review.pullRequestNumber}`,
        state,
        body: review.body,
        turnaroundMinutes,
        turnaroundClass,
        submittedAt: review.submittedAt,
      },
      update: {
        state,
        body: review.body,
        turnaroundMinutes,
        turnaroundClass,
        submittedAt: review.submittedAt,
        reviewerId: reviewer?.id,
      },
    });

    this.logger.log(
      `Saved review ${savedReview.id}: state=${state}, turnaround=${turnaroundClass} (${turnaroundMinutes} min)`,
    );

    // Publish review.submitted event for milestone tracking
    if (repository) {
      this.publishReviewSubmittedEvent(
        savedReview.id,
        repositoryId,
        repository.organizationId,
        reviewer?.id,
        review.pullRequestNumber,
        review.pullRequestTitle,
        review.submittedAt,
      );
    }

    // Track FIRST_REVIEW milestone for onboarding developers
    if (reviewer?.id) {
      try {
        await this.onboardingService.recordMilestone(reviewer.id, MilestoneType.FIRST_REVIEW);
      } catch (error) {
        this.logger.warn(
          `Failed to track FIRST_REVIEW milestone for reviewer ${reviewer.id}: ${error}`,
        );
      }
    }

    return {
      reviewId: savedReview.id,
      githubReviewId: review.reviewId,
      state,
      turnaroundMinutes,
      turnaroundClass,
      reviewerId: reviewer?.id || null,
    };
  }

  /**
   * Calculate turnaround time in minutes from PR creation to review submission
   *
   * @param prCreatedAt - PR creation timestamp
   * @param reviewSubmittedAt - Review submission timestamp
   * @returns Turnaround time in minutes
   */
  calculateTurnaroundMinutes(prCreatedAt: Date, reviewSubmittedAt: Date): number {
    const diffMs = reviewSubmittedAt.getTime() - prCreatedAt.getTime();
    return Math.max(0, Math.round(diffMs / (1000 * 60)));
  }

  /**
   * Classify turnaround time based on requirements
   * FAST: < 4 hours (240 minutes)
   * NORMAL: 4-24 hours (240-1440 minutes)
   * SLOW: > 24 hours (> 1440 minutes)
   */
  classifyTurnaround(minutes: number): TurnaroundClass {
    if (minutes < 240) return 'FAST';
    if (minutes <= 1440) return 'NORMAL';
    return 'SLOW';
  }

  /**
   * Map GitHub review state to our ReviewState enum
   */
  private mapGitHubState(
    githubState: string,
  ): 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' {
    const stateMap: Record<
      string,
      'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED'
    > = {
      pending: 'PENDING',
      approved: 'APPROVED',
      changes_requested: 'CHANGES_REQUESTED',
      commented: 'COMMENTED',
      dismissed: 'DISMISSED',
    };
    return stateMap[githubState.toLowerCase()] || 'PENDING';
  }

  /**
   * Process a review comment from the BullMQ queue
   * This method is called by the ReviewCommentProcessor worker
   *
   * @param comment - Parsed review comment data from webhook
   * @param repositoryId - Internal repository ID
   * @returns Processed review comment result
   */
  async processReviewCommentFromQueue(
    comment: ParsedReviewCommentData,
    repositoryId: string,
  ): Promise<ProcessedReviewCommentResult> {
    this.logger.log(
      `Processing review comment ${comment.commentId} for PR #${comment.pullRequestNumber}`,
    );

    // Find author by GitHub ID
    const author = await this.prisma.user.findFirst({
      where: { githubId: String(comment.authorId) },
    });

    // Find the parent review by GitHub review ID
    const review = await this.prisma.review.findFirst({
      where: {
        repositoryId,
        githubReviewId: comment.reviewId,
      },
    });

    // Find parent comment if this is a reply
    let parentComment: ReviewComment | null = null;
    if (comment.parentCommentId) {
      parentComment = await this.prisma.reviewComment.findFirst({
        where: {
          githubCommentId: comment.parentCommentId,
          review: { repositoryId },
        },
      });
    }

    // Classify the comment using ML service
    const commentClass = await this.classifyComment(comment.body);

    // Upsert the review comment record
    const savedComment = await this.prisma.reviewComment.upsert({
      where: {
        reviewId_githubCommentId: {
          reviewId: review?.id || '',
          githubCommentId: comment.commentId,
        },
      },
      create: {
        reviewId: review?.id || '',
        authorId: author?.id,
        parentId: parentComment?.id,
        githubCommentId: comment.commentId,
        body: comment.body,
        filePath: comment.filePath,
        lineNumber: comment.lineNumber,
        diffHunk: comment.diffHunk,
        commentClass,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
      update: {
        body: comment.body,
        filePath: comment.filePath,
        lineNumber: comment.lineNumber,
        diffHunk: comment.diffHunk,
        commentClass,
        authorId: author?.id,
        parentId: parentComment?.id,
        updatedAt: comment.updatedAt,
      },
    });

    this.logger.log(
      `Saved review comment ${savedComment.id}: file=${comment.filePath}, line=${comment.lineNumber}, class=${commentClass}`,
    );

    return {
      commentId: savedComment.id,
      githubCommentId: comment.commentId,
      reviewId: review?.id || null,
      authorId: author?.id || null,
      filePath: comment.filePath,
      lineNumber: comment.lineNumber,
      parentId: parentComment?.id || null,
      commentClass,
      action: 'created',
    };
  }

  /**
   * Soft delete a review comment
   * soft-delete and retain for audit
   *
   * @param githubCommentId - GitHub comment ID
   * @param repositoryId - Internal repository ID
   * @returns Processed review comment result
   */
  async softDeleteReviewComment(
    githubCommentId: number,
    repositoryId: string,
  ): Promise<ProcessedReviewCommentResult> {
    this.logger.log(`Soft-deleting review comment ${githubCommentId}`);

    // Find the comment
    const existingComment = await this.prisma.reviewComment.findFirst({
      where: {
        githubCommentId,
        review: { repositoryId },
      },
      include: {
        review: true,
      },
    });

    if (!existingComment) {
      this.logger.warn(`Review comment ${githubCommentId} not found for soft delete`);
      return {
        commentId: '',
        githubCommentId,
        reviewId: null,
        authorId: null,
        filePath: null,
        lineNumber: null,
        parentId: null,
        commentClass: null,
        action: 'deleted',
      };
    }

    // Soft delete by setting deletedAt timestamp
    const deletedComment = await this.prisma.reviewComment.update({
      where: { id: existingComment.id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Soft-deleted review comment ${deletedComment.id}`);

    return {
      commentId: deletedComment.id,
      githubCommentId,
      reviewId: existingComment.reviewId,
      authorId: existingComment.authorId,
      filePath: existingComment.filePath,
      lineNumber: existingComment.lineNumber,
      parentId: existingComment.parentId,
      commentClass: existingComment.commentClass,
      action: 'deleted',
    };
  }

  /**
   * Classify a review comment using ML service
   *
   * @param body - Comment body text
   * @returns Comment classification (CONSTRUCTIVE, NITPICK, NEUTRAL)
   */
  async classifyComment(body: string): Promise<CommentClass | null> {
    try {
      // Call ML service for comment classification
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const response = await fetch(`${mlServiceUrl}/api/ml/classify/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });

      if (!response.ok) {
        this.logger.warn(`ML service comment classification failed: ${response.status}`);
        return null;
      }

      const result = await response.json();
      return this.mapCommentClassification(result.classification);
    } catch (error) {
      this.logger.warn(`Failed to classify comment: ${error}`);
      return null;
    }
  }

  /**
   * Map ML service classification to CommentClass enum
   */
  private mapCommentClassification(classification: string): CommentClass | null {
    const classMap: Record<string, CommentClass> = {
      constructive: 'CONSTRUCTIVE',
      nitpick: 'NITPICK',
      neutral: 'NEUTRAL',
    };
    return classMap[classification?.toLowerCase()] || null;
  }

  /**
   * Publish review.submitted event for milestone tracking
   */
  private publishReviewSubmittedEvent(
    reviewId: string,
    repositoryId: string,
    organizationId: string,
    reviewerId: string | undefined,
    prNumber: number,
    prTitle: string,
    submittedAt: Date,
  ): void {
    const event: ReviewSubmittedEvent = {
      reviewId,
      repositoryId,
      organizationId,
      reviewerId,
      prNumber,
      prTitle,
      submittedAt,
    };

    this.eventEmitter.emit('review.submitted', event);
    this.logger.debug(`Emitted review.submitted event for review ${reviewId}`);
  }

  /**
   * Publish pr.merged event for milestone tracking
   */
  private publishPrMergedEvent(
    prId: string,
    prNumber: number,
    repositoryId: string,
    organizationId: string,
    authorId: string | undefined,
    mergedAt: Date,
  ): void {
    const event: PrMergedEvent = {
      prId,
      prNumber,
      repositoryId,
      organizationId,
      authorId,
      mergedAt,
    };

    this.eventEmitter.emit('pr.merged', event);
    this.logger.debug(`Emitted pr.merged event for PR #${prNumber}`);
  }

  /**
   * Process a pull request from the BullMQ queue
   * This method is called by the PullRequestProcessor worker
   *
   * @param pullRequest - Parsed pull request data from webhook
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @returns Processed pull request result
   */
  async processPullRequestFromQueue(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    organizationId: string,
  ): Promise<{ prId: number; prNumber: number; authorId: string | null }> {
    this.logger.log(`Processing merged PR ${pullRequest.prId} (#${pullRequest.prNumber})`);

    // Find PR author by GitHub ID
    const author = await this.prisma.user.findFirst({
      where: { githubId: String(pullRequest.authorId) },
    });

    // Publish pr.merged event for milestone tracking
    this.publishPrMergedEvent(
      String(pullRequest.prId),
      pullRequest.prNumber,
      repositoryId,
      organizationId,
      author?.id,
      pullRequest.mergedAt || new Date(),
    );

    this.logger.log(`Published pr.merged event for PR #${pullRequest.prNumber}`);

    return {
      prId: pullRequest.prId,
      prNumber: pullRequest.prNumber,
      authorId: author?.id || null,
    };
  }
}
