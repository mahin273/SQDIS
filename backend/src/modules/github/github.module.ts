import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { GitHubController } from './github.controller';
import { GitHubService } from './github.service';
import { EncryptionService } from './services/encryption.service';
import { WebhookSignatureService } from './services/webhook-signature.service';
import { WebhookService } from './services/webhook.service';
import { WebhookLogService } from './services/webhook-log.service';
import { IdempotencyService } from './services/idempotency.service';
import { RateLimitService } from './services/rate-limit.service';
import { EventRouter } from './services/event-router.service';
import { WebhookMonitoringService } from './services/webhook-monitoring.service';
import { WebhookFailureMonitorService } from './services/webhook-failure-monitor.service';
import { WebhookCleanupService } from './services/webhook-cleanup.service';
import { PushHandler } from './services/push-handler.service';
import { PullRequestHandler } from './services/pull-request-handler.service';
import { PullRequestReviewHandler } from './services/pull-request-review-handler.service';
import { PullRequestReviewCommentHandler } from './services/pull-request-review-comment-handler.service';
import { IssueHandler } from './services/issue-handler.service';
import { ReleaseHandler } from './services/release-handler.service';
import { CommitCommentHandler } from './services/commit-comment-handler.service';
import { GitHubApiService } from './services/github-api.service';
import { BackfillService } from './services/backfill.service';
import { PollingService } from './services/polling.service';
import { CommitProcessorQueue } from './queues/commit-processor.queue';
import { PullRequestWorker } from './processors/pull-request.worker';
import { IssueWorker } from './processors/issue.worker';
import { ReleaseWorker } from './processors/release.worker';
import { CommitCommentWorker } from './processors/commit-comment.worker';
import { PrismaModule } from '../../prisma';
import { WebSocketModule } from '../websocket/websocket.module';
import { PullRequestQueueModule } from '../../config';
import { AlertsModule } from '../alerts/alerts.module';
import { AuthModule } from '../auth/auth.module';

/**
 * GitHub integration module
 */
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
    PullRequestQueueModule,
    forwardRef(() => WebSocketModule),
    forwardRef(() => AlertsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [GitHubController],
  providers: [
    GitHubService,
    EncryptionService,
    WebhookSignatureService,
    WebhookService,
    WebhookLogService,
    IdempotencyService,
    RateLimitService,
    EventRouter,
    WebhookMonitoringService,
    WebhookFailureMonitorService,
    WebhookCleanupService,
    PushHandler,
    PullRequestHandler,
    PullRequestReviewHandler,
    PullRequestReviewCommentHandler,
    IssueHandler,
    ReleaseHandler,
    CommitCommentHandler,
    PullRequestWorker,
    IssueWorker,
    ReleaseWorker,
    CommitCommentWorker,
    GitHubApiService,
    BackfillService,
    PollingService,
    CommitProcessorQueue,
  ],
  exports: [
    GitHubService,
    EncryptionService,
    WebhookSignatureService,
    WebhookService,
    WebhookLogService,
    IdempotencyService,
    RateLimitService,
    EventRouter,
    WebhookMonitoringService,
    WebhookFailureMonitorService,
    WebhookCleanupService,
    PushHandler,
    PullRequestHandler,
    PullRequestReviewHandler,
    PullRequestReviewCommentHandler,
    IssueHandler,
    ReleaseHandler,
    CommitCommentHandler,
    GitHubApiService,
    BackfillService,
    PollingService,
    CommitProcessorQueue,
  ],
})
export class GitHubModule implements OnModuleInit {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly githubService: GitHubService,
    private readonly backfillService: BackfillService,
    private readonly eventRouter: EventRouter,
    private readonly pushHandler: PushHandler,
    private readonly pullRequestHandler: PullRequestHandler,
    private readonly pullRequestReviewHandler: PullRequestReviewHandler,
    private readonly pullRequestReviewCommentHandler: PullRequestReviewCommentHandler,
    private readonly issueHandler: IssueHandler,
    private readonly releaseHandler: ReleaseHandler,
    private readonly commitCommentHandler: CommitCommentHandler,
  ) {}

  /**
   * Wire up services after module initialization
   * - BackfillService to GitHubService (avoids circular dependency)
   * - Register event handlers with EventRouter
   *
   */
  onModuleInit() {
    this.githubService.setBackfillService(this.backfillService);

    // Register all event handlers with EventRouter
    this.eventRouter.registerHandler(this.pushHandler.getEventType(), this.pushHandler);
    this.eventRouter.registerHandler(
      this.pullRequestHandler.getEventType(),
      this.pullRequestHandler,
    );
    this.eventRouter.registerHandler(
      this.pullRequestReviewHandler.getEventType(),
      this.pullRequestReviewHandler,
    );
    this.eventRouter.registerHandler(
      this.pullRequestReviewCommentHandler.getEventType(),
      this.pullRequestReviewCommentHandler,
    );
    this.eventRouter.registerHandler(this.issueHandler.getEventType(), this.issueHandler);
    this.eventRouter.registerHandler(this.releaseHandler.getEventType(), this.releaseHandler);
    this.eventRouter.registerHandler(
      this.commitCommentHandler.getEventType(),
      this.commitCommentHandler,
    );
  }
}
