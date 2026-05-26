import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma';
import { NotificationType } from '@prisma/client';

/**
 * Event payload for goal achievement
 */
export interface GoalAchievedEvent {
  goalId: string;
  ownerId: string;
  organizationId: string;
  teamId?: string | null;
  name: string;
}

/**
 * Service for handling goal achievement notifications
 */
@Injectable()
export class GoalAchievementService {
  private readonly logger = new Logger(GoalAchievementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle goal.achieved event
   */
  @OnEvent('goal.achieved')
  async handleGoalAchieved(event: GoalAchievedEvent): Promise<void> {
    this.logger.log(`Processing goal achievement for goal ${event.goalId}`);

    try {
      // Record achievement timestamp (already done in goal-progress.service.ts)
      // The achievedAt timestamp is set when the goal status changes to ACHIEVED

      // Detect goal achievement on progress update - this event is triggered
      // when achievement is detected in goal-progress.service.ts

      // Create achievement notification for owner
      await this.createOwnerNotification(event);

      // Notify team members for team goals
      if (event.teamId) {
        await this.notifyTeamMembers(event);
      }

      this.logger.log(`Goal achievement notifications sent for goal ${event.goalId}`);
    } catch (error: any) {
      this.logger.error(
        `Error processing goal achievement for goal ${event.goalId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Create achievement notification for the goal owner
   */
  private async createOwnerNotification(event: GoalAchievedEvent): Promise<void> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: event.ownerId,
        organizationId: event.organizationId,
        type: NotificationType.GOAL_ACHIEVED,
        title: ' Goal Achieved!',
        message: `Congratulations! You have achieved your goal: "${event.name}"`,
        metadata: {
          goalId: event.goalId,
          goalName: event.name,
          teamId: event.teamId,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification
    this.eventEmitter.emit('notification.created', {
      notificationId: notification.id,
      userId: event.ownerId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
    });

    this.logger.debug(`Owner notification created for goal ${event.goalId}`);
  }

  /**
   * Notify all team members when a team goal is achieved
   * notify all team members for team goals
   */
  private async notifyTeamMembers(event: GoalAchievedEvent): Promise<void> {
    // Get all active team members except the owner (who already received notification)
    const teamMembers = await this.prisma.teamMembership.findMany({
      where: {
        teamId: event.teamId!,
        leftAt: null,
        userId: { not: event.ownerId },
      },
      select: { userId: true },
    });

    if (teamMembers.length === 0) {
      this.logger.debug(`No team members to notify for goal ${event.goalId}`);
      return;
    }

    // Get team name for the notification message
    const team = await this.prisma.team.findUnique({
      where: { id: event.teamId! },
      select: { name: true },
    });

    const teamName = team?.name || 'Your team';

    // Create notifications for all team members
    const notifications = await Promise.all(
      teamMembers.map(async (member) => {
        const notification = await this.prisma.notification.create({
          data: {
            userId: member.userId,
            organizationId: event.organizationId,
            type: NotificationType.GOAL_ACHIEVED,
            title: '🎉 Team Goal Achieved!',
            message: `${teamName} has achieved the goal: "${event.name}"`,
            metadata: {
              goalId: event.goalId,
              goalName: event.name,
              teamId: event.teamId,
              isTeamGoal: true,
            },
            isRead: false,
          },
        });

        // Emit event for real-time WebSocket notification
        this.eventEmitter.emit('notification.created', {
          notificationId: notification.id,
          userId: member.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
        });

        return notification;
      }),
    );

    this.logger.debug(
      `Team notifications created for ${notifications.length} members for goal ${event.goalId}`,
    );
  }

  /**
   * Get achievement history for a user
   * Show all past achievements
   */
  async getAchievementHistory(
    userId: string,
    organizationId: string,
    page = 1,
    limit = 20,
  ): Promise<{
    data: Array<{
      goalId: string;
      goalName: string;
      achievedAt: Date;
      teamId?: string;
      teamName?: string;
    }>;
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const [goals, total] = await Promise.all([
      this.prisma.goal.findMany({
        where: {
          organizationId,
          ownerId: userId,
          achievedAt: { not: null },
        },
        select: {
          id: true,
          name: true,
          achievedAt: true,
          teamId: true,
        },
        orderBy: { achievedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.goal.count({
        where: {
          organizationId,
          ownerId: userId,
          achievedAt: { not: null },
        },
      }),
    ]);

    // Get team names for team goals
    const teamIds = goals.filter((g) => g.teamId).map((g) => g.teamId!);
    const teams =
      teamIds.length > 0
        ? await this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            select: { id: true, name: true },
          })
        : [];

    const teamMap = new Map(teams.map((t) => [t.id, t.name]));

    const data = goals.map((goal) => ({
      goalId: goal.id,
      goalName: goal.name,
      achievedAt: goal.achievedAt!,
      teamId: goal.teamId || undefined,
      teamName: goal.teamId ? teamMap.get(goal.teamId) : undefined,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
