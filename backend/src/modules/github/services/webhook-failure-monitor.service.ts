import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { AlertsService } from '../../alerts/alerts.service';
import { AlertType } from '@prisma/client';
import {
  PULL_REQUEST_QUEUE_NAME,
  ISSUE_QUEUE_NAME,
  RELEASE_QUEUE_NAME,
  COMMIT_COMMENT_QUEUE_NAME,
  COMMIT_QUEUE_NAME,
  REVIEW_QUEUE_NAME,
  REVIEW_COMMENT_QUEUE_NAME,
} from '../queues/commit-processor.queue';

/**
 * Service for monitoring webhook processing failures and creating alerts
 */
@Injectable()
export class WebhookFailureMonitorService implements OnModuleInit {
  private readonly logger = new Logger(WebhookFailureMonitorService.name);
  private queueEvents: Map<string, QueueEvents> = new Map();

  constructor(private readonly alertsService: AlertsService) {}

  async onModuleInit() {
    // Get Redis connection configuration
    const connection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };

    // List of all webhook processing queues to monitor
    const queueNames = [
      PULL_REQUEST_QUEUE_NAME,
      ISSUE_QUEUE_NAME,
      RELEASE_QUEUE_NAME,
      COMMIT_COMMENT_QUEUE_NAME,
      COMMIT_QUEUE_NAME,
      REVIEW_QUEUE_NAME,
      REVIEW_COMMENT_QUEUE_NAME,
    ];

    // Set up listeners for each queue
    for (const queueName of queueNames) {
      const queueEvents = new QueueEvents(queueName, { connection });
      this.queueEvents.set(queueName, queueEvents);

      // Listen for failed jobs (after all retries exhausted)
      queueEvents.on('failed', async ({ jobId, failedReason, prev }) => {
        // Only create alert if this is a permanent failure (no more retries)
        // BullMQ emits 'failed' for each retry attempt, so we check attemptsMade
        try {
          // Get the queue to fetch job details
          const queue = new Queue(queueName, { connection });
          const job = await queue.getJob(jobId);

          if (!job) {
            this.logger.warn(`Failed job ${jobId} not found in queue ${queueName}`);
            return;
          }

          // Check if this is the final failure (no more retries)
          const maxAttempts = job.opts.attempts || 3;
          const attemptsMade = job.attemptsMade;

          if (attemptsMade >= maxAttempts) {
            // This is a permanent failure - create alert
            await this.createPermanentFailureAlert(
              queueName,
              job.id ?? 'unknown',
              job.data,
              failedReason,
            );
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorStack = error instanceof Error ? error.stack : undefined;
          this.logger.error(
            `Failed to process failure event for job ${jobId} in queue ${queueName}: ${errorMessage}`,
            errorStack,
          );
        }
      });

      this.logger.log(`Monitoring failures for queue: ${queueName}`);
    }
  }

  /**
   * Create an alert for a permanently failed webhook processing job
   *
   * @param queueName - Name of the queue where the job failed
   * @param jobId - ID of the failed job
   * @param jobData - Data from the failed job
   * @param failedReason - Reason for the failure
   */
  private async createPermanentFailureAlert(
    queueName: string,
    jobId: string | number,
    jobData: any,
    failedReason: string,
  ): Promise<void> {
    try {
      // Extract context from job data
      const organizationId = jobData.organizationId;
      const repositoryId = jobData.repositoryId;

      if (!organizationId) {
        this.logger.warn(
          `Cannot create alert for failed job ${jobId} in queue ${queueName}: missing organizationId`,
        );
        return;
      }

      // Determine event type and entity details
      let eventType = 'unknown';
      let entityDetails = '';

      switch (queueName) {
        case PULL_REQUEST_QUEUE_NAME:
          eventType = 'pull_request';
          entityDetails = `PR #${jobData.pullRequest?.prNumber || 'unknown'}`;
          break;
        case ISSUE_QUEUE_NAME:
          eventType = 'issue';
          entityDetails = `Issue #${jobData.issue?.issueNumber || 'unknown'}`;
          break;
        case RELEASE_QUEUE_NAME:
          eventType = 'release';
          entityDetails = `Release ${jobData.release?.tagName || 'unknown'}`;
          break;
        case COMMIT_COMMENT_QUEUE_NAME:
          eventType = 'commit_comment';
          entityDetails = `Comment ${jobData.comment?.commentId || 'unknown'}`;
          break;
        case COMMIT_QUEUE_NAME:
          eventType = 'commit';
          entityDetails = `Commit ${jobData.commit?.sha?.substring(0, 7) || 'unknown'}`;
          break;
        case REVIEW_QUEUE_NAME:
          eventType = 'pull_request_review';
          entityDetails = `Review ${jobData.review?.reviewId || 'unknown'}`;
          break;
        case REVIEW_COMMENT_QUEUE_NAME:
          eventType = 'pull_request_review_comment';
          entityDetails = `Review Comment ${jobData.comment?.commentId || 'unknown'}`;
          break;
      }

      // Create alert message with full context (Requirement 15.4)
      const message =
        `Webhook processing permanently failed after all retries. ` +
        `Queue: ${queueName}, Job: ${jobId}, Event: ${eventType}, Entity: ${entityDetails}. ` +
        `Repository: ${repositoryId || 'unknown'}. ` +
        `Error: ${failedReason}`;

      // Create alert using AlertsService
      await this.alertsService.createAlert({
        organizationId,
        type: AlertType.WEBHOOK_FAILURE,
        message,
        anomalyScore: 1.0, // High severity for permanent failures
      });

      this.logger.log(
        `Created permanent failure alert for job ${jobId} in queue ${queueName}: ${entityDetails}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to create alert for permanently failed job ${jobId} in queue ${queueName}: ${errorMessage}`,
        errorStack,
      );
    }
  }

  /**
   * Clean up queue event listeners on module destroy
   */
  async onModuleDestroy() {
    for (const [queueName, queueEvents] of this.queueEvents.entries()) {
      await queueEvents.close();
      this.logger.log(`Closed queue events listener for: ${queueName}`);
    }
  }
}
