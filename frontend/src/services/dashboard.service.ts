import { api } from './api';
import type {
  DashboardStats,
  SqsTrendPoint,
  CommitTrendPoint,
  TopRepository,
  TopDeveloper,
  TopTeam,
  RecentActivity,
  DashboardAlert,
} from '@/types';

export interface PaginatedRecentActivity {
  data: RecentActivity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts?: Record<string, number>;
}

export const dashboardService = {
  /**
   * Get organization-wide dashboard statistics
   */
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },

  /**
   * Get SQS trend over time
   */
  async getSQSTrend(days?: number): Promise<SqsTrendPoint[]> {
    const response = await api.get<SqsTrendPoint[]>('/dashboard/sqs-trend', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get commit activity trend
   */
  async getCommitTrend(days?: number): Promise<CommitTrendPoint[]> {
    const response = await api.get<CommitTrendPoint[]>('/dashboard/commit-trend', {
      params: { days },
    });
    return response.data;
  },

  /**
   * Get top repositories by SQS
   */
  async getTopRepositories(limit?: number): Promise<TopRepository[]> {
    const response = await api.get<TopRepository[]>('/dashboard/top-repositories', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get bottom repositories needing attention
   */
  async getBottomRepositories(limit?: number): Promise<TopRepository[]> {
    const response = await api.get<TopRepository[]>('/dashboard/bottom-repositories', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get top developers by DQS
   */
  async getTopDevelopers(limit?: number): Promise<TopDeveloper[]> {
    const response = await api.get<TopDeveloper[]>('/dashboard/top-developers', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get top teams by average DQS
   */
  async getTopTeams(limit?: number): Promise<TopTeam[]> {
    const response = await api.get<TopTeam[]>('/dashboard/top-teams', {
      params: { limit },
    });
    return response.data;
  },

  /**
   * Get recent engineering activity with optional pagination and type filter
   */
  async getRecentActivity(
    pageOrLimit?: number | { page?: number; limit?: number; type?: string },
    limitOrType?: number | string,
    typeFilter?: string,
  ): Promise<PaginatedRecentActivity> {
    let page = 1;
    let limit = 10;
    let type: string | undefined;

    if (typeof pageOrLimit === 'object' && pageOrLimit !== null) {
      page = pageOrLimit.page ?? 1;
      limit = pageOrLimit.limit ?? 10;
      type = pageOrLimit.type;
    } else if (typeof pageOrLimit === 'number' && typeof limitOrType === 'string') {
      limit = pageOrLimit;
      type = limitOrType;
    } else if (typeof pageOrLimit === 'number' && typeof limitOrType === 'number') {
      page = pageOrLimit;
      limit = limitOrType;
      type = typeFilter;
    } else if (typeof pageOrLimit === 'number') {
      limit = pageOrLimit;
    }

    const response = await api.get('/dashboard/recent-activity', {
      params: { page, limit, type },
    });

    const raw = response.data;
    if (Array.isArray(raw)) {
      return {
        data: raw,
        total: raw.length,
        page,
        limit,
        totalPages: Math.ceil(raw.length / limit) || 1,
      };
    }

    return {
      data: Array.isArray(raw?.data) ? raw.data : [],
      total: typeof raw?.total === 'number' ? raw.total : (raw?.data?.length || 0),
      page: typeof raw?.page === 'number' ? raw.page : page,
      limit: typeof raw?.limit === 'number' ? raw.limit : limit,
      totalPages:
        typeof raw?.totalPages === 'number'
          ? raw.totalPages
          : Math.ceil((raw?.total || 0) / limit) || 1,
      counts: raw?.counts,
    };
  },

  /**
   * Get open organization alerts
   */
  async getAlerts(): Promise<DashboardAlert[]> {
    const response = await api.get<DashboardAlert[]>('/dashboard/alerts');
    return response.data;
  },
};

export default dashboardService;