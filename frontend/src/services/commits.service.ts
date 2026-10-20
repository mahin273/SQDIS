import { api } from './api';
import type { Commit, CommitFilters, CommitStats, HeatmapData } from '@/types';

export interface PaginatedCommitsResponse {
  data: Commit[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const commitsService = {
  /**
   * Get all commits with pagination and filters
   */
  async getAll(filters?: CommitFilters): Promise<Commit[]> {
    const params = filters
      ? { ...filters, limit: filters.limit ?? filters.pageSize ?? 20 }
      : undefined;
    const response = await api.get<any>('/commits', { params });
    const raw = response.data;
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.data)) return raw.data;
      if (Array.isArray(raw.commits)) return raw.commits;
      if (Array.isArray(raw.items)) return raw.items;
    }
    return [];
  },

  /**
   * Get paginated commits with pagination metadata
   */
  async getPaginated(filters?: CommitFilters): Promise<PaginatedCommitsResponse> {
    const params = filters
      ? { ...filters, limit: filters.limit ?? filters.pageSize ?? 20 }
      : undefined;
    const response = await api.get<any>('/commits', { params });
    const raw = response.data;
    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      return {
        data: raw.data,
        meta: raw.meta || {
          total: raw.data.length,
          page: filters?.page || 1,
          limit: filters?.limit || filters?.pageSize || 20,
          totalPages: 1,
        },
      };
    }
    const arr = Array.isArray(raw) ? raw : [];
    return {
      data: arr,
      meta: {
        total: arr.length,
        page: filters?.page || 1,
        limit: filters?.limit || filters?.pageSize || 20,
        totalPages: 1,
      },
    };
  },

  /**
   * Get commit statistics
   */
  async getStats(query?: Record<string, unknown>): Promise<CommitStats> {
    const response = await api.get<CommitStats>('/commits/stats', { params: query });
    return response.data;
  },

  /**
   * Get churn heatmap data for a repository
   */
  async getHeatmap(repositoryId: string): Promise<HeatmapData> {
    const response = await api.get<HeatmapData>('/commits/heatmap', {
      params: { repositoryId },
    });
    return response.data;
  },

  /**
   * Get commit by ID
   */
  async getById(id: string): Promise<Commit> {
    const response = await api.get<Commit>(`/commits/${id}`);
    return response.data;
  },
};

export default commitsService;