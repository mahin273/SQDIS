import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma';
import { SprintsService } from '../sprints.service';

/**
 * Service for automatic sprint report generation
 */
@Injectable()
export class SprintAutoGenerationService {
  private readonly logger = new Logger(SprintAutoGenerationService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sprintsService: SprintsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Cron job that runs every hour to check for ended sprints
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleSprintEndCheck(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Sprint end check already in progress, skipping this cycle');
      return;
    }

    this.isProcessing = true;
    this.logger.log('Starting sprint end check');

    try {
      const endedSprints = await this.findEndedSprintsWithoutReports();
      this.logger.log(`Found ${endedSprints.length} ended sprints without reports`);

      for (const sprint of endedSprints) {
        await this.processEndedSprint(sprint);
      }

      this.logger.log('Sprint end check complete');
    } catch (error) {
      this.logger.error(`Sprint end check failed: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Find sprints that have ended but don't have a final report
   */
  private async findEndedSprintsWithoutReports(): Promise<
    Array<{
      id: string;
      name: string;
      teamId: string;
      organizationId: string;
      endDate: Date;
    }>
  > {
    const now = new Date();

    // Find sprints where:
    // 1. End date has passed
    // 2. Sprint is still active (not deleted)
    // 3. No report exists with generatedAt after the sprint end date
    const endedSprints = await this.prisma.sprint.findMany({
      where: {
        isActive: true,
        endDate: {
          lt: now,
        },
      },
      select: {
        id: true,
        name: true,
        teamId: true,
        organizationId: true,
        endDate: true,
        reports: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: {
            generatedAt: true,
          },
        },
      },
    });

    // Filter to sprints that don't have a report generated after the sprint ended
    return endedSprints.filter((sprint) => {
      if (sprint.reports.length === 0) {
        return true;
      }
      // Check if the latest report was generated before the sprint ended
      // (meaning it was a mid-sprint report, not a final report)
      const latestReportDate = sprint.reports[0].generatedAt;
      return latestReportDate < sprint.endDate;
    });
  }

  /**
   * Process a single ended sprint - generate report and notify team lead
   */
  private async processEndedSprint(sprint: {
    id: string;
    name: string;
    teamId: string;
    organizationId: string;
    endDate: Date;
  }): Promise<void> {
    this.logger.log(`Processing ended sprint: ${sprint.name} (${sprint.id})`);

    let retryCount = 0;
    const maxRetries = 1; 

    while (retryCount <= maxRetries) {
      try {
        // Generate the sprint report
        const report = await this.sprintsService.generateReport(sprint.id);
        this.logger.log(`Generated report for sprint ${sprint.name}: ${report.id}`);

        // Get team lead to notify
        const team = await this.prisma.team.findUnique({
          where: { id: sprint.teamId },
          select: {
            leadId: true,
            name: true,
            lead: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Send notification to team lead
        if (team?.leadId) {
          await this.notifyTeamLead(
            team.leadId,
            sprint.id,
            sprint.name,
            team.name,
            sprint.organizationId,
          );
          this.logger.log(`Notified team lead ${team.lead?.name} for sprint ${sprint.name}`);
        } else {
          this.logger.warn(`No team lead assigned for team ${team?.name}, skipping notification`);
        }

        // Success - exit retry loop
        return;
      } catch (error) {
        retryCount++;
        this.logger.error(
          `Failed to process sprint ${sprint.name} (attempt ${retryCount}/${maxRetries + 1}): ${error}`,
        );

        if (retryCount > maxRetries) {
          // Log final failure after retry
          this.logger.error(
            `Final failure processing sprint ${sprint.name} after ${maxRetries + 1} attempts`,
          );
        }
      }
    }
  }

  /**
   * Send in-app notification to team lead about sprint report
   */
  private async notifyTeamLead(
    teamLeadId: string,
    sprintId: string,
    sprintName: string,
    teamName: string,
    organizationId: string,
  ): Promise<void> {
    // Create an in-app notification
    const notification = await this.prisma.notification.create({
      data: {
        userId: teamLeadId,
        organizationId,
        type: 'SPRINT_REPORT_READY',
        title: `Sprint Report Ready: ${sprintName}`,
        message: `The sprint report for "${sprintName}" (${teamName}) has been automatically generated and is now available.`,
        metadata: {
          sprintId,
          sprintName,
          teamName,
        },
        isRead: false,
      },
    });

    // Emit event for real-time WebSocket notification
    this.eventEmitter.emit('notification.created', {
      notificationId: notification.id,
      userId: teamLeadId,
      type: 'SPRINT_REPORT_READY',
      message: notification.message,
      createdAt: notification.createdAt,
    });

    this.logger.log(
      `[NOTIFICATION] Sprint report ready notification sent for ${sprintName} - Team Lead: ${teamLeadId}`,
    );
  }

  /**
   * Manually trigger sprint end check (for testing)
   */
  async triggerSprintEndCheck(): Promise<{ processed: number }> {
    const endedSprints = await this.findEndedSprintsWithoutReports();

    for (const sprint of endedSprints) {
      await this.processEndedSprint(sprint);
    }

    return { processed: endedSprints.length };
  }

  /**
   * Get processing status for monitoring
   */
  getProcessingStatus(): { isProcessing: boolean } {
    return { isProcessing: this.isProcessing };
  }
}
