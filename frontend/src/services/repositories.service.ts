import { api } from './api';
import type { Repository } from '@/types';

export const repositoriesService = {
  /**
   * Get all repositories for the current organization
   */
  async getAll(): Promise<Repository[]> {
    try {
      const response = await api.get<Repository[]>('/github/repositories');
      return (response.data || []).map((repo: any) => ({
        ...repo,
        isActive: repo.isActive ?? repo.isEnabled ?? false,
      }));
    } catch (err: any) {
      if (err?.response?.status === 404) {
        return [];
      }
      throw err;
    }
  },

  /**
   * Enable repository tracking
   */
  async enable(repo: { id?: string; githubId?: number; name: string; fullName: string; backfill?: boolean }): Promise<Repository> {
    const targetId = repo.id || (repo.githubId ? repo.githubId.toString() : repo.name);
    const response = await api.post<Repository>(`/github/repositories/${targetId}/enable`, {
      githubId: repo.githubId || 0,
      name: repo.name,
      fullName: repo.fullName,
      backfill: repo.backfill ?? true,
    });
    return response.data;
  },

  /**
   * Disable repository tracking
   */
  async disable(repo: { id?: string; githubId?: number; name?: string }): Promise<void> {
    const targetId = repo.id || (repo.githubId ? repo.githubId.toString() : repo.name);
    await api.delete(`/github/repositories/${targetId}/disable`);
  },

  /**
   * Toggle repository tracking (enables or disables repository)
   */
  async toggle(repo: Repository, enabled: boolean): Promise<any> {
    if (enabled) {
      return this.enable({
        id: repo.id,
        githubId: repo.githubId,
        name: repo.name,
        fullName: repo.fullName || repo.name,
        backfill: true,
      });
    } else {
      return this.disable({
        id: repo.id,
        githubId: repo.githubId,
        name: repo.name,
      });
    }
  },

  /**
   * Update repository tracking settings
   */
  async update(id: string, data: { isActive?: boolean; defaultBranch?: string }): Promise<any> {
    if (data.isActive === false) {
      return this.disable({ id });
    }
    return { id, ...data };
  },

  /**
   * Sync a single repository
   */
  async sync(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(`/github/repositories/${id}/backfill`);
    return response.data;
  },

  /**
   * Sync all active repositories
   */
  async syncAll(): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/github/webhooks/refresh');
    return response.data;
  },

  /**
   * Trigger backfill for repository commits
   */
  async triggerBackfill(id: string, days?: number): Promise<{ success: boolean; message: string }> {
    const response = await api.post<{ success: boolean; message: string }>(
      `/github/repositories/${id}/backfill`,
      null,
      { params: { days } }
    );
    return response.data;
  },

  /**
   * Get backfill status for repository
   */
  async getBackfillStatus(id: string): Promise<{
    isRunning: boolean;
    lastRunAt?: string;
    lastStatus?: string;
    commitsProcessed?: number;
  }> {
    const response = await api.get<{
      isRunning: boolean;
      lastRunAt?: string;
      lastStatus?: string;
      commitsProcessed?: number;
    }>(`/github/repositories/${id}/backfill/status`);
    return response.data;
  },
};

export default repositoriesService;