import { Injectable, NotFoundException, Logger, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma';
import { AlertFiltersDto, UpdateNotificationPreferencesDto } from './dto';
import { AlertSeverity, AlertStatus, AlertType } from '@prisma/client';
import { NotificationService, AlertNotificationData } from './services/notification.service';
import { ThresholdConfigService } from './services/threshold-config.service';

/**
 * Event payload for new alert WebSocket events
 */
export interface AlertCreatedEvent {
  alertId: string;
  organizationId: string;
  commitId?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  anomalyScore?: number;
  createdAt: Date;
}

/**
 * Service for managing anomaly alerts and notifications
 */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => NotificationService))
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ThresholdConfigService))
    private readonly thresholdConfigService: ThresholdConfigService,
  ) {}

  /**
   * Find all alerts with pagination and filters
   */
  async findAll(organizationId: string, filters: AlertFiltersDto) {
    const { page = 1, limit = 20, severity, status, type, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (severity) {
      where.severity = severity;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
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

    const [alerts, total] = await Promise.all([
      this.prisma.alert.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          acknowledger: {
            select: { id: true, name: true, email: true },
          },
          resolver: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.alert.count({ where }),
    ]);

    // Calculate severity counts
    const severityCounts = await this.prisma.alert.groupBy({
      by: ['severity'],
      where: { organizationId },
      _count: { severity: true },
    });

    const severityBreakdown = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    severityCounts.forEach((item) => {
      severityBreakdown[item.severity] = item._count.severity;
    });

    return {
      data: alerts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      severityBreakdown,
    };
  }

  /**
   * Find a specific alert by ID
   */
  async findById(id: string, organizationId: string) {
    return this.prisma.alert.findFirst({
      where: { id, organizationId },
      include: {
        acknowledger: {
          select: { id: true, name: true, email: true },
        },
        resolver: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Create a new alert
   */
  async createAlert(data: {
    organizationId: string;
    commitId?: string;
    type: AlertType;
    anomalyScore?: number;
    message: string;
    modelVersion?: string;
  }) {
    // Map anomaly score to severity using organization's custom thresholds
    const { severity, shouldAlert } = await this.thresholdConfigService.mapScoreToSeverity(
      data.organizationId,
      data.anomalyScore ?? 0,
      data.type,
    );

    // Check if alert should be generated based on threshold configuration
    if (!shouldAlert) {
      this.logger.debug(
        `Alert filtered by threshold config: org=${data.organizationId}, score=${data.anomalyScore}, severity=${severity}`,
      );
      return null;
    }

    // Check for duplicate alert (same commit and type)
    if (data.commitId) {
      const existing = await this.prisma.alert.findFirst({
        where: {
          organizationId: data.organizationId,
          commitId: data.commitId,
          type: data.type,
          status: { not: AlertStatus.RESOLVED },
        },
      });

      if (existing) {
        // Update existing alert instead of creating new
        const updatedAlert = await this.prisma.alert.update({
          where: { id: existing.id },
          data: {
            anomalyScore: data.anomalyScore,
            severity,
            message: data.message,
            modelVersion: data.modelVersion,
          },
        });

        this.logger.debug(`Updated existing alert ${existing.id} for commit ${data.commitId}`);
        return updatedAlert;
      }
    }

    const alert = await this.prisma.alert.create({
      data: {
        organizationId: data.organizationId,
        commitId: data.commitId,
        type: data.type,
        severity,
        anomalyScore: data.anomalyScore,
        message: data.message,
        modelVersion: data.modelVersion,
        status: AlertStatus.OPEN,
      },
    });

    // Publish alert to WebSocket for real-time display
    this.publishAlertCreated(alert);

    // Send multi-channel notifications
    await this.sendAlertNotifications(alert);

    this.logger.log(
      `Created alert ${alert.id} for commit ${data.commitId}: severity=${severity}, score=${data.anomalyScore}`,
    );

    return alert;
  }

  /**
   * Send notifications for an alert through all enabled channels
   */
  private async sendAlertNotifications(alert: {
    id: string;
    organizationId: string;
    commitId: string | null;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    anomalyScore: number | null;
    createdAt: Date;
  }): Promise<void> {
    const notificationData: AlertNotificationData = {
      alertId: alert.id,
      organizationId: alert.organizationId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      commitId: alert.commitId || undefined,
      anomalyScore: alert.anomalyScore || undefined,
      createdAt: alert.createdAt,
    };

    try {
      const result = await this.notificationService.sendNotificationsWithFallback(notificationData);
      this.logger.debug(
        `Alert ${alert.id} notifications: ${result.totalSent} sent, ${result.totalFailed} failed`,
      );
    } catch (error) {
      // Log but don't throw - notification failures shouldn't block alert creation
      this.logger.error(`Failed to send notifications for alert ${alert.id}`, error);
    }
  }

  /**
   * Create an alert from anomaly detection during commit processing
   *
   * @param organizationId - Organization ID
   * @param commitId - Commit ID that triggered the anomaly
   * @param commitSha - Commit SHA for message context
   * @param anomalyScore - Anomaly score from ML service (0-1)
   * @param severity - Severity level from ML service
   * @param modelVersion - ML model version used for detection
   * @returns Created alert
   */
  async createAnomalyAlert(data: {
    organizationId: string;
    commitId: string;
    commitSha: string;
    anomalyScore: number;
    severity: string;
    modelVersion?: string;
  }) {
    const message =
      `Anomaly detected in commit ${data.commitSha.substring(0, 7)}: ` +
      `score=${data.anomalyScore.toFixed(3)}, severity=${data.severity}`;

    return this.createAlert({
      organizationId: data.organizationId,
      commitId: data.commitId,
      type: AlertType.ANOMALY,
      anomalyScore: data.anomalyScore,
      message,
      modelVersion: data.modelVersion || 'unknown',
    });
  }

  /**
   * Publish alert created event for WebSocket real-time display
   *
   * @param alert - The created alert
   */
  private publishAlertCreated(alert: {
    id: string;
    organizationId: string;
    commitId: string | null;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    anomalyScore: number | null;
    createdAt: Date;
  }): void {
    const event: AlertCreatedEvent = {
      alertId: alert.id,
      organizationId: alert.organizationId,
      commitId: alert.commitId || undefined,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      anomalyScore: alert.anomalyScore || undefined,
      createdAt: alert.createdAt,
    };

    // Emit event for WebSocket gateway to pick up
    this.eventEmitter.emit('alert.created', event);

    this.logger.debug(`Published alert.created event for alert ${alert.id}`);
  }

  /**
   * Map anomaly score to severity level
   * - Below 0.5: LOW
   * - 0.5 to 0.7: MEDIUM
   * - 0.7 to 0.9: HIGH
   * - 0.9 or above: CRITICAL
   */
  mapScoreToSeverity(score?: number): AlertSeverity {
    if (score === undefined || score === null) {
      return AlertSeverity.LOW;
    }

    if (score < 0.5) {
      return AlertSeverity.LOW;
    } else if (score < 0.7) {
      return AlertSeverity.MEDIUM;
    } else if (score < 0.9) {
      return AlertSeverity.HIGH;
    } else {
      return AlertSeverity.CRITICAL;
    }
  }

  /**
   * Acknowledge an alert
   */
  async acknowledge(id: string, userId: string, organizationId: string) {
    const alert = await this.findById(id, organizationId);
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
      include: {
        acknowledger: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Resolve an alert
   */
  async resolve(id: string, userId: string, organizationId: string, resolutionNotes: string) {
    const alert = await this.findById(id, organizationId);
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }

    return this.prisma.alert.update({
      where: { id },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes,
      },
      include: {
        acknowledger: {
          select: { id: true, name: true, email: true },
        },
        resolver: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string) {
    let preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Create default preferences if not exists
    if (!preferences) {
      preferences = await this.prisma.notificationPreference.create({
        data: {
          userId,
          emailEnabled: true,
          slackEnabled: false,
          inAppEnabled: true,
          digestMode: false,
          minSeverity: AlertSeverity.MEDIUM,
        },
      });
    }

    return preferences;
  }

  /**
   * Update notification preferences for a user
   */
  async updatePreferences(userId: string, dto: UpdateNotificationPreferencesDto) {
    // Ensure preferences exist
    await this.getPreferences(userId);

    return this.prisma.notificationPreference.update({
      where: { userId },
      data: dto,
    });
  }

  /**
   * Bulk acknowledge alerts
   */
  async bulkAcknowledge(ids: string[], userId: string, organizationId: string) {
    return this.prisma.alert.updateMany({
      where: {
        id: { in: ids },
        organizationId,
        status: AlertStatus.OPEN,
      },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }
}
