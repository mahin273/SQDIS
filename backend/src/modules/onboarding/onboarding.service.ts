import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnboardingStatus, MilestoneType } from '@prisma/client';
import {
  CreateOnboardingDto,
  UpdateOnboardingDto,
  ExtendOnboardingDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  UpdateChecklistItemDto,
} from './dto';
import { ProgressTrackingService } from './services/progress-tracking.service';

const ONBOARDING_PERIOD_DAYS = 90;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly progressTrackingService: ProgressTrackingService,
  ) {}

  async create(organizationId: string, dto: CreateOnboardingDto) {
    // Check if user exists and belongs to organization
    const member = await this.prisma.organizationMember.findFirst({
      where: { userId: dto.userId, organizationId },
    });

    if (!member) {
      throw new NotFoundException('User not found in organization');
    }

    // Check if user already has an active onboarding
    const existing = await this.prisma.onboarding.findUnique({
      where: { userId: dto.userId },
    });

    if (existing && existing.status === OnboardingStatus.ACTIVE) {
      throw new ConflictException('User already has an active onboarding');
    }

    // Calculate end date (90 days from now)
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + ONBOARDING_PERIOD_DAYS);

    // Create onboarding record
    const onboarding = await this.prisma.onboarding.create({
      data: {
        userId: dto.userId,
        mentorId: dto.mentorId,
        startDate,
        endDate,
        status: OnboardingStatus.ACTIVE,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        mentor: { select: { id: true, name: true, email: true } },
        milestones: true,
        checklistItems: { orderBy: { order: 'asc' } },
      },
    });

    // If template provided, create checklist items from template
    if (dto.templateId) {
      const template = await this.prisma.onboardingTemplate.findUnique({
        where: { id: dto.templateId },
      });

      if (template && template.items) {
        const items = template.items as Array<{
          title: string;
          description?: string;
          dueDate?: string;
          order: number;
        }>;
        await this.prisma.onboardingChecklistItem.createMany({
          data: items.map((item) => ({
            onboardingId: onboarding.id,
            title: item.title,
            description: item.description,
            dueDate: item.dueDate ? new Date(item.dueDate) : null,
            order: item.order,
          })),
        });
      }
    }

    return this.findById(onboarding.id);
  }

  async findAll(
    organizationId: string,
    filters?: { status?: OnboardingStatus; mentorId?: string },
  ) {
    const userIds = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    const whereClause: any = {
      userId: { in: userIds.map((u) => u.userId) },
    };

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (filters?.mentorId) {
      whereClause.mentorId = filters.mentorId;
    }

    const onboardings = await this.prisma.onboarding.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            teamMemberships: {
              where: { leftAt: null },
              orderBy: { joinedAt: 'asc' },
              select: {
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        milestones: true,
        checklistItems: { orderBy: { order: 'asc' } },
      },
      orderBy: { startDate: 'desc' },
    });

    return Promise.all(onboardings.map((o) => this.enrichOnboarding(o)));
  }

  async findById(id: string) {
    const onboarding = await this.prisma.onboarding.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            teamMemberships: {
              where: { leftAt: null },
              orderBy: { joinedAt: 'asc' },
              select: {
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        milestones: true,
        checklistItems: { orderBy: { order: 'asc' } },
      },
    });

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found');
    }

    return this.enrichOnboarding(onboarding);
  }

  async findByUserId(userId: string) {
    const onboarding = await this.prisma.onboarding.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            teamMemberships: {
              where: { leftAt: null },
              orderBy: { joinedAt: 'asc' },
              select: {
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        mentor: { select: { id: true, name: true, email: true, avatarUrl: true } },
        milestones: true,
        checklistItems: { orderBy: { order: 'asc' } },
      },
    });

    if (!onboarding) {
      return null;
    }

    return this.enrichOnboarding(onboarding);
  }

  private mapFrontendStatus(
    status: OnboardingStatus,
    isAtRisk: boolean,
  ): 'IN_PROGRESS' | 'COMPLETED' | 'AT_RISK' {
    if (status === OnboardingStatus.COMPLETED) {
      return 'COMPLETED';
    }

    if (isAtRisk) {
      return 'AT_RISK';
    }

    return 'IN_PROGRESS';
  }

  private getMilestoneDescription(type: MilestoneType): string {
    const descriptions: Record<MilestoneType, string> = {
      [MilestoneType.FIRST_COMMIT]: 'First commit created',
      [MilestoneType.FIRST_BUGFIX]: 'First bug fix merged',
      [MilestoneType.FIRST_FEATURE]: 'First feature delivered',
      [MilestoneType.FIRST_REVIEW]: 'First code review completed',
      [MilestoneType.FIRST_PR_MERGED]: 'First pull request merged',
      [MilestoneType.FIRST_TEST]: 'First test added',
    };

    return descriptions[type];
  }

  private async enrichOnboarding(onboarding: any) {
    const now = new Date();
    const daysRemaining = Math.max(
      0,
      Math.ceil((onboarding.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );
    const totalDays = Math.ceil(
      (onboarding.endDate.getTime() - onboarding.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const daysElapsed = totalDays - daysRemaining;

    const completedItems = onboarding.checklistItems.filter(
      (item: any) => item.completedAt !== null,
    ).length;
    const totalItems = onboarding.checklistItems.length;
    const checklistProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    const milestoneCount = onboarding.milestones.length;
    const totalMilestones = Object.keys(MilestoneType).length;
    const milestoneProgress = Math.round((milestoneCount / totalMilestones) * 100);

    // Flag as at-risk if: less than 30 days remaining AND (no milestones OR checklist < 50%)
    const isAtRisk = daysRemaining < 30 && (milestoneCount === 0 || checklistProgress < 50);
    const frontendStatus = this.mapFrontendStatus(onboarding.status, isAtRisk);
    const progress =
      frontendStatus === 'COMPLETED'
        ? 100
        : Math.round(((checklistProgress + milestoneProgress) / 2) * 10) / 10;
    const activeTeamMembership = onboarding.user.teamMemberships?.[0];
    const team = activeTeamMembership?.team ?? null;

    const [commitCount, latestDqs] = await Promise.all([
      this.prisma.commit.count({
        where: {
          developerId: onboarding.userId,
        },
      }),
      this.prisma.dQSScore.findFirst({
        where: {
          developerId: onboarding.userId,
        },
        orderBy: {
          calculatedAt: 'desc',
        },
        select: {
          score: true,
        },
      }),
    ]);

    return {
      ...onboarding,
      status: frontendStatus,
      team,
      progress,
      daysRemaining,
      daysElapsed,
      totalDays,
      milestones: onboarding.milestones.map((milestone: any) => ({
        ...milestone,
        description: this.getMilestoneDescription(milestone.type),
      })),
      checklist: onboarding.checklistItems.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description ?? '',
        isCompleted: item.completedAt !== null,
        completedAt: item.completedAt,
      })),
      checklistProgress,
      milestoneProgress,
      isAtRisk,
      commitCount,
      avgDqs: latestDqs?.score ?? 0,
    };
  }

  async assignMentor(id: string, mentorId: string) {
    const onboarding = await this.prisma.onboarding.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found');
    }

    // Verify mentor exists
    const mentor = await this.prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    await this.prisma.onboarding.update({
      where: { id },
      data: { mentorId },
    });

    // Send notification to mentor on assignment
    await this.sendMentorAssignmentNotification(onboarding, mentor);

    return this.findById(id);
  }

  /**
   * Send notification to mentor when they are assigned to an onboarding
   */
  private async sendMentorAssignmentNotification(
    onboarding: { id: string; userId: string; user: { id: string; name: string; email: string } },
    mentor: { id: string; name: string },
  ): Promise<void> {
    // Get the organization for this user
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: onboarding.userId },
    });

    if (!membership) {
      return; // No organization found, skip notification
    }

    const menteeName = onboarding.user.name || 'a new developer';

    // Create notification for the mentor
    const notification = await this.prisma.notification.create({
      data: {
        userId: mentor.id,
        organizationId: membership.organizationId,
        type: 'SYSTEM',
        title: 'New Mentee Assigned',
        message: `You have been assigned as a mentor for ${menteeName}. Help guide them through their onboarding journey!`,
        metadata: {
          onboardingId: onboarding.id,
          menteeId: onboarding.userId,
          menteeName,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification
    this.eventEmitter.emit('notification.created', {
      notificationId: notification.id,
      userId: mentor.id,
      type: 'SYSTEM',
      message: notification.message,
      createdAt: notification.createdAt,
    });
  }

  /**
   * Assign a mentor to an onboarding with capacity check
   * Validates mentor exists and sends notifications to both parties
   */
  async assignMentorWithCapacityCheck(id: string, mentorId: string) {
    // Find the onboarding record
    const onboarding = await this.prisma.onboarding.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found');
    }

    // Validate mentor user exists
    const mentor = await this.prisma.user.findUnique({
      where: { id: mentorId },
      select: { id: true, name: true, email: true },
    });

    if (!mentor) {
      throw new NotFoundException('Mentor not found');
    }

    // Update onboarding record with mentor ID
    await this.prisma.onboarding.update({
      where: { id },
      data: { mentorId },
    });

    // Send notifications to both mentor and developer
    await this.sendMentorAssignmentNotifications(onboarding, mentor);

    return this.findById(id);
  }

  /**
   * Send notifications to both mentor and developer when mentor is assigned
   */
  private async sendMentorAssignmentNotifications(
    onboarding: { id: string; userId: string; user: { id: string; name: string; email: string } },
    mentor: { id: string; name: string; email: string },
  ): Promise<void> {
    // Get the organization for this user
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: onboarding.userId },
    });

    if (!membership) {
      return; // No organization found, skip notifications
    }

    const menteeName = onboarding.user.name || 'a new developer';
    const mentorName = mentor.name || 'a mentor';

    // Create notification for the mentor
    const mentorNotification = await this.prisma.notification.create({
      data: {
        userId: mentor.id,
        organizationId: membership.organizationId,
        type: 'SYSTEM',
        title: 'New Mentee Assigned',
        message: `You have been assigned as a mentor for ${menteeName}. Help guide them through their onboarding journey!`,
        metadata: {
          onboardingId: onboarding.id,
          menteeId: onboarding.userId,
          menteeName,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification to mentor
    this.eventEmitter.emit('notification.created', {
      notificationId: mentorNotification.id,
      userId: mentor.id,
      type: 'SYSTEM',
      message: mentorNotification.message,
      createdAt: mentorNotification.createdAt,
    });

    // Create notification for the developer
    const developerNotification = await this.prisma.notification.create({
      data: {
        userId: onboarding.userId,
        organizationId: membership.organizationId,
        type: 'SYSTEM',
        title: 'Mentor Assigned',
        message: `${mentorName} has been assigned as your mentor. They will help guide you through your onboarding journey!`,
        metadata: {
          onboardingId: onboarding.id,
          mentorId: mentor.id,
          mentorName,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification to developer
    this.eventEmitter.emit('notification.created', {
      notificationId: developerNotification.id,
      userId: onboarding.userId,
      type: 'SYSTEM',
      message: developerNotification.message,
      createdAt: developerNotification.createdAt,
    });
  }

  async extend(id: string, dto: ExtendOnboardingDto) {
    const onboarding = await this.prisma.onboarding.findUnique({ where: { id } });

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found');
    }

    if (onboarding.status !== OnboardingStatus.ACTIVE) {
      throw new BadRequestException('Can only extend active onboardings');
    }

    const newEndDate = new Date(onboarding.endDate);
    newEndDate.setDate(newEndDate.getDate() + dto.additionalDays);

    await this.prisma.onboarding.update({
      where: { id },
      data: {
        endDate: newEndDate,
        status: OnboardingStatus.EXTENDED,
      },
    });

    return this.findById(id);
  }

  async complete(id: string) {
    const onboarding = await this.prisma.onboarding.findUnique({ where: { id } });

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found');
    }

    await this.prisma.onboarding.update({
      where: { id },
      data: { status: OnboardingStatus.COMPLETED },
    });

    return this.findById(id);
  }

  // Milestone tracking
  async recordMilestone(userId: string, type: MilestoneType) {
    const onboarding = await this.prisma.onboarding.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!onboarding || onboarding.status === OnboardingStatus.COMPLETED) {
      return null; // User not in onboarding or already completed
    }

    // Check if milestone already exists
    const existing = await this.prisma.onboardingMilestone.findUnique({
      where: { onboardingId_type: { onboardingId: onboarding.id, type } },
    });

    if (existing) {
      return existing; // Already achieved
    }

    const milestone = await this.prisma.onboardingMilestone.create({
      data: {
        onboardingId: onboarding.id,
        type,
      },
    });

    // Send notification on milestone achievement (to both mentee and mentor)
    await this.sendMilestoneNotification(
      {
        id: onboarding.id,
        userId: onboarding.userId,
        mentorId: onboarding.mentorId,
        user: onboarding.user,
      },
      type,
    );

    return milestone;
  }

  /**
   * Send notification when a milestone is achieved
   * Notifies both the onboarding user and their mentor (if assigned)
   */
  private async sendMilestoneNotification(
    onboarding: {
      id: string;
      userId: string;
      mentorId?: string | null;
      user: { id: string; name: string };
    },
    milestoneType: MilestoneType,
  ): Promise<void> {
    // Get the organization for this user
    const membership = await this.prisma.organizationMember.findFirst({
      where: { userId: onboarding.userId },
    });

    if (!membership) {
      return; // No organization found, skip notification
    }

    const milestoneLabels: Record<MilestoneType, string> = {
      [MilestoneType.FIRST_COMMIT]: 'First Commit',
      [MilestoneType.FIRST_BUGFIX]: 'First Bugfix',
      [MilestoneType.FIRST_FEATURE]: 'First Feature',
      [MilestoneType.FIRST_REVIEW]: 'First Review',
      [MilestoneType.FIRST_PR_MERGED]: 'First PR Merged',
      [MilestoneType.FIRST_TEST]: 'First Test',
    };

    const milestoneLabel = milestoneLabels[milestoneType] || milestoneType;
    const userName = onboarding.user.name || 'Developer';

    // Create notification for the onboarding user
    const notification = await this.prisma.notification.create({
      data: {
        userId: onboarding.userId,
        organizationId: membership.organizationId,
        type: 'MILESTONE_ACHIEVED',
        title: `Milestone Achieved: ${milestoneLabel}`,
        message: `Congratulations! You have achieved the "${milestoneLabel}" milestone in your onboarding journey.`,
        metadata: {
          onboardingId: onboarding.id,
          milestoneType,
          userName,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification
    this.eventEmitter.emit('notification.created', {
      notificationId: notification.id,
      userId: onboarding.userId,
      type: 'MILESTONE_ACHIEVED',
      message: notification.message,
      createdAt: notification.createdAt,
    });

    // Notify mentor on mentee milestone achievement
    if (onboarding.mentorId) {
      await this.sendMentorMilestoneNotification(
        onboarding.mentorId,
        membership.organizationId,
        onboarding.id,
        userName,
        milestoneType,
        milestoneLabel,
      );
    }
  }

  /**
   * Send notification to mentor when their mentee achieves a milestone
   */
  private async sendMentorMilestoneNotification(
    mentorId: string,
    organizationId: string,
    onboardingId: string,
    menteeName: string,
    milestoneType: MilestoneType,
    milestoneLabel: string,
  ): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: mentorId,
        organizationId,
        type: 'MENTEE_MILESTONE',
        title: `Mentee Milestone: ${milestoneLabel}`,
        message: `Your mentee ${menteeName} has achieved the "${milestoneLabel}" milestone. Great progress!`,
        metadata: {
          onboardingId,
          menteeId: menteeName,
          milestoneType,
          milestoneLabel,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification
    this.eventEmitter.emit('notification.created', {
      notificationId: notification.id,
      userId: mentorId,
      type: 'MENTEE_MILESTONE',
      message: notification.message,
      createdAt: notification.createdAt,
    });
  }

  // Checklist management
  async getChecklist(onboardingId: string) {
    const items = await this.prisma.onboardingChecklistItem.findMany({
      where: { onboardingId },
      orderBy: { order: 'asc' },
    });

    return items;
  }

  async updateChecklistItem(onboardingId: string, itemId: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.onboardingChecklistItem.findFirst({
      where: { id: itemId, onboardingId },
    });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    const updateData: any = {};
    const completed = dto.completed ?? dto.isCompleted;
    if (completed !== undefined) {
      updateData.completedAt = completed ? new Date() : null;
    }

    return this.prisma.onboardingChecklistItem.update({
      where: { id: itemId },
      data: updateData,
    });
  }

  // Template management
  async getTemplates(organizationId: string) {
    return this.prisma.onboardingTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplate(id: string) {
    const template = await this.prisma.onboardingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  async createTemplate(organizationId: string, dto: CreateTemplateDto) {
    return this.prisma.onboardingTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        items: JSON.parse(JSON.stringify(dto.items)),
      },
    });
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.onboardingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.onboardingTemplate.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.items && { items: JSON.parse(JSON.stringify(dto.items)) }),
      },
    });
  }

  async deleteTemplate(id: string) {
    const template = await this.prisma.onboardingTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.onboardingTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  // Cron job to auto-complete expired onboardings
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async transitionCompletedOnboardings() {
    const now = new Date();

    const expiredOnboardings = await this.prisma.onboarding.findMany({
      where: {
        status: { in: [OnboardingStatus.ACTIVE, OnboardingStatus.EXTENDED] },
        endDate: { lte: now },
      },
    });

    for (const onboarding of expiredOnboardings) {
      await this.prisma.onboarding.update({
        where: { id: onboarding.id },
        data: { status: OnboardingStatus.COMPLETED },
      });
    }

    return { transitioned: expiredOnboardings.length };
  }

  // Dashboard statistics
  async getDashboardStats(organizationId: string) {
    const userIds = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });

    const userIdList = userIds.map((u) => u.userId);

    const [active, completed, atRisk] = await Promise.all([
      this.prisma.onboarding.count({
        where: {
          userId: { in: userIdList },
          status: OnboardingStatus.ACTIVE,
        },
      }),
      this.prisma.onboarding.count({
        where: {
          userId: { in: userIdList },
          status: OnboardingStatus.COMPLETED,
        },
      }),
      this.prisma.onboarding.count({
        where: {
          userId: { in: userIdList },
          status: OnboardingStatus.ACTIVE,
          endDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return { active, completed, atRisk, total: active + completed };
  }

  /**
   * Get velocity comparison across cohorts
   * Compares milestone timing across new hires and computes averages
   */
  async getVelocityComparison(
    organizationId: string,
    filters?: { teamId?: string; startDate?: Date; endDate?: Date },
  ) {
    // Get all organization members
    const memberQuery: any = { organizationId };

    const userIds = await this.prisma.organizationMember.findMany({
      where: memberQuery,
      select: { userId: true },
    });

    const userIdList = userIds.map((u) => u.userId);

    // Build onboarding query with optional date filters
    const onboardingWhere: any = {
      userId: { in: userIdList },
    };

    if (filters?.startDate) {
      onboardingWhere.startDate = { gte: filters.startDate };
    }
    if (filters?.endDate) {
      onboardingWhere.startDate = {
        ...onboardingWhere.startDate,
        lte: filters.endDate,
      };
    }

    // Get all onboardings with milestones
    const onboardings = await this.prisma.onboarding.findMany({
      where: onboardingWhere,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        milestones: true,
      },
      orderBy: { startDate: 'desc' },
    });

    // Calculate cohort averages for each milestone type
    const cohortAverages = this.calculateCohortAverages(onboardings);

    // Calculate individual developer velocities with comparison to cohort
    const developerVelocities = onboardings.map((onboarding) => {
      const milestoneTimings = this.calculateMilestoneTimings(onboarding);
      const comparison = this.compareToCohort(milestoneTimings, cohortAverages);

      return {
        onboardingId: onboarding.id,
        userId: onboarding.userId,
        user: onboarding.user,
        startDate: onboarding.startDate,
        status: onboarding.status,
        milestoneTimings,
        comparison,
        overallPerformance: this.calculateOverallPerformance(comparison),
      };
    });

    // Calculate milestone achievement rates
    const milestoneAchievementRates = this.calculateMilestoneAchievementRates(onboardings);

    // Calculate average time to productivity (all milestones achieved)
    const avgTimeToProductivity = this.calculateAverageTimeToProductivity(onboardings);

    return {
      cohortAverages,
      developerVelocities,
      milestoneAchievementRates,
      avgTimeToProductivity,
      totalOnboardings: onboardings.length,
      completedOnboardings: onboardings.filter((o) => o.status === OnboardingStatus.COMPLETED)
        .length,
    };
  }

  /**
   * Calculate cohort averages for each milestone type
   */
  private calculateCohortAverages(
    onboardings: any[],
  ): Record<string, { avgDays: number; count: number }> {
    const milestoneTypes = Object.values(MilestoneType);
    const averages: Record<string, { avgDays: number; count: number }> = {};

    for (const type of milestoneTypes) {
      const timings: number[] = [];

      for (const onboarding of onboardings) {
        const milestone = onboarding.milestones.find((m: any) => m.type === type);
        if (milestone) {
          const daysToAchieve = Math.ceil(
            (new Date(milestone.achievedAt).getTime() - new Date(onboarding.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          timings.push(daysToAchieve);
        }
      }

      averages[type] = {
        avgDays:
          timings.length > 0 ? Math.round(timings.reduce((a, b) => a + b, 0) / timings.length) : 0,
        count: timings.length,
      };
    }

    return averages;
  }

  /**
   * Calculate milestone timings for a single onboarding
   */
  private calculateMilestoneTimings(
    onboarding: any,
  ): Record<string, { daysToAchieve: number; achievedAt: Date } | null> {
    const milestoneTypes = Object.values(MilestoneType);
    const timings: Record<string, { daysToAchieve: number; achievedAt: Date } | null> = {};

    for (const type of milestoneTypes) {
      const milestone = onboarding.milestones.find((m: any) => m.type === type);
      if (milestone) {
        const daysToAchieve = Math.ceil(
          (new Date(milestone.achievedAt).getTime() - new Date(onboarding.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        timings[type] = { daysToAchieve, achievedAt: milestone.achievedAt };
      } else {
        timings[type] = null;
      }
    }

    return timings;
  }

  /**
   * Compare individual timings to cohort averages
   */
  private compareToCohort(
    timings: Record<string, { daysToAchieve: number; achievedAt: Date } | null>,
    cohortAverages: Record<string, { avgDays: number; count: number }>,
  ): Record<
    string,
    { difference: number; performance: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'NOT_ACHIEVED' }
  > {
    const comparison: Record<
      string,
      { difference: number; performance: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'NOT_ACHIEVED' }
    > = {};

    for (const [type, timing] of Object.entries(timings)) {
      const cohortAvg = cohortAverages[type]?.avgDays || 0;

      if (!timing) {
        comparison[type] = { difference: 0, performance: 'NOT_ACHIEVED' };
      } else if (cohortAvg === 0) {
        // No cohort data to compare against
        comparison[type] = { difference: 0, performance: 'ON_TRACK' };
      } else {
        const difference = timing.daysToAchieve - cohortAvg;
        let performance: 'AHEAD' | 'ON_TRACK' | 'BEHIND';

        // Consider within 2 days as "on track"
        if (difference < -2) {
          performance = 'AHEAD';
        } else if (difference > 2) {
          performance = 'BEHIND';
        } else {
          performance = 'ON_TRACK';
        }

        comparison[type] = { difference, performance };
      }
    }

    return comparison;
  }

  /**
   * Calculate overall performance based on milestone comparisons
   */
  private calculateOverallPerformance(
    comparison: Record<
      string,
      { difference: number; performance: 'AHEAD' | 'ON_TRACK' | 'BEHIND' | 'NOT_ACHIEVED' }
    >,
  ): { score: number; status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_ATTENTION' } {
    const achieved = Object.values(comparison).filter((c) => c.performance !== 'NOT_ACHIEVED');

    if (achieved.length === 0) {
      return { score: 0, status: 'NEEDS_ATTENTION' };
    }

    const aheadCount = achieved.filter((c) => c.performance === 'AHEAD').length;
    const onTrackCount = achieved.filter((c) => c.performance === 'ON_TRACK').length;
    const behindCount = achieved.filter((c) => c.performance === 'BEHIND').length;

    // Score: AHEAD = 3, ON_TRACK = 2, BEHIND = 1
    const score = Math.round(
      ((aheadCount * 3 + onTrackCount * 2 + behindCount * 1) / (achieved.length * 3)) * 100,
    );

    let status: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'NEEDS_ATTENTION';
    if (score >= 80) {
      status = 'EXCELLENT';
    } else if (score >= 60) {
      status = 'GOOD';
    } else if (score >= 40) {
      status = 'AVERAGE';
    } else {
      status = 'NEEDS_ATTENTION';
    }

    return { score, status };
  }

  /**
   * Calculate milestone achievement rates across all onboardings
   */
  private calculateMilestoneAchievementRates(
    onboardings: any[],
  ): Record<string, { achieved: number; total: number; rate: number }> {
    const milestoneTypes = Object.values(MilestoneType);
    const rates: Record<string, { achieved: number; total: number; rate: number }> = {};

    for (const type of milestoneTypes) {
      const achieved = onboardings.filter((o) =>
        o.milestones.some((m: any) => m.type === type),
      ).length;

      rates[type] = {
        achieved,
        total: onboardings.length,
        rate: onboardings.length > 0 ? Math.round((achieved / onboardings.length) * 100) : 0,
      };
    }

    return rates;
  }

  /**
   * Calculate average time to productivity (all milestones achieved)
   */
  private calculateAverageTimeToProductivity(onboardings: any[]): {
    avgDays: number;
    count: number;
  } {
    const milestoneTypes = Object.values(MilestoneType);
    const productivityTimes: number[] = [];

    for (const onboarding of onboardings) {
      // Check if all milestones are achieved
      const achievedTypes = new Set(onboarding.milestones.map((m: any) => m.type));
      const allAchieved = milestoneTypes.every((type) => achievedTypes.has(type));

      if (allAchieved) {
        // Find the last milestone achieved
        const lastMilestone = onboarding.milestones.reduce((latest: any, current: any) => {
          return new Date(current.achievedAt) > new Date(latest.achievedAt) ? current : latest;
        });

        const daysToProductivity = Math.ceil(
          (new Date(lastMilestone.achievedAt).getTime() -
            new Date(onboarding.startDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
        productivityTimes.push(daysToProductivity);
      }
    }

    return {
      avgDays:
        productivityTimes.length > 0
          ? Math.round(productivityTimes.reduce((a, b) => a + b, 0) / productivityTimes.length)
          : 0,
      count: productivityTimes.length,
    };
  }

  /**
   * Get velocity comparison for a specific developer
   */
  async getDeveloperVelocity(organizationId: string, userId: string) {
    const onboarding = await this.prisma.onboarding.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        milestones: true,
      },
    });

    if (!onboarding) {
      throw new NotFoundException('Onboarding not found for this user');
    }

    // Get cohort data for comparison
    const cohortData = await this.getVelocityComparison(organizationId);

    const milestoneTimings = this.calculateMilestoneTimings(onboarding);
    const comparison = this.compareToCohort(milestoneTimings, cohortData.cohortAverages);
    const overallPerformance = this.calculateOverallPerformance(comparison);

    return {
      onboardingId: onboarding.id,
      userId: onboarding.userId,
      user: onboarding.user,
      startDate: onboarding.startDate,
      status: onboarding.status,
      milestoneTimings,
      comparison,
      overallPerformance,
      cohortAverages: cohortData.cohortAverages,
    };
  }

  /**
   * Get available mentors with capacity information
   * Delegates to ProgressTrackingService
   */
  async getAvailableMentors(organizationId: string) {
    return this.progressTrackingService.getAvailableMentors(organizationId);
  }
}
