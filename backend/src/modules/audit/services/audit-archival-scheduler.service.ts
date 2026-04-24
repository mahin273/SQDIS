import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ARCHIVAL_QUEUE } from '../audit.module';

/**
 * Service for scheduling automated audit log archival.
 *
 * This service runs a daily cron job at 2 AM UTC to queue archival jobs
 * for all organizations based on their retention policies.
 *
 */
@Injectable()
export class AuditArchivalSchedulerService {
  private readonly logger = new Logger(AuditArchivalSchedulerService.name);

  constructor(
    @InjectQueue(ARCHIVAL_QUEUE) private readonly archivalQueue: Queue,
  ) {}

  /**
   * Scheduled job that runs daily at 2 AM UTC to trigger archival process.
   *
   * The job queues an archival task that will:
   * - Process all organizations
   * - Apply their retention policies
   * - Move old entries to archive
   * - Compress data
   * - Log the operation
   *
   */
  @Cron('0 2 * * *', {
    name: 'daily-audit-archival',
    timeZone: 'UTC',
  })
  async scheduleDailyArchival(): Promise<void> {
    this.logger.log('Starting daily audit log archival process');

    try {
      // Queue archival job for all organizations
      const job = await this.archivalQueue.add(
        'daily-archival',
        {
          // No organizationId means process all organizations
          organizationId: undefined,
        },
        {
          priority: 1, // High priority for scheduled jobs
          removeOnComplete: true,
          removeOnFail: false, // Keep failed jobs for debugging
        },
      );

      this.logger.log(`Queued daily archival job with ID: ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue daily archival job: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Manual trigger for archival (useful for testing or manual operations).
   *
   * @param organizationId - Optional organization ID to archive only specific org
   */
  async triggerArchival(organizationId?: string): Promise<void> {
    this.logger.log(
      `Manually triggering archival${organizationId ? ` for organization ${organizationId}` : ' for all organizations'}`,
    );

    try {
      const job = await this.archivalQueue.add(
        'manual-archival',
        { organizationId },
        {
          priority: 2, // Lower priority than scheduled jobs
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(`Queued manual archival job with ID: ${job.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue manual archival job: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
