import { api } from './api';
import type { Developer, DeveloperStats, LeaderboardEntry, LeaderboardQuery } from '@/types';

export const developersService = {
  /**
   * Get all developers for the organization
   */
  async getAll(): Promise<Developer[]> {
    try {
      const response = await api.get<Developer[]>('/developers');
      if (Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch (e) {
      // Fallback to leaderboard endpoint
    }
    const response = await api.get<any>('/leaderboard', { params: { limit: 100 } });
    const raw = response.data;
    const entries = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && Array.isArray(raw.entries))
      ? raw.entries
      : (raw && typeof raw === 'object' && Array.isArray(raw.data))
      ? raw.data
      : [];

    return entries.map((e: any) => ({
      id: e.developerId || e.id || e.userId || '',
      name: e.developerName || e.name || 'Unknown Developer',
      email: e.developerEmail || e.email || '',
      avatarUrl: e.avatarUrl,
      dqs: e.dqs ?? 0,
      role: e.role || 'DEVELOPER',
      status: e.status || 'ACTIVE',
      lastActive: e.lastActive || e.cachedAt || null,
      commitCount: e.commitCount ?? e.commits ?? 0,
      pullRequestCount: e.pullRequestCount ?? 0,
      codeReviewCount: e.reviewsGiven ?? e.reviews ?? 0,
      ...e,
    }));
  },

  /**
   * Get developer by ID
   */
  async getById(id: string): Promise<Developer> {
    const response = await api.get<Developer>(`/developers/${id}`);
    return response.data;
  },

  /**
   * Get developer stats including DQS, commits, reviews, coverage
   */
  async getStats(id: string): Promise<DeveloperStats> {
    const response = await api.get<DeveloperStats>(`/developers/${id}/stats`);
    return response.data;
  },

  /**
   * Get developer leaderboard
   */
  async getLeaderboard(query?: LeaderboardQuery): Promise<LeaderboardEntry[]> {
    const response = await api.get<any>('/leaderboard', { params: query });
    const raw = response.data;
    const entries = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' && Array.isArray(raw.entries))
      ? raw.entries
      : (raw && typeof raw === 'object' && Array.isArray(raw.data))
      ? raw.data
      : [];

    return entries.map((e: any) => ({
      rank: e.rank ?? 0,
      userId: e.developerId || e.userId || e.id || '',
      name: e.developerName || e.name || 'Unknown Developer',
      avatarUrl: e.avatarUrl,
      dqs: e.dqs ?? 0,
      sqs: e.sqs ?? e.dqs ?? 0,
      commits: e.commitCount ?? e.commits ?? 0,
      reviews: e.reviewsGiven ?? e.reviews ?? 0,
      coverage: e.coverage ?? 0,
      trend: e.dqsTrend ?? e.trend ?? 0,
      ...e,
    }));
  },
};

export default developersService;