import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

/**
 * Cache TTL for analytics results (5 minutes)
 */
const ANALYTICS_CACHE_TTL = 300; // 5 minutes in seconds

/**
 * Cache key prefix for analytics
 */
const ANALYTICS_CACHE_PREFIX = 'audit:analytics';

/**
 * Interface for action counts by type
 */
export interface ActionCountsByType {
  [action: string]: number;
}

/**
 * Interface for user activity summary
 */
export interface UserActivitySummary {
  userId: string;
  userName: string;
  actionCount: number;
  lastActivity: Date;
}

/**
 * Interface for failed permission summary
 */
export interface FailedPermissionSummary {
  userId: string;
  userName: string;
  failedAttempts: number;
  mostCommonAction: string;
  lastAttempt: Date;
}

/**
 * Interface for timeline data point
 */
export interface TimelineDataPoint {
  timestamp: Date;
  actionCount: number;
  actionBreakdown: ActionCountsByType;
}

/**
 * Interface for resource access summary
 */
export interface ResourceAccessSummary {
  resourceType: string;
  resourceId: string;
  accessCount: number;
  uniqueUsers: number;
}

/**
 * Service for generating analytics and insights from audit log data
 *
 * Features:
 * - Action counts by type
 * - Most active users
 * - Failed permission checks
 * - Action timeline with configurable granularity
 * - Most accessed resources
 * - Caching with 5-minute TTL
 * - Queries both active and archived audit logs
 */
