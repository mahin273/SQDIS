import { ReviewState, TurnaroundClass, CommentClass } from '@prisma/client';

export interface ReviewFilters {
  page?: number;
  limit?: number;
  repositoryId?: string;
  reviewerId?: string;
  prAuthorId?: string;
  state?: ReviewState;
  turnaroundClass?: TurnaroundClass;
  startDate?: Date | string;
  endDate?: Date | string;
  viewType?: 'all' | 'my_reviews' | 'reviews_on_my_prs' | 'team';
  teamId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReviewStats {
  totalReviews: number;
  approvalRate: number;
  avgTurnaroundMinutes: number;
  turnaroundDistribution: {
    FAST: number;
    NORMAL: number;
    SLOW: number;
  };
}

export interface ReviewQualityMetrics {
  totalComments: number;
  avgCommentsPerReview: number;
  commentClassification: {
    CONSTRUCTIVE: number;
    NITPICK: number;
    NEUTRAL: number;
  };
  reviewDepthScore: number;
}

export interface ReviewActivityData {
  date: string;
  reviewCount: number;
  avgTurnaroundMinutes: number;
}

export interface ReviewerRanking {
  reviewer: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
  reviewCount: number;
  avgTurnaroundMinutes: number;
  approvalRate?: number;
  constructiveComments?: number;
}

export interface ReviewDebt {
  totalPending: number;
  debtByAssignee: {
    reviewer: {
      id: string;
      name: string;
      avatarUrl: string | null;
    };
    count: number;
    oldestAge: number;
  }[];
}

export interface ReviewAnalytics {
  stats: ReviewStats;
  qualityMetrics: ReviewQualityMetrics;
  activityTrend: ReviewActivityData[];
  peakHours: { hour: number; count: number }[];
  peakDays: { day: string; count: number }[];
}
