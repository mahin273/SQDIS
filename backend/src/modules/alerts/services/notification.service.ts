import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { PrismaService } from '../../../prisma';
import { AlertSeverity, NotificationType } from '@prisma/client';
import { DigestService } from './digest.service';

/**
 * Interface for alert notification data
 */
export interface AlertNotificationData {
  alertId: string;
  organizationId: string;
  type: string;
  severity: AlertSeverity;
  message: string;
  commitId?: string;
  anomalyScore?: number;
  createdAt: Date;
}

/**
 * Interface for notification channel result
 */
export interface NotificationChannelResult {
  channel: 'email' | 'slack' | 'inApp';
  success: boolean;
  error?: string;
}

/**
 * Service for sending multi-channel notifications for alerts
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => DigestService))
    private readonly digestService: DigestService,
  ) {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter for sending notifications
   */
  private initializeEmailTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!user || !pass) {
      this.logger.warn('SMTP credentials not configured. Email notifications will be disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('Email transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email transporter', error);
    }
  }

  /**
   * Send notifications for an alert through all enabled channels
   *
   * @param alert - Alert notification data
   * @returns Array of results for each notification channel
   */
  async sendAlertNotifications(alert: AlertNotificationData): Promise<NotificationChannelResult[]> {
    const results: NotificationChannelResult[] = [];

    // Get all admins in the organization who should receive notifications
    const recipients = await this.getAlertRecipients(alert.organizationId, alert.severity);

    if (recipients.length === 0) {
      this.logger.debug(`No recipients found for alert ${alert.alertId}`);
      return results;
    }

    // Process each recipient
    for (const recipient of recipients) {
      const preferences = await this.getUserPreferences(recipient.userId);

      // Check if alert severity meets minimum threshold
      if (!this.meetsSeverityThreshold(alert.severity, preferences.minSeverity)) {
        continue;
      }

      // Check quiet hours - skip non-critical alerts during quiet hours
      const inQuietHours = this.isInQuietHours(preferences.quietStart, preferences.quietEnd);
      if (inQuietHours && alert.severity !== AlertSeverity.CRITICAL) {
        this.logger.debug(`Skipping notification for user ${recipient.userId} - in quiet hours`);
        continue;
      }

      // Check digest mode - queue for digest instead of immediate notification
      // CRITICAL alerts always bypass digest mode for immediate notification
      if (preferences.digestMode && alert.severity !== AlertSeverity.CRITICAL) {
        await this.digestService.queueForDigest(recipient.userId, alert.organizationId, alert);
        this.logger.debug(`Queued alert ${alert.alertId} for digest to user ${recipient.userId}`);

        // Still create in-app notification even in digest mode
        if (preferences.inAppEnabled) {
          const inAppResult = await this.createInAppNotification(recipient.userId, alert);
          results.push(inAppResult);
        }
        continue;
      }

      // Send through enabled channels (immediate mode)
      //  Send email notification for HIGH/CRITICAL alerts
      if (preferences.emailEnabled && this.shouldSendEmail(alert.severity)) {
        const emailResult = await this.sendEmailNotification(recipient, alert);
        results.push(emailResult);
      }

      // Send Slack notification (optional)
      if (preferences.slackEnabled && preferences.slackWebhookUrl) {
        const slackResult = await this.sendSlackNotification(preferences.slackWebhookUrl, alert);
        results.push(slackResult);
      }

      //  Create in-app notification for all alerts
      if (preferences.inAppEnabled) {
        const inAppResult = await this.createInAppNotification(recipient.userId, alert);
        results.push(inAppResult);
      }
    }

    return results;
  }

  /**
   * Get users who should receive alert notifications
   * Returns admins and owners of the organization
   */
  private async getAlertRecipients(
    organizationId: string,
    severity: AlertSeverity,
  ): Promise<Array<{ userId: string; email: string; name: string }>> {
    // For HIGH and CRITICAL alerts, notify admins and owners
    // For lower severity, only notify owners
    const roles =
      severity === AlertSeverity.HIGH || severity === AlertSeverity.CRITICAL
        ? ['OWNER', 'ADMIN']
        : ['OWNER'];

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: { in: roles as any },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    return members.map((m) => ({
      userId: m.user.id,
      email: m.user.email,
      name: m.user.name,
    }));
  }

  /**
   * Get user notification preferences with defaults
   */
  private async getUserPreferences(userId: string): Promise<{
    emailEnabled: boolean;
    slackEnabled: boolean;
    slackWebhookUrl?: string;
    inAppEnabled: boolean;
    quietStart?: string;
    quietEnd?: string;
    digestMode: boolean;
    minSeverity: AlertSeverity;
  }> {
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Return defaults if no preferences set
    if (!preferences) {
      return {
        emailEnabled: true,
        slackEnabled: false,
        inAppEnabled: true,
        digestMode: false,
        minSeverity: AlertSeverity.MEDIUM,
      };
    }

    return {
      emailEnabled: preferences.emailEnabled,
      slackEnabled: preferences.slackEnabled,
      slackWebhookUrl: preferences.slackWebhookUrl || undefined,
      inAppEnabled: preferences.inAppEnabled,
      quietStart: preferences.quietStart || undefined,
      quietEnd: preferences.quietEnd || undefined,
      digestMode: preferences.digestMode,
      minSeverity: preferences.minSeverity,
    };
  }

  /**
   * Check if alert severity meets the minimum threshold
   */
  private meetsSeverityThreshold(
    alertSeverity: AlertSeverity,
    minSeverity: AlertSeverity,
  ): boolean {
    const severityOrder = {
      [AlertSeverity.LOW]: 1,
      [AlertSeverity.MEDIUM]: 2,
      [AlertSeverity.HIGH]: 3,
      [AlertSeverity.CRITICAL]: 4,
    };

    return severityOrder[alertSeverity] >= severityOrder[minSeverity];
  }

  /**
   * Check if current time is within quiet hours
   */
  private isInQuietHours(quietStart?: string, quietEnd?: string): boolean {
    if (!quietStart || !quietEnd) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = quietStart.split(':').map(Number);
    const [endHour, endMin] = quietEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  /**
   * Determine if email should be sent based on severity
   * Only send emails for HIGH and CRITICAL alerts
   */
  private shouldSendEmail(severity: AlertSeverity): boolean {
    return severity === AlertSeverity.HIGH || severity === AlertSeverity.CRITICAL;
  }

  /**
   * Send email notification for an alert
   *
   * @param recipient - User to send email to
   * @param alert - Alert data
   * @returns Notification channel result
   */
  async sendEmailNotification(
    recipient: { userId: string; email: string; name: string },
    alert: AlertNotificationData,
  ): Promise<NotificationChannelResult> {
    if (!this.transporter) {
      this.logger.warn(
        `Email sending disabled. Would send alert ${alert.alertId} to ${recipient.email}`,
      );
      return {
        channel: 'email',
        success: false,
        error: 'Email transporter not configured',
      };
    }

    const fromEmail = this.configService.get<string>('SMTP_FROM', 'noreply@sqdis.com');
    const appUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');

    const mailOptions = {
      from: `"SQDIS Alerts" <${fromEmail}>`,
      to: recipient.email,
      subject: this.getEmailSubject(alert),
      html: this.getAlertEmailTemplate(recipient.name, alert, appUrl),
      text: this.getAlertEmailText(recipient.name, alert, appUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Alert email sent to ${recipient.email} for alert ${alert.alertId}`);
      return { channel: 'email', success: true };
    } catch (error) {
      this.logger.error(`Failed to send alert email to ${recipient.email}`, error);
      return {
        channel: 'email',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get email subject based on alert severity
   */
  private getEmailSubject(alert: AlertNotificationData): string {
    const severityEmoji = {
      [AlertSeverity.LOW]: 'ℹ️',
      [AlertSeverity.MEDIUM]: '⚠️',
      [AlertSeverity.HIGH]: '🔶',
      [AlertSeverity.CRITICAL]: '🔴',
    };

    return `${severityEmoji[alert.severity]} [${alert.severity}] SQDIS Alert: ${alert.type}`;
  }

  /**
   * Generate HTML email template for alert notification
   */
  private getAlertEmailTemplate(
    recipientName: string,
    alert: AlertNotificationData,
    appUrl: string,
  ): string {
    const severityColors = {
      [AlertSeverity.LOW]: '#3b82f6',
      [AlertSeverity.MEDIUM]: '#f59e0b',
      [AlertSeverity.HIGH]: '#f97316',
      [AlertSeverity.CRITICAL]: '#ef4444',
    };

    const alertUrl = `${appUrl}/alerts/${alert.alertId}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SQDIS Alert Notification</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${severityColors[alert.severity]}; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${alert.severity} Alert</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">SQDIS - Software Quality & Developer Intelligence System</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi ${recipientName},</p>
    
    <p>A <strong>${alert.severity}</strong> severity alert has been triggered in your organization:</p>
    
    <div style="background: white; border-left: 4px solid ${severityColors[alert.severity]}; padding: 15px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Type:</strong> ${alert.type}</p>
      <p style="margin: 0 0 10px 0;"><strong>Message:</strong> ${alert.message}</p>
      ${alert.anomalyScore !== undefined ? `<p style="margin: 0 0 10px 0;"><strong>Anomaly Score:</strong> ${(alert.anomalyScore * 100).toFixed(1)}%</p>` : ''}
      <p style="margin: 0;"><strong>Time:</strong> ${alert.createdAt.toISOString()}</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${alertUrl}" 
         style="background: ${severityColors[alert.severity]}; 
                color: white; 
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;">
        View Alert Details
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px;">
      You're receiving this email because you're an administrator of this organization.
      <br>
      <a href="${appUrl}/settings/notifications" style="color: #667eea;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email for alert notification
   */
  private getAlertEmailText(
    recipientName: string,
    alert: AlertNotificationData,
    appUrl: string,
  ): string {
    return `
SQDIS Alert Notification

Hi ${recipientName},

A ${alert.severity} severity alert has been triggered in your organization:

Type: ${alert.type}
Message: ${alert.message}
${alert.anomalyScore !== undefined ? `Anomaly Score: ${(alert.anomalyScore * 100).toFixed(1)}%` : ''}
Time: ${alert.createdAt.toISOString()}

View alert details: ${appUrl}/alerts/${alert.alertId}

---
You're receiving this email because you're an administrator of this organization.
Manage notification preferences: ${appUrl}/settings/notifications
    `.trim();
  }

  /**
   * Send Slack notification via webhook
   *
   * @param webhookUrl - Slack webhook URL
   * @param alert - Alert data
   * @returns Notification channel result
   */
  async sendSlackNotification(
    webhookUrl: string,
    alert: AlertNotificationData,
  ): Promise<NotificationChannelResult> {
    const severityEmoji = {
      [AlertSeverity.LOW]: ':information_source:',
      [AlertSeverity.MEDIUM]: ':warning:',
      [AlertSeverity.HIGH]: ':large_orange_diamond:',
      [AlertSeverity.CRITICAL]: ':red_circle:',
    };

    const severityColors = {
      [AlertSeverity.LOW]: '#3b82f6',
      [AlertSeverity.MEDIUM]: '#f59e0b',
      [AlertSeverity.HIGH]: '#f97316',
      [AlertSeverity.CRITICAL]: '#ef4444',
    };

    const appUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    const alertUrl = `${appUrl}/alerts/${alert.alertId}`;

    const payload = {
      text: `${severityEmoji[alert.severity]} *${alert.severity} Alert*: ${alert.type}`,
      attachments: [
        {
          color: severityColors[alert.severity],
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: alert.message,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Severity:*\n${alert.severity}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Type:*\n${alert.type}`,
                },
                ...(alert.anomalyScore !== undefined
                  ? [
                      {
                        type: 'mrkdwn',
                        text: `*Anomaly Score:*\n${(alert.anomalyScore * 100).toFixed(1)}%`,
                      },
                    ]
                  : []),
              ],
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'View Alert',
                  },
                  url: alertUrl,
                  style: 'primary',
                },
              ],
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack webhook returned ${response.status}`);
      }

      this.logger.log(`Slack notification sent for alert ${alert.alertId}`);
      return { channel: 'slack', success: true };
    } catch (error) {
      this.logger.error(`Failed to send Slack notification for alert ${alert.alertId}`, error);
      return {
        channel: 'slack',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create in-app notification for an alert
   *
   * @param userId - User to create notification for
   * @param alert - Alert data
   * @returns Notification channel result
   */
  async createInAppNotification(
    userId: string,
    alert: AlertNotificationData,
  ): Promise<NotificationChannelResult> {
    try {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          organizationId: alert.organizationId,
          type: NotificationType.ALERT,
          title: `${alert.severity} Alert: ${alert.type}`,
          message: alert.message,
          metadata: {
            alertId: alert.alertId,
            severity: alert.severity,
            type: alert.type,
            commitId: alert.commitId,
            anomalyScore: alert.anomalyScore,
          },
          isRead: false,
        },
      });

      // Emit event for real-time WebSocket notification
      this.eventEmitter.emit('notification.created', {
        notificationId: notification.id,
        userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
      });

      this.logger.debug(`In-app notification created for user ${userId}, alert ${alert.alertId}`);
      return { channel: 'inApp', success: true };
    } catch (error) {
      this.logger.error(`Failed to create in-app notification for user ${userId}`, error);
      return {
        channel: 'inApp',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle notification channel failures gracefully
   *
   * Logs failures but doesn't throw, allowing other channels to proceed
   * Returns aggregated results for monitoring
   */
  async sendNotificationsWithFallback(alert: AlertNotificationData): Promise<{
    totalSent: number;
    totalFailed: number;
    results: NotificationChannelResult[];
  }> {
    const results = await this.sendAlertNotifications(alert);

    const totalSent = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    if (totalFailed > 0) {
      this.logger.warn(
        `Alert ${alert.alertId}: ${totalFailed} notification(s) failed out of ${results.length}`,
      );

      // Log individual failures for debugging
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          this.logger.error(`Channel ${r.channel} failed: ${r.error}`);
        });
    }

    return { totalSent, totalFailed, results };
  }
}
