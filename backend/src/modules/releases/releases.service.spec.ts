import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReleasesService } from './releases.service';
import { PrismaService } from '../../prisma/prisma.service';
import { createMockPrismaService, MockPrismaService } from '../../../test/mocks/prisma.mock';

describe('ReleasesService', () => {
  let service: ReleasesService;
  let prisma: MockPrismaService;

  const mockRelease = {
    id: 'rel-123',
    version: 'v1.0.0',
    targetDate: new Date('2026-12-01'),
    description: 'Q4 Major Release',
    organizationId: 'org-123',
    isActive: true,
    sprintAssociations: [],
  };

  beforeEach(async () => {
    prisma = createMockPrismaService() as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleasesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<ReleasesService>(ReleasesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw ConflictException if release version already exists', async () => {
      prisma.release.findFirst.mockResolvedValue(mockRelease as any);

      await expect(
        service.create({ version: 'v1.0.0', targetDate: '2026-12-01' }, 'org-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create release successfully when version is unique', async () => {
      prisma.release.findFirst.mockResolvedValue(null);
      prisma.release.create.mockResolvedValue(mockRelease as any);

      const result = await service.create(
        { version: 'v1.0.0', targetDate: '2026-12-01', description: 'Q4 Major Release' },
        'org-123',
      );

      expect(prisma.release.create).toHaveBeenCalled();
      expect(result.version).toBe('v1.0.0');
    });
  });

  describe('findAll', () => {
    it('should return list of active releases for organization', async () => {
      prisma.release.findMany.mockResolvedValue([mockRelease] as any);

      const result = await service.findAll('org-123');

      expect(prisma.release.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-123', isActive: true },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('evaluateCanaryTelemetry', () => {
    it('should throw NotFoundException if release does not exist', async () => {
      prisma.release.findFirst.mockResolvedValue(null);

      await expect(
        service.evaluateCanaryTelemetry('rel-999', 'org-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should evaluate and persist canary telemetry defensively when ML service returns fallback', async () => {
      prisma.release.findFirst.mockResolvedValue(mockRelease as any);
      const mockSaved = {
        id: 'telemetry-1',
        releaseId: 'rel-123',
        serviceName: 'sqdis-backend',
        verdict: 'HEALTHY',
        recommendation: 'PROCEED',
        p95BaselineMs: 12.5,
        p95CanaryMs: 12.9,
        p95DeltaPct: 3.2,
        errorBaseline: 0.0,
        errorCanary: 0.0,
        errorDelta: 0.0,
        memoryBaselineMb: 178.0,
        memoryCanaryMb: 179.8,
        memoryDeltaPct: 1.01,
        score: 100,
        violations: [],
        createdAt: new Date(),
      };
      prisma.releaseTelemetryAnalysis.create.mockResolvedValue(mockSaved as any);

      const result = await service.evaluateCanaryTelemetry('rel-123', 'org-123');

      expect(prisma.releaseTelemetryAnalysis.create).toHaveBeenCalled();
      expect(result.verdict).toBe('HEALTHY');
      expect(result.recommendation).toBe('PROCEED');
      expect(result.score).toBe(100);
      expect(result.deltas.latency_delta_pct).toBe(3.2);
    });
  });

  describe('calculateReadiness', () => {
    it('should calculate 5-factor readiness with telemetry stability included', async () => {
      prisma.release.findUnique.mockResolvedValue({
        ...mockRelease,
        sprintAssociations: [
          {
            sprint: {
              reports: [
                {
                  bugsIntroduced: 2,
                  bugsFixed: 2,
                  coveragePct: 80,
                  avgDQS: 85,
                },
              ],
            },
          },
        ],
      } as any);

      prisma.releaseTelemetryAnalysis.findFirst.mockResolvedValue({
        id: 'tel-1',
        releaseId: 'rel-123',
        verdict: 'HEALTHY',
        recommendation: 'PROCEED',
        score: 95,
      } as any);

      const readiness = await service.calculateReadiness('rel-123');

      expect(readiness.hasTelemetry).toBe(true);
      expect(readiness.telemetryScore).toBe(95);
      expect(readiness.telemetryVerdict).toBe('HEALTHY');
      expect(readiness.isAtRisk).toBe(false);
      expect(readiness.score).toBe(89);
    });

    it('should mark release as at-risk if telemetry reports CRITICAL_REGRESSION', async () => {
      prisma.release.findUnique.mockResolvedValue({
        ...mockRelease,
        sprintAssociations: [],
      } as any);

      prisma.releaseTelemetryAnalysis.findFirst.mockResolvedValue({
        id: 'tel-2',
        releaseId: 'rel-123',
        verdict: 'CRITICAL_REGRESSION',
        recommendation: 'TRIGGER_ROLLBACK',
        score: 40,
      } as any);

      const readiness = await service.calculateReadiness('rel-123');

      expect(readiness.hasTelemetry).toBe(true);
      expect(readiness.isAtRisk).toBe(true);
      expect(readiness.telemetryVerdict).toBe('CRITICAL_REGRESSION');
      expect(readiness.telemetryRecommendation).toBe('TRIGGER_ROLLBACK');
    });
  });

  describe('rollbackRelease', () => {
    it('should successfully execute rollback, update release, and create notification', async () => {
      prisma.release.findFirst.mockResolvedValue({
        ...mockRelease,
        isRolledBack: false,
        telemetryAnalyses: [
          {
            verdict: 'FAIL',
            recommendation: 'TRIGGER_ROLLBACK',
            p95DeltaPct: 35.2,
            errorDelta: 0.8,
            memoryDeltaPct: 15.0,
            score: 25,
          },
        ],
      } as any);

      prisma.release.update.mockResolvedValue({
        ...mockRelease,
        isRolledBack: true,
        rolledBackAt: new Date(),
        rollbackReason: 'Canary telemetry FAIL: TRIGGER_ROLLBACK',
        rollbackTriggeredBy: 'user-123',
      } as any);

      prisma.notification.create.mockResolvedValue({} as any);

      const result = await service.rollbackRelease('rel-123', 'org-123', 'user-123', {
        reason: 'Canary telemetry FAIL: TRIGGER_ROLLBACK',
      });

      expect(result.success).toBe(true);
      expect(result.isRolledBack).toBe(true);
      expect(result.releaseId).toBe('rel-123');
      expect(result.rollbackReason).toBe('Canary telemetry FAIL: TRIGGER_ROLLBACK');
      expect(prisma.release.update).toHaveBeenCalled();
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if release is already rolled back', async () => {
      prisma.release.findFirst.mockResolvedValue({
        ...mockRelease,
        isRolledBack: true,
        rolledBackAt: new Date(),
      } as any);

      await expect(
        service.rollbackRelease('rel-123', 'org-123', 'user-123'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if release does not exist', async () => {
      prisma.release.findFirst.mockResolvedValue(null);

      await expect(
        service.rollbackRelease('non-existent', 'org-123', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

