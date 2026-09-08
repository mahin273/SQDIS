import { api } from './api';
import type {
  AuditLog,
  AuditLogFilters,
  ExportAuditLogsRequest,
  AuditExport,
  RetentionPolicy,
  UpdateRetentionPolicyRequest,
  ActionCountsAnalytics,
  ActiveUsersAnalytics,
  FailedPermissionsAnalytics,
  TimelineAnalytics,
  TopResourcesAnalytics,
  GdprDataAccessResponse,
  GdprAnonymizeResponse,
  ComplianceReport,
} from '@/types';

export const auditService = {
  /**
   * Query audit logs with advanced filtering
   */
  async queryLogs(filters?: AuditLogFilters): Promise<{ data: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const response = await api.get<{ data: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }>('/audit-logs', {
      params: filters,
    });
    return response.data;
  },

  /**
   * Alias for queryLogs - backward compatibility
   */
  async getAll(filters?: AuditLogFilters): Promise<{ data: AuditLog[]; total: number; page: number; pageSize: number; totalPages: number }> {
    return this.queryLogs(filters);
  },

  /**
   * Get a single audit log entry by ID
   */
  async getById(id: string): Promise<AuditLog> {
    const response = await api.get<AuditLog>(`/audit-logs/${id}`);
    return response.data;
  },

  /**
   * Trigger a test audit event to verify real-time websocket monitoring
   */
  async triggerTestEvent(action?: string, severity?: string): Promise<{ success: boolean; message: string; action: string; severity: string }> {
    const response = await api.post('/audit-logs/test-event', { action, severity });
    return response.data;
  },

  /**
   * Export audit logs to CSV or JSON format
   */
  async exportLogs(data: ExportAuditLogsRequest): Promise<AuditExport> {
    const response = await api.post<AuditExport>('/audit-logs/export', data);
    return response.data;
  },

  /**
   * Get export status
   */
  async getExportStatus(id: string): Promise<AuditExport> {
    const response = await api.get<AuditExport>(`/audit-logs/export/${id}`);
    return response.data;
  },

  /**
   * Get retention policy for the organization
   */
  async getRetentionPolicy(): Promise<RetentionPolicy> {
    const response = await api.get<RetentionPolicy>('/audit-logs/retention-policy');
    return response.data;
  },

  /**
   * Update retention policy for the organization
   */
  async updateRetentionPolicy(data: UpdateRetentionPolicyRequest): Promise<RetentionPolicy> {
    const response = await api.put<RetentionPolicy>('/audit-logs/retention-policy', data);
    return response.data;
  },

  /**
   * Get action counts by type for analytics
   */
  async getActionCounts(
    startDate?: string | { startDate?: string; endDate?: string },
    endDate?: string
  ): Promise<ActionCountsAnalytics[]> {
    const params =
      typeof startDate === 'object'
        ? startDate
        : { startDate: startDate as string | undefined, endDate };
    const response = await api.get<ActionCountsAnalytics[]>('/audit-logs/analytics/action-counts', {
      params,
    });
    return response.data;
  },

  /**
   * Get most active users for analytics
   */
  async getActiveUsers(
    startDate?: string | { startDate?: string; endDate?: string; limit?: number },
    endDate?: string,
    limit?: number
  ): Promise<ActiveUsersAnalytics[]> {
    const params =
      typeof startDate === 'object'
        ? startDate
        : { startDate: startDate as string | undefined, endDate, limit };
    const response = await api.get<ActiveUsersAnalytics[]>('/audit-logs/analytics/active-users', {
      params,
    });
    return response.data;
  },

  /**
   * Get failed permission checks for analytics
   */
  async getFailedPermissions(
    startDate?: string | { startDate?: string; endDate?: string },
    endDate?: string
  ): Promise<FailedPermissionsAnalytics[]> {
    const params =
      typeof startDate === 'object'
        ? startDate
        : { startDate: startDate as string | undefined, endDate };
    const response = await api.get<FailedPermissionsAnalytics[]>('/audit-logs/analytics/failed-permissions', {
      params,
    });
    return response.data;
  },

  /**
   * Get action timeline over time
   */
  async getActionTimeline(
    startDate?: string,
    endDate?: string,
    granularity?: 'hour' | 'day' | 'week'
  ): Promise<TimelineAnalytics[]> {
    const response = await api.get<TimelineAnalytics[]>('/audit-logs/analytics/timeline', {
      params: { startDate, endDate, granularity },
    });
    return response.data;
  },

  /**
   * Get most accessed resources for analytics
   */
  async getTopResources(startDate?: string, endDate?: string, limit?: number): Promise<TopResourcesAnalytics[]> {
    const response = await api.get<TopResourcesAnalytics[]>('/audit-logs/analytics/top-resources', {
      params: { startDate, endDate, limit },
    });
    return response.data;
  },

  /**
   * GDPR data access - Get all audit entries for a specific user
   */
  async getGdprDataAccess(userId: string): Promise<GdprDataAccessResponse> {
    const response = await api.get<GdprDataAccessResponse>(`/audit-logs/gdpr/data-access/${userId}`);
    return response.data;
  },

  /**
   * GDPR anonymization - Anonymize all audit entries for a specific user
   */
  async anonymizeGdprData(userId: string): Promise<GdprAnonymizeResponse> {
    const response = await api.post<GdprAnonymizeResponse>(`/audit-logs/gdpr/anonymize/${userId}`);
    return response.data;
  },

  /**
   * Generate compliance report
   */
  async generateComplianceReport(data: {
    reportType: 'SOC2' | 'GDPR' | 'HIPAA';
    startDate?: string;
    endDate?: string;
  }): Promise<ComplianceReport> {
    const response = await api.post<ComplianceReport>('/audit-logs/compliance/report', data);
    return response.data;
  },
};

export default auditService;