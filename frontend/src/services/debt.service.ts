import { api } from './api';
import type {
  DebtItem,
  DebtFilters,
  DebtHotspot,
  DebtTrend,
  DebtRecommendation,
  DebtAttribution,
  ModuleDebtScore,
} from '@/types';

export const debtService = {
  /**
   * Get all debt items with pagination and filters
   */
  async getAll(filters?: DebtFilters): Promise<{ data: DebtItem[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const params = {
      ...filters,
      limit: filters?.limit || filters?.pageSize || 20,
    };
    const response = await api.get<{ data: DebtItem[]; total: number; page: number; pageSize: number; totalPages: number }>('/debt', {
      params,
    });
    return response.data;
  },

  /**
   * Get code hot spots
   */
  async getHotspots(repositoryId?: string): Promise<DebtHotspot[]> {
    const response = await api.get<DebtHotspot[]>('/debt/hotspots', {
      params: { repositoryId },
    });
    return response.data;
  },

  /**
   * Get debt trends over time
   */
  async getTrends(days?: number, repositoryId?: string, teamId?: string): Promise<DebtTrend> {
    const response = await api.get<DebtTrend>('/debt/trends', {
      params: { days, repositoryId, teamId },
    });
    return response.data;
  },

  /**
   * Get prioritized debt recommendations
   */
  async getRecommendations(repositoryId?: string, limit?: number): Promise<DebtRecommendation[]> {
    const response = await api.get<DebtRecommendation[]>('/debt/recommendations', {
      params: { repositoryId, limit },
    });
    return response.data;
  },

  /**
   * Get debt attribution by developer
   */
  async getAttribution(): Promise<DebtAttribution[]> {
    const response = await api.get<DebtAttribution[]>('/debt/attribution');
    return response.data;
  },

  /**
   * Get module-level debt scores
   */
  async getModuleScores(repositoryId?: string, threshold?: number): Promise<ModuleDebtScore[]> {
    const response = await api.get<ModuleDebtScore[]>('/debt/modules', {
      params: { repositoryId, threshold },
    });
    return response.data;
  },

  /**
   * Get a debt item by ID
   */
  async getById(id: string): Promise<DebtItem> {
    const response = await api.get<DebtItem>(`/debt/${id}`);
    return response.data;
  },

  /**
   * Mark a debt item as resolved
   */
  async resolve(id: string): Promise<DebtItem> {
    const response = await api.post<DebtItem>(`/debt/${id}/resolve`);
    return response.data;
  },
};

export default debtService;