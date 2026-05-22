// Progress Tracking Service - Fixed TypeScript errors
import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MilestoneType, OnboardingStatus } from '@prisma/client';
import {
  DashboardStatsDto,
  AtRiskDeveloperDto,
  DeveloperProgressDto,
  MilestoneTimelineEntryDto,
  MentorCapacityDto,
} from '../dto/progress-tracking.dto';

/**
 * Progress Tracking Service
 *
 * Provides analytics and dashboard data for onboarding progress tracking.
 * Calculates statistics, identifies at-risk developers, and tracks mentor capacity.
 *
 */
@Injectable()
export class ProgressTrackingService {
  private readonly logger = new Logger(ProgressTrackingService.name);

  // Configuration constants
  private readonly AT_RISK_FIRST_COMMIT_DAYS = 7;
  private readonly AT_RISK_FIRST_REVIEW_DAYS = 14;
  private readonly MAX_MENTOR_CAPACITY = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get dashboard statistics for an organization
   * Calculates active onboarding count, milestone achievement rates,
   * average days to milestones, and at-risk developer count
   *
   */
  async getDashboardStats(organizationId: string): Promise<DashboardStatsDto> {
    this.logger.debug(`Getting dashboard stats for organization ${organizationId}`);

    // Get all active onboardings with their milestones
    const activeOnboardings = await this.prisma.onboarding.findMany({
      where: {
        user: {
          memberships: {
            some: {
              organizationId,
            },
          },
        },
        status: OnboardingStatus.ACTIVE,
      },
      include: {
        milestones: true,
        user: true,
      },
    });

    const activeOnboardingCount = activeOnboardings.length;

    // Calculate milestone achievement rates
    const milestoneAchievementRates = this.calculateMilestoneAchievementRates(activeOnboardings);

    // Calculate average days to each milestone
    const averageDaysToMilestone = this.calculateMilestoneAverages(activeOnboardings);

    // Count at-risk developers
    const atRiskCount = activeOnboardings.filter((onboarding) =>
      this.isAtRisk(onboarding, onboarding.milestones),
    ).length;

    return {
      activeOnboardingCount,
      milestoneAchievementRates,
      averageDaysToMilestone,
      atRiskCount,
    };
  }

  /**
   * Get list of at-risk developers for an organization
   * Identifies developers who haven't achieved expected milestones within thresholds
   *
   */
  async getAtRiskDevelopers(organizationId: string): Promise<AtRiskDeveloperDto[]> {
    this.logger.debug(`Getting at-risk developers for organization ${organizationId}`);

    const activeOnboardings = await this.prisma.onboarding.findMany({
      where: {
        user: {
          memberships: {
            some: {
              organizationId,
            },
          },
        },
        status: OnboardingStatus.ACTIVE,
      },
      include: {
        milestones: true,
        user: true,
      },
    });

    const atRiskDevelopers: AtRiskDeveloperDto[] = [];

    for (const onboarding of activeOnboardings) {
      if (this.isAtRisk(onboarding, onboarding.milestones)) {
        const daysElapsed = this.calculateDaysElapsed(onboarding.startDate);
        const achievedMilestones = onboarding.milestones.map((m: { type: any }) => m.type);
        const riskFactors = this.calculateRiskFactors(daysElapsed, achievedMilestones);

        atRiskDevelopers.push({
          userId: onboarding.userId,
          userName: onboarding.user.name,
          onboardingStartDate: onboarding.startDate,
          daysElapsed,
          achievedMilestones,
          missingMilestones: this.getMissingMilestones(achievedMilestones),
          riskFactors,
        });
      }
    }

    return atRiskDevelopers;
  }

