import {
  COMMIT_QUEUE,
  EMAIL_QUEUE,
  REPORT_QUEUE,
  REVIEW_COMMENT_QUEUE,
  REVIEW_QUEUE,
  SCORE_QUEUE,
  PULL_REQUEST_QUEUE,
  REATTRIBUTION_QUEUE,
  getRedisConnection,
} from './bullmq.config';

describe('BullMQ config', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exports stable queue names used by workers and modules', () => {
    expect([
      COMMIT_QUEUE,
      REVIEW_QUEUE,
      REVIEW_COMMENT_QUEUE,
      PULL_REQUEST_QUEUE,
      SCORE_QUEUE,
      REATTRIBUTION_QUEUE,
      REPORT_QUEUE,
      EMAIL_QUEUE,
    ]).toEqual([
      'commit-processing',
      'review-processing',
      'review-comment-processing',
      'pull-request-processing',
      'score-calculation',
      'commit-reattribution',
      'report-generation',
      'email-sending',
    ]);
  });

  it('builds Redis connection options from environment values', () => {
    process.env = {
      ...originalEnv,
      REDIS_HOST: 'redis.local',
      REDIS_PORT: '6380',
      REDIS_PASSWORD: 'secret',
    };

    expect(getRedisConnection()).toEqual({
      host: 'redis.local',
      port: 6380,
      password: 'secret',
    });
  });

  it('uses localhost defaults when Redis environment values are omitted', () => {
    process.env = { ...originalEnv };
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;

    expect(getRedisConnection()).toEqual({
      host: 'localhost',
      port: 6379,
      password: undefined,
    });
  });
});
