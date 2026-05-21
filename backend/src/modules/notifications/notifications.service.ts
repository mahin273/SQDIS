import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma';
import { NotificationFiltersDto, CreateNotificationDto } from './dto';
import { NotificationType, Prisma } from '@prisma/client';

/**
 * Service for managing in-app notifications
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create a new notification
   * Create in-app notification for admins
   */
  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        organizationId: dto.organizationId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        metadata: dto.metadata as Prisma.JsonObject,
      },
    });

    // Publish WebSocket event for real-time updates
    // Publish notification:new event
    this.eventEmitter.emit('notification.created', {
      notificationId: notification.id,
      userId: notification.userId,
      organizationId: notification.organizationId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: notification.createdAt,
    });

    this.logger.debug(`Created notification ${notification.id} for user ${dto.userId}`);
    return notification;
  }

  /**
   * Get notifications for a user with filters and pagination
   */
  async findAll(userId: string, organizationId: string, filters: NotificationFiltersDto) {
    const { type, isRead, startDate, endDate, page = 1, limit = 20 } = filters;

    const where: Prisma.NotificationWhereInput = {
      userId,
      organizationId,
    };

    if (type) {
      where.type = type;
    }

    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single notification by ID
   */
  async findOne(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return notification;
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, organizationId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        organizationId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    this.logger.debug(`Marked ${result.count} notifications as read for user ${userId}`);
    return { count: result.count };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string, organizationId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        organizationId,
        isRead: false,
      },
    });

    return { count };
  }

  /**
   * Delete a notification
   */
  async delete(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    await this.prisma.notification.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Create notification for alert
   * Create in-app notification for all alerts
   */
  async createAlertNotification(
    userId: string,
    organizationId: string,
    alertId: string,
    severity: string,
    message: string,
  ) {
    return this.create({
      userId,
      organizationId,
      type: NotificationType.ALERT,
      title: `${severity} Alert`,
      message,
      metadata: { alertId, severity },
    });
  }

  /**
   * Create notification for milestone achievement
   * Send notification on milestone achievement
   */
  async createMilestoneNotification(
    userId: string,
    organizationId: string,
    milestoneType: string,
    developerName: string,
  ) {
    return this.create({
      userId,
      organizationId,
      type: NotificationType.MILESTONE_ACHIEVED,
      title: 'Milestone Achieved',
      message: `${developerName} achieved ${milestoneType} milestone`,
      metadata: { milestoneType, developerName },
    });
  }

  /**
   * Create notification for goal achievement
   * Create achievement notification for owner
   */
  async createGoalAchievementNotification(
    userId: string,
    organizationId: string,
    goalName: string,
    goalId: string,
  ) {
    return this.create({
      userId,
      organizationId,
      type: NotificationType.GOAL_ACHIEVED,
      title: 'Goal Achieved!',
      message: `Congratulations! You achieved your goal: ${goalName}`,
      metadata: { goalId, goalName },
    });
  }

  /**
   * Create notification for sprint report ready
   * Send notification to Team Lead
   */
  async createSprintReportNotification(
    userId: string,
    organizationId: string,
    sprintName: string,
    sprintId: string,
  ) {
    return this.create({
      userId,
      organizationId,
      type: NotificationType.SPRINT_REPORT_READY,
      title: 'Sprint Report Ready',
      message: `The report for sprint "${sprintName}" is now available`,
      metadata: { sprintId, sprintName },
    });
  }
}
