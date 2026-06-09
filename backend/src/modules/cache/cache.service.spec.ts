import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let service: CacheService;
  let redis: Record<string, jest.Mock>;
  let metrics: {
    redisOperationsTotal: { inc: jest.Mock };
    redisOperationDuration: { observe: jest.Mock };
    redisCacheHits: { inc: jest.Mock };
    redisCacheMisses: { inc: jest.Mock };
    redisConnectionStatus: { set: jest.Mock };
  };

  beforeEach(() => {
    redis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
      ttl: jest.fn(),
      exists: jest.fn(),
      quit: jest.fn(),
    };
    metrics = {
      redisOperationsTotal: { inc: jest.fn() },
      redisOperationDuration: { observe: jest.fn() },
      redisCacheHits: { inc: jest.fn() },
      redisCacheMisses: { inc: jest.fn() },
      redisConnectionStatus: { set: jest.fn() },
    };

    service = new CacheService({} as ConfigService, metrics as any);
  });

  function connectMockRedis() {
    (service as any).redis = redis;
    (service as any).isConnected = true;
  }

  it('reports unavailable and avoids Redis calls before connecting', async () => {
    await expect(service.get('dqs:score:1')).resolves.toBeNull();
    await expect(service.exists('dqs:score:1')).resolves.toBe(false);
    await service.set('dqs:score:1', { value: 1 }, 30);
    await service.delete('dqs:score:1');

    expect(service.isAvailable()).toBe(false);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('gets JSON values and records cache hits', async () => {
    connectMockRedis();
    redis.get.mockResolvedValue(JSON.stringify({ score: 92 }));

    await expect(service.get<{ score: number }>('sqs:score:commit-1')).resolves.toEqual({
      score: 92,
    });

    expect(metrics.redisCacheHits.inc).toHaveBeenCalledWith({ key_prefix: 'sqs' });
    expect(metrics.redisOperationsTotal.inc).toHaveBeenCalledWith({ operation: 'get' });
  });

  it('returns null on cache miss and failed reads', async () => {
    connectMockRedis();
    redis.get.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('redis down'));

    await expect(service.get('leaderboard:org-1')).resolves.toBeNull();
    await expect(service.get('leaderboard:org-1')).resolves.toBeNull();

    expect(metrics.redisCacheMisses.inc).toHaveBeenCalledWith({ key_prefix: 'leaderboard' });
  });

  it('sets, deletes, and deletes by pattern', async () => {
    connectMockRedis();
    redis.keys.mockResolvedValue(['a', 'b']);

    await service.set('history:user-1', { items: [] }, 60);
    await service.delete('history:user-1');
    await service.deletePattern('history:*');

    expect(redis.setex).toHaveBeenCalledWith('history:user-1', 60, JSON.stringify({ items: [] }));
    expect(redis.del).toHaveBeenCalledWith('history:user-1');
    expect(redis.del).toHaveBeenCalledWith('a', 'b');
  });

  it('supports getOrSet, key helpers, ttl, and exists', async () => {
    connectMockRedis();
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify({ cached: true }));
    redis.ttl.mockResolvedValue(45);
    redis.exists.mockResolvedValue(1);
    const callback = jest.fn().mockResolvedValue({ computed: true });

    await expect(service.getOrSet('risks:repo-1', 30, callback)).resolves.toEqual({
      computed: true,
    });
    await expect(service.getOrSet('risks:repo-1', 30, callback)).resolves.toEqual({
      cached: true,
    });
    await expect(service.getTTL('risks:repo-1')).resolves.toBe(45);
    await expect(service.exists('risks:repo-1')).resolves.toBe(true);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(service.buildKey('leaderboard', 'org-1')).toBe('leaderboard:org-1');
    expect(service.buildKeyFromParts('team', '', 'leaderboard', 'org-1')).toBe(
      'team:leaderboard:org-1',
    );
  });
});
