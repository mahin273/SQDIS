import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bullmq';
import { REVIEW_QUEUE } from '../../../config';
import { ReviewsService } from '../reviews.service';
import { ScoresService } from '../../scores/scores.service';
import { ParsedReviewData } from '../../github/dto/webhook-payload.dto';

/**
 * Job data structure for review processing
 */
export interface ReviewJobData {
  type: 'process_review';
  review: ParsedReviewData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Result of processing a review
 */
export interface ProcessedReviewResult {
  reviewId: string;
  githubReviewId: number;
  state: string;
  turnaroundMinutes: number | null;
  turnaroundClass: string | null;
  reviewerId: string | null;
}

/**
 * BullMQ Worker for processing review jobs
 */
@Processor(REVIEW_QUEUE)
export class ReviewProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewProcessor.name);

  constructor(
    private readonly reviewsService: ReviewsService,
    @Inject(forwardRef(() => ScoresService))
    private readonly scoresService: ScoresService,
  ) {
    super();
  }

  /**
   * Process a review job from the queue
   */
  async process(job: Job<ReviewJobData>): Promise<ProcessedReviewResult> {
    this.logger.log(`Processing review job ${job.id}: review ${job.data.review.reviewId}`);

    try {
      const { review, repositoryId, organizationId } = job.data;

      // Process the review using the reviews service
      const result = await this.reviewsService.processReviewFromQueue(review, repositoryId);

      this.logger.log(
        `Successfully processed review ${review.reviewId}: state=${result.state}, turnaround=${result.turnaroundClass}`,
      );

      // Trigger DQS recalculation for the reviewer if they are a known user
      // review metrics change triggers DQS recalculation
      if (result.reviewerId) {
        await this.triggerDQSRecalculation(result.reviewerId, organizationId);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to process review ${job.data.review.reviewId}: ${error}`);
      throw error;
    }
  }

  /**
   * Trigger DQS recalculation for a reviewer after processing a new review
   * review metrics change triggers DQS recalculation
   *
   * @param reviewerId - The reviewer's user ID
   * @param organizationId - The organization ID
   */
  private async triggerDQSRecalculation(reviewerId: string, organizationId: string): Promise<void> {
    try {
      this.logger.debug(`Triggering DQS recalculation for reviewer ${reviewerId}`);
      await this.scoresService.enqueueScoreCalculation({
        entityId: reviewerId,
        type: 'dqs',
        organizationId,
        triggeredBy: 'review',
      });
      this.logger.log(`Enqueued DQS recalculation for reviewer ${reviewerId}`);
    } catch (error) {
      // Log but don't fail the review processing if DQS recalculation fails
      this.logger.warn(`Failed to trigger DQS recalculation for reviewer ${reviewerId}: ${error}`);
    }
  }
}
