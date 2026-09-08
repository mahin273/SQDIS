import { api } from './api';
import type {
  Alert,
  AlertFilters,
  AlertPreference,
  UpdatePreferenceRequest,
  AlertThresholdConfig,
  CreateThresholdConfigRequest,
  UpdateThresholdConfigRequest,
} from '@/types';

export const alertsService = {
  /**
   * Get all alerts with pagination and filters
   */
  async getAll(filters?: AlertFilters): Promise<{ data: Alert[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const response = await api.get<{ data: Alert[]; total: number; page: number; pageSize: number; totalPages: number }>('/alerts', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Get a specific alert by ID
   */
  async getById(id: string): Promise<Alert> {
    const response = await api.get<Alert>(`/alerts/${id}`);
    return response.data;
  },

  /**
   * Acknowledge an alert
   */
  async acknowledge(id: string): Promise<Alert> {
    const response = await api.post<Alert>(`/alerts/${id}/acknowledge`);
    return response.data;
  },

  /**
   * Resolve an alert with resolution notes
   */
  async resolve(id: string, resolutionNotes: string = 'Resolved via alert management console'): Promise<Alert> {
    const response = await api.post<Alert>(`/alerts/${id}/resolve`, {
      resolutionNotes: resolutionNotes || 'Resolved via alert management console',
    });
    return response.data;
  },

  /**
   * Get notification preferences for current user
   */
  async getPreferences(): Promise<AlertPreference> {
    const response = await api.get<AlertPreference>('/alerts/preferences');
    return response.data;
  },

  /**
   * Update notification preferences for current user
   */
  async updatePreferences(data: UpdatePreferenceRequest): Promise<AlertPreference> {
    const response = await api.patch<AlertPreference>('/alerts/preferences', data);
    return response.data;
  },

  /**
   * Get all threshold configurations for the organization
   */
  async getThresholdConfigs(): Promise<AlertThresholdConfig[]> {
    const response = await api.get<AlertThresholdConfig[]>('/alerts/thresholds');
    return response.data;
  },

  /**
   * Get threshold configuration for a specific alert type
   */
  async getThresholdConfig(alertType: string): Promise<AlertThresholdConfig> {
    const response = await api.get<AlertThresholdConfig>(`/alerts/thresholds/${alertType}`);
    return response.data;
  },

  /**
   * Create or update threshold configuration
   */
  async upsertThresholdConfig(data: CreateThresholdConfigRequest): Promise<AlertThresholdConfig> {
    const response = await api.post<AlertThresholdConfig>('/alerts/thresholds', data);
    return response.data;
  },

  /**
   * Update threshold configuration for a specific alert type
   */
  async updateThresholdConfig(
    alertType: string,
    data: UpdateThresholdConfigRequest
  ): Promise<AlertThresholdConfig> {
    const response = await api.patch<AlertThresholdConfig>(`/alerts/thresholds/${alertType}`, data);
    return response.data;
  },

  /**
   * Reset all threshold configurations to defaults
   */
  async resetAllThresholdConfigs(): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>('/alerts/thresholds');
    return response.data;
  },

  /**
   * Reset threshold configuration for a specific alert type
   */
  async resetThresholdConfig(alertType: string): Promise<{ message: string }> {
    const response = await api.delete<{ message: string }>(`/alerts/thresholds/${alertType}`);
    return response.data;
  },
};

export default alertsService;