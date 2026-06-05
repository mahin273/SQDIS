/* eslint-disable */
import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { WebhookSignatureService } from './webhook-signature.service';
import { CacheService } from '../../cache/cache.service';
import { IdempotencyService } from './idempotency.service';
import { WebhookLogService } from './webhook-log.service';
import { RateLimitService } from './rate-limit.service';
import { EventRouter } from './event-router.service';
import { CommitProcessorQueue } from '../queues/commit-processor.queue';
import {
  PushEventPayload,
  PullRequestEventPayload,
  PullRequestReviewEventPayload,
  PullRequestReviewCommentEventPayload,
  ParsedCommitData,
  ParsedReviewData,
  ParsedReviewCommentData,
  ParsedPullRequestData,
} from '../dto/webhook-payload.dto';

/**
 * Supported GitHub webhook event types
 */
export type WebhookEventType =
  | 'push'
  | 'pull_request'
  | 'pull_request_review'
  | 'pull_request_review_comment'
  | 'ping'
  | 'unknown';

/**
 * Result of webhook processing
 */
export interface WebhookProcessingResult {
  success: boolean;
  eventType: WebhookEventType;
  message: string;
  commitsQueued?: number;
  reviewsQueued?: number;
  reviewCommentsQueued?: number;
  pullRequestsQueued?: number;
  forced?: boolean;
  branch?: string;
  tag?: string;
  refType?: 'branch' | 'tag';
}

