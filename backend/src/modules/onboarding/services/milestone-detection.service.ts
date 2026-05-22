import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { Onboarding, OnboardingMilestone, MilestoneType, OnboardingStatus } from '@prisma/client';
import type {
  CommitProcessedEvent,
  ReviewSubmittedEvent,
  PrMergedEvent,
  MilestoneAchievedEvent,
} from '../interfaces/milestone-events.interface';

/**
 * Milestone Detection Service
 *
 * Listens to commit and review events to automatically detect milestone achievements
 * for onboarding developers. When a milestone is detected, it creates a milestone
 * record and publishes a milestone.achieved event.
 *
 */
@Injectable()
export class MilestoneDetectionService {
  private readonly logger = new Logger(MilestoneDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle commit.processed events
   */
  @OnEvent('commit.processed')
  async handleCommitProcessed(event: CommitProcessedEvent): Promise<void> {
    this.logger.debug(`Received commit.processed event for commit ${event.commitId}`);

    // Event payload validation
    if (!event.developerId) {
      this.logger.debug(
        `Skipping milestone detection for commit ${event.commitId}: no developerId`,
      );
      return;
    }

    if (!event.classification && event.classification !== null) {
      this.logger.warn(
        `Invalid event payload for commit ${event.commitId}: classification field missing`,
      );
      return;
    }

    try {
      await this.detectCommitMilestones(event.developerId, event.classification, event.commitId);
    } catch (error: any) {
      // Error handling for database failures
      this.logger.error(
        `Error processing commit milestone detection for commit ${event.commitId}: ${error.message}`,
        error.stack,
      );
      // Continue processing - don't throw to avoid blocking event handling
    }
  }

  /**
   * Handle review.submitted events
   */
  @OnEvent('review.submitted')
  async handleReviewSubmitted(event: ReviewSubmittedEvent): Promise<void> {
    this.logger.debug(`Received review.submitted event for review ${event.reviewId}`);

    // Event payload validation
    if (!event.reviewerId) {
      this.logger.debug(`Skipping milestone detection for review ${event.reviewId}: no reviewerId`);
      return;
    }

    try {
      await this.detectReviewMilestones(event.reviewerId, event.reviewId);
    } catch (error: any) {
      // Error handling for database failures
      this.logger.error(
        `Error processing review milestone detection for review ${event.reviewId}: ${error.message}`,
        error.stack,
      );
      // Continue processing - don't throw to avoid blocking event handling
    }
  }

  /**
   * Handle pr.merged events
   */
  @OnEvent('pr.merged')
  async handlePrMerged(event: PrMergedEvent): Promise<void> {
    this.logger.debug(`Received pr.merged event for PR ${event.prNumber}`);

    // Event payload validation
    if (!event.authorId) {
      this.logger.debug(`Skipping milestone detection for PR ${event.prNumber}: no authorId`);
      return;
    }

    try {
      await this.detectPrMergedMilestone(event.authorId, event.prId);
    } catch (error: any) {
      // Error handling for database failures
      this.logger.error(
        `Error processing PR merged milestone detection for PR ${event.prNumber}: ${error.message}`,
        error.stack,
      );
      // Continue processing - don't throw to avoid blocking event handling
    }
  }

  /**
   * Detect commit-related milestones
   * Checks for FIRST_COMMIT and classification-based milestones (BUGFIX, TEST, FEATURE)
   */
  private async detectCommitMilestones(
    developerId: string,
    classification: string | null,
    commitId: string,
  ): Promise<void> {
    // Get active onboarding for developer 
    const onboarding = await this.getActiveOnboarding(developerId);
    if (!onboarding) {
      this.logger.debug(`No active onboarding found for developer ${developerId}`);
      return;
    }

    // Check FIRST_COMMIT milestone 
    if (!(await this.milestoneExists(onboarding.id, MilestoneType.FIRST_COMMIT))) {
      const milestone = await this.createMilestone(onboarding.id, MilestoneType.FIRST_COMMIT);
      if (milestone) {
        this.publishMilestoneAchieved(milestone, onboarding);
      }
    }

    // Check classification-based milestones
    if (classification) {
      const classificationUpper = classification.toUpperCase();

      // FIRST_BUGFIX milestone
      if (
        classificationUpper === 'BUGFIX' &&
        !(await this.milestoneExists(onboarding.id, MilestoneType.FIRST_BUGFIX))
      ) {
        const milestone = await this.createMilestone(onboarding.id, MilestoneType.FIRST_BUGFIX);
        if (milestone) {
          this.publishMilestoneAchieved(milestone, onboarding);
        }
      }

      // FIRST_TEST milestone
      if (
        classificationUpper === 'TEST' &&
        !(await this.milestoneExists(onboarding.id, MilestoneType.FIRST_TEST))
      ) {
        const milestone = await this.createMilestone(onboarding.id, MilestoneType.FIRST_TEST);
        if (milestone) {
          this.publishMilestoneAchieved(milestone, onboarding);
        }
      }

      // FIRST_FEATURE milestone
      if (
        classificationUpper === 'FEATURE' &&
        !(await this.milestoneExists(onboarding.id, MilestoneType.FIRST_FEATURE))
      ) {
        const milestone = await this.createMilestone(onboarding.id, MilestoneType.FIRST_FEATURE);
        if (milestone) {
          this.publishMilestoneAchieved(milestone, onboarding);
        }
      }
    }
  }

  /**
   * Detect review-related milestones
   * Checks for FIRST_REVIEW milestone
   */
  private async detectReviewMilestones(reviewerId: string, reviewId: string): Promise<void> {
    // Get active onboarding for reviewer
    const onboarding = await this.getActiveOnboarding(reviewerId);
    if (!onboarding) {
      this.logger.debug(`No active onboarding found for reviewer ${reviewerId}`);
      return;
    }

    // Check FIRST_REVIEW milestone
    if (!(await this.milestoneExists(onboarding.id, MilestoneType.FIRST_REVIEW))) {
      const milestone = await this.createMilestone(onboarding.id, MilestoneType.FIRST_REVIEW);
      if (milestone) {
        this.publishMilestoneAchieved(milestone, onboarding);
      }
    }
  }

  /**
   * Detect PR merged milestone
   * Checks for FIRST_PR_MERGED milestone
   */
  private async detectPrMergedMilestone(authorId: string, prId: string): Promise<void> {
    // Get active onboarding for PR author
    const onboarding = await this.getActiveOnboarding(authorId);
    if (!onboarding) {
      this.logger.debug(`No active onboarding found for PR author ${authorId}`);
      return;
    }

    // Check FIRST_PR_MERGED milestone
    if (!(await this.milestoneExists(onboarding.id, MilestoneType.FIRST_PR_MERGED))) {
      const milestone = await this.createMilestone(onboarding.id, MilestoneType.FIRST_PR_MERGED);
      if (milestone) {
        this.publishMilestoneAchieved(milestone, onboarding);
      }
    }
  }

  /**
   * Get active onboarding for a user
   * Returns the active onboarding record if one exists, null otherwise
   */
  private async getActiveOnboarding(userId: string) {
    try {
      const onboarding = await this.prisma.onboarding.findFirst({
        where: {
          userId,
          status: OnboardingStatus.ACTIVE,
        },
        include: {
          user: {
            include: {
              memberships: true,
            },
          },
          mentor: true,
        },
      });

      return onboarding;
    } catch (error: any) {
      this.logger.error(
        `Error fetching active onboarding for user ${userId}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Check if a milestone already exists for an onboarding
   */
  private async milestoneExists(onboardingId: string, type: MilestoneType): Promise<boolean> {
    try {
      const milestone = await this.prisma.onboardingMilestone.findUnique({
        where: {
          onboardingId_type: {
            onboardingId,
            type,
          },
        },
      });

      return milestone !== null;
    } catch (error: any) {
      this.logger.error(
        `Error checking milestone existence for onboarding ${onboardingId}, type ${type}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Create a milestone record
   * Returns the created milestone or null if creation fails or milestone already exists
   */
  private async createMilestone(
    onboardingId: string,
    type: MilestoneType,
  ): Promise<OnboardingMilestone | null> {
    try {
      const milestone = await this.prisma.onboardingMilestone.create({
        data: {
          onboardingId,
          type,
          achievedAt: new Date(),
        },
      });

      this.logger.log(`Created milestone ${type} for onboarding ${onboardingId}`);

      return milestone;
    } catch (error: any) {
      // Unique constraint violation is expected (idempotency) - log as debug
      if (error.code === 'P2002') {
        this.logger.debug(`Milestone ${type} already exists for onboarding ${onboardingId}`);
      } else {
        // Other database errors - log as error
        this.logger.error(
          `Error creating milestone ${type} for onboarding ${onboardingId}: ${error.message}`,
          error.stack,
        );
      }
      return null;
    }
  }

  /**
   * Publish milestone.achieved event
   */
  private publishMilestoneAchieved(milestone: OnboardingMilestone, onboarding: any): void {
    const event: MilestoneAchievedEvent = {
      milestoneId: milestone.id,
      onboardingId: milestone.onboardingId,
      userId: onboarding.userId,
      organizationId: onboarding.user.memberships?.[0]?.organizationId || 'unknown',
      milestoneType: milestone.type,
      achievedAt: milestone.achievedAt,
      userName: onboarding.user.name,
      mentorId: onboarding.mentorId ?? undefined,
    };

    this.eventEmitter.emit('milestone.achieved', event);
    this.logger.log(
      `Published milestone.achieved event for ${milestone.type} - user ${onboarding.user.name}`,
    );
  }
}
