// Reviews Service - Fixed mergedAt null error
import { Injectable, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma';
import {
  ReviewFilters,
  ReviewStats,
  ReviewerRanking,
  ReviewDebt,
  ReviewDebtItem,
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
  NotificationType,
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
import { GitHubService } from '../github/github.service';
import { GitHubApiService } from '../github/services/github-api.service';
import { ScoresMlClientService } from '../scores/services/scores-ml-client.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => OnboardingService))
    private readonly onboardingService: OnboardingService,
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject(forwardRef(() => GitHubService))
    private readonly githubService?: GitHubService,
    @Optional()
    @Inject(forwardRef(() => GitHubApiService))
    private readonly gitHubApiService?: GitHubApiService,
    @Optional()
    @Inject(forwardRef(() => ScoresMlClientService))
    private readonly scoresMlClientService?: ScoresMlClientService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
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

    // Enrich with linesAdded and linesDeleted from pull_requests and commits
    const prNumbers = data.map((r) => r.prNumber);
    const repoIds = Array.from(new Set(data.map((r) => r.repositoryId)));

    const prs =
      (await this.prisma.pullRequest?.findMany?.({
        where: {
          repositoryId: { in: repoIds },
          prNumber: { in: prNumbers },
        },
        select: {
          prNumber: true,
          repositoryId: true,
          headCommitSha: true,
        },
      })) ?? [];

    const commitShas = (prs || [])
      .map((p) => p.headCommitSha)
      .filter((sha): sha is string => !!sha);

    const commits =
      commitShas.length > 0 && this.prisma.commit?.findMany
        ? (await this.prisma.commit.findMany({
            where: {
              repositoryId: { in: repoIds },
              sha: { in: commitShas },
            },
            select: {
              sha: true,
              repositoryId: true,
              linesAdded: true,
              linesDeleted: true,
            },
          })) ?? []
        : [];

    const commitMap = new Map<string, { linesAdded: number; linesDeleted: number }>();
    for (const c of commits) {
      commitMap.set(`${c.repositoryId}:${c.sha}`, {
        linesAdded: c.linesAdded,
        linesDeleted: c.linesDeleted,
      });
    }

    const prStatsMap = new Map<string, { linesAdded: number; linesDeleted: number }>();
    for (const p of prs) {
      if (p.headCommitSha) {
        const stats = commitMap.get(`${p.repositoryId}:${p.headCommitSha}`);
        if (stats) {
          prStatsMap.set(`${p.repositoryId}:${p.prNumber}`, stats);
        }
      }
    }

    // For any PRs not matched by headCommitSha, try finding merge commit
    const missingPrs = prNumbers.filter((num) => {
      const r = data.find((d) => d.prNumber === num);
      return r && !prStatsMap.has(`${r.repositoryId}:${num}`);
    });

    if (missingPrs.length > 0 && this.prisma.commit?.findMany) {
      const mergeCommits =
        (await this.prisma.commit.findMany({
          where: {
            repositoryId: { in: repoIds },
            OR: missingPrs.map((num) => ({
              message: { contains: `#${num}` },
            })),
          },
          select: {
            repositoryId: true,
            message: true,
            linesAdded: true,
            linesDeleted: true,
          },
        })) ?? [];

      for (const mc of mergeCommits) {
        for (const num of missingPrs) {
          if (mc.message.includes(`#${num}`)) {
            prStatsMap.set(`${mc.repositoryId}:${num}`, {
              linesAdded: mc.linesAdded,
              linesDeleted: mc.linesDeleted,
            });
            break;
          }
        }
      }
    }

    const mappedData = data.map((r) => {
      const stats = prStatsMap.get(`${r.repositoryId}:${r.prNumber}`);
      return {
        ...r,
        pullRequestId: r.prNumber,
        pullRequestTitle: r.prTitle,
        author: {
          id: r.reviewer?.id,
          name: r.reviewer?.name || 'Mahin Khan',
          email: r.reviewer?.email || 'md.mahin.bd18@gmail.com',
        },
        reviewers: r.reviewer
          ? [
              {
                id: r.reviewer.id,
                name: r.reviewer.name,
                email: r.reviewer.email,
                reviewedAt: r.submittedAt?.toISOString(),
              },
            ]
          : [],
        commentCount: r._count?.comments ?? 0,
        linesAdded: stats?.linesAdded ?? 0,
        linesRemoved: stats?.linesDeleted ?? 0,
      };
    });

    return {
      data: mappedData as any,
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
        count: data.count,
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

    const averageTurnaroundHours = stats.avgTurnaroundMinutes ? stats.avgTurnaroundMinutes / 60 : 0;

    return {
      stats,
      qualityMetrics,
      activityTrend,
      peakHours: peakTimes.peakHours,
      peakDays: peakTimes.peakDays,
      totalReviews: stats.totalReviews,
      averageTurnaroundHours,
      approvalRate: stats.approvalRate,
      reviewsByState: {
        APPROVED: stats.approvalRate,
      },
    } as any;
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
          userId: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          reviewsCompleted: reviewer._count.id,
          reviewCount: reviewer._count.id,
          avgReviewTurnaround: Math.round((reviewer._avg.turnaroundMinutes || 0) / 60 * 10) / 10,
          avgTurnaroundMinutes: Math.round(reviewer._avg.turnaroundMinutes || 0),
          approvalRate:
            reviewer._count.id > 0 ? Math.round((approvedCount / reviewer._count.id) * 100) : 0,
          totalComments: comments,
          constructiveComments: comments,
          score: 100,
        } as any);
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

    const team = this.prisma.team?.findUnique
      ? await this.prisma.team.findUnique({
          where: { id: teamId },
          select: { name: true },
        })
      : null;

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

    const items: ReviewDebtItem[] = pendingReviews.map((r: any) => {
      const ageDays = (Date.now() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24);
      const waitedDays = Math.round(ageDays * 10) / 10;
      return {
        id: r.id,
        pullRequestTitle: r.prTitle || (r.prNumber ? `PR #${r.prNumber}` : 'Pending Pull Request'),
        prNumber: r.prNumber,
        prUrl: r.prUrl || '',
        waitedDays,
        reviewers: r.reviewer?.name ? [r.reviewer.name] : [],
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
      };
    });

    const oldestPendingReviewDays =
      items.length > 0 ? Math.max(...items.map((i) => i.waitedDays)) : 0;

    const avgWaitingDays =
      items.length > 0
        ? Math.round((items.reduce((sum, i) => sum + i.waitedDays, 0) / items.length) * 10) / 10
        : 0;

    const penalty = pendingReviews.length * 5 + oldestPendingReviewDays * 5;
    const calculatedScore = Math.max(0, Math.min(100, Math.round(100 - penalty)));

    return {
      teamId,
      teamName: team?.name,
      items,
      totalPending: pendingReviews.length,
      debtByAssignee: Object.values(debtByAssignee),
      score: calculatedScore,
      pendingReviews: pendingReviews.length,
      oldestPendingReviewDays,
      avgWaitingDays,
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
   * @param action - The PR event action (opened, synchronize, closed, etc.)
   * @returns Processed pull request result
   */
  async processPullRequestFromQueue(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    organizationId: string,
    action?: string,
  ): Promise<{ prId: number; prNumber: number; authorId: string | null }> {
    this.logger.log(`Processing PR ${pullRequest.prId} (#${pullRequest.prNumber}, action: ${action || 'sync'})`);

    // Find PR author by GitHub ID
    const author = await this.prisma.user.findFirst({
      where: { githubId: String(pullRequest.authorId) },
    });

    // 1. If PR is merged, emit pr.merged event for milestone tracking
    if (pullRequest.merged || (action === 'closed' && pullRequest.mergedAt)) {
      this.publishPrMergedEvent(
        String(pullRequest.prId),
        pullRequest.prNumber,
        repositoryId,
        organizationId,
        author?.id,
        pullRequest.mergedAt || new Date(),
      );
      this.logger.log(`Published pr.merged event for PR #${pullRequest.prNumber}`);
    }

    // 2. If PR is opened or synchronized (new commits pushed), trigger automated Quality Gate check
    if (action === 'opened' || action === 'synchronize') {
      await this.evaluateAndPostPRQualityGate(pullRequest, repositoryId, organizationId, author?.id);
    }

    return {
      prId: pullRequest.prId,
      prNumber: pullRequest.prNumber,
      authorId: author?.id || null,
    };
  }

  /**
   * Run automated Quality Gate scan for PR and post summary bot comment
   */
  private async evaluateAndPostPRQualityGate(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    organizationId: string,
    authorUserId?: string,
  ): Promise<void> {
    try {
      if (!this.githubService || !this.gitHubApiService || !this.scoresMlClientService) {
        this.logger.debug('Skipping PR Quality Gate: required GitHub/ML services not available');
        return;
      }

      const repository = await this.prisma.repository.findUnique({
        where: { id: repositoryId },
      });
      if (!repository || !repository.fullName) return;

      const octokit = await this.githubService.getOctokitForOrganization(organizationId);
      if (!octokit) {
        this.logger.warn(`No GitHub connection found for organization ${organizationId}`);
        return;
      }

      const [owner, repoName] = repository.fullName.split('/');
      const codeFiles = await this.gitHubApiService.fetchRepositoryCodeFiles(octokit, owner, repoName, 30);
      if (!codeFiles || codeFiles.length === 0) return;

      const gateResult = await this.scoresMlClientService.evaluateQualityGate({
        files: codeFiles,
        repository_id: repositoryId,
      });

      if (!gateResult) return;

      await this.gitHubApiService.postPullRequestQualitySummary(
        octokit,
        owner,
        repoName,
        pullRequest.prNumber,
        {
          status: gateResult.status,
          totalDebtHours: gateResult.total_debt_hours,
          securityIssuesCount: gateResult.violations.filter((v) => v.rule.includes('security')).length,
          violations: gateResult.violations.map((v) => ({
            rule: v.rule,
            message: v.message,
            severity: v.severity,
          })),
          quickWins: gateResult.passed
            ? ['Clean scan! Maintain current quality standards.']
            : ['Resolve blocking quality gate violations to pass CI checks.'],
        },
      );

      // If Quality Gate failed, send in-app notification to author
      if (gateResult.status === 'FAILED' && this.notificationsService && authorUserId) {
        await this.notificationsService.create({
          userId: authorUserId,
          organizationId,
          type: NotificationType.ALERT,
          title: `Quality Gate Failed for PR #${pullRequest.prNumber}`,
          message: `Your PR #${pullRequest.prNumber} in ${repository.name} has failed quality gate checks with ${gateResult.violations.length} violations.`,
          metadata: {
            prNumber: pullRequest.prNumber,
            repositoryId,
            violations: gateResult.violations,
            debtHours: gateResult.total_debt_hours,
          },
        });
      }
    } catch (error) {
      this.logger.warn(`Error during PR Quality Gate execution: ${error}`);
    }
  }
}
