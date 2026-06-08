import { HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { WebhookService } from './webhook.service';

describe('WebhookService', () => {
  let service: WebhookService;
  let prisma: { repository: Record<string, jest.Mock> };
  let signatureService: Record<string, jest.Mock>;
  let idempotencyService: Record<string, jest.Mock>;
  let commitProcessorQueue: Record<string, jest.Mock>;
  let webhookLogService: Record<string, jest.Mock>;
  let rateLimitService: Record<string, jest.Mock>;
  let eventRouter: Record<string, jest.Mock>;
  let cacheService: Record<string, jest.Mock>;

  const repository = {
    id: 'repo-1',
    organizationId: 'org-1',
    githubId: 123,
    fullName: 'acme/api',
    webhookSecret: 'secret',
  };

  const pushPayload = {
    ref: 'refs/heads/main',
    forced: false,
    deleted: false,
    repository: {
      id: 123,
      full_name: 'acme/api',
    },
    commits: [
      {
        id: 'sha-1',
        distinct: true,
        message: 'feat: test',
        timestamp: '2026-01-01T00:00:00.000Z',
        author: { name: 'Author', email: 'author@example.com' },
        committer: { name: 'Committer', email: 'committer@example.com' },
        added: ['a.ts'],
        removed: [],
        modified: ['b.ts'],
      },
      {
        id: 'sha-2',
        distinct: false,
        message: 'duplicate',
        timestamp: '2026-01-01T00:00:00.000Z',
        author: { name: 'Author', email: 'author@example.com' },
        committer: { name: 'Committer', email: 'committer@example.com' },
        added: [],
        removed: [],
        modified: [],
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      repository: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };
    signatureService = {
      verifySignature: jest.fn(() => true),
      computeSignature: jest.fn(() => 'computed-signature'),
    };
    idempotencyService = {
      isProcessed: jest.fn(() => false),
      getCachedResult: jest.fn(),
      markProcessed: jest.fn(),
    };
    commitProcessorQueue = {
      addCommitJobs: jest.fn(),
      addPullRequestJob: jest.fn(),
      addReviewJob: jest.fn(),
      addReviewCommentJob: jest.fn(),
    };
    webhookLogService = {
      createLog: jest.fn(),
      updateLog: jest.fn(),
      getLogByDeliveryId: jest.fn(),
    };
    rateLimitService = {
      checkRateLimit: jest.fn(() => ({
        allowed: true,
        remaining: 99,
        resetAt: new Date(Date.now() + 60_000),
      })),
      incrementCount: jest.fn(),
    };
    eventRouter = {
      routeEvent: jest.fn().mockResolvedValue({
        success: true,
        jobsQueued: 2,
        message: 'Queued jobs',
      }),
    };
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    service = new WebhookService(
      prisma as any,
      signatureService as any,
      idempotencyService as any,
      commitProcessorQueue as any,
      webhookLogService as any,
      rateLimitService as any,
      eventRouter as any,
      cacheService as any,
    );
  });

  afterEach(() => {
    delete process.env.WEBHOOK_PAYLOAD_SIZE_LIMIT;
    jest.clearAllMocks();
  });

  it('returns cached successful results for duplicate deliveries', async () => {
    const cachedResult = {
      success: true,
      eventType: 'push',
      message: 'Already queued',
      commitsQueued: 1,
    };
    idempotencyService.isProcessed.mockResolvedValue(true);
    idempotencyService.getCachedResult.mockResolvedValue(cachedResult);

    await expect(service.processWebhook('{}', 'signature', 'push', 'delivery-1')).resolves.toBe(
      cachedResult,
    );
    expect(prisma.repository.findFirst).not.toHaveBeenCalled();
    expect(eventRouter.routeEvent).not.toHaveBeenCalled();
  });

  it('marks ping deliveries processed without requiring repository lookup or signature verification', async () => {
    await expect(service.processWebhook('{}', '', 'ping', 'delivery-1')).resolves.toEqual({
      success: true,
      eventType: 'ping',
      message: 'Pong! Webhook configured successfully.',
    });

    expect(idempotencyService.markProcessed).toHaveBeenCalledWith('delivery-1', {
      success: true,
      eventType: 'ping',
      message: 'Pong! Webhook configured successfully.',
    });
    expect(signatureService.verifySignature).not.toHaveBeenCalled();
  });

  it('verifies, logs, routes, marks, and returns supported webhook events', async () => {
    prisma.repository.findFirst.mockResolvedValue(repository);
    const payload = JSON.stringify(pushPayload);

    await expect(service.processWebhook(payload, 'sha256=valid', 'push', 'delivery-1')).resolves.toEqual({
      success: true,
      eventType: 'push',
      message: 'Queued jobs',
      commitsQueued: 2,
    });

    expect(cacheService.set).toHaveBeenCalledWith(
      'github:repository:secret:123',
      {
        id: repository.id,
        organizationId: repository.organizationId,
        fullName: repository.fullName,
        webhookSecret: repository.webhookSecret,
      },
      3600,
    );
    expect(signatureService.verifySignature).toHaveBeenCalledWith(payload, 'sha256=valid', 'secret');
    expect(rateLimitService.incrementCount).toHaveBeenCalledWith(repository.id);
    expect(webhookLogService.createLog).toHaveBeenCalledWith('delivery-1', 'push', repository.id, payload);
    expect(eventRouter.routeEvent).toHaveBeenCalledWith('push', pushPayload, repository.id, 'org-1');
    expect(idempotencyService.markProcessed).toHaveBeenCalledWith('delivery-1', {
      success: true,
      eventType: 'push',
      message: 'Queued jobs',
      commitsQueued: 2,
    });
    expect(webhookLogService.updateLog).toHaveBeenCalledWith('delivery-1', 'success', expect.any(Number));
  });

  it('uses cached repository secrets and rejects negative-cache repositories', async () => {
    cacheService.get.mockResolvedValueOnce({
      id: repository.id,
      organizationId: repository.organizationId,
      fullName: repository.fullName,
      webhookSecret: repository.webhookSecret,
    });

    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=valid', 'push', 'delivery-1'),
    ).resolves.toMatchObject({ success: true });
    expect(prisma.repository.findFirst).not.toHaveBeenCalled();

    cacheService.get.mockResolvedValueOnce('NOT_FOUND');
    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=valid', 'push', 'delivery-2'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('negative-caches missing enabled repositories and rejects invalid signatures', async () => {
    prisma.repository.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=bad', 'push', 'delivery-1'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cacheService.set).toHaveBeenCalledWith('github:repository:secret:123', 'NOT_FOUND', 300);

    prisma.repository.findFirst.mockResolvedValueOnce(repository);
    signatureService.verifySignature.mockReturnValueOnce(false);

    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=bad', 'push', 'delivery-2'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws payload-too-large and rate-limit errors before routing', async () => {
    process.env.WEBHOOK_PAYLOAD_SIZE_LIMIT = '4';

    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=valid', 'push', 'delivery-1'),
    ).rejects.toMatchObject({
      status: HttpStatus.PAYLOAD_TOO_LARGE,
    });

    delete process.env.WEBHOOK_PAYLOAD_SIZE_LIMIT;
    prisma.repository.findFirst.mockResolvedValue(repository);
    rateLimitService.checkRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
    });

    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=valid', 'push', 'delivery-2'),
    ).rejects.toBeInstanceOf(HttpException);
    expect(eventRouter.routeEvent).not.toHaveBeenCalled();
  });

  it('updates webhook logs as failed when event routing throws', async () => {
    prisma.repository.findFirst.mockResolvedValue(repository);
    eventRouter.routeEvent.mockRejectedValueOnce(new Error('handler failed'));

    await expect(
      service.processWebhook(JSON.stringify(pushPayload), 'sha256=valid', 'push', 'delivery-1'),
    ).rejects.toThrow('handler failed');

    expect(webhookLogService.updateLog).toHaveBeenCalledWith(
      'delivery-1',
      'failed',
      expect.any(Number),
      'handler failed',
    );
  });

  it('parses refs and queues only distinct commits for push events', async () => {
    await expect(service.processPushEvent(pushPayload as any, 'repo-1', 'org-1')).resolves.toMatchObject({
      success: true,
      commitsQueued: 1,
      branch: 'main',
      refType: 'branch',
    });

    expect(commitProcessorQueue.addCommitJobs).toHaveBeenCalledWith(
      [
        {
          sha: 'sha-1',
          message: 'feat: test',
          timestamp: new Date('2026-01-01T00:00:00.000Z'),
          authorName: 'Author',
          authorEmail: 'author@example.com',
          committerName: 'Committer',
          committerEmail: 'committer@example.com',
          filesAdded: ['a.ts'],
          filesRemoved: [],
          filesModified: ['b.ts'],
          repositoryId: 123,
          repositoryFullName: 'acme/api',
          forced: false,
        },
      ],
      'repo-1',
      'org-1',
    );
    expect(service.parseRef('refs/tags/v1.0.0')).toEqual({ tag: 'v1.0.0', refType: 'tag' });
    expect(service.parseRef('custom-ref')).toEqual({ branch: 'custom-ref', refType: 'branch' });
  });

  it('retries webhook deliveries after authorization and signature regeneration', async () => {
    webhookLogService.getLogByDeliveryId.mockResolvedValue({
      deliveryId: 'delivery-1',
      eventType: 'push',
      repositoryId: 'repo-1',
      payload: JSON.stringify(pushPayload),
    });
    prisma.repository.findUnique.mockResolvedValue(repository);
    jest.spyOn(service, 'processWebhook').mockResolvedValue({
      success: true,
      eventType: 'push',
      message: 'retried',
    });

    await expect(service.retryWebhookDelivery('delivery-1', 'org-1')).resolves.toEqual({
      success: true,
      eventType: 'push',
      message: 'retried',
    });

    expect(signatureService.computeSignature).toHaveBeenCalledWith(JSON.stringify(pushPayload), 'secret');
    expect(service.processWebhook).toHaveBeenCalledWith(
      JSON.stringify(pushPayload),
      'sha256=computed-signature',
      'push',
      expect.stringMatching(/^delivery-1-retry-/),
    );
  });
});
