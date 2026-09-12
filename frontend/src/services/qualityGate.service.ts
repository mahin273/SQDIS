import { api } from './api';

export type QualityGateStatus = 'PASSED' | 'WARNING' | 'BLOCKED';

export interface QualityGateResult {
  id: string;
  pullRequestId: string;
  repositoryId: string;
  prNumber: number;
  headCommitSha: string;
  status: QualityGateStatus;
  defectProbability: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | string;
  maxComplexity: number;
  impactedTestsCount: number;
  prunedPercentage: number;
  estimatedTimeSaved: number;
  summaryMarkdown: string;
  githubCommentId: number | null;
  githubStatusState: string | null;
  createdAt: string;
  pullRequest?: {
    title: string;
    state: string;
    authorLogin: string;
    headBranch: string;
    baseBranch: string;
  };
}

export interface EvaluateQualityGatePayload {
  repositoryId: string;
  prNumber: number;
  headCommitSha?: string;
  files?: string[];
}

export const qualityGateService = {
  /**
   * Retrieve the latest Quality Gate evaluation for a given PR.
   */
  async getLatest(repositoryId: string, prNumber: number): Promise<QualityGateResult | null> {
    const response = await api.get<QualityGateResult | null>(
      `/github/quality-gate/${repositoryId}/pr/${prNumber}`
    );
    return response.data;
  },

  /**
   * Trigger an on-demand Quality Gate evaluation for a pull request.
   */
  async evaluate(payload: EvaluateQualityGatePayload): Promise<QualityGateResult> {
    const response = await api.post<QualityGateResult>(
      '/github/quality-gate/evaluate-pr',
      payload
    );
    return response.data;
  },
};
