import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../../prisma';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: Record<string, jest.Mock>;
  };
  let eventEmitter: { emit: jest.Mock };

  const notification = {
    id: 'notification-1',
    userId: 'user-1',
    organizationId: 'org-1',
    type: NotificationType.ALERT,
    title: 'HIGH Alert',
    message: 'Anomaly detected',
    metadata: { alertId: 'alert-1' },
    isRead: false,
    readAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a notification and emits a websocket event', async () => {
    prisma.notification.create.mockResolvedValue(notification);

    await expect(
      service.create({
        userId: 'user-1',
        organizationId: 'org-1',
        type: NotificationType.ALERT,
        title: 'HIGH Alert',
        message: 'Anomaly detected',
        metadata: { alertId: 'alert-1' },
      }),
    ).resolves.toEqual(notification);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'notification.created',
      expect.objectContaining({
        notificationId: 'notification-1',
        userId: 'user-1',
      }),
    );
  });

  it('returns paginated notifications for a user', async () => {
    prisma.notification.findMany.mockResolvedValue([notification]);
    prisma.notification.count.mockResolvedValue(1);

    await expect(
      service.findAll('user-1', 'org-1', { page: 1, limit: 20, isRead: false }),
    ).resolves.toEqual({
      data: [notification],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    });
  });

  it('marks an unread notification as read', async () => {
    prisma.notification.findFirst.mockResolvedValue(notification);
    prisma.notification.update.mockResolvedValue({
      ...notification,
      isRead: true,
      readAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await expect(service.markAsRead('notification-1', 'user-1')).resolves.toMatchObject({
      isRead: true,
    });
  });

  it('returns an already-read notification without updating it', async () => {
    prisma.notification.findFirst.mockResolvedValue({
      ...notification,
      isRead: true,
      readAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    await expect(service.markAsRead('notification-1', 'user-1')).resolves.toMatchObject({
      isRead: true,
    });
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications as read', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 4 });

    await expect(service.markAllAsRead('user-1', 'org-1')).resolves.toEqual({ count: 4 });
  });

  it('returns unread notification count', async () => {
    prisma.notification.count.mockResolvedValue(3);

    await expect(service.getUnreadCount('user-1', 'org-1')).resolves.toEqual({ count: 3 });
  });

  it('deletes a notification owned by the user', async () => {
    prisma.notification.findFirst.mockResolvedValue(notification);
    prisma.notification.delete.mockResolvedValue(notification);

    await expect(service.delete('notification-1', 'user-1')).resolves.toEqual({
      deleted: true,
    });
  });

  it('throws when deleting a missing notification', async () => {
    prisma.notification.findFirst.mockResolvedValue(null);

    await expect(service.delete('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates alert notifications with severity metadata', async () => {
    prisma.notification.create.mockResolvedValue(notification);

    await service.createAlertNotification(
      'user-1',
      'org-1',
      'alert-1',
      'HIGH',
      'Anomaly detected',
    );

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: NotificationType.ALERT,
        title: 'HIGH Alert',
        metadata: { alertId: 'alert-1', severity: 'HIGH' },
      }),
    });
  });
});
