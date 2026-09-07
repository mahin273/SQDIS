import { api } from './api';
import type {
  GitHubConnectionStatus,
  ConnectGitHubRequest,
  WebhookLogEntry,
  WebhookHealthMetric,
} from '@/types';

export const githubService = {
  /**
   * Get GitHub connection status
   */
  async getStatus(): Promise<GitHubConnectionStatus> {
    const response = await api.get<GitHubConnectionStatus>('/github/status');
    return response.data;
  },

  /**
   * Get GitHub OAuth 2.0 authorization URL
   */
  async getOAuthAuthorizeUrl(): Promise<{ url: string }> {
    const response = await api.get<{ url: string }>('/github/oauth/authorize');
    return response.data;
  },

  /**
   * Connect GitHub PAT to organization
   */
  async connect(data: ConnectGitHubRequest): Promise<GitHubConnectionStatus> {
    const response = await api.post<GitHubConnectionStatus>('/github/connect', data);
    return response.data;
  },

  /**
   * Disconnect GitHub from organization
   */
  async disconnect(): Promise<void> {
    await api.delete('/github/disconnect');
  },

  /**
   * Validate GitHub PAT without connecting
   */
  async validatePAT(pat: string): Promise<{ valid: boolean; scopes?: string[]; message?: string }> {
    const response = await api.post<{ valid: boolean; scopes?: string[]; message?: string }>('/github/validate', { pat });
    return response.data;
  },

  /**
   * Query webhook delivery logs
   */
  async getWebhookLogs(query?: Record<string, unknown>): Promise<WebhookLogEntry[]> {
    const response = await api.get<WebhookLogEntry[]>('/github/webhooks/logs', { params: query });
    return response.data;
  },

  /**
   * Get webhook health metrics
   */
  async getWebhookHealth(period?: string): Promise<WebhookHealthMetric[]> {
    const response = await api.get<WebhookHealthMetric[]>('/github/webhooks/health', {
      params: { period },
    });
    return response.data;
  },

  /**
   * Update webhooks for all enabled repositories
   */
  async refreshWebhooks(): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/github/webhooks/refresh');
    return response.data;
  },

  /**
   * Backward-compatible alias used by the settings page
   */
  async syncRepositories(): Promise<{ message: string }> {
    return this.refreshWebhooks();
  },

  /**
   * Test webhook connectivity
   */
  async testWebhookConnectivity(repositoryId: string): Promise<{ success: boolean; message: string; repositoryName?: string }> {
    const response = await api.post<{ success: boolean; message: string; repositoryName?: string }>(
      '/github/webhooks/test-connectivity',
      { repositoryId }
    );
    return response.data;
  },

  /**
   * Retry a previously failed webhook delivery
   */
  async retryWebhookDelivery(deliveryId: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(
      `/github/webhooks/retry/${deliveryId}`
    );
    return response.data;
  },

  /**
   * Update the sliding-window webhook rate limit
   */
  async updateWebhookRateLimit(data: {
    maxRequests: number;
    windowMs: number;
  }): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>(
      '/github/webhooks/rate-limit',
      data
    );
    return response.data;
  },

  /**
   * Rotate the webhook secret for a specific repository
   */
  async updateWebhookSecret(
    repoId: string,
    data: { webhookSecret: string }
  ): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>(
      `/github/repositories/${repoId}/webhook-secret`,
      data
    );
    return response.data;
  },

  /**
   * Toggle webhook processing on or off for a specific repository
   */
  async updateWebhookEnabled(
    repoId: string,
    data: { webhookEnabled: boolean }
  ): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>(
      `/github/repositories/${repoId}/webhook-enabled`,
      data
    );
    return response.data;
  },
};

export default githubService;
