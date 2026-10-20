import { api } from './api';
import type {
  DqsScore,
  SqsScore,
  ScoreHistoryPoint,
  RiskModule,
  RecalculateRequest,
} from '@/types';

export const scoresService = {
  /**
   * Get current user's DQS score
   */
  async getMyScore(): Promise<DqsScore> {
    const response = await api.get<DqsScore>('/scores/me');
    return response.data;
  },

  /**
   * Get a specific developer DQS score
   */
  async getDQS(developerId: string): Promise<DqsScore> {
    const response = await api.get<DqsScore>(`/scores/dqs/${developerId}`);
    return response.data;
  },

  /**
   * Get DQS score history for a developer
   */
  async getDQSHistory(developerId: string, query?: Record<string, unknown>): Promise<ScoreHistoryPoint[]> {
    const response = await api.get<any>(`/scores/dqs/${developerId}/history`, {
      params: query,
    });
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response.data?.history)) {
      return response.data.history.map((item: any) => ({
        date: item.calculatedAt || item.date || item.createdAt,
        score: item.score,
        modelVersion: item.modelVersion,
      }));
    }
    return [];
  },

  /**
   * Get SHAP explanations for developer DQS score
   */
  async getDQSExplanation(developerId: string): Promise<any> {
    const response = await api.get<any>(`/scores/dqs/${developerId}/explain`);
    const raw = response.data;
    const topFeatures = raw?.explanation?.topFeatures || raw?.topFeatures || [];
    const shapValues: Record<string, number> = {};
    for (const f of topFeatures) {
      if (f.feature) {
        shapValues[f.feature] = typeof f.impact === 'number' ? f.impact : (typeof f.value === 'number' ? f.value : 0);
      }
    }

    let recommendation = raw?.recommendation || '';
    if (!recommendation && topFeatures.length > 0) {
      const negativeFeatures = [...topFeatures]
        .filter((f: any) => (f.impact || 0) < 0)
        .sort((a: any, b: any) => (a.impact || 0) - (b.impact || 0));

      if (negativeFeatures.length > 0) {
        const worst = negativeFeatures[0];
        const readable = worst.feature.replace(/_/g, ' ');
        recommendation = `Targeted Coaching: Improving ${readable} (current impact: ${worst.impact.toFixed(1)} pts) will provide the fastest path to the next DQS performance tier.`;
      } else {
        recommendation = 'Strong engineering cadence and low defect vulnerability across all evaluated features.';
      }
    }

    return {
      ...raw,
      topFeatures,
      shapValues: Object.keys(shapValues).length > 0 ? shapValues : (raw?.shapValues || {}),
      recommendation,
    };
  },

  /**
   * Get project SQS score
   */
  async getSQS(projectId: string): Promise<SqsScore> {
    const response = await api.get<SqsScore>(`/scores/sqs/${projectId}`);
    return response.data;
  },

  /**
   * Get SQS score history for a project
   */
  async getSQSHistory(projectId: string, query?: Record<string, unknown>): Promise<ScoreHistoryPoint[]> {
    const response = await api.get<ScoreHistoryPoint[]>(`/scores/sqs/${projectId}/history`, {
      params: query,
    });
    return response.data;
  },

  /**
   * Get risky modules for a project
   */
  async getRiskyModules(projectId: string): Promise<RiskModule[]> {
    const response = await api.get<any>(`/scores/sqs/${projectId}/risks`);
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response.data?.riskyModules)) {
      return response.data.riskyModules;
    }
    return [];
  },

  /**
   * Trigger score recalculation
   */
  async recalculate(data: RecalculateRequest): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/scores/recalculate', data);
    return response.data;
  },
};

export default scoresService;