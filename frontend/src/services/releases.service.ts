import { api } from './api';
import type {
  Release,
  CreateReleaseRequest,
  UpdateReleaseRequest,
  AssociateSprintRequest,
  ReleaseReadiness,
} from '@/types';

export const releasesService = {
  /**
   * Get all releases for the current organization
   */
  async getAll(): Promise<Release[]> {
    const response = await api.get<Release[]>('/releases');
    return response.data;
  },

  /**
   * Get release by ID with associated sprints
   */
  async getById(id: string): Promise<Release> {
    const response = await api.get<Release>(`/releases/${id}`);
    return response.data;
  },

  /**
   * Create a new release
   */
  async create(data: CreateReleaseRequest): Promise<Release> {
    const response = await api.post<Release>('/releases', data);
    return response.data;
  },

  /**
   * Update release
   */
  async update(id: string, data: UpdateReleaseRequest): Promise<Release> {
    const response = await api.patch<Release>(`/releases/${id}`, data);
    return response.data;
  },

  /**
   * Delete release (soft delete)
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/releases/${id}`);
  },

  /**
   * Associate a sprint with a release
   */
  async associateSprint(id: string, data: AssociateSprintRequest): Promise<Release> {
    const response = await api.post<Release>(`/releases/${id}/sprints`, data);
    return response.data;
  },

  /**
   * Remove sprint association from a release
   */
  async dissociateSprint(id: string, sprintId: string): Promise<void> {
    await api.delete(`/releases/${id}/sprints/${sprintId}`);
  },

  /**
   * Get release readiness score
   */
  async getReadiness(id: string): Promise<ReleaseReadiness> {
    const response = await api.get<ReleaseReadiness>(`/releases/${id}/readiness`);
    return response.data;
  },

  /**
   * Evaluate canary performance regression telemetry
   */
  async evaluateCanaryTelemetry(
    id: string,
    data?: import('@/types').EvaluateTelemetryRequest,
  ): Promise<import('@/types').ReleaseTelemetryAnalysis> {
    const response = await api.post<import('@/types').ReleaseTelemetryAnalysis>(
      `/releases/${id}/telemetry/evaluate`,
      data || {},
    );
    return response.data;
  },

  /**
   * Get canary performance telemetry history
   */
  async getCanaryTelemetry(id: string): Promise<import('@/types').ReleaseTelemetryAnalysis[]> {
    const response = await api.get<import('@/types').ReleaseTelemetryAnalysis[]>(
      `/releases/${id}/telemetry`,
    );
    return response.data;
  },

  /**
   * Dispatch automated rollback and webhook incident response
   */
  async rollbackRelease(
    id: string,
    data?: import('@/types').RollbackReleaseRequest,
  ): Promise<import('@/types').RollbackResponse> {
    const response = await api.post<import('@/types').RollbackResponse>(
      `/releases/${id}/rollback`,
      data || {},
    );
    return response.data;
  },
};


export default releasesService;