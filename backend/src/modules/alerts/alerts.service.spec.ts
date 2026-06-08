import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AlertSeverity, AlertStatus, AlertType } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { AlertsService } from './alerts.service';
import { NotificationService } from './services/notification.service';
import { ThresholdConfigService } from './services/threshold-config.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let prisma: {
    alert: Record<string, jest.Mock>;
    notificationPreference: Record<string, jest.Mock>;
  };
  let eventEmitter: { emit: jest.Mock };
  let thresholdConfigService: { mapScoreToSeverity: jest.Mock };
  let notificationService: { sendNotificationsWithFallback: jest.Mock };

  const alert = {
    id: 'alert-1',
    organizationId: 'org-1',
    commitId: 'commit-1',
    type: AlertType.ANOMALY,
    severity: AlertSeverity.HIGH,
    anomalyScore: 0.85,
    message: 'Anomaly detected',
    status: AlertStatus.OPEN,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      alert: {
        findMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationPreference: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    eventEmitter = { emit: jest.fn() };
    thresholdConfigService = {
      mapScoreToSeverity: jest.fn().mockResolvedValue({
        severity: AlertSeverity.HIGH,
        shouldAlert: true,
      }),
    };
    notificationService = {
      sendNotificationsWithFallback: jest.fn().mockResolvedValue({
        totalSent: 1,
        totalFailed: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationService, useValue: notificationService },
        { provide: ThresholdConfigService, useValue: thresholdConfigService },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated alerts with severity breakdown', async () => {
    prisma.alert.findMany.mockResolvedValue([alert]);
    prisma.alert.count.mockResolvedValue(1);
    prisma.alert.groupBy.mockResolvedValue([
      { severity: AlertSeverity.HIGH, _count: { severity: 1 } },
    ]);

    await expect(service.findAll('org-1', { page: 1, limit: 20 })).resolves.toEqual({
      data: [alert],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
      severityBreakdown: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 1,
        CRITICAL: 0,
      },
    });
  });

  it('creates an alert and publishes websocket and notification events', async () => {
    prisma.alert.findFirst.mockResolvedValue(null);
    prisma.alert.create.mockResolvedValue(alert);

    await expect(
      service.createAlert({
        organizationId: 'org-1',
        commitId: 'commit-1',
        type: AlertType.ANOMALY,
        anomalyScore: 0.85,
        message: 'Anomaly detected',
      }),
    ).resolves.toEqual(alert);

    expect(eventEmitter.emit).toHaveBeenCalledWith('alert.created', expect.objectContaining({
      alertId: 'alert-1',
    }));
    expect(notificationService.sendNotificationsWithFallback).toHaveBeenCalled();
  });

  it('skips alert creation when threshold config filters it out', async () => {
    thresholdConfigService.mapScoreToSeverity.mockResolvedValue({
      severity: AlertSeverity.LOW,
      shouldAlert: false,
    });

    await expect(
      service.createAlert({
        organizationId: 'org-1',
        type: AlertType.ANOMALY,
        anomalyScore: 0.1,
        message: 'Low score',
      }),
    ).resolves.toBeNull();
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('updates an existing open alert for the same commit instead of duplicating', async () => {
    prisma.alert.findFirst.mockResolvedValue({ id: 'alert-1' });
    prisma.alert.update.mockResolvedValue(alert);

    await expect(
      service.createAlert({
        organizationId: 'org-1',
        commitId: 'commit-1',
        type: AlertType.ANOMALY,
        anomalyScore: 0.9,
        message: 'Updated anomaly',
      }),
    ).resolves.toEqual(alert);
    expect(prisma.alert.update).toHaveBeenCalled();
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('maps anomaly scores to severity levels', () => {
    expect(service.mapScoreToSeverity(0.3)).toBe(AlertSeverity.LOW);
    expect(service.mapScoreToSeverity(0.6)).toBe(AlertSeverity.MEDIUM);
    expect(service.mapScoreToSeverity(0.8)).toBe(AlertSeverity.HIGH);
    expect(service.mapScoreToSeverity(0.95)).toBe(AlertSeverity.CRITICAL);
  });

  it('acknowledges an alert', async () => {
    prisma.alert.findFirst.mockResolvedValue(alert);
    prisma.alert.update.mockResolvedValue({
      ...alert,
      status: AlertStatus.ACKNOWLEDGED,
    });

    await expect(service.acknowledge('alert-1', 'user-1', 'org-1')).resolves.toMatchObject({
      status: AlertStatus.ACKNOWLEDGED,
    });
  });

  it('throws when acknowledging a missing alert', async () => {
    prisma.alert.findFirst.mockResolvedValue(null);

    await expect(service.acknowledge('missing', 'user-1', 'org-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves an alert with notes', async () => {
    prisma.alert.findFirst.mockResolvedValue(alert);
    prisma.alert.update.mockResolvedValue({
      ...alert,
      status: AlertStatus.RESOLVED,
      resolutionNotes: 'False positive',
    });

    await expect(
      service.resolve('alert-1', 'user-1', 'org-1', 'False positive'),
    ).resolves.toMatchObject({
      status: AlertStatus.RESOLVED,
    });
  });

  it('creates default notification preferences when none exist', async () => {
    prisma.notificationPreference.findUnique.mockResolvedValue(null);
    prisma.notificationPreference.create.mockResolvedValue({
      userId: 'user-1',
      emailEnabled: true,
      inAppEnabled: true,
      minSeverity: AlertSeverity.MEDIUM,
    });

    await expect(service.getPreferences('user-1')).resolves.toMatchObject({
      userId: 'user-1',
      emailEnabled: true,
    });
  });
});