  /**
   * Get detailed progress for an individual developer
   * Returns milestone achievements, timing comparisons, and mentor information
   *
   */
  async getDeveloperProgress(
    userId: string,
    organizationId?: string,
  ): Promise<DeveloperProgressDto> {
    this.logger.debug(`Getting developer progress for user ${userId}`);

    const onboarding = await this.prisma.onboarding.findUnique({
      where: { userId },
      include: {
        milestones: true,
        user: {
          include: {
            memberships: true,
          },
        },
        mentor: true,
      },
    });

    if (!onboarding) {
      throw new NotFoundException(`No onboarding found for user ${userId}`);
    }

    const userOrgId = onboarding.user.memberships[0]?.organizationId;
    // Authorization check: Verify the user belongs to the requesting organization
    if (organizationId && userOrgId !== organizationId) {
      throw new UnauthorizedException("You do not have access to this developer's progress");
    }

    const daysElapsed = this.calculateDaysElapsed(onboarding.startDate);

    // Calculate cohort averages for comparison
    const cohortAverages = await this.calculateCohortAverages(userOrgId);

    // Get all possible milestone types
    const allMilestoneTypes = Object.values(MilestoneType);

    // Create a map of achieved milestones for quick lookup
    const achievedMilestonesMap = new Map(
      onboarding.milestones.map((m: { type: any; achievedAt: Date }) => [m.type, m]),
    );

    // Build milestone progress data for all milestone types
    const milestones = allMilestoneTypes.map((type) => {
      const achievedMilestone = achievedMilestonesMap.get(type);

      if (achievedMilestone) {
        // Milestone has been achieved
        const daysToAchieve = this.calculateDaysToMilestone(
          onboarding.startDate,
          achievedMilestone.achievedAt,
        );
        const comparedToCohort = this.compareToCohort(type, daysToAchieve, cohortAverages);

        return {
          type,
          achievedAt: achievedMilestone.achievedAt,
          daysToAchieve,
          comparedToCohort,
        };
      } else {
        // Milestone has not been achieved
        return {
          type,
          achievedAt: undefined,
          daysToAchieve: undefined,
          comparedToCohort: 'not_achieved' as const,
        };
      }
    });

    return {
      userId: onboarding.userId,
      userName: onboarding.user.name,
      onboardingStartDate: onboarding.startDate,
      onboardingEndDate: onboarding.endDate,
      daysElapsed,
      status: onboarding.status,
      mentorId: onboarding.mentorId ?? undefined,
      mentorName: onboarding.mentor?.name,
      milestones,
    };
  }

  /**
   * Get milestone timeline for a developer
   * Returns milestones ordered by achievement timestamp with timing information
   *
   */
  async getMilestoneTimeline(userId: string): Promise<MilestoneTimelineEntryDto[]> {
    this.logger.debug(`Getting milestone timeline for user ${userId}`);

    const onboarding = await this.prisma.onboarding.findUnique({
      where: { userId },
      include: {
        milestones: {
          orderBy: {
            achievedAt: 'asc',
          },
        },
      },
    });

    if (!onboarding) {
      throw new NotFoundException(`No onboarding found for user ${userId}`);
    }

    // Handle empty timeline case
    if (onboarding.milestones.length === 0) {
      return [];
    }

    const timeline: MilestoneTimelineEntryDto[] = [];
    let previousAchievedAt: Date | null = null;

    for (const milestone of onboarding.milestones) {
      const daysSinceStart = this.calculateDaysToMilestone(
        onboarding.startDate,
        milestone.achievedAt,
      );

      const daysSincePrevious = previousAchievedAt
        ? this.calculateDaysToMilestone(previousAchievedAt, milestone.achievedAt)
        : undefined;

      timeline.push({
        milestoneType: milestone.type,
        achievedAt: milestone.achievedAt,
        daysSinceStart,
        daysSincePrevious,
      });

      previousAchievedAt = milestone.achievedAt;
    }

    return timeline;
  }

