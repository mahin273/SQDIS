import { Injectable, Logger } from '@nestjs/common';
import { CacheService, CACHE_TTL as GLOBAL_CACHE_TTL } from '../../cache';

/**
 * Cache keys for scores
 */
export const CACHE_KEYS = {
  DQS_SCORE: (developerId: string) => `dqs:score:${developerId}`,
  DQS_HISTORY: (developerId: string) => `dqs:history:${developerId}`,
  DQS_EXPLANATION: (developerId: string) => `dqs:explain:${developerId}`,
  SQS_SCORE: (projectId: string) => `sqs:score:${projectId}`,
  SQS_HISTORY: (projectId: string) => `sqs:history:${projectId}`,
  SQS_RISKS: (projectId: string) => `sqs:risks:${projectId}`,
};

/**
 * Default TTL values in seconds
 * - DQS/SQS scores: 1 hour TTL
 * - History data: 30 minutes TTL
 */
export const CACHE_TTL = {
  DQS_SCORE: GLOBAL_CACHE_TTL.DQS_SCORE, // 1 hour
  DQS_HISTORY: GLOBAL_CACHE_TTL.HISTORY, // 30 minutes
  DQS_EXPLANATION: GLOBAL_CACHE_TTL.EXPLANATION, // 1 hour
  SQS_SCORE: GLOBAL_CACHE_TTL.SQS_SCORE, // 1 hour
  SQS_HISTORY: GLOBAL_CACHE_TTL.HISTORY, // 30 minutes
  SQS_RISKS: GLOBAL_CACHE_TTL.RISKS, // 1 hour
};

/**
 * Service for caching DQS and SQS scores with Redis
 * Delegates to the global CacheService
 */
@Injectable()
export class ScoresCacheService {
  private readonly logger = new Logger(ScoresCacheService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.cacheService.isAvailable();
  }

  /**
   * Get cached value
   *
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    return this.cacheService.get<T>(key);
  }

  /**
   * Set cached value with TTL
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    return this.cacheService.set(key, value, ttl);
  }

  /**
   * Delete cached value
   *
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    return this.cacheService.delete(key);
  }

  /**
   * Delete all cached values matching a pattern
   *
   * @param pattern - Key pattern (e.g., "dqs:*")
   */
  async deletePattern(pattern: string): Promise<void> {
    return this.cacheService.deletePattern(pattern);
  }

  /**
   * Invalidate all DQS caches for a developer
   *
   * @param developerId - Developer ID
   */
  async invalidateDQS(developerId: string): Promise<void> {
    await this.delete(CACHE_KEYS.DQS_SCORE(developerId));
    await this.delete(CACHE_KEYS.DQS_HISTORY(developerId));
    await this.delete(CACHE_KEYS.DQS_EXPLANATION(developerId));
    // Also invalidate any history queries with this developer
    await this.deletePattern(`${CACHE_KEYS.DQS_HISTORY(developerId)}:*`);
    this.logger.debug(`Invalidated all DQS caches for developer: ${developerId}`);
  }

  /**
   * Invalidate all SQS caches for a project
   *
   * @param projectId - Project ID
   */
  async invalidateSQS(projectId: string): Promise<void> {
    await this.delete(CACHE_KEYS.SQS_SCORE(projectId));
    await this.delete(CACHE_KEYS.SQS_HISTORY(projectId));
    await this.delete(CACHE_KEYS.SQS_RISKS(projectId));
    // Also invalidate any history queries with this project
    await this.deletePattern(`${CACHE_KEYS.SQS_HISTORY(projectId)}:*`);
    this.logger.debug(`Invalidated all SQS caches for project: ${projectId}`);
  }

  /**
   * Get or set cached value with callback
   *
   * @param key - Cache key
   * @param ttl - Time to live in seconds
   * @param callback - Function to call if cache miss
   * @returns Cached or computed value
   */
  async getOrSet<T>(key: string, ttl: number, callback: () => Promise<T>): Promise<T> {
    return this.cacheService.getOrSet(key, ttl, callback);
  }
}
