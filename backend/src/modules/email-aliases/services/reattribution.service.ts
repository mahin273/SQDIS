import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { REATTRIBUTION_QUEUE } from '../../../config';
import { ReattributionJobData } from '../types';

/**
 * Service for managing commit re-attribution jobs
 */
@Injectable()
export class ReattributionService {
  private readonly logger = new Logger(ReattributionService.name);

  constructor(
    @InjectQueue(REATTRIBUTION_QUEUE)
    private readonly reattributionQueue: Queue<ReattributionJobData>,
  ) {}

  /**
   * Trigger re-attribution when an email alias is verified
   */
  async triggerAttributionOnVerification(
    email: string,
    userId: string,
    organizationId?: string,
  ): Promise<string> {
    this.logger.log(`Triggering commit attribution for verified email: ${email}`);

    const job = await this.reattributionQueue.add(
      'attribute-commits',
      {
        email,
        userId,
        organizationId,
        operation: 'attribute',
      },
      {
        jobId: `attr-${email}-${Date.now()}`,
      },
    );

    this.logger.log(`Created attribution job ${job.id} for email ${email}`);
    return job.id as string;
  }

  /**
   * Trigger un-attribution when an email alias is removed
   */
  async triggerUnattributionOnRemoval(
    email: string,
    userId: string,
    organizationId?: string,
  ): Promise<string> {
    this.logger.log(`Triggering commit un-attribution for removed email: ${email}`);

    const job = await this.reattributionQueue.add(
      'unattribute-commits',
      {
        email,
        userId,
        organizationId,
        operation: 'unattribute',
      },
      {
        jobId: `unattr-${email}-${Date.now()}`,
      },
    );

    this.logger.log(`Created un-attribution job ${job.id} for email ${email}`);
    return job.id as string;
  }

  /**
   * Get the status of a re-attribution job
   */
  async getJobStatus(jobId: string) {
    const job = await this.reattributionQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    const state = await job.getState();
    return {
      id: job.id,
      state,
      data: job.data,
      progress: job.progress,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
