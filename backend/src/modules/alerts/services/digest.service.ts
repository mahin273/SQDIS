import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { PrismaService } from '../../../prisma';
import { AlertSeverity, AlertType } from '@prisma/client';
import { AlertNotificationData } from './notification.service';

/**
 * Interface for digest summary
 */
export interface DigestSummary {
  userId: string;
  userEmail: string;
  userName: string;
  organizationId: string;
  alerts: Array<{
    alertId: string;
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    createdAt: Date;
  }>;
  severityCounts: {
    LOW: number;
    MEDIUM: number;
    HIGH: number;
    CRITICAL: number;
  };
}

/**
 * Service for managing digest mode notifications
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);
  private transporter: Transporter | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter for sending digest notifications
   */
  private initializeEmailTransporter(): void {
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!user || !pass) {
      this.logger.warn('SMTP credentials not configured. Digest emails will be disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      this.logger.log('Digest email transporter initialized');
    } catch (error) {
      this.logger.error('Failed to initialize digest email transporter', error);
    }
  }

  /**
   * Queue an alert for digest notification
   */
  async queueForDigest(
    userId: string,
    organizationId: string,
    alert: AlertNotificationData,
  ): Promise<void> {
    try {
      await this.prisma.digestQueue.create({
        data: {
          userId,
          organizationId,
          alertId: alert.alertId,
          alertType: alert.type as AlertType,
          alertSeverity: alert.severity,
          alertMessage: alert.message,
          alertCreatedAt: alert.createdAt,
          processed: false,
        },
      });
      this.logger.debug(`Queued alert ${alert.alertId} for digest to user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to queue alert ${alert.alertId} for digest`, error);
    }
  }

  /**
   * Process hourly digests
   * Runs every hour at minute 0
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processHourlyDigests(): Promise<void> {
    this.logger.log('Processing hourly digests...');
    await this.processDigests('hourly');
  }

  /**
   * Process daily digests
   * Runs every day at 9:00 AM
   */
  @Cron('0 9 * * *')
  async processDailyDigests(): Promise<void> {
    this.logger.log('Processing daily digests...');
    await this.processDigests('daily');
  }

  /**
   * Process weekly digests
   * Runs every Monday at 9:00 AM
   */
  @Cron('0 9 * * 1')
  async processWeeklyDigests(): Promise<void> {
    this.logger.log('Processing weekly digests...');
    await this.processDigests('weekly');
  }

  /**
   * Process digests for a specific frequency
   */
  private async processDigests(frequency: string): Promise<void> {
    try {
      // Get users with digest mode enabled and matching frequency
      const usersWithDigest = await this.prisma.notificationPreference.findMany({
        where: {
          digestMode: true,
          digestFrequency: frequency,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      if (usersWithDigest.length === 0) {
        this.logger.debug(`No users with ${frequency} digest mode enabled`);
        return;
      }

      for (const pref of usersWithDigest) {
        await this.sendDigestForUser(pref.userId, pref.user.email, pref.user.name);
      }

      this.logger.log(`Processed ${frequency} digests for ${usersWithDigest.length} users`);
    } catch (error) {
      this.logger.error(`Failed to process ${frequency} digests`, error);
    }
  }

  /**
   * Send digest email for a specific user
   */
  private async sendDigestForUser(
    userId: string,
    userEmail: string,
    userName: string,
  ): Promise<void> {
    // Get unprocessed digest items for this user
    const pendingItems = await this.prisma.digestQueue.findMany({
      where: {
        userId,
        processed: false,
      },
      orderBy: { alertCreatedAt: 'desc' },
    });

    if (pendingItems.length === 0) {
      this.logger.debug(`No pending digest items for user ${userId}`);
      return;
    }

    // Group by organization
    const byOrg = new Map<string, typeof pendingItems>();
    for (const item of pendingItems) {
      const existing = byOrg.get(item.organizationId) || [];
      existing.push(item);
      byOrg.set(item.organizationId, existing);
    }

    // Send digest for each organization
    for (const [orgId, items] of byOrg) {
      const summary = this.buildDigestSummary(userId, userEmail, userName, orgId, items);
      await this.sendDigestEmail(summary);
    }

    // Mark items as processed
    await this.prisma.digestQueue.updateMany({
      where: {
        id: { in: pendingItems.map((i) => i.id) },
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    this.logger.log(`Sent digest with ${pendingItems.length} alerts to ${userEmail}`);
  }

  /**
   * Build digest summary from pending items
   */
  private buildDigestSummary(
    userId: string,
    userEmail: string,
    userName: string,
    organizationId: string,
    items: Array<{
      alertId: string;
      alertType: AlertType;
      alertSeverity: AlertSeverity;
      alertMessage: string;
      alertCreatedAt: Date;
    }>,
  ): DigestSummary {
    const severityCounts = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0,
    };

    const alerts = items.map((item) => {
      severityCounts[item.alertSeverity]++;
      return {
        alertId: item.alertId,
        type: item.alertType,
        severity: item.alertSeverity,
        message: item.alertMessage,
        createdAt: item.alertCreatedAt,
      };
    });

    return {
      userId,
      userEmail,
      userName,
      organizationId,
      alerts,
      severityCounts,
    };
  }

  /**
   * Send digest email
   */
  private async sendDigestEmail(summary: DigestSummary): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        `Digest email disabled. Would send ${summary.alerts.length} alerts to ${summary.userEmail}`,
      );
      return;
    }

    const fromEmail = this.configService.get<string>('SMTP_FROM', 'noreply@sqdis.com');
    const appUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');

    const mailOptions = {
      from: `"SQDIS Alerts" <${fromEmail}>`,
      to: summary.userEmail,
      subject: this.getDigestSubject(summary),
      html: this.getDigestEmailTemplate(summary, appUrl),
      text: this.getDigestEmailText(summary, appUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Digest email sent to ${summary.userEmail}`);
    } catch (error) {
      this.logger.error(`Failed to send digest email to ${summary.userEmail}`, error);
    }
  }

  /**
   * Get digest email subject
   */
  private getDigestSubject(summary: DigestSummary): string {
    const total = summary.alerts.length;
    const critical = summary.severityCounts.CRITICAL;
    const high = summary.severityCounts.HIGH;

    if (critical > 0) {
      return `🔴 SQDIS Alert Digest: ${total} alerts (${critical} critical)`;
    } else if (high > 0) {
      return `🔶 SQDIS Alert Digest: ${total} alerts (${high} high priority)`;
    }
    return `📊 SQDIS Alert Digest: ${total} alerts`;
  }

  /**
   * Generate HTML email template for digest
   */
  private getDigestEmailTemplate(summary: DigestSummary, appUrl: string): string {
    const severityColors = {
      LOW: '#3b82f6',
      MEDIUM: '#f59e0b',
      HIGH: '#f97316',
      CRITICAL: '#ef4444',
    };

    const alertRows = summary.alerts
      .map(
        (alert) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <span style="background: ${severityColors[alert.severity]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
              ${alert.severity}
            </span>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${alert.type}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${alert.message}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">
            <a href="${appUrl}/alerts/${alert.alertId}" style="color: #667eea;">View</a>
          </td>
        </tr>
      `,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SQDIS Alert Digest</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: #667eea; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Alert Digest</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">SQDIS - Software Quality & Developer Intelligence System</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p>Hi ${summary.userName},</p>
    
    <p>Here's your alert digest with <strong>${summary.alerts.length}</strong> alerts:</p>
    
    <div style="display: flex; gap: 10px; margin: 20px 0;">
      <div style="background: #ef4444; color: white; padding: 10px 15px; border-radius: 5px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold;">${summary.severityCounts.CRITICAL}</div>
        <div style="font-size: 12px;">Critical</div>
      </div>
      <div style="background: #f97316; color: white; padding: 10px 15px; border-radius: 5px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold;">${summary.severityCounts.HIGH}</div>
        <div style="font-size: 12px;">High</div>
      </div>
      <div style="background: #f59e0b; color: white; padding: 10px 15px; border-radius: 5px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold;">${summary.severityCounts.MEDIUM}</div>
        <div style="font-size: 12px;">Medium</div>
      </div>
      <div style="background: #3b82f6; color: white; padding: 10px 15px; border-radius: 5px; text-align: center;">
        <div style="font-size: 24px; font-weight: bold;">${summary.severityCounts.LOW}</div>
        <div style="font-size: 12px;">Low</div>
      </div>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 5px; overflow: hidden;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th style="padding: 10px; text-align: left;">Severity</th>
          <th style="padding: 10px; text-align: left;">Type</th>
          <th style="padding: 10px; text-align: left;">Message</th>
          <th style="padding: 10px; text-align: left;">Action</th>
        </tr>
      </thead>
      <tbody>
        ${alertRows}
      </tbody>
    </table>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${appUrl}/alerts" 
         style="background: #667eea; 
                color: white; 
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;">
        View All Alerts
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #666; font-size: 14px;">
      You're receiving this digest because you have digest mode enabled.
      <br>
      <a href="${appUrl}/settings/notifications" style="color: #667eea;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email for digest
   */
  private getDigestEmailText(summary: DigestSummary, appUrl: string): string {
    const alertList = summary.alerts
      .map((a) => `- [${a.severity}] ${a.type}: ${a.message}`)
      .join('\n');

    return `
SQDIS Alert Digest

Hi ${summary.userName},

Here's your alert digest with ${summary.alerts.length} alerts:

Summary:
- Critical: ${summary.severityCounts.CRITICAL}
- High: ${summary.severityCounts.HIGH}
- Medium: ${summary.severityCounts.MEDIUM}
- Low: ${summary.severityCounts.LOW}

Alerts:
${alertList}

View all alerts: ${appUrl}/alerts

---
You're receiving this digest because you have digest mode enabled.
Manage notification preferences: ${appUrl}/settings/notifications
    `.trim();
  }

  /**
   * Clean up old processed digest items (older than 30 days)
   * Runs daily at midnight
   */
  @Cron('0 0 * * *')
  async cleanupOldDigestItems(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const result = await this.prisma.digestQueue.deleteMany({
        where: {
          processed: true,
          processedAt: { lt: thirtyDaysAgo },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} old digest items`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old digest items', error);
    }
  }
}
