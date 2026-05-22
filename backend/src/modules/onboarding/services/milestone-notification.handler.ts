import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailQueueService } from '../../notifications/email/email-queue.service';
import type { MilestoneAchievedEvent } from '../interfaces/milestone-events.interface';
import { MilestoneType, NotificationType } from '@prisma/client';

/**
 * Milestone Notification Handler
 *
 * Listens to milestone.achieved events and creates notifications for developers and mentors.
 * Sends both in-app notifications and email notifications.
 *
 */
@Injectable()
export class MilestoneNotificationHandler {
  private readonly logger = new Logger(MilestoneNotificationHandler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly emailQueueService: EmailQueueService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Handle milestone.achieved events
   * Creates notifications for both the developer and their mentor (if assigned)
   */
  @OnEvent('milestone.achieved')
  async handleMilestoneAchieved(event: MilestoneAchievedEvent): Promise<void> {
    this.logger.debug(
      `Received milestone.achieved event for ${event.milestoneType} - user ${event.userName}`,
    );

    try {
      // Create developer notifications
      await this.createDeveloperNotifications(
        event.userId,
        event.organizationId,
        event.milestoneType,
        event.achievedAt,
      );

      // Create mentor notifications if mentor assigned
      if (event.mentorId) {
        await this.createMentorNotifications(
          event.mentorId,
          event.organizationId,
          event.milestoneType,
          event.userName,
          event.achievedAt,
        );
      }
    } catch (error: any) {
      // Error handling for notification failures
      this.logger.error(
        `Error handling milestone.achieved event for ${event.milestoneType} - user ${event.userName}: ${error.message}`,
        error.stack,
      );
      // Continue processing - don't throw to avoid blocking event handling
    }
  }

  /**
   * Create notifications for the developer who achieved the milestone
   * Creates both in-app and email notifications
   */
  private async createDeveloperNotifications(
    userId: string,
    organizationId: string,
    milestoneType: MilestoneType,
    achievedAt: Date,
  ): Promise<void> {
    // Validate achievedAt date
    if (!achievedAt || isNaN(achievedAt.getTime())) {
      this.logger.warn(`Invalid achievedAt date for user ${userId}, milestone ${milestoneType}`);
      return;
    }

    // Get user details
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found for milestone notification`);
      return;
    }

    // Format milestone message
    const { title, message } = this.formatMilestoneMessage(milestoneType);

    try {
      // Create in-app notification
      await this.notificationsService.create({
        userId,
        organizationId,
        type: NotificationType.MILESTONE_ACHIEVED,
        title,
        message,
        metadata: {
          milestoneType,
          achievedAt: achievedAt.toISOString(),
        },
      });

      this.logger.debug(`Created in-app notification for user ${userId}`);
    } catch (error: any) {
      this.logger.error(
        `Error creating in-app notification for user ${userId}: ${error.message}`,
        error.stack,
      );
    }

    try {
      // Send email notification 
      await this.sendMilestoneEmail(user.email, user.name, milestoneType, achievedAt);

      this.logger.debug(`Queued email notification for user ${userId}`);
    } catch (error: any) {
      this.logger.error(
        `Error sending email notification for user ${userId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create notifications for the mentor of the developer who achieved the milestone
   * Creates in-app notification with mentee information
   */
  private async createMentorNotifications(
    mentorId: string,
    organizationId: string,
    milestoneType: MilestoneType,
    developerName: string,
    achievedAt: Date,
  ): Promise<void> {
    // Validate achievedAt date
    if (!achievedAt || isNaN(achievedAt.getTime())) {
      this.logger.warn(
        `Invalid achievedAt date for mentor ${mentorId}, milestone ${milestoneType}`,
      );
      return;
    }

    // Get mentor details
    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { name: true, email: true },
    });

    if (!mentor) {
      this.logger.warn(`Mentor ${mentorId} not found for milestone notification`);
      return;
    }

    // Format mentor notification message
    const { title, message } = this.formatMilestoneMessage(milestoneType, developerName);

    try {
      // Create in-app notification for mentor
      await this.notificationsService.create({
        userId: mentorId,
        organizationId,
        type: NotificationType.MENTEE_MILESTONE,
        title,
        message,
        metadata: {
          milestoneType,
          developerName,
          achievedAt: achievedAt.toISOString(),
        },
      });

      this.logger.debug(`Created mentor notification for mentor ${mentorId}`);
    } catch (error: any) {
      this.logger.error(
        `Error creating mentor notification for mentor ${mentorId}: ${error.message}`,
        error.stack,
      );
    }

    try {
      // Send email notification to mentor
      await this.sendMentorMilestoneEmail(
        mentor.email,
        mentor.name,
        developerName,
        milestoneType,
        achievedAt,
      );

      this.logger.debug(`Queued mentor email notification for mentor ${mentorId}`);
    } catch (error: any) {
      this.logger.error(
        `Error sending mentor email notification for mentor ${mentorId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send milestone achievement email to developer
   */
  private async sendMilestoneEmail(
    userEmail: string,
    userName: string,
    milestoneType: MilestoneType,
    achievedAt: Date,
  ): Promise<void> {
    const appBaseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');

    const milestoneDescription = this.getMilestoneDescription(milestoneType);

    await this.emailQueueService.queueMilestoneEmail(userEmail, {
      mentorName: userName, // For developer emails, we use their own name
      developerName: userName,
      milestoneType: this.formatMilestoneTypeName(milestoneType),
      milestoneDescription,
      dashboardUrl: `${appBaseUrl}/onboarding/progress`,
    });
  }

  /**
   * Send milestone achievement email to mentor
   */
  private async sendMentorMilestoneEmail(
    mentorEmail: string,
    mentorName: string,
    developerName: string,
    milestoneType: MilestoneType,
    achievedAt: Date,
  ): Promise<void> {
    const appBaseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');

    const milestoneDescription = this.getMilestoneDescription(milestoneType);

    await this.emailQueueService.queueMilestoneEmail(mentorEmail, {
      mentorName,
      developerName,
      milestoneType: this.formatMilestoneTypeName(milestoneType),
      milestoneDescription,
      dashboardUrl: `${appBaseUrl}/onboarding/mentees`,
    });
  }

  /**
   * Format milestone message for notifications
   * Returns title and message based on milestone type
   */
  private formatMilestoneMessage(
    milestoneType: MilestoneType,
    developerName?: string,
  ): { title: string; message: string } {
    const milestoneTypeName = this.formatMilestoneTypeName(milestoneType);

    if (developerName) {
      // Mentor notification format
      return {
        title: 'Mentee Milestone Achieved',
        message: `${developerName} achieved ${milestoneTypeName} milestone`,
      };
    } else {
      // Developer notification format
      return {
        title: 'Milestone Achieved!',
        message: `Congratulations! You achieved ${milestoneTypeName} milestone`,
      };
    }
  }

  /**
   * Format milestone type name for display
   */
  private formatMilestoneTypeName(milestoneType: MilestoneType): string {
    const typeNames: Record<MilestoneType, string> = {
      FIRST_COMMIT: 'First Commit',
      FIRST_BUGFIX: 'First Bugfix',
      FIRST_FEATURE: 'First Feature',
      FIRST_REVIEW: 'First Review',
      FIRST_PR_MERGED: 'First PR Merged',
      FIRST_TEST: 'First Test',
    };

    return typeNames[milestoneType] || milestoneType;
  }

  /**
   * Get milestone description for email templates
   */
  private getMilestoneDescription(milestoneType: MilestoneType): string {
    const descriptions: Record<MilestoneType, string> = {
      FIRST_COMMIT: 'Made their first commit to the codebase',
      FIRST_BUGFIX: 'Fixed their first bug',
      FIRST_FEATURE: 'Implemented their first feature',
      FIRST_REVIEW: 'Completed their first code review',
      FIRST_PR_MERGED: 'Had their first pull request merged',
      FIRST_TEST: 'Wrote their first test',
    };

    return descriptions[milestoneType] || 'Achieved a milestone';
  }
}
