import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Queue names for job processing
 */
export const COMMIT_QUEUE = 'commit-processing';
export const REVIEW_QUEUE = 'review-processing';
export const REVIEW_COMMENT_QUEUE = 'review-comment-processing';
export const PULL_REQUEST_QUEUE = 'pull-request-processing';
export const SCORE_QUEUE = 'score-calculation';
export const REATTRIBUTION_QUEUE = 'commit-reattribution';
export const REPORT_QUEUE = 'report-generation';
export const EMAIL_QUEUE = 'email-sending';

/**
 * BullMQ module configuration with Redis connection
 */
export const BullMQConfig = BullModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    connection: {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
      password: configService.get<string>('REDIS_PASSWORD') || undefined,
    },
  }),
  inject: [ConfigService],
});

/**
 * Register commit processing queue
 */
export const CommitQueueModule = BullModule.registerQueue({
  name: COMMIT_QUEUE,
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

/**
 * Register review processing queue
 */
export const ReviewQueueModule = BullModule.registerQueue({
  name: REVIEW_QUEUE,
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

/**
 * Register review comment processing queue
 */
export const ReviewCommentQueueModule = BullModule.registerQueue({
  name: REVIEW_COMMENT_QUEUE,
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

/**
 * Register pull request processing queue
 */
export const PullRequestQueueModule = BullModule.registerQueue({
  name: PULL_REQUEST_QUEUE,
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

/**
 * Register score calculation queue
 */
export const ScoreQueueModule = BullModule.registerQueue({
  name: SCORE_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Register commit re-attribution queue
 */
export const ReattributionQueueModule = BullModule.registerQueue({
  name: REATTRIBUTION_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Redis connection options helper
 */
export const getRedisConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
});


/**
 * Register report generation queue
 */
export const ReportQueueModule = BullModule.registerQueue({
  name: REPORT_QUEUE,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Register email sending queue
 */
export const EmailQueueModule = BullModule.registerQueue({
  name: EMAIL_QUEUE,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});
