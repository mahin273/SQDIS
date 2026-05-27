import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PULL_REQUEST_QUEUE } from '../../../config';
import { ReviewsService } from '../reviews.service';
import { ParsedPullRequestData } from '../../github/dto/webhook-payload.dto';

/**
 * Job data structure for pull request processing
 */
export interface PullRequestJobData {
  type: 'process_pull_request';
  pullRequest: ParsedPullRequestData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Result of processing a pull request
 */
export interface ProcessedPullRequestResult {
  prId: number;
  prNumber: number;
  authorId: string | null;
}

/**
 * BullMQ Worker for processing pull request jobs
 */
@Processor(PULL_REQUEST_QUEUE)
export class PullRequestProcessor extends WorkerHost {
  private readonly logger = new Logger(PullRequestProcessor.name);

  constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  /**
   * Process a pull request job from the queue
   */
  async process(job: Job<PullRequestJobData>): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Processing pull request job ${job.id}: PR ${job.data.pullRequest.prNumber}`);

    try {
      const { pullRequest, repositoryId, organizationId } = job.data;

      // Process the pull request using the reviews service
      const result = await this.reviewsService.processPullRequestFromQueue(
        pullRequest,
        repositoryId,
        organizationId,
      );

      this.logger.log(`Successfully processed PR ${pullRequest.prNumber}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to process PR ${job.data.pullRequest.prNumber}: ${error}`);
      throw error;
    }
  }
}