@Injectable()
export class AuditAnalyticsService {
  private readonly logger = new Logger(AuditAnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get action counts by type for a given time period
   *
   * @param organizationId - Organization ID to filter by
   * @param startDate - Start of time period
   * @param endDate - End of time period
   * @returns Action counts grouped by action type
   */
  async getActionCountsByType(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ActionCountsByType> {
    const cacheKey = this.buildCacheKey('action-counts', {
      organizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Try to get from cache
    const cached = await this.getCachedResult<ActionCountsByType>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for action counts: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for action counts: ${cacheKey}`);

    // Query both active and archived logs
    const [activeCounts, archivedCounts] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          action: true,
        },
      }),
      this.prisma.archivedAuditLog.groupBy({
        by: ['action'],
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          action: true,
        },
      }),
    ]);

    // Combine counts from both sources
    const result: ActionCountsByType = {};

    for (const item of activeCounts) {
      result[item.action] = item._count.action;
    }

    for (const item of archivedCounts) {
      result[item.action] = (result[item.action] || 0) + item._count.action;
    }

    // Cache the result
    await this.setCachedResult(cacheKey, result, ANALYTICS_CACHE_TTL);

    return result;
  }

  /**
   * Get most active users by action count
   *
   * @param organizationId - Organization ID to filter by
   * @param startDate - Start of time period
   * @param endDate - End of time period
   * @param limit - Maximum number of users to return
   * @returns List of most active users ordered by action count
   */
  async getMostActiveUsers(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<UserActivitySummary[]> {
    const cacheKey = this.buildCacheKey('active-users', {
      organizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: limit.toString(),
    });

    // Try to get from cache
    const cached = await this.getCachedResult<UserActivitySummary[]>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for active users: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for active users: ${cacheKey}`);

    // Query both active and archived logs
    const [activeUsers, archivedUsers] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['userId'],
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          userId: true,
        },
        _max: {
          timestamp: true,
        },
      }),
      this.prisma.archivedAuditLog.groupBy({
        by: ['userId'],
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: {
          userId: true,
        },
        _max: {
          timestamp: true,
        },
      }),
    ]);

    // Combine and aggregate user activity
    const userActivityMap = new Map<string, { count: number; lastActivity: Date }>();

    for (const item of activeUsers) {
      userActivityMap.set(item.userId, {
        count: item._count.userId,
        lastActivity: item._max.timestamp!,
      });
    }

    for (const item of archivedUsers) {
      const existing = userActivityMap.get(item.userId);
      if (existing) {
        existing.count += item._count.userId;
        if (item._max.timestamp! > existing.lastActivity) {
          existing.lastActivity = item._max.timestamp!;
        }
      } else {
        userActivityMap.set(item.userId, {
          count: item._count.userId,
          lastActivity: item._max.timestamp!,
        });
      }
    }

    // Get user details
    const userIds = Array.from(userActivityMap.keys());
    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Build result
    const result: UserActivitySummary[] = users.map((user) => {
      const activity = userActivityMap.get(user.id)!;
      return {
        userId: user.id,
        userName: user.name,
        actionCount: activity.count,
        lastActivity: activity.lastActivity,
      };
    });

    // Sort by action count descending and limit
    result.sort((a, b) => b.actionCount - a.actionCount);
    const limitedResult = result.slice(0, limit);

    // Cache the result
    await this.setCachedResult(cacheKey, limitedResult, ANALYTICS_CACHE_TTL);

    return limitedResult;
  }

  /**
   * Get failed permission checks by user
   *
   * @param organizationId - Organization ID to filter by
   * @param startDate - Start of time period
   * @param endDate - End of time period
   * @returns List of users with failed permission checks
   */
  async getFailedPermissionChecks(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<FailedPermissionSummary[]> {
    const cacheKey = this.buildCacheKey('failed-permissions', {
      organizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    // Try to get from cache
    const cached = await this.getCachedResult<FailedPermissionSummary[]>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for failed permissions: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for failed permissions: ${cacheKey}`);

    // Query both active and archived logs for failed permission checks
    const [activeFailures, archivedFailures] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          action: 'PERMISSION_CHECK',
          granted: false,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          userId: true,
          resourceType: true,
          timestamp: true,
        },
      }),
      this.prisma.archivedAuditLog.findMany({
        where: {
          organizationId,
          action: 'PERMISSION_CHECK',
          granted: false,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          userId: true,
          resourceType: true,
          timestamp: true,
        },
      }),
    ]);

    // Combine failures
    const allFailures = [...activeFailures, ...archivedFailures];

    // Aggregate by user
    const userFailuresMap = new Map<
      string,
      { count: number; actions: string[]; lastAttempt: Date }
    >();

    for (const failure of allFailures) {
      const existing = userFailuresMap.get(failure.userId);
      if (existing) {
        existing.count++;
        existing.actions.push(failure.resourceType);
        if (failure.timestamp > existing.lastAttempt) {
          existing.lastAttempt = failure.timestamp;
        }
      } else {
        userFailuresMap.set(failure.userId, {
          count: 1,
          actions: [failure.resourceType],
          lastAttempt: failure.timestamp,
        });
      }
    }

    // Get user details
    const userIds = Array.from(userFailuresMap.keys());
    if (userIds.length === 0) {
      return [];
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: {
          in: userIds,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Build result
    const result: FailedPermissionSummary[] = users.map((user) => {
      const failures = userFailuresMap.get(user.id)!;

      // Find most common action
      const actionCounts = new Map<string, number>();
      for (const action of failures.actions) {
        actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
      }

      let mostCommonAction = '';
      let maxCount = 0;
      for (const [action, count] of actionCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonAction = action;
        }
      }

      return {
        userId: user.id,
        userName: user.name,
        failedAttempts: failures.count,
        mostCommonAction,
        lastAttempt: failures.lastAttempt,
      };
    });

    // Sort by failed attempts descending
    result.sort((a, b) => b.failedAttempts - a.failedAttempts);

    // Cache the result
    await this.setCachedResult(cacheKey, result, ANALYTICS_CACHE_TTL);

    return result;
  }

  /**
   * Get action timeline with configurable granularity
   *
   * @param organizationId - Organization ID to filter by
   * @param startDate - Start of time period
   * @param endDate - End of time period
   * @param granularity - Time bucket granularity (hour, day, week)
   * @returns Timeline data points with action counts
   */
  async getActionTimeline(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    granularity: 'hour' | 'day' | 'week',
  ): Promise<TimelineDataPoint[]> {
    const cacheKey = this.buildCacheKey('timeline', {
      organizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      granularity,
    });

    // Try to get from cache
    const cached = await this.getCachedResult<TimelineDataPoint[]>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for timeline: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for timeline: ${cacheKey}`);

    // Query both active and archived logs
    const [activeLogs, archivedLogs] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          timestamp: true,
          action: true,
        },
      }),
      this.prisma.archivedAuditLog.findMany({
        where: {
          organizationId,
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          timestamp: true,
          action: true,
        },
      }),
    ]);

    // Combine logs
    const allLogs = [...activeLogs, ...archivedLogs];

    // Group by time bucket
    const timelineMap = new Map<string, { count: number; actions: Map<string, number> }>();

    for (const log of allLogs) {
      const bucketKey = this.getTimeBucket(log.timestamp, granularity);

      const existing = timelineMap.get(bucketKey);
      if (existing) {
        existing.count++;
        existing.actions.set(log.action, (existing.actions.get(log.action) || 0) + 1);
      } else {
        const actions = new Map<string, number>();
        actions.set(log.action, 1);
        timelineMap.set(bucketKey, {
          count: 1,
          actions,
        });
      }
    }

    // Build result
    const result: TimelineDataPoint[] = [];
    for (const [bucketKey, data] of timelineMap.entries()) {
      const actionBreakdown: ActionCountsByType = {};
      for (const [action, count] of data.actions.entries()) {
        actionBreakdown[action] = count;
      }

      result.push({
        timestamp: new Date(bucketKey),
        actionCount: data.count,
        actionBreakdown,
      });
    }

    // Sort by timestamp
    result.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Cache the result
    await this.setCachedResult(cacheKey, result, ANALYTICS_CACHE_TTL);

    return result;
  }

  /**
   * Get most accessed resources
   *
   * @param organizationId - Organization ID to filter by
   * @param startDate - Start of time period
   * @param endDate - End of time period
   * @param limit - Maximum number of resources to return
   * @returns List of most accessed resources
   */
  async getMostAccessedResources(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    limit: number,
  ): Promise<ResourceAccessSummary[]> {
    const cacheKey = this.buildCacheKey('top-resources', {
      organizationId,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit: limit.toString(),
    });

    // Try to get from cache
    const cached = await this.getCachedResult<ResourceAccessSummary[]>(cacheKey);
    if (cached !== null) {
      this.logger.debug(`Cache hit for top resources: ${cacheKey}`);
      return cached;
    }

    this.logger.debug(`Cache miss for top resources: ${cacheKey}`);

    // Query both active and archived logs
    const [activeLogs, archivedLogs] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          organizationId,
          resourceId: {
            not: null,
          },
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          resourceType: true,
          resourceId: true,
          userId: true,
        },
      }),
      this.prisma.archivedAuditLog.findMany({
        where: {
          organizationId,
          resourceId: {
            not: null,
          },
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          resourceType: true,
          resourceId: true,
          userId: true,
        },
      }),
    ]);

    // Combine logs
    const allLogs = [...activeLogs, ...archivedLogs];

    // Aggregate by resource
    const resourceMap = new Map<
      string,
      { resourceType: string; resourceId: string; count: number; users: Set<string> }
    >();

    for (const log of allLogs) {
      if (!log.resourceId) continue;

      const key = `${log.resourceType}:${log.resourceId}`;
      const existing = resourceMap.get(key);

      if (existing) {
        existing.count++;
        existing.users.add(log.userId);
      } else {
        resourceMap.set(key, {
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          count: 1,
          users: new Set([log.userId]),
        });
      }
    }

    // Build result
    const result: ResourceAccessSummary[] = Array.from(resourceMap.values()).map(
      (resource) => ({
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
        accessCount: resource.count,
        uniqueUsers: resource.users.size,
      }),
    );

    // Sort by access count descending and limit
    result.sort((a, b) => b.accessCount - a.accessCount);
    const limitedResult = result.slice(0, limit);

    // Cache the result
    await this.setCachedResult(cacheKey, limitedResult, ANALYTICS_CACHE_TTL);

    return limitedResult;
  }

  /**
   * Build cache key from method name and parameters
   *
   * @param method - Method name
   * @param params - Parameters object
   * @returns Cache key
   */
  private buildCacheKey(method: string, params: Record<string, string>): string {
    const parts = [ANALYTICS_CACHE_PREFIX, method];

    // Add sorted parameter keys for consistent cache keys
    const sortedKeys = Object.keys(params).sort();
    for (const key of sortedKeys) {
      parts.push(`${key}=${params[key]}`);
    }

    return parts.join(':');
  }

  /**
   * Get cached result
   *
   * @param key - Cache key
   * @returns Cached result or null
   */
  private async getCachedResult<T>(key: string): Promise<T | null> {
    try {
      return await this.cacheService.get<T>(key);
    } catch (error) {
      this.logger.warn(`Failed to get cached result for ${key}: ${error}`);
      return null;
    }
  }

  /**
   * Set cached result
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in seconds
   */
  private async setCachedResult<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      await this.cacheService.set(key, data, ttl);
    } catch (error) {
      this.logger.warn(`Failed to set cached result for ${key}: ${error}`);
    }
  }

  /**
   * Get time bucket key for a timestamp based on granularity
   *
   * @param timestamp - Timestamp to bucket
   * @param granularity - Time bucket granularity
   * @returns ISO string representing the bucket start time
   */
  private getTimeBucket(timestamp: Date, granularity: 'hour' | 'day' | 'week'): string {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'week':
        // Set to start of week (Sunday)
        const day = date.getDay();
        date.setDate(date.getDate() - day);
        date.setHours(0, 0, 0, 0);
        break;
    }

    return date.toISOString();
  }
}
