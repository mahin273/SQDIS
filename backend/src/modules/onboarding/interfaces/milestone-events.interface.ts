import { MilestoneType } from '@prisma/client';

/**
 * Event interfaces for milestone tracking
 * These events are emitted by various services and consumed by the milestone detection system
 */

/**
 * Event emitted when a commit is processed by the commits service
 * This event is already defined in websocket-events.service.ts
 * Included here for reference and type safety in milestone detection
 */
export interface CommitProcessedEvent {
  commitId: string;
  sha: string;
  repositoryId: string;
  organizationId: string;
  developerId?: string; // May be null for unmapped commits
  authorName: string;
  authorEmail: string;
  classification: string | null;
  message: string;
  timestamp: Date;
}

/**
 * Event emitted when a code review is submitted
 */
export interface ReviewSubmittedEvent {
  reviewId: string;
  repositoryId: string;
  organizationId: string;
  reviewerId?: string; // May be null for unmapped reviewers
  prNumber: number;
  prTitle: string;
  submittedAt: Date;
}

/**
 * Event emitted when a pull request is merged
 */
export interface PrMergedEvent {
  prId: string;
  prNumber: number;
  repositoryId: string;
  organizationId: string;
  authorId?: string; // May be null for unmapped authors
  mergedAt: Date;
}

/**
 * Event emitted when a milestone is achieved by an onboarding developer
 */
export interface MilestoneAchievedEvent {
  milestoneId: string;
  onboardingId: string;
  userId: string;
  organizationId: string;
  milestoneType: MilestoneType;
  achievedAt: Date;
  userName: string;
  mentorId?: string;
}