  /**
   * Get available mentors for an organization
   * Returns mentors who have fewer than max capacity active mentees
   *
   */
  async getAvailableMentors(organizationId: string): Promise<MentorCapacityDto[]> {
    this.logger.debug(`Getting available mentors for organization ${organizationId}`);

    // Get all users in the organization
    const users = await this.prisma.user.findMany({
      where: {
        memberships: {
          some: {
            organizationId,
          },
        },
      },
      include: {
        mentoring: {
          where: {
            status: OnboardingStatus.ACTIVE,
          },
          include: {
            user: true,
          },
        },
      },
    });

    const mentorCapacities: MentorCapacityDto[] = [];

    for (const user of users) {
      const currentMenteeCount = user.mentoring.length;
      const availableCapacity = Math.max(0, this.MAX_MENTOR_CAPACITY - currentMenteeCount);
      const isAvailable = currentMenteeCount < this.MAX_MENTOR_CAPACITY;

      // Only include mentors who have capacity or are already mentoring
      if (isAvailable || currentMenteeCount > 0) {
        mentorCapacities.push({
          mentorId: user.id,
          mentorName: user.name,
          currentMenteeCount,
          maxCapacity: this.MAX_MENTOR_CAPACITY,
          availableCapacity,
          isAvailable,
          activeMentees: user.mentoring.map((onboarding) => ({
            userId: onboarding.userId,
            userName: onboarding.user.name,
            onboardingStartDate: onboarding.startDate,
          })),
        });
      }
    }

    // Sort by available capacity (descending) then by name
    mentorCapacities.sort((a, b) => {
      if (a.availableCapacity !== b.availableCapacity) {
        return b.availableCapacity - a.availableCapacity;
      }
      return a.mentorName.localeCompare(b.mentorName);
    });

    return mentorCapacities;
  }

