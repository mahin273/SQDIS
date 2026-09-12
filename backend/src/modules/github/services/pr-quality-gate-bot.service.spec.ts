import { Test, TestingModule } from '@nestjs/testing';
import { PrQualityGateBotService } from './pr-quality-gate-bot.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { GitHubService } from '../github.service';
import { CodeIntelligenceService } from '../../code-intelligence/code-intelligence.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QualityGateStatus } from '@prisma/client';

describe('PrQualityGateBotService', () => {
  let service: PrQualityGateBotService;
  let mockPrisma: any;
  let mockGitHubService: any;
  let mockCodeIntelligenceService: any;
  let mockEventEmitter: any;

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
    mockEventEmitter = {
      emit: jest.fn(),
    };

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
        findMany: jest.fn().mockResolvedValue([]),
      },
      qualityGatePolicy: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create, update }) => Promise.resolve({ id: 'policy-1', ...create, ...update })),
      },
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'admin-1' }]),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
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
        { provide: EventEmitter2, useValue: mockEventEmitter },
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

  describe('Policy Configuration', () => {
    it('returns default policy when no custom policy is configured', async () => {
      mockPrisma.qualityGatePolicy.findUnique.mockResolvedValueOnce(null);

      const policy = await service.getPolicy('repo-uuid-1');
      expect(policy.isCustom).toBe(false);
      expect(policy.warningDefectProbability).toBe(0.4);
      expect(policy.blockedDefectProbability).toBe(0.65);
      expect(policy.warningComplexity).toBe(15);
      expect(policy.blockedComplexity).toBe(25);
      expect(policy.blockOnSecurity).toBe(true);
    });

    it('returns custom policy when record exists in database', async () => {
      mockPrisma.qualityGatePolicy.findUnique.mockResolvedValueOnce({
        id: 'pol-custom-1',
        repositoryId: 'repo-uuid-1',
        warningDefectProbability: 0.25,
        blockedDefectProbability: 0.50,
        warningComplexity: 10,
        blockedComplexity: 18,
        blockOnSecurity: true,
        enableBotComment: true,
        enableCommitStatus: true,
        strictBranchProtection: true,
      });

      const policy = await service.getPolicy('repo-uuid-1');
      expect(policy.isCustom).toBe(true);
      expect(policy.warningDefectProbability).toBe(0.25);
      expect(policy.blockedDefectProbability).toBe(0.50);
      expect(policy.warningComplexity).toBe(10);
      expect(policy.blockedComplexity).toBe(18);
      expect(policy.strictBranchProtection).toBe(true);
    });

    it('upserts policy thresholds and throws error if warning exceeds blocked', async () => {
      await expect(
        service.upsertPolicy('repo-uuid-1', {
          warningDefectProbability: 0.8,
          blockedDefectProbability: 0.5,
        }),
      ).rejects.toThrow('Warning defect probability cannot exceed blocked defect probability');

      await expect(
        service.upsertPolicy('repo-uuid-1', {
          warningComplexity: 30,
          blockedComplexity: 20,
        }),
      ).rejects.toThrow('Warning complexity threshold cannot exceed blocked complexity threshold');
    });

    it('successfully upserts valid custom policy', async () => {
      mockPrisma.qualityGatePolicy.upsert.mockResolvedValueOnce({
        id: 'pol-custom-saved',
        repositoryId: 'repo-uuid-1',
        warningDefectProbability: 0.3,
        blockedDefectProbability: 0.55,
        warningComplexity: 12,
        blockedComplexity: 20,
        blockOnSecurity: true,
        enableBotComment: false,
        enableCommitStatus: true,
        strictBranchProtection: true,
      });

      const result = await service.upsertPolicy('repo-uuid-1', {
        warningDefectProbability: 0.3,
        blockedDefectProbability: 0.55,
        warningComplexity: 12,
        blockedComplexity: 20,
        enableBotComment: false,
        strictBranchProtection: true,
      });

      expect(mockPrisma.qualityGatePolicy.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { repositoryId: 'repo-uuid-1' },
        }),
      );
      expect(result.warningDefectProbability).toBe(0.3);
      expect(result.blockedDefectProbability).toBe(0.55);
      expect(result.enableBotComment).toBe(false);
    });

    it('evaluates status against custom policy thresholds', async () => {
      // Mock strict policy: defect >= 0.20 is BLOCKED
      mockPrisma.qualityGatePolicy.findUnique.mockResolvedValue({
        id: 'pol-strict',
        repositoryId: 'repo-uuid-1',
        warningDefectProbability: 0.10,
        blockedDefectProbability: 0.20,
        warningComplexity: 8,
        blockedComplexity: 12,
        blockOnSecurity: true,
        enableBotComment: true,
        enableCommitStatus: true,
        strictBranchProtection: true,
      });

      mockCodeIntelligenceService.predictCommitRisk.mockResolvedValueOnce({
        defect_probability: 0.22, // Would be PASSED under default 0.40, but BLOCKED under custom 0.20
        risk_level: 'LOW',
        is_defect_prone: false,
        top_risk_drivers: ['Custom policy test'],
      });

      const result = await service.evaluateAndReport({
        repositoryId: 'repo-uuid-1',
        prNumber: 55,
        filesOverride: [{ path: 'src/core.ts', content: 'export const x = 1;' }],
      });

      expect(result.status).toBe(QualityGateStatus.BLOCKED);
    });
  });

  describe('Realtime Events & Compliance Analytics', () => {
    it('emits pr.quality_gate.evaluated event upon completing evaluation', async () => {
      await service.evaluateAndReport({
        repositoryId: 'repo-uuid-1',
        prNumber: 42,
        filesOverride: [{ path: 'README.md', content: '# Docs' }],
      });

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'pr.quality_gate.evaluated',
        expect.objectContaining({
          repositoryId: 'repo-uuid-1',
          organizationId: 'org-uuid-1',
          prNumber: 42,
          status: QualityGateStatus.PASSED,
        }),
      );
    });

    it('creates in-app notifications for team leads when a PR is BLOCKED', async () => {
      mockCodeIntelligenceService.predictCommitRisk.mockResolvedValueOnce({
        defect_probability: 0.85,
        risk_level: 'CRITICAL',
        is_defect_prone: true,
        top_risk_drivers: ['Critical defect probability'],
      });

      await service.evaluateAndReport({
        repositoryId: 'repo-uuid-1',
        prNumber: 99,
        filesOverride: [{ path: 'src/risky.ts', content: 'export const x = 1;' }],
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'admin-1',
            type: 'ALERT',
            title: 'Quality Gate Blocked: PR #99',
          }),
        }),
      );
    });

    it('returns default 100% compliance rate when repository has no prior evaluations', async () => {
      mockPrisma.pullRequestQualityGate.findMany.mockResolvedValueOnce([]);

      const history = await service.getComplianceHistory('repo-uuid-1', 30);

      expect(history.totalEvaluations).toBe(0);
      expect(history.passedCount).toBe(0);
      expect(history.complianceRate).toBe(100.0);
      expect(history.averageDefectProbability).toBe(0);
      expect(history.evaluations).toEqual([]);
    });

    it('computes compliance history percentages, defect averages, and peak complexity accurately', async () => {
      const now = new Date();
      mockPrisma.pullRequestQualityGate.findMany.mockResolvedValueOnce([
        {
          id: 'gate-1',
          prNumber: 101,
          headCommitSha: 'sha-1',
          status: QualityGateStatus.PASSED,
          defectProbability: 0.12,
          riskLevel: 'LOW',
          maxComplexity: 5,
          createdAt: now,
        },
        {
          id: 'gate-2',
          prNumber: 102,
          headCommitSha: 'sha-2',
          status: QualityGateStatus.PASSED,
          defectProbability: 0.18,
          riskLevel: 'LOW',
          maxComplexity: 8,
          createdAt: now,
        },
        {
          id: 'gate-3',
          prNumber: 103,
          headCommitSha: 'sha-3',
          status: QualityGateStatus.WARNING,
          defectProbability: 0.45,
          riskLevel: 'MODERATE',
          maxComplexity: 16,
          createdAt: now,
        },
        {
          id: 'gate-4',
          prNumber: 104,
          headCommitSha: 'sha-4',
          status: QualityGateStatus.BLOCKED,
          defectProbability: 0.75,
          riskLevel: 'CRITICAL',
          maxComplexity: 28,
          createdAt: now,
        },
      ]);

      const history = await service.getComplianceHistory('repo-uuid-1', 30);

      expect(history.totalEvaluations).toBe(4);
      expect(history.passedCount).toBe(2);
      expect(history.warningCount).toBe(1);
      expect(history.blockedCount).toBe(1);
      // Passed / Total = 2 / 4 = 50.0%
      expect(history.complianceRate).toBe(50.0);
      // Average defect = (0.12 + 0.18 + 0.45 + 0.75) / 4 = 1.50 / 4 = 0.38 (38%)
      expect(history.averageDefectProbability).toBe(0.38);
      expect(history.peakComplexity).toBe(28);
      expect(history.evaluations).toHaveLength(4);
    });
  });
});
