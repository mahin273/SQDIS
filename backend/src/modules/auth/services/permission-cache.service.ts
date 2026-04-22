/* eslint-disable */
import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

/**
 * Permission cache TTL in seconds (5 minutes)
 */
const PERMISSION_CACHE_TTL = 300;

/**
 * Service for caching permission decisions to reduce database queries
 *
 * Features:
 * - Cache permission decisions with 5-minute TTL
 * - Organization-scoped cache keys to prevent cross-organization pollution
 * - Invalidation methods for user and organization-wide cache clearing
 */
@Injectable()
export class PermissionCacheService {
  private readonly logger = new Logger(PermissionCacheService.name);

  constructor(private readonly cacheService: CacheService) {}

  /**
   * Get cached permission decision
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param permission - Permission string (e.g., "team:create", "project:update")
   * @returns Cached permission decision or null if not cached
   */
  async getCachedPermission(
    userId: string,
    organizationId: string,
    permission: string,
  ): Promise<boolean | null> {
    const key = this.buildCacheKey(userId, organizationId, permission);
    const cached = await this.cacheService.get<boolean>(key);

    if (cached !== null) {
      this.logger.debug(
        `Permission cache hit: user=${userId}, org=${organizationId}, permission=${permission}, granted=${cached}`,
      );
    }

    return cached;
  }

  /**
   * Set cached permission decision with TTL
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param permission - Permission string
   * @param granted - Whether permission is granted
   */
  async setCachedPermission(
    userId: string,
    organizationId: string,
    permission: string,
    granted: boolean,
  ): Promise<void> {
    const key = this.buildCacheKey(userId, organizationId, permission);
    await this.cacheService.set(key, granted, PERMISSION_CACHE_TTL);

    this.logger.debug(
      `Permission cached: user=${userId}, org=${organizationId}, permission=${permission}, granted=${granted}, ttl=${PERMISSION_CACHE_TTL}s`,
    );
  }

  /**
   * Invalidate all cached permissions for a specific user in an organization
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   */
  async invalidateUserPermissions(userId: string, organizationId: string): Promise<void> {
    const pattern = this.buildCacheKeyPattern(userId, organizationId);
    await this.cacheService.deletePattern(pattern);

    this.logger.log(
      `Invalidated permission cache for user=${userId}, org=${organizationId}`,
    );
  }

  /**
   * Invalidate all cached permissions for an entire organization
   *
   * @param organizationId - Organization ID
   */
  async invalidateOrganizationPermissions(organizationId: string): Promise<void> {
    const pattern = `perm:*:${organizationId}:*`;
    await this.cacheService.deletePattern(pattern);

    this.logger.log(`Invalidated permission cache for entire org=${organizationId}`);
  }

  /**
   * Build cache key with organization scoping
   *
   * Format: perm:${userId}:${organizationId}:${permission}
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @param permission - Permission string
   * @returns Cache key
   */
  private buildCacheKey(userId: string, organizationId: string, permission: string): string {
    return `perm:${userId}:${organizationId}:${permission}`;
  }

  /**
   * Build cache key pattern for user-specific invalidation
   *
   * @param userId - User ID
   * @param organizationId - Organization ID
   * @returns Cache key pattern
   */
  private buildCacheKeyPattern(userId: string, organizationId: string): string {
    return `perm:${userId}:${organizationId}:*`;
  }
}
