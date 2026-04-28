/*eslint-disable */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import {
  ParsedCommitData,
  ParsedReviewData,
  ParsedReviewCommentData,
  ParsedPullRequestData,
  ParsedIssueData,
  ParsedReleaseData,
  ParsedCommitCommentData,
} from '../dto/webhook-payload.dto';

/**
 * Queue names for GitHub webhook processing
 */
export const COMMIT_QUEUE_NAME = 'commit-processing';
export const REVIEW_QUEUE_NAME = 'review-processing';
export const REVIEW_COMMENT_QUEUE_NAME = 'review-comment-processing';
export const PULL_REQUEST_QUEUE_NAME = 'pull-request-processing';
export const ISSUE_QUEUE_NAME = 'issue-processing';
export const RELEASE_QUEUE_NAME = 'release-processing';
export const COMMIT_COMMENT_QUEUE_NAME = 'commit-comment-processing';

/**
 * Job types for commit processing queue
 */
export interface CommitJobData {
  type: 'process_commit';
  commit: ParsedCommitData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Job types for review processing queue
 */
export interface ReviewJobData {
  type: 'process_review';
  review: ParsedReviewData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Job types for review comment processing queue
 */
export interface ReviewCommentJobData {
  type: 'process_review_comment' | 'delete_review_comment';
  comment: ParsedReviewCommentData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Job types for pull request processing queue
 */
export interface PullRequestJobData {
  type: 'process_pull_request';
  pullRequest: ParsedPullRequestData;
  action: string;
  repositoryId: string;
  organizationId: string;
}

/**
 * Job types for issue processing queue
 */
export interface IssueJobData {
  type: 'process_issue';
  issue: ParsedIssueData;
  action: string;
  repositoryId: string;
  organizationId: string;
}

/**
 * Job types for release processing queue
 */
export interface ReleaseJobData {
  type: 'process_release';
  release: ParsedReleaseData;
  action: string;
  repositoryId: string;
  organizationId: string;
}

/**
 * Job types for commit comment processing queue
 */
export interface CommitCommentJobData {
  type: 'process_commit_comment';
  comment: ParsedCommitCommentData;
  repositoryId: string;
  organizationId: string;
}

/**
 * Redis connection options
 */
const getRedisConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
});

/**
 * Service for managing commit and review processing queues
 */
@Injectable()
export class CommitProcessorQueue implements OnModuleInit {
  private readonly logger = new Logger(CommitProcessorQueue.name);
  private commitQueue: Queue<CommitJobData>;
  private reviewQueue: Queue<ReviewJobData>;
  private reviewCommentQueue: Queue<ReviewCommentJobData>;
  private pullRequestQueue: Queue<PullRequestJobData>;
  private issueQueue: Queue<IssueJobData>;
  private releaseQueue: Queue<ReleaseJobData>;
  private commitCommentQueue: Queue<CommitCommentJobData>;

