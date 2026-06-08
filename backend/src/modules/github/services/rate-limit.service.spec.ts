import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma';
import { CacheService } from '../../cache/cache.service';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;
  let prisma: {
    repository: Record<string, jest.Mock>;
    webhookRateLimit: Record<string, jest.Mock>;
  };
  let cache: {
    isAvailable: jest.Mock;
    redis: {
      zcount: jest.Mock;
      zadd: jest.Mock;
      zremrangebyscore: jest.Mock;
      expire: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      repository: {
        findUnique: jest.fn(),
      },
      webhookRateLimit: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };
    cache = {
      isAvailable: jest.fn(() => true),
      redis: {
        zcount: jest.fn(),
        zadd: jest.fn(),
        zremrangebyscore: jest.fn(),
        expire: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    service = module.get<RateLimitService>(RateLimitService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fails open when the repository is not found', async () => {
    prisma.repository.findUnique.mockResolvedValue(null);

    const result = await service.checkRateLimit('missing-repo');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(100);
  });

  it('allows all requests when rate limiting is disabled for the organization', async () => {
    prisma.repository.findUnique.mockResolvedValue({ organizationId: 'org-1' });
    prisma.webhookRateLimit.findUnique.mockResolvedValue({
      requestsPerMinute: 50,
      enabled: false,
    });

    const result = await service.checkRateLimit('repo-1');

    expect(result).toEqual({
      allowed: true,
      remaining: 50,
      resetAt: expect.any(Date),
    });
    expect(cache.redis.zcount).not.toHaveBeenCalled();
  });

  it('blocks requests when the sliding window count reaches the limit', async () => {
    prisma.repository.findUnique.mockResolvedValue({ organizationId: 'org-1' });
    prisma.webhookRateLimit.findUnique.mockResolvedValue({
      requestsPerMinute: 10,
      enabled: true,
    });
    cache.redis.zcount.mockResolvedValue(10);

    const result = await service.checkRateLimit('repo-1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('returns default configuration when no organization override exists', async () => {
    prisma.webhookRateLimit.findUnique.mockResolvedValue(null);

    await expect(service.getRateLimitConfig('org-1')).resolves.toEqual({
      requestsPerMinute: 100,
      enabled: true,
    });
  });

  it('upserts organization rate limit configuration', async () => {
    prisma.webhookRateLimit.upsert.mockResolvedValue({
      organizationId: 'org-1',
      requestsPerMinute: 25,
      enabled: true,
    });

    await service.updateRateLimitConfig('org-1', {
      requestsPerMinute: 25,
      enabled: true,
    });

    expect(prisma.webhookRateLimit.upsert).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      create: {
        organizationId: 'org-1',
        requestsPerMinute: 25,
        enabled: true,
      },
      update: {
        requestsPerMinute: 25,
        enabled: true,
      },
    });
  });

  it('increments the Redis sliding window when cache is available', async () => {
    await service.incrementCount('repo-1');

    expect(cache.redis.zadd).toHaveBeenCalled();
    expect(cache.redis.zremrangebyscore).toHaveBeenCalled();
    expect(cache.redis.expire).toHaveBeenCalledWith(expect.stringContaining('repo-1'), 120);
  });

  it('skips increment when Redis is unavailable', async () => {
    cache.isAvailable.mockReturnValue(false);

    await service.incrementCount('repo-1');

    expect(cache.redis.zadd).not.toHaveBeenCalled();
  });
});
