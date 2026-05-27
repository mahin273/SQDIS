import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { REVIEW_COMMENT_QUEUE } from '../../../config';
import { ReviewsService } from '../reviews.service';
import { ParsedReviewCommentData } from '../../github/dto/webhook-payload.dto';

/**
 * Job data structure for review comment processing
 */
export interface ReviewCommentJobData {
  type: 'process_review_comment' | 'delete_review_comment';
  comment: ParsedReviewCommentData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Result of processing a review comment
 */
export interface ProcessedReviewCommentResult {
  commentId: string;
  githubCommentId: number;
  reviewId: string | null;
  authorId: string | null;
  filePath: string | null;
  lineNumber: number | null;
  parentId: string | null;
  commentClass: string | null;
  action: 'created' | 'updated' | 'deleted';
}

/**
 * BullMQ Worker for processing review comment jobs
 */
@Processor(REVIEW_COMMENT_QUEUE)
export class ReviewCommentProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewCommentProcessor.name);

  constructor(private readonly reviewsService: ReviewsService) {
    super();
  }

  /**
   * Process a review comment job from the queue
   */
  async process(job: Job<ReviewCommentJobData>): Promise<ProcessedReviewCommentResult> {
    this.logger.log(
      `Processing review comment job ${job.id}: comment ${job.data.comment.commentId}`,
    );

    try {
      const { type, comment, repositoryId } = job.data;

      if (type === 'delete_review_comment') {
        return this.processDeleteComment(comment, repositoryId);
      }

      return this.processCreateOrUpdateComment(comment, repositoryId);
    } catch (error) {
      this.logger.error(`Failed to process review comment ${job.data.comment.commentId}: ${error}`);
      throw error;
    }
  }

  /**
   * Process a created or updated review comment
   */
  private async processCreateOrUpdateComment(
    comment: ParsedReviewCommentData,
    repositoryId: string,
  ): Promise<ProcessedReviewCommentResult> {
    const result = await this.reviewsService.processReviewCommentFromQueue(comment, repositoryId);

    this.logger.log(
      `Successfully processed review comment ${comment.commentId}: file=${result.filePath}, line=${result.lineNumber}`,
    );

    return result;
  }

  /**
   * Process a deleted review comment (soft delete)
   */
  private async processDeleteComment(
    comment: ParsedReviewCommentData,
    repositoryId: string,
  ): Promise<ProcessedReviewCommentResult> {
    const result = await this.reviewsService.softDeleteReviewComment(
      comment.commentId,
      repositoryId,
    );

    this.logger.log(`Soft-deleted review comment ${comment.commentId}`);

    return result;
  }
}
