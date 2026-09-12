import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { PULL_REQUEST_QUEUE_NAME, PullRequestJobData } from '../queues/commit-processor.queue';
import { ParsedPullRequestData } from '../dto/webhook-payload.dto';
import { PullRequestState } from '@prisma/client';
import { DatabaseErrorHandler } from '../utils/database-error-handler';
import { PrQualityGateBotService } from '../services/pr-quality-gate-bot.service';

/**
 * Result of processing a pull request
 */
export interface ProcessedPullRequestResult {
  pullRequestId: string;
  prNumber: number;
  action: string;
  authorId: string | null;
}

/**
 * BullMQ Worker for processing pull request jobs from GitHub webhooks
 *
 * This worker handles:
 * - PR creation for 'opened' action
 * - PR updates for 'closed', 'reopened', 'synchronize' actions
 * - Review requests for 'review_requested' action
 * - Mapping GitHub users to internal users via githubId
 * - Triggering automated Quality Gate bot evaluations
 *
 */
@Processor(PULL_REQUEST_QUEUE_NAME)
export class PullRequestWorker extends WorkerHost {
  private readonly logger = new Logger(PullRequestWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prQualityGateBotService: PrQualityGateBotService,
  ) {
    super();
  }

  /**
   * Process a pull request job from the queue
   *
   * Handles different PR actions:
   * - opened: Creates a new pull request record
   * - closed: Updates the pull request status (checks merged flag)
   * - reopened: Updates the pull request status to open
   * - synchronize: Updates the pull request with new commits
   * - review_requested: Records the review request (currently logs only)
   *
   */
  async process(job: Job<PullRequestJobData>): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Processing pull request job ${job.id}: PR #${job.data.pullRequest.prNumber}`);

