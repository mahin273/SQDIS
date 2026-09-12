import { describe, it, expect, vi, beforeEach } from 'vitest';
import { codeIntelligenceService } from './codeIntelligence.service';
import { api } from './api';

vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('codeIntelligenceService - Automated Remediation Advice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /code-intelligence/remediation/advise and returns refactoring recipes', async () => {
    const mockResponse = {
      totalSmellsFound: 1,
      refactoringPotentialScore: 85,
      recipes: [
        {
          smellType: 'DEEP_NESTING',
          title: 'Deeply Nested Conditionals (Arrow Anti-Pattern)',
          severity: 'WARNING' as const,
          recommendedStrategy: 'Guard Clause Inversion',
          estimatedComplexityReductionPct: 45,
          explanation: 'Nesting depth creates high cognitive load.',
          stepByStep: ['Invert conditional check', 'Return early'],
          beforeSnippet: 'if (valid) { doSomething(); }',
          afterSnippet: 'if (!valid) return;\ndoSomething();',
        },
      ],
    };

    vi.mocked(api.post).mockResolvedValueOnce({ data: mockResponse });

    const result = await codeIntelligenceService.getRemediationAdvice({
      code: 'function test() { if (a) { if (b) { return 1; } } }',
      language: 'typescript',
    });

    expect(api.post).toHaveBeenCalledWith('/code-intelligence/remediation/advise', {
      code: 'function test() { if (a) { if (b) { return 1; } } }',
      language: 'typescript',
    });
    expect(result.totalSmellsFound).toBe(1);
    expect(result.recipes[0].recommendedStrategy).toBe('Guard Clause Inversion');
    expect(result.refactoringPotentialScore).toBe(85);
  });

  it('calls GET /code-intelligence/repositories/:id/treemap and returns architecture treemap', async () => {
    const mockTreemap = {
      repositoryId: 'repo-123',
      totalFiles: 24,
      totalLoc: 8500,
      averageComplexity: 11.2,
      root: {
        name: 'root',
        path: '',
        type: 'directory' as const,
        loc: 8500,
        cyclomaticComplexity: 11.2,
        cognitiveComplexity: 14.5,
        defectProbability: 0.45,
        debtCount: 3,
        churnCount: 42,
        riskLevel: 'HIGH' as const,
        children: [],
      },
      quadrantCounts: {
        dangerZone: 3,
        stableComplex: 4,
        activeSimple: 7,
        healthy: 10,
      },
      quadrantFiles: [],
    };

    vi.mocked(api.get).mockResolvedValueOnce({ data: mockTreemap });

    const result = await codeIntelligenceService.getRepositoryTreemap('repo-123', {
      sizeBy: 'loc',
      colorBy: 'complexity',
    });

    expect(api.get).toHaveBeenCalledWith('/code-intelligence/repositories/repo-123/treemap', {
      params: { sizeBy: 'loc', colorBy: 'complexity' },
    });
    expect(result.repositoryId).toBe('repo-123');
    expect(result.totalFiles).toBe(24);
    expect(result.quadrantCounts.dangerZone).toBe(3);
  });
});

