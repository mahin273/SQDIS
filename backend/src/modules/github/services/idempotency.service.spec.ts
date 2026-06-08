import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let prisma: {
    webhookIdempotency: Record<string, jest.Mock>;
  };

  beforeEach(() => {
    prisma = {
      webhookIdempotency: {
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    service = new IdempotencyService(prisma as any);
  });

  afterEach(() => {
    delete process.env.WEBHOOK_IDEMPOTENCY_RETENTION_DAYS;
  });

  it('detects whether a delivery has already been processed', async () => {
    prisma.webhookIdempotency.findUnique.mockResolvedValueOnce(null);
    await expect(service.isProcessed('delivery-1')).resolves.toBe(false);

    prisma.webhookIdempotency.findUnique.mockResolvedValueOnce({ deliveryId: 'delivery-1' });
    await expect(service.isProcessed('delivery-1')).resolves.toBe(true);
  });

  it('stores processing result with retention expiry', async () => {
    process.env.WEBHOOK_IDEMPOTENCY_RETENTION_DAYS = '3';
    const result = {
      success: true,
      eventType: 'push' as const,
      message: 'Queued',
      commitsQueued: 1,
    };

    await service.markProcessed('delivery-1', result);

    expect(prisma.webhookIdempotency.create).toHaveBeenCalledWith({
      data: {
        deliveryId: 'delivery-1',
        result,
        expiresAt: expect.any(Date),
      },
    });
  });

  it('returns cached processing results and cleans up expired records', async () => {
    const result = { success: true, eventType: 'ping', message: 'Pong!' };
    prisma.webhookIdempotency.findUnique.mockResolvedValueOnce({ result });

    await expect(service.getCachedResult('delivery-1')).resolves.toBe(result);

    prisma.webhookIdempotency.findUnique.mockResolvedValueOnce(null);
    await expect(service.getCachedResult('missing')).resolves.toBeNull();

    prisma.webhookIdempotency.deleteMany.mockResolvedValue({ count: 4 });
    await expect(service.cleanupOldRecords()).resolves.toBe(4);
    expect(prisma.webhookIdempotency.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lt: expect.any(Date) },
      },
    });
  });
});
