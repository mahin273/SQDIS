import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CodeIntelligenceService } from './code-intelligence.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DataFilterService } from '../auth/services/data-filter.service';
import { createMockPrismaService, MockPrismaService } from '../../../test/mocks/prisma.mock';

describe('CodeIntelligenceService', () => {
  let service: CodeIntelligenceService;
  let prisma: MockPrismaService;
  let mockDataFilterService: {
    getScopedProjectAndRepoIds: jest.Mock;
    verifyRepositoryAccess: jest.Mock;
    verifyTeamAccess: jest.Mock;
  };

  beforeEach(async () => {
    const mockPrisma = createMockPrismaService();
    mockDataFilterService = {
      getScopedProjectAndRepoIds: jest.fn().mockResolvedValue({
        isOrgScoped: true,
        effectiveRole: 'OWNER',
        projectIds: [],
        repositoryIds: [],
        teamIds: [],
      }),
      verifyRepositoryAccess: jest.fn().mockImplementation(async (repoId, orgId) => ({
        repositoryId: repoId,
        organizationId: orgId,
      })),
      verifyTeamAccess: jest.fn().mockImplementation(async (teamId, orgId) => ({
        teamId,
        organizationId: orgId,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeIntelligenceService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: any) => {
              if (key === 'ML_SERVICE_URL') return 'http://localhost:8000';
              return defaultVal;
            }),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: DataFilterService,
          useValue: mockDataFilterService,
        },
      ],
    }).compile();

    service = module.get<CodeIntelligenceService>(CodeIntelligenceService);
    prisma = module.get<PrismaService>(PrismaService) as unknown as MockPrismaService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRepositoryTreemap', () => {
    it('should build hierarchical treemap and calculate LOC-weighted complexity from database records', async () => {
      const mockMetrics = [
        {
          id: 'm-1',
          repositoryId: 'repo-1',
          filePath: 'src/modules/auth/auth.service.ts',
          cyclomaticComplexity: 20,
          cognitiveComplexity: 25,
          maintainabilityIndex: 65,
          updatedAt: new Date(),
        },
        {
          id: 'm-2',
          repositoryId: 'repo-1',
          filePath: 'src/modules/auth/auth.controller.ts',
          cyclomaticComplexity: 5,
          cognitiveComplexity: 6,
          maintainabilityIndex: 85,
          updatedAt: new Date(),
        },
        {
          id: 'm-3',
          repositoryId: 'repo-1',
          filePath: 'src/modules/commits/commits.service.ts',
          cyclomaticComplexity: 16,
          cognitiveComplexity: 22,
          maintainabilityIndex: 70,
          updatedAt: new Date(),
        },
        {
          id: 'm-4',
          repositoryId: 'repo-1',
          filePath: 'src/utils/logger.ts',
          cyclomaticComplexity: 3,
          cognitiveComplexity: 3,
          maintainabilityIndex: 90,
          updatedAt: new Date(),
        },
      ];

      (prisma.fileASTMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);
      (prisma.fileASTMetric.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 865 },
        _avg: { cyclomaticComplexity: 8.76 },
      });
      (prisma.fileASTMetric.count as jest.Mock).mockResolvedValue(194);
      (prisma.commit.aggregate as jest.Mock).mockResolvedValue({
        _sum: { linesAdded: 415030, linesDeleted: 46888 },
      });
      (prisma.fileChange.findMany as jest.Mock).mockResolvedValue([
        { filePath: 'src/modules/auth/auth.service.ts', additions: 150, deletions: 20 },
      ]);
      (prisma.debtItem.findMany as jest.Mock).mockResolvedValue([
        { filePath: 'src/modules/auth/auth.service.ts' },
        { filePath: 'src/modules/auth/auth.service.ts' },
      ]);
      (prisma.defectPrediction.findMany as jest.Mock).mockResolvedValue([
        {
          filePath: 'src/modules/auth/auth.service.ts',
          defectProbability: 0.78,
          riskLevel: 'CRITICAL',
        },
      ]);

      const result = await service.getRepositoryTreemap('repo-1');

      expect(result).toBeDefined();
      expect(result.repositoryId).toBe('repo-1');
      expect(result.totalFiles).toBe(4);
      expect(result.visualizedFiles).toBe(4);
      expect(result.repoStats).toBeDefined();
      expect(result.repoStats!.totalFiles).toBe(865);
      expect(result.repoStats!.averageComplexity).toBe(8.8);
      expect(result.repoStats!.totalHotspots).toBe(194);
      expect(result.totalLoc).toBeGreaterThan(0);
      expect(result.root.type).toBe('directory');
      expect(result.root.children).toBeDefined();
      expect(result.root.children!.length).toBeGreaterThan(0);

      // Verify auth.service.ts has debt count 2
      const authService = result.quadrantFiles.find(
        (f) => f.filePath === 'src/modules/auth/auth.service.ts',
      );
      expect(authService).toBeDefined();
      expect(authService!.debtCount).toBe(2);
      expect(authService!.defectProbability).toBe(0.78);

      // Verify quadrants summary exists
      expect(result.quadrantCounts).toHaveProperty('dangerZone');
      expect(result.quadrantCounts).toHaveProperty('stableComplex');
      expect(result.quadrantCounts).toHaveProperty('activeSimple');
      expect(result.quadrantCounts).toHaveProperty('healthy');
    });

    it('should return clean empty state without synthetic mock files when repository has no files', async () => {
      (prisma.fileASTMetric.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debtItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.defectPrediction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.fileASTMetric.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 0 },
        _avg: { cyclomaticComplexity: 0 },
      });
      (prisma.fileASTMetric.count as jest.Mock).mockResolvedValue(0);
      (prisma.commit.aggregate as jest.Mock).mockResolvedValue({
        _sum: { linesAdded: 0, linesDeleted: 0 },
      });

      const result = await service.getRepositoryTreemap('empty-repo');

      expect(result).toBeDefined();
      expect(result.repositoryId).toBe('empty-repo');
      expect(result.totalFiles).toBe(0);
      expect(result.totalLoc).toBe(0);
      expect(result.averageComplexity).toBe(0);
      expect(result.root.type).toBe('directory');
      expect(result.root.children).toEqual([]);
      expect(result.quadrantFiles).toEqual([]);
      expect(result.quadrantCounts.dangerZone).toBe(0);
      expect(result.isPartialData).toBe(false);
    });

    it('should preserve authentic partial analysis state when repository has fewer than 3 files without injecting fake files', async () => {
      const mockMetrics = [
        {
          id: 'm-1',
          repositoryId: 'repo-sparse',
          filePath: 'src/main.ts',
          cyclomaticComplexity: 4,
          cognitiveComplexity: 5,
          maintainabilityIndex: 88,
          updatedAt: new Date(),
        },
      ];

      (prisma.fileASTMetric.findMany as jest.Mock).mockResolvedValue(mockMetrics);
      (prisma.debtItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.defectPrediction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.fileASTMetric.aggregate as jest.Mock).mockResolvedValue({
        _count: { id: 1 },
        _avg: { cyclomaticComplexity: 4.0 },
      });
      (prisma.fileASTMetric.count as jest.Mock).mockResolvedValue(0);
      (prisma.commit.aggregate as jest.Mock).mockResolvedValue({
        _sum: { linesAdded: 50, linesDeleted: 5 },
      });
      (prisma.fileChange.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getRepositoryTreemap('repo-sparse');

      expect(result.totalFiles).toBe(1);
      expect(result.isPartialData).toBe(true);
      expect(result.root.children).toHaveLength(1);
      expect(result.quadrantFiles).toHaveLength(1);
      expect(result.quadrantFiles[0].filePath).toBe('src/main.ts');
    });
  });

  describe('analyzeTestImpact', () => {
    it('should execute TIA without injecting synthetic E2E tests or 75% fallback defaults', async () => {
      (prisma.fileASTMetric.findMany as jest.Mock).mockResolvedValue([
        { filePath: 'src/modules/auth/auth.service.ts' },
      ]);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          impacted_test_files: ['src/modules/auth/auth.service.spec.ts'],
          impacted_tests_count: 1,
          time_savings_percentage: 50,
          total_tests_in_repo: 2,
        }),
      });
      global.fetch = mockFetch;

      const result = await service.analyzeTestImpact({
        repositoryId: 'repo-1',
        changedFiles: ['src/modules/auth/auth.service.ts'],
      });

      expect(mockFetch).toHaveBeenCalled();
      const calledPayload = JSON.parse(mockFetch.mock.calls[0][1].body);

      // Verify no fake test/e2e.spec.ts injected
      expect(calledPayload.files.some((f: any) => f.path === 'test/e2e.spec.ts')).toBe(false);
      expect(calledPayload.files.some((f: any) => f.path === 'test/sanity.spec.ts')).toBe(false);

      expect(result.prunedPercentage).toBe(50);
      expect(result.totalTests).toBe(2);
      expect(result.impactedTestsCount).toBe(1);
      expect(result.estimatedTimeSavedSeconds).toBe(90);
    });

    it('should return 0 time savings and 0 total tests when ML service returns zero or unmeasured values', async () => {
      (prisma.fileASTMetric.findMany as jest.Mock).mockResolvedValue([]);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          impacted_test_files: [],
          impacted_tests_count: 0,
        }),
      });
      global.fetch = mockFetch;

      const result = await service.analyzeTestImpact({
        changedFiles: ['src/unknown.ts'],
      });

      expect(result.prunedPercentage).toBe(0);
      expect(result.totalTests).toBe(0);
      expect(result.impactedTestsCount).toBe(0);
      expect(result.estimatedTimeSavedSeconds).toBe(0);
    });
  });

  describe('getRepositoryStats', () => {
    it('should aggregate accurate database counts across files, hotspots, and JIT commits', async () => {
      (prisma.fileASTMetric.count as jest.Mock)
        .mockResolvedValueOnce(865) // total files
        .mockResolvedValueOnce(101) // critical
        .mockResolvedValueOnce(93)  // high
        .mockResolvedValueOnce(671); // moderate/low

      (prisma.defectPrediction.count as jest.Mock).mockResolvedValue(370);
      (prisma.commit.count as jest.Mock).mockResolvedValue(371);

      const stats = await service.getRepositoryStats('repo-1');

      expect(stats.analyzedFiles).toBe(865);
      expect(stats.hotspots.total).toBe(194);
      expect(stats.hotspots.critical).toBe(101);
      expect(stats.hotspots.high).toBe(93);
      expect(stats.hotspots.moderateOrLow).toBe(671);
      expect(stats.jitScreenedCommits).toBe(370);
      expect(stats.totalCommits).toBe(371);
    });
  });
});
