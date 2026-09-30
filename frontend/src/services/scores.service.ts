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
    const response = await api.get<ScoreHistoryPoint[]>(`/scores/dqs/${developerId}/history`, {
      params: query,
    });
    return response.data;
  },

  /**
   * Get SHAP explanations for developer DQS score
   */
  async getDQSExplanation(developerId: string): Promise<{ shapValues: Record<string, number>; recommendation: string }> {
    const response = await api.get<any>(
      `/scores/dqs/${developerId}/explain`
    );
    
    const shapValues: Record<string, number> = {};
    if (response.data?.explanation?.topFeatures) {
      response.data.explanation.topFeatures.forEach((f: any) => {
        shapValues[f.feature] = f.impact;
      });
    } else if (response.data?.shapValues) {
      // Fallback if backend gets updated
      Object.assign(shapValues, response.data.shapValues);
    }

    return {
      shapValues,
      recommendation: response.data?.recommendation || "Focus on improving areas with negative impact.",
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