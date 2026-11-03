import { api } from './api';
import type {
  Sprint,
  CreateSprintRequest,
  UpdateSprintRequest,
  SprintReport,
  SprintCompareResponse,
  VelocityTrend,
  SprintTimelineEntry,
  SprintBurndown,
  SprintHealth,
  SprintContributions,
  SprintGoal,
  CreateSprintGoalRequest,
  SprintRetrospective,
  CreateRetrospectiveRequest,
  SprintCarryOver,
  CreateCarryOverRequest,
} from '@/types';

export const sprintsService = {
  /**
   * Get all sprints for the current organization
   */
  async getAll(teamId?: string): Promise<Sprint[]> {
    const response = await api.get<Sprint[]>('/sprints', { params: { teamId } });
    return response.data;
  },

  /**
   * Get active sprints for the current organization
   */
  async getActive(teamId?: string): Promise<Sprint[]> {
    const response = await api.get<Sprint[]>('/sprints/active', { params: teamId ? { teamId } : undefined });
    return response.data;
  },

  /**
   * Get sprint by ID
   */
  async getById(id: string): Promise<Sprint> {
    const response = await api.get<Sprint>(`/sprints/${id}`);
    return response.data;
  },

  /**
   * Create a new sprint
   */
  async create(data: CreateSprintRequest): Promise<Sprint> {
    const response = await api.post<Sprint>('/sprints', data);
    return response.data;
  },

  /**
   * Update sprint
   */
  async update(id: string, data: UpdateSprintRequest): Promise<Sprint> {
    const response = await api.patch<Sprint>(`/sprints/${id}`, data);
    return response.data;
  },

  /**
   * Delete sprint (soft delete)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/sprints/${id}`);
  },

  /**
   * Get sprint report with quality metrics
   */
  async getReport(id: string): Promise<SprintReport> {
    const response = await api.get<SprintReport>(`/sprints/${id}/report`);
    return response.data;
  },

  /**
   * Compare multiple sprints
   */
  async compareSprints(sprintIds: string[]): Promise<SprintCompareResponse> {
    const response = await api.get<SprintCompareResponse>('/sprints/compare', {
      params: { sprintIds: sprintIds.join(',') },
    });
    return response.data;
  },

  /**
   * Get velocity trend across sprints
   */
  async getVelocityTrend(teamId?: string, limit?: number): Promise<VelocityTrend> {
    const response = await api.get<VelocityTrend>('/sprints/analytics/velocity', {
      params: { teamId, limit },
    });
    return response.data;
  },

  /**
   * Get sprint timeline for Gantt view
   */
  async getSprintTimeline(months?: number): Promise<SprintTimelineEntry[]> {
    const response = await api.get<SprintTimelineEntry[]>('/sprints/analytics/timeline', {
      params: { months },
    });
    return response.data;
  },

  /**
   * Get sprint burndown data
   */
  async getBurndown(id: string): Promise<SprintBurndown> {
    const response = await api.get<SprintBurndown>(`/sprints/${id}/burndown`);
    return response.data;
  },

  /**
   * Get sprint health indicators
   */
  async getSprintHealth(id: string): Promise<SprintHealth> {
    const response = await api.get<SprintHealth>(`/sprints/${id}/health`);
    return response.data;
  },

  /**
   * Get developer contributions for a sprint
   */
  async getDeveloperContributions(id: string): Promise<SprintContributions> {
    const response = await api.get<SprintContributions>(`/sprints/${id}/contributions`);
    return response.data;
  },

  /**
   * Create a sprint goal
   */
  async createGoal(id: string, data: CreateSprintGoalRequest): Promise<SprintGoal> {
    const response = await api.post<SprintGoal>(`/sprints/${id}/goals`, data);
    return response.data;
  },

  /**
   * Get sprint goals
   */
  async getGoals(id: string): Promise<SprintGoal[]> {
    const response = await api.get<SprintGoal[]>(`/sprints/${id}/goals`);
    return response.data;
  },

  /**
   * Delete a sprint goal
   */
  async deleteGoal(goalId: string): Promise<void> {
    await api.delete(`/sprints/goals/${goalId}`);
  },

  /**
   * Create or update sprint retrospective
   */
  async upsertRetrospective(id: string, data: CreateRetrospectiveRequest): Promise<SprintRetrospective> {
    const response = await api.put<SprintRetrospective>(`/sprints/${id}/retrospective`, data);
    return response.data;
  },

  /**
   * Get sprint retrospective
   */
  async getRetrospective(id: string): Promise<SprintRetrospective> {
    const response = await api.get<SprintRetrospective>(`/sprints/${id}/retrospective`);
    return response.data;
  },

  /**
   * Create a carry-over item
   */
  async createCarryOver(id: string, data: CreateCarryOverRequest): Promise<SprintCarryOver> {
    const response = await api.post<SprintCarryOver>(`/sprints/${id}/carry-overs`, data);
    return response.data;
  },

  /**
   * Get carry-overs for a sprint
   */
  async getCarryOvers(id: string): Promise<SprintCarryOver[]> {
    const response = await api.get<SprintCarryOver[]>(`/sprints/${id}/carry-overs`);
    return response.data;
  },

  /**
   * Delete a carry-over item
   */
  async deleteCarryOver(carryOverId: string): Promise<void> {
    await api.delete(`/sprints/carry-overs/${carryOverId}`);
  },

  /**
   * Trigger automatic end-of-sprint report generation for all active sprints
   */
  async autoGenerate(): Promise<{ message: string; count: number }> {
    const response = await api.post<{ message: string; count: number }>(
      '/sprints/auto-generate'
    );
    return response.data;
  },

  /**
   * Download sprint report as PDF (binary blob)
   */
  async exportPdf(id: string): Promise<Blob> {
    const response = await api.get(`/sprints/${id}/export/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download sprint report as CSV (binary blob)
   */
  async exportCsv(id: string): Promise<Blob> {
    const response = await api.get(`/sprints/${id}/export/csv`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default sprintsService;