import { Test, TestingModule } from '@nestjs/testing';
import { AlertSeverity, AlertType } from '@prisma/client';
import { PrismaService } from '../../../prisma';
import { DEFAULT_THRESHOLDS, ThresholdConfigService } from './threshold-config.service';

describe('ThresholdConfigService', () => {
  let service: ThresholdConfigService;
  let prisma: {
    alertThresholdConfig: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    prisma = {
      alertThresholdConfig: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ThresholdConfigService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ThresholdConfigService>(ThresholdConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns default thresholds when no organization config exists', async () => {
    prisma.alertThresholdConfig.findUnique.mockResolvedValue(null);

    await expect(service.getConfig('org-1', AlertType.ANOMALY)).resolves.toEqual({
      id: null,
      organizationId: 'org-1',
      alertType: AlertType.ANOMALY,
      ...DEFAULT_THRESHOLDS,
      isActive: true,
      createdAt: null,
      updatedAt: null,
      createdBy: null,
      updatedBy: null,
      isDefault: true,
    });
  });

  it('marks stored configuration as non-default', async () => {
    prisma.alertThresholdConfig.findUnique.mockResolvedValue({
      id: 'config-1',
      organizationId: 'org-1',
      alertType: AlertType.ANOMALY,
      lowThreshold: 0.1,
      mediumThreshold: 0.4,
      highThreshold: 0.7,
      criticalThreshold: 0.9,
      minSeverity: AlertSeverity.MEDIUM,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      createdBy: 'user-1',
      updatedBy: 'user-1',
    });

    await expect(service.getConfig('org-1')).resolves.toMatchObject({
      id: 'config-1',
      isDefault: false,
    });
  });

  it('maps anomaly scores to severity using organization thresholds', async () => {
    prisma.alertThresholdConfig.findUnique.mockResolvedValue({
      id: 'config-1',
      organizationId: 'org-1',
      alertType: AlertType.ANOMALY,
      lowThreshold: 0.2,
      mediumThreshold: 0.5,
      highThreshold: 0.7,
      criticalThreshold: 0.9,
      minSeverity: AlertSeverity.MEDIUM,
      isActive: true,
    });

    await expect(service.mapScoreToSeverity('org-1', 0.1)).resolves.toEqual({
      severity: AlertSeverity.LOW,
      shouldAlert: false,
    });
    await expect(service.mapScoreToSeverity('org-1', 0.55)).resolves.toEqual({
      severity: AlertSeverity.MEDIUM,
      shouldAlert: true,
    });
    await expect(service.mapScoreToSeverity('org-1', 0.95)).resolves.toEqual({
      severity: AlertSeverity.CRITICAL,
      shouldAlert: true,
    });
  });

  it('rejects threshold values that are not in ascending order', async () => {
    await expect(
      service.upsertConfig('org-1', {
        lowThreshold: 0.8,
        mediumThreshold: 0.5,
        highThreshold: 0.7,
        criticalThreshold: 0.9,
      }),
    ).rejects.toThrow('Thresholds must be in ascending order: low <= medium <= high <= critical');
    expect(prisma.alertThresholdConfig.upsert).not.toHaveBeenCalled();
  });

  it('upserts valid threshold configuration', async () => {
    prisma.alertThresholdConfig.upsert.mockResolvedValue({
      id: 'config-1',
      organizationId: 'org-1',
      alertType: AlertType.ANOMALY,
      lowThreshold: 0.1,
      mediumThreshold: 0.4,
      highThreshold: 0.7,
      criticalThreshold: 0.9,
      minSeverity: AlertSeverity.LOW,
      isActive: true,
    });

    await expect(
      service.upsertConfig(
        'org-1',
        {
          lowThreshold: 0.1,
          mediumThreshold: 0.4,
          highThreshold: 0.7,
          criticalThreshold: 0.9,
        },
        'user-1',
      ),
    ).resolves.toMatchObject({ id: 'config-1' });
  });

  it('resets configuration to defaults by deleting stored values', async () => {
    prisma.alertThresholdConfig.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.resetConfig('org-1', AlertType.ANOMALY)).resolves.toEqual({
      success: true,
      message: 'Threshold configuration reset to defaults',
    });
    expect(prisma.alertThresholdConfig.deleteMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        alertType: AlertType.ANOMALY,
      },
    });
  });
});
