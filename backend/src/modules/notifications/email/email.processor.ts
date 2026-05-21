import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from './email.service';
import { EMAIL_QUEUE } from '../../../config/bullmq.config';
import {
  verificationEmailTemplate,
  invitationEmailTemplate,
  alertEmailTemplate,
  milestoneEmailTemplate,
  goalAchievementEmailTemplate,
  sprintReportEmailTemplate,
  VerificationEmailData,
  InvitationEmailData,
  AlertEmailData,
  MilestoneEmailData,
  GoalAchievementEmailData,
  SprintReportEmailData,
} from './templates';

/**
 * Email job types
 */
export enum EmailJobType {
  VERIFICATION = 'verification',
  INVITATION = 'invitation',
  ALERT = 'alert',
  MILESTONE = 'milestone',
  GOAL_ACHIEVEMENT = 'goal_achievement',
  SPRINT_REPORT = 'sprint_report',
}

/**
 * Email job data interface
 */
export interface EmailJobData {
  type: EmailJobType;
  to: string;
  data:
    | VerificationEmailData
    | InvitationEmailData
    | AlertEmailData
    | MilestoneEmailData
    | GoalAchievementEmailData
    | SprintReportEmailData;
}

/**
 * Email job processor for BullMQ
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  /**
   * Process email sending job
   */
  async process(job: Job<EmailJobData>): Promise<boolean> {
    const { type, to, data } = job.data;
    this.logger.debug(`Processing email job ${job.id}: ${type} to ${to}`);

    try {
      const { subject, html } = this.generateEmail(type, data);

      await this.emailService.sendEmail({
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully: ${type} to ${to}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email ${type} to ${to}: ${errorMessage}`);
      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Generate email content based on type
   */
  private generateEmail(
    type: EmailJobType,
    data: EmailJobData['data'],
  ): { subject: string; html: string } {
    switch (type) {
      case EmailJobType.VERIFICATION:
        return {
          subject: 'Verify Your Email Address - SQDIS',
          html: verificationEmailTemplate(data as VerificationEmailData),
        };

      case EmailJobType.INVITATION:
        const invData = data as InvitationEmailData;
        return {
          subject: `You're invited to join ${invData.organizationName} on SQDIS`,
          html: invitationEmailTemplate(invData),
        };

      case EmailJobType.ALERT:
        const alertData = data as AlertEmailData;
        return {
          subject: `${alertData.severity} Alert - ${alertData.alertTitle}`,
          html: alertEmailTemplate(alertData),
        };

      case EmailJobType.MILESTONE:
        const milestoneData = data as MilestoneEmailData;
        return {
          subject: `${milestoneData.developerName} achieved a milestone!`,
          html: milestoneEmailTemplate(milestoneData),
        };

      case EmailJobType.GOAL_ACHIEVEMENT:
        const goalData = data as GoalAchievementEmailData;
        return {
          subject: `Goal Achieved: ${goalData.goalName}`,
          html: goalAchievementEmailTemplate(goalData),
        };

      case EmailJobType.SPRINT_REPORT:
        const sprintData = data as SprintReportEmailData;
        return {
          subject: `Sprint Report Ready: ${sprintData.sprintName}`,
          html: sprintReportEmailTemplate(sprintData),
        };

      default:
        throw new Error(`Unknown email type: ${type}`);
    }
  }

  /**
   * Handle job completion
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job<EmailJobData>) {
    this.logger.debug(`Email job ${job.id} completed: ${job.data.type} to ${job.data.to}`);
  }

  /**
   * Handle job failure
   * Handle email failures with retry
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<EmailJobData>, error: Error) {
    this.logger.error(
      `Email job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${error.message}`,
    );

    if (job.attemptsMade >= (job.opts.attempts || 5)) {
      this.logger.error(
        `Email job ${job.id} exhausted all retries: ${job.data.type} to ${job.data.to}`,
      );
    }
  }
}