/**
 * Service for processing GitHub webhooks
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: WebhookSignatureService,
    private readonly idempotencyService: IdempotencyService,
    private readonly commitProcessorQueue: CommitProcessorQueue,
    private readonly webhookLogService: WebhookLogService,
    private readonly rateLimitService: RateLimitService,
    private readonly eventRouter: EventRouter,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Process incoming GitHub webhook
   *
   * @param payload - Raw request body
   * @param signature - X-Hub-Signature-256 header
   * @param event - X-GitHub-Event header
   * @param deliveryId - X-GitHub-Delivery header
   * @returns Processing result
   *
   */
  async processWebhook(
    payload: string,
    signature: string,
    event: string,
    deliveryId: string,
  ): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    this.logger.log(`Processing webhook: event=${event}, delivery=${deliveryId}`);

    const payloadSizeBytes = Buffer.byteLength(payload, 'utf8');
    const maxSizeBytes = parseInt(process.env.WEBHOOK_PAYLOAD_SIZE_LIMIT || '5242880', 10); // Default 5MB

    if (payloadSizeBytes > maxSizeBytes) {
      const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
      const actualSizeMB = (payloadSizeBytes / (1024 * 1024)).toFixed(2);

      // Parse payload to get repository info for logging
      let repositoryInfo = 'unknown';
      try {
        const parsedPayload = JSON.parse(payload) as any;
        if (parsedPayload.repository) {
          repositoryInfo =
            parsedPayload.repository.full_name || `id:${parsedPayload.repository.id}`;
        }
      } catch {
        // If payload can't be parsed, log with unknown repository
      }

      this.logger.warn(
        `Payload size ${actualSizeMB}MB exceeds limit ${maxSizeMB}MB for delivery ${deliveryId}, repository ${repositoryInfo}`,
      );

      // Return 413 with size limit in error response
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          message: `Payload size ${actualSizeMB}MB exceeds limit of ${maxSizeMB}MB`,
          maxSizeBytes,
          maxSizeMB,
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    // Check idempotency - if already processed, return cached result
    const isProcessed = await this.idempotencyService.isProcessed(deliveryId);
    if (isProcessed) {
      const cachedResult = await this.idempotencyService.getCachedResult(deliveryId);

      if (cachedResult) {
        // If original processing succeeded, return cached result
        if (cachedResult.success) {
          this.logger.log(`Returning cached result for delivery ${deliveryId}`);
          return cachedResult;
        }

        // If original processing failed, allow retry
        this.logger.log(`Retrying failed delivery ${deliveryId}`);
      }
    }

    // Handle ping event (sent when webhook is first configured)
    if (event === 'ping') {
      const result: WebhookProcessingResult = {
        success: true,
        eventType: 'ping',
        message: 'Pong! Webhook configured successfully.',
      };

      // Mark as processed
      await this.idempotencyService.markProcessed(deliveryId, result);

      return result;
    }

    // Parse payload to get repository info for signature verification
    let parsedPayload:
      | PushEventPayload
      | PullRequestEventPayload
      | PullRequestReviewEventPayload
      | PullRequestReviewCommentEventPayload;
    try {
      parsedPayload = JSON.parse(payload) as
        | PushEventPayload
        | PullRequestEventPayload
        | PullRequestReviewEventPayload
        | PullRequestReviewCommentEventPayload;
    } catch {
      throw new UnauthorizedException('Invalid JSON payload');
    }

    // Get repository from cache first to avoid DB starvation DOS
    const githubId = parsedPayload.repository.id;
    const cacheKey = `github:repository:secret:${githubId}`;

    let cachedRepository = await this.cacheService.get<{
      id: string;
      organizationId: string;
      fullName: string;
      webhookSecret: string | null;
    } | 'NOT_FOUND'>(cacheKey);

    let repository: {
      id: string;
      organizationId: string;
      fullName: string;
      webhookSecret: string | null;
    } | null = null;

    if (cachedRepository === 'NOT_FOUND') {
      throw new UnauthorizedException('Invalid webhook signature');
    } else if (cachedRepository) {
      repository = cachedRepository;
    } else {
      const dbRepository = await this.prisma.repository.findFirst({
        where: {
          githubId,
          isEnabled: true,
        },
      });

      if (dbRepository) {
        repository = {
          id: dbRepository.id,
          organizationId: dbRepository.organizationId,
          fullName: dbRepository.fullName,
          webhookSecret: dbRepository.webhookSecret,
        };
        await this.cacheService.set(cacheKey, repository, 3600); // 1 hour TTL
      } else {
        await this.cacheService.set(cacheKey, 'NOT_FOUND', 300); // 5 minutes negative caching
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }

    if (!repository.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Check rate limit before processing
    const rateLimitResult = await this.rateLimitService.checkRateLimit(repository.id);

    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);

      this.logger.warn(
        `Rate limit exceeded for repository ${repository.fullName}: ${rateLimitResult.remaining} remaining, retry after ${retryAfterSeconds}s`,
      );

      // Return 429 with Retry-After header
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded',
          retryAfter: retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
        {
          cause: new Error('Rate limit exceeded'),
        },
      );
    }

    // Verify webhook signature
    const isValid = this.signatureService.verifySignature(
      payload,
      signature,
      repository.webhookSecret,
    );

    if (!isValid) {
      this.logger.warn(`Invalid webhook signature for repository ${repository.fullName}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Increment rate limit count after successful validation
    await this.rateLimitService.incrementCount(repository.id);

    // Create webhook log entry at start of processing
    await this.webhookLogService.createLog(deliveryId, event, repository.id, payload);

    try {
      // Process based on event type using EventRouter
      const routerResult = await this.eventRouter.routeEvent(
        event,
        parsedPayload,
        repository.id,
        repository.organizationId,
      );

      // Convert EventHandlerResult to WebhookProcessingResult
      const result: WebhookProcessingResult = {
        success: routerResult.success,
        eventType: event as WebhookEventType,
        message: routerResult.message,
        commitsQueued: routerResult.jobsQueued,
      };

      // Mark delivery as processed after successful handling
      await this.idempotencyService.markProcessed(deliveryId, result);

      // Update webhook log with success status and response time
      const responseTimeMs = Date.now() - startTime;
      await this.webhookLogService.updateLog(deliveryId, 'success', responseTimeMs);

      return result;
    } catch (error) {
      // Update webhook log with failure status and error message
      const responseTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.webhookLogService.updateLog(deliveryId, 'failed', responseTimeMs, errorMessage);

      // Re-throw the error to maintain existing error handling behavior
      throw error;
    }
  }

  /**
   * Process push event and extract commit data
   */
  async processPushEvent(
    payload: PushEventPayload,
    repositoryId: string,
    organizationId: string,
  ): Promise<WebhookProcessingResult> {
    // Extract branch or tag name from ref
    const refInfo = this.parseRef(payload.ref);

    // Skip if this is a branch/tag deletion
    if (payload.deleted) {
      return {
        success: true,
        eventType: 'push',
        message: 'Branch/tag deletion event - no commits to process',
        commitsQueued: 0,
        forced: payload.forced,
        ...refInfo,
      };
    }

    const commits = this.parsePushEventCommits(payload);

    if (commits.length === 0) {
      return {
        success: true,
        eventType: 'push',
        message: 'No commits to process',
        commitsQueued: 0,
        forced: payload.forced,
        ...refInfo,
      };
    }

    this.logger.log(
      `Parsed ${commits.length} commits from push event for ${payload.repository.full_name}${payload.forced ? ' (force push)' : ''} on ${refInfo.refType} ${refInfo.branch || refInfo.tag}`,
    );

    // Enqueue commits for processing via BullMQ
    await this.commitProcessorQueue.addCommitJobs(commits, repositoryId, organizationId);

    return {
      success: true,
      eventType: 'push',
      message: `Queued ${commits.length} commits for processing${payload.forced ? ' (force push)' : ''} on ${refInfo.refType} ${refInfo.branch || refInfo.tag}`,
      commitsQueued: commits.length,
      forced: payload.forced,
      ...refInfo,
    };
  }

  /**
   * Process pull request event and extract PR data
   */
  async processPullRequestEvent(
    payload: PullRequestEventPayload,
    repositoryId: string,
    organizationId: string,
  ): Promise<WebhookProcessingResult> {
    // Only process closed PRs that were merged
    if (payload.action !== 'closed' || !payload.pull_request.merged_at) {
      return {
        success: true,
        eventType: 'pull_request',
        message: `PR action '${payload.action}' ${!payload.pull_request.merged_at ? '(not merged)' : ''} - not processing`,
        pullRequestsQueued: 0,
      };
    }

    const pr = this.parsePullRequestEvent(payload);

    this.logger.log(`Parsed merged PR #${pr.prNumber} in ${payload.repository.full_name}`);

    // Enqueue PR for processing via BullMQ
    await this.commitProcessorQueue.addPullRequestJob(pr, repositoryId, organizationId);

    return {
      success: true,
      eventType: 'pull_request',
      message: `Queued merged PR for processing`,
      pullRequestsQueued: 1,
    };
  }

  /**
   * Parse push event payload and extract commit data
   */
  parsePushEventCommits(payload: PushEventPayload): ParsedCommitData[] {
    return payload.commits
      .filter((commit) => commit.distinct) // Only process distinct commits
      .map((commit) => ({
        sha: commit.id,
        message: commit.message,
        timestamp: new Date(commit.timestamp),
        authorName: commit.author.name,
        authorEmail: commit.author.email,
        committerName: commit.committer.name,
        committerEmail: commit.committer.email,
        filesAdded: commit.added,
        filesRemoved: commit.removed,
        filesModified: commit.modified,
        repositoryId: payload.repository.id,
        repositoryFullName: payload.repository.full_name,
        forced: payload.forced,
      }));
  }

  /**
   * Parse ref field to extract branch or tag name
   *
   * @param ref - The ref field from push event (e.g., "refs/heads/main" or "refs/tags/v1.0.0")
   * @returns Object containing branch or tag name and ref type
   */
  parseRef(ref: string): { branch?: string; tag?: string; refType: 'branch' | 'tag' } {
    const BRANCH_PREFIX = 'refs/heads/';
    const TAG_PREFIX = 'refs/tags/';

    if (ref.startsWith(BRANCH_PREFIX)) {
      return {
        branch: ref.substring(BRANCH_PREFIX.length),
        refType: 'branch',
      };
    } else if (ref.startsWith(TAG_PREFIX)) {
      return {
        tag: ref.substring(TAG_PREFIX.length),
        refType: 'tag',
      };
    }

    // Fallback: treat as branch if no recognized prefix
    return {
      branch: ref,
      refType: 'branch',
    };
  }

  /**
   * Parse pull request event payload and extract PR data
   */
  parsePullRequestEvent(payload: PullRequestEventPayload): ParsedPullRequestData {
    return {
      prId: payload.pull_request.id,
      prNumber: payload.pull_request.number,
      title: payload.pull_request.title,
      body: payload.pull_request.body,
      state: payload.pull_request.state,
      merged: !!payload.pull_request.merged_at,
      mergedAt: payload.pull_request.merged_at ? new Date(payload.pull_request.merged_at) : null,
      authorLogin: payload.pull_request.user.login,
      authorId: payload.pull_request.user.id,
      baseBranch: payload.pull_request.base.ref,
      headBranch: payload.pull_request.head.ref,
      baseCommitSha: payload.pull_request.base.sha,
      headCommitSha: payload.pull_request.head.sha,
      createdAt: new Date(payload.pull_request.created_at),
      updatedAt: new Date(payload.pull_request.updated_at),
      closedAt: payload.pull_request.closed_at ? new Date(payload.pull_request.closed_at) : null,
      repositoryId: payload.repository.id,
      repositoryFullName: payload.repository.full_name,
    };
  }

  /**
   * Process pull request review event
   */
  async processPullRequestReviewEvent(
    payload: PullRequestReviewEventPayload,
    repositoryId: string,
    organizationId: string,
  ): Promise<WebhookProcessingResult> {
    // Only process submitted reviews
    if (payload.action !== 'submitted') {
      return {
        success: true,
        eventType: 'pull_request_review',
        message: `Review action '${payload.action}' - not processing`,
        reviewsQueued: 0,
      };
    }

    const review = this.parsePullRequestReviewEvent(payload);

    this.logger.log(
      `Parsed review ${review.reviewId} for PR #${review.pullRequestNumber} in ${payload.repository.full_name}`,
    );

    // Enqueue review for processing via BullMQ
    await this.commitProcessorQueue.addReviewJob(review, repositoryId, organizationId);

    return {
      success: true,
      eventType: 'pull_request_review',
      message: `Queued review for processing`,
      reviewsQueued: 1,
    };
  }

  /**
   * Parse pull request review event payload
   */
  parsePullRequestReviewEvent(payload: PullRequestReviewEventPayload): ParsedReviewData {
    return {
      reviewId: payload.review.id,
      reviewerLogin: payload.review.user.login,
      reviewerId: payload.review.user.id,
      reviewerEmail: payload.review.user.email,
      state: payload.review.state,
      body: payload.review.body,
      submittedAt: new Date(payload.review.submitted_at),
      commitId: payload.review.commit_id,
      pullRequestNumber: payload.pull_request.number,
      pullRequestTitle: payload.pull_request.title,
      pullRequestCreatedAt: new Date(payload.pull_request.created_at),
      repositoryId: payload.repository.id,
      repositoryFullName: payload.repository.full_name,
    };
  }

  /**
   * Process pull request review comment event
   */
  async processPullRequestReviewCommentEvent(
    payload: PullRequestReviewCommentEventPayload,
    repositoryId: string,
    organizationId: string,
  ): Promise<WebhookProcessingResult> {
    const { action, comment } = payload;

    // Process created, edited, and deleted actions
    if (!['created', 'edited', 'deleted'].includes(action)) {
      return {
        success: true,
        eventType: 'pull_request_review_comment',
        message: `Comment action '${action}' - not processing`,
        reviewCommentsQueued: 0,
      };
    }

    const parsedComment = this.parsePullRequestReviewCommentEvent(payload);

    this.logger.log(
      `Parsed review comment ${parsedComment.commentId} for PR #${parsedComment.pullRequestNumber} in ${payload.repository.full_name} (action: ${action})`,
    );

    // Enqueue comment for processing via BullMQ
    await this.commitProcessorQueue.addReviewCommentJob(
      parsedComment,
      repositoryId,
      organizationId,
      action,
    );

    return {
      success: true,
      eventType: 'pull_request_review_comment',
      message: `Queued review comment for ${action} processing`,
      reviewCommentsQueued: 1,
    };
  }

  /**
   * Parse pull request review comment event payload
   */
  parsePullRequestReviewCommentEvent(
    payload: PullRequestReviewCommentEventPayload,
  ): ParsedReviewCommentData {
    const { comment, pull_request, repository } = payload;

    return {
      commentId: comment.id,
      reviewId: comment.pull_request_review_id,
      authorLogin: comment.user.login,
      authorId: comment.user.id,
      authorEmail: comment.user.email,
      body: comment.body,
      filePath: comment.path,
      lineNumber: comment.line || comment.original_line,
      diffHunk: comment.diff_hunk,
      parentCommentId: comment.in_reply_to_id,
      createdAt: new Date(comment.created_at),
      updatedAt: new Date(comment.updated_at),
      pullRequestNumber: pull_request.number,
      repositoryId: repository.id,
      repositoryFullName: repository.full_name,
    };
  }

  /**
   * Get repository by GitHub ID
   */
  async getRepositoryByGitHubId(githubId: number) {
    return this.prisma.repository.findFirst({
      where: {
        githubId,
        isEnabled: true,
      },
    });
  }

  /**
   * Manually retry a failed webhook delivery
   *
   * @param deliveryId - X-GitHub-Delivery header value
   * @param organizationId - Organization ID for authorization
   * @returns Processing result
   */
  async retryWebhookDelivery(
    deliveryId: string,
    organizationId: string,
  ): Promise<WebhookProcessingResult> {
    this.logger.log(`Manual retry requested for delivery ${deliveryId}`);

    // Fetch the original webhook log with payload
    const log = await this.webhookLogService.getLogByDeliveryId(deliveryId);

    if (!log) {
      throw new NotFoundException(`Webhook delivery ${deliveryId} not found`);
    }

    if (!log.payload) {
      throw new BadRequestException(
        `Webhook delivery ${deliveryId} does not have a stored payload`,
      );
    }

    // Verify the repository belongs to the organization
    const repository = await this.prisma.repository.findUnique({
      where: { id: log.repositoryId },
    });

    if (!repository) {
      throw new NotFoundException(`Repository ${log.repositoryId} not found`);
    }

    if (repository.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have permission to retry this webhook delivery');
    }

    if (!repository.webhookSecret) {
      throw new BadRequestException('Repository does not have a webhook secret configured');
    }

    // Generate a new signature for the retry (using the current webhook secret)
    const signature =
      'sha256=' + this.signatureService.computeSignature(log.payload, repository.webhookSecret);

    // Create a new delivery ID for the retry to avoid idempotency conflicts
    const retryDeliveryId = `${deliveryId}-retry-${Date.now()}`;

    this.logger.log(
      `Retrying webhook: originalDelivery=${deliveryId}, retryDelivery=${retryDeliveryId}, event=${log.eventType}`,
    );

    // Reprocess through the webhook pipeline
    return this.processWebhook(log.payload, signature, log.eventType, retryDeliveryId);
  }
}