  /**
   * Get capacity information for a specific mentor
   *
   */
  async getMentorCapacity(mentorId: string): Promise<MentorCapacityDto> {
    this.logger.debug(`Getting mentor capacity for mentor ${mentorId}`);

    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      include: {
        mentoring: {
          where: {
            status: OnboardingStatus.ACTIVE,
          },
          include: {
            user: true,
          },
        },
      },
    });

    if (!mentor) {
      throw new NotFoundException(`Mentor not found: ${mentorId}`);
    }

    const currentMenteeCount = mentor.mentoring.length;
    const availableCapacity = Math.max(0, this.MAX_MENTOR_CAPACITY - currentMenteeCount);
    const isAvailable = currentMenteeCount < this.MAX_MENTOR_CAPACITY;

    return {
      mentorId: mentor.id,
      mentorName: mentor.name,
      currentMenteeCount,
      maxCapacity: this.MAX_MENTOR_CAPACITY,
      availableCapacity,
      isAvailable,
      activeMentees: mentor.mentoring.map((onboarding) => ({
        userId: onboarding.userId,
        userName: onboarding.user.name,
        onboardingStartDate: onboarding.startDate,
      })),
    };
  }

  // ==================== HELPER METHODS ====================

  /**
   * Calculate milestone achievement rates for active onboardings
   */
  private calculateMilestoneAchievementRates(
    activeOnboardings: any[],
  ): Record<MilestoneType, { achieved: number; total: number; rate: number }> {
    const total = activeOnboardings.length;
    const rates: any = {};

    // Initialize rates for all milestone types
    for (const milestoneType of Object.values(MilestoneType)) {
      const achieved = activeOnboardings.filter((onboarding) =>
        onboarding.milestones.some((m: any) => m.type === milestoneType),
      ).length;

      rates[milestoneType] = {
        achieved,
        total,
        rate: total > 0 ? achieved / total : 0,
      };
    }

    return rates;
  }

  /**
   * Calculate average days to achieve each milestone
   */
  private calculateMilestoneAverages(
    onboardings: any[],
  ): Record<MilestoneType, { avgDays: number; count: number }> {
    const averages: any = {};

    // Initialize averages for all milestone types
    for (const milestoneType of Object.values(MilestoneType)) {
      const milestonesOfType = onboardings.flatMap((onboarding) =>
        onboarding.milestones
          .filter((m: any) => m.type === milestoneType)
          .map((m: any) => ({
            startDate: onboarding.startDate,
            achievedAt: m.achievedAt,
          })),
      );

      if (milestonesOfType.length > 0) {
        const totalDays = milestonesOfType.reduce(
          (sum, milestone) =>
            sum + this.calculateDaysToMilestone(milestone.startDate, milestone.achievedAt),
          0,
        );
        const avgDays = totalDays / milestonesOfType.length;

        averages[milestoneType] = {
          avgDays: Math.round(avgDays * 10) / 10, // Round to 1 decimal place
          count: milestonesOfType.length,
        };
      } else {
        averages[milestoneType] = {
          avgDays: 0,
          count: 0,
        };
      }
    }

    return averages;
  }

  /**
   * Check if a developer is at risk
   * At-risk criteria: no FIRST_COMMIT after 7 days OR no FIRST_REVIEW after 14 days
   *
   */
  private isAtRisk(onboarding: any, milestones: any[]): boolean {
    const daysElapsed = this.calculateDaysElapsed(onboarding.startDate);
    const achievedMilestoneTypes = milestones.map((m) => m.type);

    // Check FIRST_COMMIT threshold
    const hasFirstCommit = achievedMilestoneTypes.includes(MilestoneType.FIRST_COMMIT);
    if (!hasFirstCommit && daysElapsed > this.AT_RISK_FIRST_COMMIT_DAYS) {
      return true;
    }

    // Check FIRST_REVIEW threshold
    const hasFirstReview = achievedMilestoneTypes.includes(MilestoneType.FIRST_REVIEW);
    if (!hasFirstReview && daysElapsed > this.AT_RISK_FIRST_REVIEW_DAYS) {
      return true;
    }

    return false;
  }

  /**
   * Calculate risk factors for an at-risk developer
   */
  private calculateRiskFactors(daysElapsed: number, achievedMilestones: MilestoneType[]): string[] {
    const riskFactors: string[] = [];

    if (
      !achievedMilestones.includes(MilestoneType.FIRST_COMMIT) &&
      daysElapsed > this.AT_RISK_FIRST_COMMIT_DAYS
    ) {
      riskFactors.push(`No first commit after ${this.AT_RISK_FIRST_COMMIT_DAYS} days`);
    }

    if (
      !achievedMilestones.includes(MilestoneType.FIRST_REVIEW) &&
      daysElapsed > this.AT_RISK_FIRST_REVIEW_DAYS
    ) {
      riskFactors.push(`No first review after ${this.AT_RISK_FIRST_REVIEW_DAYS} days`);
    }

    return riskFactors;
  }

  /**
   * Get list of missing milestones
   */
  private getMissingMilestones(achievedMilestones: MilestoneType[]): MilestoneType[] {
    const allMilestones = Object.values(MilestoneType);
    return allMilestones.filter((type) => !achievedMilestones.includes(type));
  }

  /**
   * Calculate days elapsed since a date
   */
  private calculateDaysElapsed(startDate: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - new Date(startDate).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysToMilestone(startDate: Date, achievedAt: Date): number {
    const diffMs = new Date(achievedAt).getTime() - new Date(startDate).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate cohort averages for milestone timing
   */
  private async calculateCohortAverages(
    organizationId: string,
  ): Promise<Record<MilestoneType, number>> {
    const allOnboardings = await this.prisma.onboarding.findMany({
      where: {
        user: {
          memberships: {
            some: {
              organizationId,
            },
          },
        },
      },
      include: {
        milestones: true,
      },
    });

    const averages = this.calculateMilestoneAverages(allOnboardings);
    const cohortAverages: any = {};

    for (const [type, data] of Object.entries(averages)) {
      cohortAverages[type] = data.avgDays;
    }

    return cohortAverages;
  }

  /**
   * Compare milestone timing to cohort average
   */
  private compareToCohort(
    milestoneType: MilestoneType,
    daysToAchieve: number,
    cohortAverages: Record<MilestoneType, number>,
  ): 'faster' | 'average' | 'slower' | 'not_achieved' {
    const cohortAvg = cohortAverages[milestoneType];

    if (cohortAvg === 0) {
      return 'average'; // No cohort data available
    }

    const threshold = cohortAvg * 0.2; // 20% threshold for "average"

    if (daysToAchieve < cohortAvg - threshold) {
      return 'faster';
    } else if (daysToAchieve > cohortAvg + threshold) {
      return 'slower';
    } else {
      return 'average';
    }
  }
}
