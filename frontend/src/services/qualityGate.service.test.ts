import { describe, it, expect, vi, beforeEach } from 'vitest';
import { qualityGateService } from './qualityGate.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('qualityGateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches latest quality gate evaluation for a given PR', async () => {
    const mockResult = {
      id: 'qg-123',
      repositoryId: 'repo-1',
      prNumber: 42,
      status: 'PASSED',
      defectProbability: 0.12,
      riskLevel: 'LOW',
      maxComplexity: 8,
      impactedTestsCount: 2,
      prunedPercentage: 80,
      estimatedTimeSaved: 120,
    };
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockResult });

    const result = await qualityGateService.getLatest('repo-1', 42);

    expect(api.get).toHaveBeenCalledWith('/github/quality-gate/repo-1/pr/42');
    expect(result).toEqual(mockResult);
  });

  it('triggers on-demand quality gate assessment for a pull request', async () => {
    const payload = {
      repositoryId: 'repo-1',
      prNumber: 42,
      headCommitSha: 'abc1234',
    };
    const mockEvaluated = {
      id: 'qg-456',
      repositoryId: 'repo-1',
      prNumber: 42,
      status: 'PASSED',
      defectProbability: 0.106,
      riskLevel: 'LOW',
      maxComplexity: 2,
      impactedTestsCount: 1,
      prunedPercentage: 75,
      estimatedTimeSaved: 180,
    };
    vi.mocked(api.post).mockResolvedValueOnce({ data: mockEvaluated });

    const result = await qualityGateService.evaluate(payload);

    expect(api.post).toHaveBeenCalledWith('/github/quality-gate/evaluate-pr', payload);
    expect(result).toEqual(mockEvaluated);
  });
});
