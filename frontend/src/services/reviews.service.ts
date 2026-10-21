import { api } from './api';
import type {
  Review,
  ReviewFilters,
  ReviewListResponse,
  ReviewLeaderboardEntry,
  ReviewAnalytics,
  ReviewQualityMetrics,
  ReviewActivityTrendPoint,
  PeakReviewTimes,
  ReviewDebt,
  DeveloperReviewStats,
} from '@/types';

export const reviewsService = {
  /**
   * List pull request reviews with pagination and filters
   */
  async getAll(filters?: ReviewFilters): Promise<ReviewListResponse> {
    const response = await api.get<ReviewListResponse>('/reviews', { params: filters });
    return response.data;
  },

  /**
   * Get pending reviews for current user
   */
  async getPendingReviews(): Promise<Review[]> {
    const response = await api.get<Review[]>('/reviews/pending');
    return response.data;
  },

  /**
   * Get top reviewers leaderboard
   */
  async getLeaderboard(limit?: number, repositoryId?: string): Promise<ReviewLeaderboardEntry[]> {
    const response = await api.get<ReviewLeaderboardEntry[]>('/reviews/leaderboard', {
      params: { limit, repositoryId },
    });
    return response.data;
  },

  /**
   * Get comprehensive review analytics
   */
  async getAnalytics(
    startDateOrParams?: string | { startDate?: string; endDate?: string; repositoryId?: string },
    endDate?: string,
    repositoryId?: string
  ): Promise<ReviewAnalytics> {
    let params: { startDate?: string; endDate?: string; repositoryId?: string } = {};
    if (typeof startDateOrParams === 'object' && startDateOrParams !== null) {
      params = startDateOrParams;
    } else {
      params = { startDate: startDateOrParams, endDate, repositoryId };
    }
    const response = await api.get<ReviewAnalytics>('/reviews/analytics', { params });
    return response.data;
  },

  /**
   * Get review quality metrics
   */
  async getQualityMetrics(
    startDateOrParams?: string | { startDate?: string; endDate?: string; repositoryId?: string },
    endDate?: string,
    repositoryId?: string
  ): Promise<ReviewQualityMetrics> {
    let params: { startDate?: string; endDate?: string; repositoryId?: string } = {};
    if (typeof startDateOrParams === 'object' && startDateOrParams !== null) {
      params = startDateOrParams;
    } else {
      params = { startDate: startDateOrParams, endDate, repositoryId };
    }
    const response = await api.get<ReviewQualityMetrics>('/reviews/quality-metrics', { params });
    return response.data;
  },

  /**
   * Get review activity trend over time
   */
  async getActivityTrend(days?: number, repositoryId?: string): Promise<ReviewActivityTrendPoint[]> {
    const response = await api.get<ReviewActivityTrendPoint[]>('/reviews/activity-trend', {
      params: { days, repositoryId },
    });
    return response.data;
  },

  /**
   * Get peak review activity days and hours
   */
  async getPeakTimes(repositoryId?: string): Promise<PeakReviewTimes> {
    const response = await api.get<PeakReviewTimes>('/reviews/peak-times', {
      params: { repositoryId },
    });
    return response.data;
  },

  /**
   * Get repositories containing reviews
   */
  async getRepositoriesWithReviews(): Promise<Array<{ id: string; name: string; fullName: string }>> {
    const response = await api.get<Array<{ id: string; name: string; fullName: string }>>(
      '/reviews/repositories'
    );
    return response.data;
  },

  /**
   * Get team review debt
   */
  async getTeamDebt(teamId: string): Promise<ReviewDebt> {
    const response = await api.get<ReviewDebt>('/reviews/debt', { params: { teamId } });
    return response.data;
  },

  /**
   * Get review statistics for a developer
   */
  async getDeveloperStats(developerId: string): Promise<DeveloperReviewStats> {
    const response = await api.get<DeveloperReviewStats>(`/reviews/stats/${developerId}`);
    return response.data;
  },

  /**
   * Get review details by ID
   */
  async getById(id: string): Promise<Review> {
    const response = await api.get<Review>(`/reviews/${id}`);
    return response.data;
  },

  /**
   * Export reviews list to CSV (binary blob)
   */
  async exportCsv(filters?: Record<string, unknown>): Promise<Blob> {
    const response = await api.get('/reviews/export', {
      params: filters,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default reviewsService;