    try {
      const { pullRequest, repositoryId, organizationId, action } = job.data;

      // Find PR author by GitHub ID
      const author = await this.prisma.user.findFirst({
        where: { githubId: String(pullRequest.authorId) },
      });

      let result: ProcessedPullRequestResult;

      switch (action) {
        case 'opened':
          result = await this.handleOpened(pullRequest, repositoryId, author?.id || null);
          break;
        case 'closed':
          result = await this.handleClosed(pullRequest, repositoryId, author?.id || null);
          break;
        case 'reopened':
          result = await this.handleReopened(pullRequest, repositoryId, author?.id || null);
          break;
        case 'synchronize':
          result = await this.handleSynchronize(pullRequest, repositoryId, author?.id || null);
          break;
        case 'review_requested':
          result = await this.handleReviewRequested(pullRequest, repositoryId, author?.id || null);
          break;
        default:
          this.logger.warn(`Unknown action for PR #${pullRequest.prNumber}: ${action}`);
          result = {
            pullRequestId: '',
            prNumber: pullRequest.prNumber,
            action,
            authorId: author?.id || null,
          };
      }

      // Trigger automated Quality Gate evaluation for opened, synchronize, or reopened PRs
      if (['opened', 'synchronize', 'reopened'].includes(action)) {
        try {
          await this.prQualityGateBotService.evaluateAndReport({
            repositoryId,
            prNumber: pullRequest.prNumber,
            headCommitSha: pullRequest.headCommitSha,
            pullRequestId: result.pullRequestId || undefined,
            organizationId,
          });
          this.logger.log(`Completed Quality Gate evaluation for PR #${pullRequest.prNumber}`);
        } catch (gateErr) {
          this.logger.error(
            `Quality Gate evaluation failed for PR #${pullRequest.prNumber}: ${gateErr.message}`,
          );
        }
      }

      this.logger.log(`Successfully processed PR #${pullRequest.prNumber} (action: ${action})`);
      return result;
    } catch (error) {
      // Extract data for error handling
      const { pullRequest, action } = job.data;

      // Handle database errors with retry logic
      const handled = DatabaseErrorHandler.handleDatabaseError(error, this.logger, {
        jobId: job.id,
        entityType: 'PullRequest',
        entityId: pullRequest.prNumber,
        action,
      });

      // If handled as idempotent success, return a result
      if (handled) {
        return {
          pullRequestId: '',
          prNumber: pullRequest.prNumber,
          action,
          authorId: null,
        };
      }

      // Otherwise, error was re-thrown by handler
      throw error;
    }
  }

  /**
   * Handle PR creation for 'opened' action
   */
  private async handleOpened(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    authorId: string | null,
  ): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Creating new PR #${pullRequest.prNumber}`);

    const state = this.mapPullRequestState(pullRequest);

    const pr = await this.prisma.pullRequest.upsert({
      where: {
        repositoryId_githubPrId: {
          repositoryId,
          githubPrId: pullRequest.prId,
        },
      },
      create: {
        repositoryId,
        githubPrId: pullRequest.prId,
        prNumber: pullRequest.prNumber,
        title: pullRequest.title,
        body: pullRequest.body,
        state,
        merged: pullRequest.merged,
        mergedAt: pullRequest.mergedAt,
        authorLogin: pullRequest.authorLogin,
        authorId: pullRequest.authorId,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        baseCommitSha: pullRequest.baseCommitSha,
        headCommitSha: pullRequest.headCommitSha,
        createdAt: pullRequest.createdAt,
        updatedAt: pullRequest.updatedAt,
        closedAt: pullRequest.closedAt,
      },
      update: {
        title: pullRequest.title,
        body: pullRequest.body,
        state,
        merged: pullRequest.merged,
        mergedAt: pullRequest.mergedAt,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        baseCommitSha: pullRequest.baseCommitSha,
        headCommitSha: pullRequest.headCommitSha,
        updatedAt: pullRequest.updatedAt,
        closedAt: pullRequest.closedAt,
      },
    });

    return {
      pullRequestId: pr.id,
      prNumber: pr.prNumber,
      action: 'opened',
      authorId,
    };
  }

  /**
   * Handle PR closure for 'closed' action
   */
  private async handleClosed(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    authorId: string | null,
  ): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Closing PR #${pullRequest.prNumber} (merged: ${pullRequest.merged})`);

    const state = pullRequest.merged ? PullRequestState.MERGED : PullRequestState.CLOSED;

    const pr = await this.prisma.pullRequest.upsert({
      where: {
        repositoryId_githubPrId: {
          repositoryId,
          githubPrId: pullRequest.prId,
        },
      },
      create: {
        repositoryId,
        githubPrId: pullRequest.prId,
        prNumber: pullRequest.prNumber,
        title: pullRequest.title,
        body: pullRequest.body,
        state,
        merged: pullRequest.merged,
        mergedAt: pullRequest.mergedAt,
        authorLogin: pullRequest.authorLogin,
        authorId: pullRequest.authorId,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        baseCommitSha: pullRequest.baseCommitSha,
        headCommitSha: pullRequest.headCommitSha,
        createdAt: pullRequest.createdAt,
        updatedAt: pullRequest.updatedAt,
        closedAt: pullRequest.closedAt,
      },
      update: {
        state,
        merged: pullRequest.merged,
        mergedAt: pullRequest.mergedAt,
        updatedAt: pullRequest.updatedAt,
        closedAt: pullRequest.closedAt,
      },
    });

    return {
      pullRequestId: pr.id,
      prNumber: pr.prNumber,
      action: 'closed',
      authorId,
    };
  }

  /**
   * Handle PR reopening for 'reopened' action
   */
  private async handleReopened(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    authorId: string | null,
  ): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Reopening PR #${pullRequest.prNumber}`);

    const pr = await this.prisma.pullRequest.update({
      where: {
        repositoryId_githubPrId: {
          repositoryId,
          githubPrId: pullRequest.prId,
        },
      },
      data: {
        state: PullRequestState.OPEN,
        updatedAt: pullRequest.updatedAt,
        closedAt: null,
      },
    });

    return {
      pullRequestId: pr.id,
      prNumber: pr.prNumber,
      action: 'reopened',
      authorId,
    };
  }

  /**
   * Handle PR synchronization for 'synchronize' action
   * Updates the PR with new commits
   */
  private async handleSynchronize(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    authorId: string | null,
  ): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Synchronizing PR #${pullRequest.prNumber} with new commits`);

    const pr = await this.prisma.pullRequest.update({
      where: {
        repositoryId_githubPrId: {
          repositoryId,
          githubPrId: pullRequest.prId,
        },
      },
      data: {
        headCommitSha: pullRequest.headCommitSha,
        updatedAt: pullRequest.updatedAt,
      },
    });

    return {
      pullRequestId: pr.id,
      prNumber: pr.prNumber,
      action: 'synchronize',
      authorId,
    };
  }

  /**
   * Handle review request for 'review_requested' action
   */
  private async handleReviewRequested(
    pullRequest: ParsedPullRequestData,
    repositoryId: string,
    authorId: string | null,
  ): Promise<ProcessedPullRequestResult> {
    this.logger.log(`Recording review request for PR #${pullRequest.prNumber}`);

    // Ensure the PR exists in the database
    const pr = await this.prisma.pullRequest.upsert({
      where: {
        repositoryId_githubPrId: {
          repositoryId,
          githubPrId: pullRequest.prId,
        },
      },
      create: {
        repositoryId,
        githubPrId: pullRequest.prId,
        prNumber: pullRequest.prNumber,
        title: pullRequest.title,
        body: pullRequest.body,
        state: this.mapPullRequestState(pullRequest),
        merged: pullRequest.merged,
        mergedAt: pullRequest.mergedAt,
        authorLogin: pullRequest.authorLogin,
        authorId: pullRequest.authorId,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        baseCommitSha: pullRequest.baseCommitSha,
        headCommitSha: pullRequest.headCommitSha,
        createdAt: pullRequest.createdAt,
        updatedAt: pullRequest.updatedAt,
        closedAt: pullRequest.closedAt,
      },
      update: {
        updatedAt: pullRequest.updatedAt,
      },
    });

    // Note: The actual review request details (requested reviewer) would need to be
    // stored in a separate table if we want to track them. For now, we just ensure
    // the PR exists and is up to date.

    return {
      pullRequestId: pr.id,
      prNumber: pr.prNumber,
      action: 'review_requested',
      authorId,
    };
  }

  /**
   * Map ParsedPullRequestData state to PullRequestState enum
   */
  private mapPullRequestState(pullRequest: ParsedPullRequestData): PullRequestState {
    if (pullRequest.merged) {
      return PullRequestState.MERGED;
    }
    if (pullRequest.state === 'closed') {
      return PullRequestState.CLOSED;
    }
    return PullRequestState.OPEN;
  }
}
