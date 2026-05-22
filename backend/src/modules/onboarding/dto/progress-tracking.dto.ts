import { MilestoneType, OnboardingStatus } from '@prisma/client';

/**
 * Dashboard statistics for onboarding progress tracking
 * Provides aggregate metrics across all active onboardings
 */
export class DashboardStatsDto {
  /**
   * Total number of developers currently in active onboarding
   */
  activeOnboardingCount!: number;

  /**
   * Achievement rates for each milestone type
   * Maps milestone type to achievement statistics
   */
  milestoneAchievementRates!: Record<
    MilestoneType,
    {
      achieved: number; // Number of developers who achieved this milestone
      total: number; // Total number of active onboardings
      rate: number; // Achievement rate (achieved / total)
    }
  >;

  /**
   * Average days to achieve each milestone type
   * Only includes developers who have achieved the milestone
   */
  averageDaysToMilestone!: Record<
    MilestoneType,
    {
      avgDays: number; // Average days from onboarding start to milestone achievement
      count: number; // Number of developers included in the average
    }
  >;

  /**
   * Number of developers identified as at-risk
   */
  atRiskCount!: number;
}

/**
 * Information about a developer who is at risk during onboarding
 * At-risk criteria: no FIRST_COMMIT after 7 days OR no FIRST_REVIEW after 14 days
 */
export class AtRiskDeveloperDto {
  /**
   * User ID of the at-risk developer
   */
  userId!: string;

  /**
   * Display name of the developer
   */
  userName!: string;

  /**
   * Date when onboarding started
   */
  onboardingStartDate!: Date;

  /**
   * Number of days elapsed since onboarding start
   */
  daysElapsed!: number;

  /**
   * List of milestone types that have been achieved
   */
  achievedMilestones!: MilestoneType[];

  /**
   * List of milestone types that are expected but not yet achieved
   */
  missingMilestones!: MilestoneType[];

  /**
   * Human-readable descriptions of why this developer is at risk
   * Examples: "No first commit after 7 days", "No first review after 14 days"
   */
  riskFactors!: string[];
}

/**
 * Detailed progress information for an individual developer
 * Includes milestone achievements, timing comparisons, and mentor information
 */
export class DeveloperProgressDto {
  /**
   * User ID of the developer
   */
  userId!: string;

  /**
   * Display name of the developer
   */
  userName!: string;

  /**
   * Date when onboarding started
   */
  onboardingStartDate!: Date;

  /**
   * Date when onboarding is scheduled to end
   */
  onboardingEndDate!: Date;

  /**
   * Number of days elapsed since onboarding start
   */
  daysElapsed!: number;

  /**
   * Current onboarding status (ACTIVE, COMPLETED, etc.)
   */
  status!: OnboardingStatus;

  /**
   * User ID of assigned mentor (if any)
   */
  mentorId?: string;

  /**
   * Display name of assigned mentor (if any)
   */
  mentorName?: string;

  /**
   * Detailed milestone achievement information
   * Includes both achieved and unachieved milestones
   */
  milestones!: {
    type: MilestoneType;
    achievedAt?: Date; // Undefined for unachieved milestones
    daysToAchieve?: number; // Days from onboarding start to achievement (undefined for unachieved)
    comparedToCohort: 'faster' | 'average' | 'slower' | 'not_achieved';
  }[];
}

/**
 * Single entry in a milestone timeline
 * Represents one milestone achievement with timing information
 */
export class MilestoneTimelineEntryDto {
  /**
   * Type of milestone achieved
   */
  milestoneType!: MilestoneType;

  /**
   * Timestamp when the milestone was achieved
   */
  achievedAt!: Date;

  /**
   * Number of days from onboarding start to this milestone
   */
  daysSinceStart!: number;

  /**
   * Number of days since the previous milestone (undefined for first milestone)
   */
  daysSincePrevious?: number;
}

/**
 * Mentor capacity and availability information
 * Tracks current mentee count and available capacity
 */
export class MentorCapacityDto {
  /**
   * User ID of the mentor
   */
  mentorId!: string;

  /**
   * Display name of the mentor
   */
  mentorName!: string;

  /**
   * Current number of active mentees
   */
  currentMenteeCount!: number;

  /**
   * Maximum number of mentees allowed (typically 3)
   */
  maxCapacity!: number;

  /**
   * Number of additional mentees this mentor can take
   * Calculated as max(0, maxCapacity - currentMenteeCount)
   */
  availableCapacity!: number;

  /**
   * Whether this mentor is available to take new mentees
   * False when currentMenteeCount >= maxCapacity
   */
  isAvailable!: boolean;

  /**
   * List of current active mentees
   */
  activeMentees!: {
    userId: string;
    userName: string;
    onboardingStartDate: Date;
  }[];
}
