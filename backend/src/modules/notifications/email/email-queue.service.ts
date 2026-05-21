import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_QUEUE } from '../../../config/bullmq.config';
import { EmailJobType, EmailJobData } from './email.processor';
import {
  VerificationEmailData,
  InvitationEmailData,
  AlertEmailData,
  MilestoneEmailData,
  GoalAchievementEmailData,
  SprintReportEmailData,
} from './templates';

/**
 * Service for enqueueing email jobs
 */
@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue<EmailJobData>) {}

  /**
   * Queue a verification email
   * Send verification email with secure token
   */
  async queueVerificationEmail(to: string, data: VerificationEmailData): Promise<void> {
    await this.addJob(EmailJobType.VERIFICATION, to, data);
    this.logger.debug(`Queued verification email to ${to}`);
  }

  /**
   * Queue an invitation email
   * Send invitation with 7-day expiry
   */
  async queueInvitationEmail(to: string, data: InvitationEmailData): Promise<void> {
    await this.addJob(EmailJobType.INVITATION, to, data);
    this.logger.debug(`Queued invitation email to ${to}`);
  }

  /**
   * Queue an alert email
   * Send email notification for HIGH/CRITICAL alerts
   */
  async queueAlertEmail(to: string, data: AlertEmailData): Promise<void> {
    // Only send email for HIGH and CRITICAL alerts
    if (data.severity === 'HIGH' || data.severity === 'CRITICAL') {
      await this.addJob(EmailJobType.ALERT, to, data, { priority: 1 }); // High priority
      this.logger.debug(`Queued ${data.severity} alert email to ${to}`);
    }
  }

  /**
   * Queue a milestone notification email
   * Send notification on milestone achievement
   */
  async queueMilestoneEmail(to: string, data: MilestoneEmailData): Promise<void> {
    await this.addJob(EmailJobType.MILESTONE, to, data);
    this.logger.debug(`Queued milestone email to ${to}`);
  }

  /**
   * Queue a goal achievement email
   * Create achievement notification
   */
  async queueGoalAchievementEmail(to: string, data: GoalAchievementEmailData): Promise<void> {
    await this.addJob(EmailJobType.GOAL_ACHIEVEMENT, to, data);
    this.logger.debug(`Queued goal achievement email to ${to}`);
  }

  /**
   * Queue a sprint report email
   * Send notification to Team Lead
   */
  async queueSprintReportEmail(to: string, data: SprintReportEmailData): Promise<void> {
    await this.addJob(EmailJobType.SPRINT_REPORT, to, data);
    this.logger.debug(`Queued sprint report email to ${to}`);
  }

  /**
   * Add a job to the email queue
   */
  private async addJob(
    type: EmailJobType,
    to: string,
    data: EmailJobData['data'],
    options?: { priority?: number },
  ): Promise<void> {
    await this.emailQueue.add(
      type,
      { type, to, data },
      {
        priority: options?.priority,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
