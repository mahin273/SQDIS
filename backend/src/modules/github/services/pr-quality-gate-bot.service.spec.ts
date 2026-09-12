import { Test, TestingModule } from '@nestjs/testing';
import { PrQualityGateBotService } from './pr-quality-gate-bot.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GitHubService } from '../github.service';
import { CodeIntelligenceService } from '../../code-intelligence/code-intelligence.service';
import { QualityGateStatus } from '@prisma/client';

describe('PrQualityGateBotService', () => {
  let service: PrQualityGateBotService;
  let mockPrisma: any;
  let mockGitHubService: any;
  let mockCodeIntelligenceService: any;

  const sampleRepo = {
    id: 'repo-uuid-1',
    organizationId: 'org-uuid-1',
    fullName: 'test-org/test-repo',
  };

  const samplePr = {
    id: 'pr-uuid-1',
    repositoryId: 'repo-uuid-1',
    prNumber: 42,
    headCommitSha: 'sha-abc-123',
  };

  beforeEach(async () => {
    mockPrisma = {
      repository: {
        findUnique: jest.fn().mockResolvedValue(sampleRepo),
      },
      pullRequest: {
        findFirst: jest.fn().mockResolvedValue(samplePr),
        create: jest.fn().mockResolvedValue(samplePr),
      },
      pullRequestQualityGate: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'gate-uuid-1', createdAt: new Date(), ...data })),
        findFirst: jest.fn().mockResolvedValue({ id: 'gate-uuid-1', status: QualityGateStatus.PASSED }),
      },
    };

    mockGitHubService = {
      getOctokitForOrganization: jest.fn().mockRejectedValue(new Error('No PAT configured in test')),
    };

    mockCodeIntelligenceService = {
      analyzeCodeQuality: jest.fn().mockResolvedValue({
        complexity: [
          { path: 'src/app.ts', cyclomatic_complexity: 4, cognitive_complexity: 2 },
        ],
        security: [],
        total_debt_hours: 0,
      }),
      predictCommitRisk: jest.fn().mockResolvedValue({
        defect_probability: 0.15,
        risk_level: 'LOW',
        is_defect_prone: false,
        top_risk_drivers: ['Safe bounded commit'],
      }),
      analyzeTestImpact: jest.fn().mockResolvedValue({
        changed_files: ['src/app.ts'],
        total_tests_in_repo: 10,
        impacted_tests_count: 2,
        impacted_test_files: ['src/app.spec.ts'],
        skipped_test_files: ['src/other.spec.ts'],
        time_savings_percentage: 80.0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrQualityGateBotService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GitHubService, useValue: mockGitHubService },
        { provide: CodeIntelligenceService, useValue: mockCodeIntelligenceService },
      ],
    }).compile();

    service = module.get<PrQualityGateBotService>(PrQualityGateBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('evaluates documentation-only changesets as PASSED immediately without deep AST or ML', async () => {
    const result = await service.evaluateAndReport({
      repositoryId: 'repo-uuid-1',
      prNumber: 42,
      filesOverride: [
        { path: 'README.md', content: '# SQDIS Documentation' },
        { path: 'docs/architecture.md', content: '# Architecture' },
      ],
    });

    expect(result.status).toBe(QualityGateStatus.PASSED);
    expect(result.defectProbability).toBe(0.05);
    expect(result.maxComplexity).toBe(1);
    expect(result.prunedPercentage).toBe(100.0);
    expect(result.summaryMarkdown).toContain('Documentation / Configuration Changeset');
    expect(mockCodeIntelligenceService.analyzeCodeQuality).not.toHaveBeenCalled();
    expect(mockCodeIntelligenceService.predictCommitRisk).not.toHaveBeenCalled();
  });

  it('evaluates clean code changeset as PASSED and triggers AST, commit risk, and TIA', async () => {
    const result = await service.evaluateAndReport({
      repositoryId: 'repo-uuid-1',
      prNumber: 42,
      filesOverride: [
        { path: 'src/app.ts', content: 'export function add(a: number, b: number) { return a + b; }' },
      ],
    });

    expect(result.status).toBe(QualityGateStatus.PASSED);
    expect(result.defectProbability).toBe(0.15);
    expect(result.maxComplexity).toBe(4);
    expect(result.impactedTestsCount).toBe(2);
    expect(result.prunedPercentage).toBe(80.0);
    expect(mockCodeIntelligenceService.analyzeCodeQuality).toHaveBeenCalled();
    expect(mockCodeIntelligenceService.predictCommitRisk).toHaveBeenCalled();
    expect(mockCodeIntelligenceService.analyzeTestImpact).toHaveBeenCalled();
    expect(result.summaryMarkdown).toContain('🟢 **PASSED**');
  });

  it('evaluates high complexity or high defect risk changeset as BLOCKED', async () => {
    mockCodeIntelligenceService.analyzeCodeQuality.mockResolvedValue({
      complexity: [
        { path: 'src/monolith.ts', cyclomatic_complexity: 32, cognitive_complexity: 40 },
      ],
      security: [
        { path: 'src/monolith.ts', severity: 'CRITICAL', message: 'SQL injection potential' },
      ],
      total_debt_hours: 12,
    });
    mockCodeIntelligenceService.predictCommitRisk.mockResolvedValue({
      defect_probability: 0.78,
      risk_level: 'HIGH',
      is_defect_prone: true,
      top_risk_drivers: ['Very high churn and complexity'],
    });

    const result = await service.evaluateAndReport({
      repositoryId: 'repo-uuid-1',
      prNumber: 42,
      filesOverride: [
        { path: 'src/monolith.ts', content: 'function deepNested() {}' },
      ],
    });

    expect(result.status).toBe(QualityGateStatus.BLOCKED);
    expect(result.defectProbability).toBe(0.78);
    expect(result.maxComplexity).toBe(32);
    expect(result.summaryMarkdown).toContain('🔴 **BLOCKED**');
    expect(result.summaryMarkdown).toContain('High Cyclomatic Complexity (32)');
  });

  it('evaluates moderate risk changeset as WARNING', async () => {
    mockCodeIntelligenceService.analyzeCodeQuality.mockResolvedValue({
      complexity: [
        { path: 'src/feature.ts', cyclomatic_complexity: 18, cognitive_complexity: 14 },
      ],
      security: [],
      total_debt_hours: 2,
    });
    mockCodeIntelligenceService.predictCommitRisk.mockResolvedValue({
      defect_probability: 0.45,
      risk_level: 'MODERATE',
      is_defect_prone: false,
      top_risk_drivers: ['Moderate complexity growth'],
    });

    const result = await service.evaluateAndReport({
      repositoryId: 'repo-uuid-1',
      prNumber: 42,
      filesOverride: [
        { path: 'src/feature.ts', content: 'function feature() {}' },
      ],
    });

    expect(result.status).toBe(QualityGateStatus.WARNING);
    expect(result.summaryMarkdown).toContain('🟡 **WARNING**');
    expect(result.githubStatusState).toBe('success');
  });

  it('updates existing comment idempotently when bot marker is present', async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({ data: [] }),
        },
        issues: {
          listComments: jest.fn().mockResolvedValue({
            data: [
              { id: 101, body: 'Hey LGTM!' },
              { id: 102, body: '## 🛡️ SQDIS Quality Gate: 🟢 **PASSED**\n\n<!-- SQDIS-QUALITY-GATE-BOT -->\nOld report' },
            ],
          }),
          updateComment: jest.fn().mockResolvedValue({ data: { id: 102 } }),
          createComment: jest.fn(),
        },
        repos: {
          getContent: jest.fn(),
          createCommitStatus: jest.fn().mockResolvedValue({ data: {} }),
        },
      },
    };

    mockGitHubService.getOctokitForOrganization.mockResolvedValue(mockOctokit);

    const result = await service.evaluateAndReport({
      repositoryId: 'repo-uuid-1',
      prNumber: 42,
      headCommitSha: 'sha-head-999',
      filesOverride: [
        { path: 'README.md', content: '# Docs only' },
      ],
    });

    expect(mockOctokit.rest.issues.updateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        comment_id: 102,
      }),
    );
    expect(mockOctokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(mockOctokit.rest.repos.createCommitStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'sqdis/quality-gate',
        state: 'success',
      }),
    );
    expect(result.githubCommentId).toBe(102);
  });

  it('creates new comment when no previous bot comment exists', async () => {
    const mockOctokit = {
      rest: {
        pulls: {
          listFiles: jest.fn().mockResolvedValue({ data: [] }),
        },
        issues: {
          listComments: jest.fn().mockResolvedValue({
            data: [{ id: 201, body: 'Just a regular developer comment' }],
          }),
          updateComment: jest.fn(),
          createComment: jest.fn().mockResolvedValue({ data: { id: 202 } }),
        },
        repos: {
          getContent: jest.fn(),
          createCommitStatus: jest.fn().mockResolvedValue({ data: {} }),
        },
      },
    };

    mockGitHubService.getOctokitForOrganization.mockResolvedValue(mockOctokit);

    const result = await service.evaluateAndReport({
      repositoryId: 'repo-uuid-1',
      prNumber: 42,
      headCommitSha: 'sha-head-999',
      filesOverride: [
        { path: 'README.md', content: '# Docs only' },
      ],
    });

    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalled();
    expect(mockOctokit.rest.issues.updateComment).not.toHaveBeenCalled();
    expect(result.githubCommentId).toBe(202);
  });

  it('retrieves latest evaluation via getLatestEvaluation', async () => {
    await service.getLatestEvaluation('repo-uuid-1', 42);
    expect(mockPrisma.pullRequestQualityGate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { repositoryId: 'repo-uuid-1', prNumber: 42 },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
