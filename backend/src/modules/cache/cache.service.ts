/* eslint-disable */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { MetricsService } from '../metrics/metrics.service.js';


/**
 * Cache TTL constants in seconds

 */
export const CACHE_TTL = {
  /** 1 hour TTL for DQS scores */
  DQS_SCORE: 3600,
  /** 1 hour TTL for SQS scores */
  SQS_SCORE: 3600,
  /** 5 minutes TTL for leaderboard data */
  LEADERBOARD: 300,
  /** 30 minutes TTL for history data */
  HISTORY: 1800,
  /** 1 hour TTL for explanations */
  EXPLANATION: 3600,
  /** 1 hour TTL for risky modules */
  RISKS: 3600,
};

/**
 * Cache key prefixes for different data types
 */
export const CACHE_PREFIX = {
  DQS_SCORE: 'dqs:score',
  DQS_HISTORY: 'dqs:history',
  DQS_EXPLANATION: 'dqs:explain',
  SQS_SCORE: 'sqs:score',
  SQS_HISTORY: 'sqs:history',
  SQS_RISKS: 'sqs:risks',
  LEADERBOARD: 'leaderboard',
  TEAM_LEADERBOARD: 'team:leaderboard',
  DEVELOPER_LEADERBOARD: 'developer:leaderboard',
};

/**
 * General caching service with Redis backend
 * Features:
 * - Get/Set/Delete operations with TTL
 * - Pattern-based invalidation
 * - Graceful fallback when Redis unavailable
 * - Connection retry with exponential backoff
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private isConnected = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject(MetricsService) private readonly metricsService?: MetricsService,
  ) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      const host = this.configService.get<string>('REDIS_HOST', 'localhost');
      const port = this.configService.get<number>('REDIS_PORT', 6379);
      const password = this.configService.get<string>('REDIS_PASSWORD');

      this.redis = new Redis({
        host,
        port,
        password: password || undefined,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('Redis connection failed after 3 retries, operating without cache');
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      await this.redis.connect();
      this.isConnected = true;
      this.logger.log(`Connected to Redis at ${host}:${port}`);

      // Update connection status metric
      if (this.metricsService) {
        this.metricsService.redisConnectionStatus.set(1);
      }
    } catch (error) {
      this.logger.warn(`Failed to connect to Redis: ${error}. Operating without cache.`);
      this.isConnected = false;

      // Update connection status metric
      if (this.metricsService) {
        this.metricsService.redisConnectionStatus.set(0);
      }
    }
  }

  /**
   * Disconnect from Redis
   */
  private async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      this.logger.log('Disconnected from Redis');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }

  /**
   *
   * @param key - Cache key
   * @returns Cached value or null if not found/unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isAvailable()) {
      return null;
    }

    const startTime = Date.now();
    const keyPrefix = this.extractKeyPrefix(key);

    try {
      const value = await this.redis!.get(key);

      // Record operation metrics
      this.recordOperationMetrics('get', startTime);

      if (value) {
        this.logger.debug(`Cache hit for key: ${key}`);
        // Record cache hit
        if (this.metricsService) {
          this.metricsService.redisCacheHits.inc({ key_prefix: keyPrefix });
        }
        return JSON.parse(value) as T;
      }
      this.logger.debug(`Cache miss for key: ${key}`);
      // Record cache miss
      if (this.metricsService) {
        this.metricsService.redisCacheMisses.inc({ key_prefix: keyPrefix });
      }
      return null;
    } catch (error) {
      this.recordOperationMetrics('get', startTime);
      this.logger.warn(`Failed to get cache key ${key}: ${error}`);
      return null;
    }
  }

  /**
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const startTime = Date.now();

    try {
      await this.redis!.setex(key, ttl, JSON.stringify(value));
      this.recordOperationMetrics('set', startTime);
      this.logger.debug(`Cached key: ${key} with TTL: ${ttl}s`);
    } catch (error) {
      this.recordOperationMetrics('set', startTime);
      this.logger.warn(`Failed to set cache key ${key}: ${error}`);
    }
  }

  /**
   * Delete cached value
   *
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    const startTime = Date.now();

    try {
      await this.redis!.del(key);
      this.recordOperationMetrics('del', startTime);
      this.logger.debug(`Deleted cache key: ${key}`);
    } catch (error) {
      this.recordOperationMetrics('del', startTime);
      this.logger.warn(`Failed to delete cache key ${key}: ${error}`);
    }
  }

  /**
   * Delete all cached values matching a pattern
   *
   * @param pattern - Key pattern (e.g., "dqs:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.isAvailable()) {
      return;
    }

    try {
      const keys = await this.redis!.keys(pattern);
      if (keys.length > 0) {
        await this.redis!.del(...keys);
        this.logger.debug(`Deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to delete keys matching ${pattern}: ${error}`);
    }
  }

  /**
   * @param key - Cache key
   * @param ttl - Time to live in seconds
   * @param callback - Function to call if cache miss
   * @returns Cached or computed value
   */
  async getOrSet<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - compute value
    const value = await callback();

    // Store in cache
    await this.set(key, value, ttl);

    return value;
  }

  /**
   * Build a cache key from prefix and identifier
   *
   * @param prefix - Cache key prefix
   * @param id - Entity identifier
   * @returns Full cache key
   */
  buildKey(prefix: string, id: string): string {
    return `${prefix}:${id}`;
  }

  /**
   * Build a cache key with multiple parts
   *
   * @param parts - Key parts to join
   * @returns Full cache key
   */
  buildKeyFromParts(...parts: string[]): string {
    return parts.filter(Boolean).join(':');
  }

  /**
   * Get TTL for a cached key
   *
   * @param key - Cache key
   * @returns TTL in seconds or -1 if no TTL, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    if (!this.isAvailable()) {
      return -2;
    }

    try {
      return await this.redis!.ttl(key);
    } catch (error) {
      this.logger.warn(`Failed to get TTL for key ${key}: ${error}`);
      return -2;
    }
  }

  /**
   * Check if a key exists in cache
   *
   * @param key - Cache key
   * @returns true if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    const startTime = Date.now();

    try {
      const result = await this.redis!.exists(key);
      this.recordOperationMetrics('exists', startTime);
      return result === 1;
    } catch (error) {
      this.recordOperationMetrics('exists', startTime);
      this.logger.warn(`Failed to check existence of key ${key}: ${error}`);
      return false;
    }
  }

  /**
   * Record Redis operation metrics
   * @param operation - The Redis operation name
   * @param startTime - The start time of the operation
   */
  private recordOperationMetrics(operation: string, startTime: number): void {
    if (this.metricsService) {
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.redisOperationsTotal.inc({ operation });
      this.metricsService.redisOperationDuration.observe({ operation }, duration);
    }
  }

  /**
   * Extract key prefix for metrics labeling
   * @param key - The full cache key
   * @returns The key prefix (first segment before colon)
   */
  private extractKeyPrefix(key: string): string {
    const parts = key.split(':');
    return parts.length > 1 ? parts[0] : 'unknown';
  }
}
