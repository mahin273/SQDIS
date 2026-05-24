import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REATTRIBUTION_QUEUE } from '../../../config';
import { PrismaService } from '../../../prisma';
import { ReattributionJobData, ReattributionResult, REATTRIBUTION_BATCH_SIZE } from '../types';

/**
 * BullMQ Worker for processing commit re-attribution jobs
 */
@Processor(REATTRIBUTION_QUEUE)
export class ReattributionProcessor extends WorkerHost {
  private readonly logger = new Logger(ReattributionProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Process a re-attribution job from the queue
   */
  async process(job: Job<ReattributionJobData>): Promise<ReattributionResult> {
    const startTime = Date.now();
    const { email, userId, operation } = job.data;

    this.logger.log(
      `Processing re-attribution job ${job.id}: ${operation} commits for email ${email}`,
    );

    try {
      const result = await this.processReattribution(email, userId, operation);

      const durationMs = Date.now() - startTime;
      this.logger.log(
        `Re-attribution complete for ${email}: ${result.commitsUpdated} commits updated in ${result.batchesProcessed} batches (${durationMs}ms)`,
      );

      return {
        ...result,
        durationMs,
      };
    } catch (error) {
      this.logger.error(`Failed to process re-attribution for ${email}: ${error}`);
      throw error;
    }
  }

  /**
   * Process commits in batches of 1000
   */
  private async processReattribution(
    email: string,
    userId: string | null,
    operation: 'attribute' | 'unattribute',
  ): Promise<Omit<ReattributionResult, 'durationMs'>> {
    let totalProcessed = 0;
    let commitsUpdated = 0;
    let batchesProcessed = 0;
    let hasMore = true;

    const normalizedEmail = email.toLowerCase();

    while (hasMore) {
      // Find commits matching the email in batches
      const commits = await this.prisma.commit.findMany({
        where: {
          authorEmail: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          // For attribution: find commits without a developer
          // For unattribution: find commits with the specific developer
          ...(operation === 'attribute' ? { developerId: null } : { developerId: userId }),
        },
        select: { id: true },
        take: REATTRIBUTION_BATCH_SIZE,
      });

      if (commits.length === 0) {
        hasMore = false;
        break;
      }

      totalProcessed += commits.length;
      batchesProcessed++;

      // Update commits with matching author email
      const updateResult = await this.prisma.commit.updateMany({
        where: {
          id: { in: commits.map((c) => c.id) },
        },
        data: {
          developerId: operation === 'attribute' ? userId : null,
        },
      });

      commitsUpdated += updateResult.count;

      this.logger.debug(
        `Batch ${batchesProcessed}: processed ${commits.length} commits, updated ${updateResult.count}`,
      );

      // If we got fewer than batch size, we're done
      if (commits.length < REATTRIBUTION_BATCH_SIZE) {
        hasMore = false;
      }

      // Update job progress
      this.updateJobProgress(totalProcessed, batchesProcessed);
    }

    // Log total records updated as per requirement 2.10.5
    this.logger.log(
      `Re-attribution complete: ${commitsUpdated} total records updated for email ${email}`,
    );

    return {
      totalProcessed,
      commitsUpdated,
      batchesProcessed,
    };
  }

  /**
   * Update job progress for monitoring
   */
  private updateJobProgress(processed: number, batches: number): void {
    // Progress updates can be used for monitoring
     this.logger.debug(`Progress: ${processed} commits in ${batches} batches`);
  }
}
