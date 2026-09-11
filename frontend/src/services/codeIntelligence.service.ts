import { api } from './api';

export interface AstDefectRequest {
  filePath?: string;
  content?: string;
  loc?: number;
  cyclomaticComplexity?: number;
  halsteadVolume?: number;
  halsteadDifficulty?: number;
  halsteadEffort?: number;
}

export interface AstDefectResponse {
  id?: string;
  file_path: string;
  defect_probability: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  is_defect_prone: boolean;
  metrics_analyzed: Record<string, number>;
  top_risk_drivers: string[];
  model_version: string;
  benchmark?: string;
  createdAt?: string;
}

export interface CommitRiskRequest {
  commitSha?: string;
  addedLines: number;
  deletedLines: number;
  modifiedFilesCount: number;
  maxCyclomaticComplexity?: number;
  authorExperienceCommits?: number;
  directoryEntropy?: number;
}

export interface CommitRiskResponse {
  id?: string;
  defect_probability: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH';
  is_defect_prone: boolean;
  top_risk_drivers: string[];
  odds_ratio?: number;
  model_version: string;
  createdAt?: string;
}

export interface TestImpactRequest {
  repositoryRoot?: string;
  changedFiles: string[];
  testFiles?: string[];
  fileContents?: Record<string, string>;
}

export interface TestImpactResponse {
  changed_files: string[];
  impacted_tests: string[];
  skipped_tests: string[];
  total_tests: number;
  time_saved_percentage: number;
  impact_closures: Record<string, string[]>;
}

export interface AuthorOwnership {
  developer_id: string;
  author_name: string;
  contribution_ratio: number;
  commit_share: number;
  churn_share: number;
  is_key_owner: boolean;
}

export interface ModuleBusFactorResult {
  module_name: string;
  bus_factor: number;
  gini_coefficient: number;
  risk_level: 'CRITICAL_SILO' | 'VULNERABLE' | 'RESILIENT' | 'UNKNOWN';
  total_commits: number;
  total_churn: number;
  key_owners: string[];
  author_ownerships: AuthorOwnership[];
  cross_training_recommendation: string;
}

export interface TeamBusFactorResponse {
  snapshotId?: string;
  teamId?: string;
  teamName?: string;
  repository_name: string;
  overall_bus_factor: number;
  average_gini: number;
  total_modules_analyzed: number;
  critical_silos_count: number;
  vulnerable_count: number;
  resilient_count: number;
  module_results: ModuleBusFactorResult[];
  createdAt?: string;
}

export const codeIntelligenceService = {
  async predictAstDefect(payload: AstDefectRequest): Promise<AstDefectResponse> {
    const resp = await api.post<AstDefectResponse>('/code-intelligence/ast-defect', payload);
    return resp.data;
  },

  async predictCommitRisk(payload: CommitRiskRequest): Promise<CommitRiskResponse> {
    const resp = await api.post<CommitRiskResponse>('/code-intelligence/commit-risk', payload);
    return resp.data;
  },

  async analyzeTestImpact(payload: TestImpactRequest): Promise<TestImpactResponse> {
    const resp = await api.post<TestImpactResponse>('/code-intelligence/test-impact', payload);
    return resp.data;
  },

  async getTeamBusFactor(teamId: string): Promise<TeamBusFactorResponse> {
    const resp = await api.get<TeamBusFactorResponse>(`/code-intelligence/teams/${teamId}/bus-factor`);
    return resp.data;
  },

  async getDefectHistory(limit = 20): Promise<AstDefectResponse[]> {
    const resp = await api.get<AstDefectResponse[]>('/code-intelligence/history', {
      params: { limit },
    });
    return resp.data;
  },
};
