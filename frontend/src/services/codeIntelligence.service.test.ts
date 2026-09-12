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
});