  async onModuleInit() {
    const connection = getRedisConnection();

    this.commitQueue = new Queue<CommitJobData>(COMMIT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.reviewQueue = new Queue<ReviewJobData>(REVIEW_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.reviewCommentQueue = new Queue<ReviewCommentJobData>(REVIEW_COMMENT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.pullRequestQueue = new Queue<PullRequestJobData>(PULL_REQUEST_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.issueQueue = new Queue<IssueJobData>(ISSUE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.releaseQueue = new Queue<ReleaseJobData>(RELEASE_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.commitCommentQueue = new Queue<CommitCommentJobData>(COMMIT_COMMENT_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.logger.log(
      'Commit, review, review comment, pull request, issue, release, and commit comment processing queues initialized',
    );
  }

  /**
   * Add a commit processing job to the queue
   *
   * @param commit - Parsed commit data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @returns Job instance
   */
  async addCommitJob(
    commit: ParsedCommitData,
    repositoryId: string,
    organizationId: string,
  ): Promise<Job<CommitJobData>> {
    const jobData: CommitJobData = {
      type: 'process_commit',
      commit,
      repositoryId,
      organizationId,
    };

    const job = await this.commitQueue.add(`commit-${commit.sha}`, jobData, {
      jobId: `commit-${commit.sha}-${repositoryId}`,
    });

    this.logger.debug(`Queued commit ${commit.sha} for processing`);
    return job;
  }

  /**
   * Add multiple commit processing jobs to the queue
   *
   * @param commits - Array of parsed commit data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @returns Array of job instances
   */
  async addCommitJobs(
    commits: ParsedCommitData[],
    repositoryId: string,
    organizationId: string,
  ): Promise<Job<CommitJobData>[]> {
    const jobs: Job<CommitJobData>[] = [];

    for (const commit of commits) {
      const job = await this.addCommitJob(commit, repositoryId, organizationId);
      jobs.push(job);
    }

    this.logger.log(`Queued ${jobs.length} commits for processing`);
    return jobs;
  }

  /**
   * Add a review processing job to the queue
   *
   * @param review - Parsed review data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @returns Job instance
   */
  async addReviewJob(
    review: ParsedReviewData,
    repositoryId: string,
    organizationId: string,
  ): Promise<Job<ReviewJobData>> {
    const jobData: ReviewJobData = {
      type: 'process_review',
      review,
      repositoryId,
      organizationId,
    };

    const job = await this.reviewQueue.add(`review-${review.reviewId}`, jobData, {
      jobId: `review-${review.reviewId}-${repositoryId}`,
    });

    this.logger.debug(`Queued review ${review.reviewId} for processing`);
    return job;
  }

  /**
   * Add a review comment processing job to the queue
   *
   * @param comment - Parsed review comment data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @param action - The action type (created, edited, deleted)
   * @returns Job instance
   */
  async addReviewCommentJob(
    comment: ParsedReviewCommentData,
    repositoryId: string,
    organizationId: string,
    action: 'created' | 'edited' | 'deleted' = 'created',
  ): Promise<Job<ReviewCommentJobData>> {
    const jobType = action === 'deleted' ? 'delete_review_comment' : 'process_review_comment';
    const jobData: ReviewCommentJobData = {
      type: jobType,
      comment,
      repositoryId,
      organizationId,
    };

    const job = await this.reviewCommentQueue.add(`comment-${comment.commentId}`, jobData, {
      jobId: `comment-${comment.commentId}-${repositoryId}-${action}`,
    });

    this.logger.debug(`Queued review comment ${comment.commentId} for ${action} processing`);
    return job;
  }

  /**
   * Add a pull request processing job to the queue
   *
   * @param pullRequest - Parsed pull request data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @param action - The PR action (opened, closed, reopened, synchronize, review_requested)
   * @returns Job instance
   */
  async addPullRequestJob(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    organizationId: string,
    action: string = 'synchronize',
  ): Promise<Job<PullRequestJobData>> {
    const jobData: PullRequestJobData = {
      type: 'process_pull_request',
      pullRequest,
      action,
      repositoryId,
      organizationId,
    };

    const job = await this.pullRequestQueue.add(`pr-${pullRequest.prId}`, jobData, {
      jobId: `pr-${pullRequest.prId}-${repositoryId}-${action}`,
    });

    this.logger.debug(`Queued pull request ${pullRequest.prId} for processing (action: ${action})`);
    return job;
  }

  /**
   * Add an issue processing job to the queue
   *
   * @param issue - Parsed issue data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @param action - The issue action (opened, closed, reopened, labeled, unlabeled, assigned, unassigned)
   * @returns Job instance
   */
  async addIssueJob(
    issue: ParsedIssueData,
    repositoryId: string,
    organizationId: string,
    action: string,
  ): Promise<Job<IssueJobData>> {
    const jobData: IssueJobData = {
      type: 'process_issue',
      issue,
      action,
      repositoryId,
      organizationId,
    };

    const job = await this.issueQueue.add(`issue-${issue.issueId}`, jobData, {
      jobId: `issue-${issue.issueId}-${repositoryId}-${action}`,
    });

    this.logger.debug(`Queued issue ${issue.issueId} for processing (action: ${action})`);
    return job;
  }

  /**
   * Add a release processing job to the queue
   *
   * @param release - Parsed release data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @param action - The release action (published, created, deleted, edited)
   * @returns Job instance
   */
  async addReleaseJob(
    release: ParsedReleaseData,
    repositoryId: string,
    organizationId: string,
    action: string,
  ): Promise<Job<ReleaseJobData>> {
    const jobData: ReleaseJobData = {
      type: 'process_release',
      release,
      action,
      repositoryId,
      organizationId,
    };

    const job = await this.releaseQueue.add(`release-${release.releaseId}`, jobData, {
      jobId: `release-${release.releaseId}-${repositoryId}-${action}`,
    });

    this.logger.debug(`Queued release ${release.releaseId} for processing (action: ${action})`);
    return job;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [
      commitCounts,
      reviewCounts,
      reviewCommentCounts,
      pullRequestCounts,
      issueCounts,
      releaseCounts,
      commitCommentCounts,
    ] = await Promise.all([
      this.commitQueue.getJobCounts(),
      this.reviewQueue.getJobCounts(),
      this.reviewCommentQueue.getJobCounts(),
      this.pullRequestQueue.getJobCounts(),
      this.issueQueue.getJobCounts(),
      this.releaseQueue.getJobCounts(),
      this.commitCommentQueue.getJobCounts(),
    ]);

    return {
      commits: commitCounts,
      reviews: reviewCounts,
      reviewComments: reviewCommentCounts,
      pullRequests: pullRequestCounts,
      issues: issueCounts,
      releases: releaseCounts,
      commitComments: commitCommentCounts,
    };
  }

  /**
   * Get the commit queue instance (for worker registration)
   */
  getCommitQueue(): Queue<CommitJobData> {
    return this.commitQueue;
  }

  /**
   * Get the review queue instance (for worker registration)
   */
  getReviewQueue(): Queue<ReviewJobData> {
    return this.reviewQueue;
  }

  /**
   * Get the review comment queue instance (for worker registration)
   */
  getReviewCommentQueue(): Queue<ReviewCommentJobData> {
    return this.reviewCommentQueue;
  }

  /**
   * Get the pull request queue instance (for worker registration)
   */
  getPullRequestQueue(): Queue<PullRequestJobData> {
    return this.pullRequestQueue;
  }

  /**
   * Get the issue queue instance (for worker registration)
   */
  getIssueQueue(): Queue<IssueJobData> {
    return this.issueQueue;
  }

  /**
   * Get the release queue instance (for worker registration)
   */
  getReleaseQueue(): Queue<ReleaseJobData> {
    return this.releaseQueue;
  }

  /**
   * Add a commit comment processing job to the queue
   *
   * @param comment - Parsed commit comment data
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @returns Job instance
   */
  async addCommitCommentJob(
    comment: ParsedCommitCommentData,
    repositoryId: string,
    organizationId: string,
  ): Promise<Job<CommitCommentJobData>> {
    const jobData: CommitCommentJobData = {
      type: 'process_commit_comment',
      comment,
      repositoryId,
      organizationId,
    };

    const job = await this.commitCommentQueue.add(`comment-${comment.commentId}`, jobData, {
      jobId: `commit-comment-${comment.commentId}-${repositoryId}`,
    });

    this.logger.debug(`Queued commit comment ${comment.commentId} for processing`);
    return job;
  }

  /**
   * Get the commit comment queue instance (for worker registration)
   */
  getCommitCommentQueue(): Queue<CommitCommentJobData> {
    return this.commitCommentQueue;
  }
}
