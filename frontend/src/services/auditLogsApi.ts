import { apiClient } from './apiClient';
import type {
  AuditLog,
  AuditLogsResponse,
  QueryAuditLogsRequest,
  ExportAuditLogsRequest,
  Export,
  RetentionPolicy,
  UpdateRetentionPolicyRequest,
  ActionCountsAnalytics,
  ActiveUsersAnalytics,
  FailedPermissionsAnalytics,
  TimelineAnalytics,
  TopResourcesAnalytics,
  GDPRDataAccessResponse,
  ComplianceReportRequest,
  ComplianceReport,
  PaginationParams,
} from '../types/api.types';

/**
 * Audit Logs API Client
 * Handles audit logging, analytics, and compliance features
 */
export const auditLogsApi = {
  /**
   * Get audit logs with pagination and filtering
   */
  getAll: async (params?: QueryAuditLogsRequest & PaginationParams): Promise<AuditLogsResponse> => {
    const response = await apiClient.get<AuditLogsResponse>('/audit-logs', {
      params,
    });
    return response.data;
  },

  /**
   * Get specific audit log by ID
   */
  getById: async (id: string): Promise<AuditLog> => {
    const response = await apiClient.get<AuditLog>(`/audit-logs/${id}`);
    return response.data;
  },

  /**
   * Export audit logs
   */
  export: async (data: ExportAuditLogsRequest): Promise<Export> => {
    const response = await apiClient.post<Export>('/audit-logs/export', data);
    return response.data;
  },

  /**
   * Get export status and download URL
   */
  getExport: async (id: string): Promise<Export> => {
    const response = await apiClient.get<Export>(`/audit-logs/export/${id}`);
    return response.data;
  },

  /**
   * Download exported audit logs
   */
  downloadExport: (id: string): string => {
    return `/audit-logs/export/${id}/download`;
  },

  /**
   * Get retention policy
   */
  getRetentionPolicy: async (): Promise<RetentionPolicy> => {
    const response = await apiClient.get<RetentionPolicy>('/audit-logs/retention-policy');
    return response.data;
  },

  /**
   * Update retention policy
   */
  updateRetentionPolicy: async (data: UpdateRetentionPolicyRequest): Promise<RetentionPolicy> => {
    const response = await apiClient.put<RetentionPolicy>('/audit-logs/retention-policy', data);
    return response.data;
  },

  /**
   * Get action counts analytics
   */
  getActionCounts: async (params?: { startDate?: string; endDate?: string }): Promise<ActionCountsAnalytics[]> => {
    const response = await apiClient.get<ActionCountsAnalytics[]>(
      '/audit-logs/analytics/action-counts',
      {
        params,
      }
    );
    return response.data;
  },

  /**
   * Get active users analytics
   */
  getActiveUsers: async (params?: { startDate?: string; endDate?: string; limit?: number }): Promise<ActiveUsersAnalytics[]> => {
    const response = await apiClient.get<ActiveUsersAnalytics[]>(
      '/audit-logs/analytics/active-users',
      {
        params,
      }
    );
    return response.data;
  },

  /**
   * Get failed permissions analytics
   */
  getFailedPermissions: async (params?: { startDate?: string; endDate?: string }): Promise<FailedPermissionsAnalytics[]> => {
    const response = await apiClient.get<FailedPermissionsAnalytics[]>(
      '/audit-logs/analytics/failed-permissions',
      {
        params,
      }
    );
    return response.data;
  },

  /**
   * Get timeline analytics (events over time)
   */
  getTimeline: async (params?: { startDate?: string; endDate?: string; granularity?: 'hour' | 'day' | 'week' }): Promise<TimelineAnalytics[]> => {
    const response = await apiClient.get<TimelineAnalytics[]>(
      '/audit-logs/analytics/timeline',
      {
        params,
      }
    );
    return response.data;
  },

  /**
   * Get top resources analytics
   */
  getTopResources: async (params?: { startDate?: string; endDate?: string; limit?: number }): Promise<TopResourcesAnalytics[]> => {
    const response = await apiClient.get<TopResourcesAnalytics[]>(
      '/audit-logs/analytics/top-resources',
      {
        params,
      }
    );
    return response.data;
  },

  /**
   * Get GDPR data access for a user
   */
  getGDPRDataAccess: async (userId: string): Promise<GDPRDataAccessResponse> => {
    const response = await apiClient.get<GDPRDataAccessResponse>(
      `/audit-logs/gdpr/data-access/${userId}`
    );
    return response.data;
  },

  /**
   * Anonymize user data (GDPR right to be forgotten)
   */
  anonymizeUserData: async (userId: string): Promise<{ message: string }> => {
    const response = await apiClient.post(`/audit-logs/gdpr/anonymize/${userId}`);
    return response.data;
  },

  /**
   * Generate compliance report
   */
  generateComplianceReport: async (
    data: ComplianceReportRequest
  ): Promise<ComplianceReport> => {
    const response = await apiClient.post<ComplianceReport>(
      '/audit-logs/compliance/report',
      data
    );
    return response.data;
  },
};

export default auditLogsApi;
