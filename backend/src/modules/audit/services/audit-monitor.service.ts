import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheService } from '../../cache/cache.service';
import { AlertsService } from '../../alerts/alerts.service';
import { AlertType, AuditSeverity, Role } from '@prisma/client';

/**
 * Interface for audit log entries used in monitoring
 */
export interface AuditLog {
  id: string;
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata?: any;
  granted?: boolean | null;
  requiredRole?: Role | null;
  userRole?: Role | null;
  timestamp: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  entryHash: string;
  previousEntryHash?: string | null;
  severity?: AuditSeverity | null;
}

/**
 * AuditMonitorService provides real-time monitoring and security pattern detection.
 *
 * This service:
 * - Emits real-time WebSocket events for security-relevant audit entries
 * - Detects suspicious patterns (failed permission thresholds, role elevation, unusual IP access)
 * - Creates security alerts for detected threats
 * - Integrates with EventEmitter2 for event emission
 *
 */
@Injectable()
export class AuditMonitorService {
  private readonly logger = new Logger(AuditMonitorService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly alertService: AlertsService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Emits a real-time audit event via WebSocket.
   *
   * Events are published to the 'audit.created' channel and can be filtered
   * by organization on the client side.
   *
   * @param entry - The audit log entry to emit
   *

   */
  async emitAuditEvent(entry: AuditLog): Promise<void> {
    try {
      // Emit event to WebSocket channel
      // The event will be picked up by the WebSocket gateway
      this.eventEmitter.emit('audit.created', {
        id: entry.id,
        userId: entry.userId,
        organizationId: entry.organizationId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        timestamp: entry.timestamp,
        severity: entry.severity,
        metadata: entry.metadata,
      });

      this.logger.debug(
        `Emitted audit event: action=${entry.action}, org=${entry.organizationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit audit event: ${error.message}`,
        error.stack,
      );
      // Don't throw - event emission should not block audit logging
    }
  }

  /**
   * Detects suspicious patterns in audit entries and creates security alerts.
   *
   * Patterns detected:
   * - Multiple failed permission checks (5+ within 5 minutes)
   * - Role elevation to ADMIN or OWNER
   * - Access from unusual IP addresses (not seen in last 30 days)
   *
   * @param entry - The audit log entry to analyze
   *
   */
  async detectSuspiciousPatterns(entry: AuditLog): Promise<void> {
    try {
      // Check for multiple failed permission checks
      if (
        entry.action === 'PERMISSION_CHECK' &&
        entry.granted === false
      ) {
        const thresholdExceeded = await this.checkFailedPermissionThreshold(
          entry.userId,
          entry.organizationId,
        );

        if (thresholdExceeded) {
          await this.createSecurityAlert(
            'FAILED_PERMISSION_THRESHOLD',
            entry,
            {
              message: `User ${entry.userId} has exceeded the failed permission check threshold (5 in 5 minutes)`,
              count: 5,
              timeWindow: '5 minutes',
            },
          );
        }
      }

      // Check for role elevation
      if (entry.action === 'ROLE_CHANGE') {
        const isElevation = await this.checkRoleElevation(entry);

        if (isElevation) {
          await this.createSecurityAlert(
            'ROLE_ELEVATION',
            entry,
            {
              message: `User role elevated to ${entry.metadata?.newRole}`,
              targetUserId: entry.metadata?.targetUserId,
              oldRole: entry.metadata?.oldRole,
              newRole: entry.metadata?.newRole,
            },
          );
        }
      }

      // Check for unusual IP access
      if (entry.ipAddress) {
        const isUnusual = await this.checkUnusualIPAccess(
          entry.userId,
          entry.ipAddress,
        );

        if (isUnusual) {
          await this.createSecurityAlert(
            'UNUSUAL_IP_ACCESS',
            entry,
            {
              message: `Access from unusual IP address: ${entry.ipAddress}`,
              ipAddress: entry.ipAddress,
              userAgent: entry.userAgent,
            },
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to detect suspicious patterns: ${error.message}`,
        error.stack,
      );
      // Don't throw - pattern detection should not block audit logging
    }
  }

  /**
   * Checks if a user has exceeded the failed permission check threshold.
   *
   * Threshold: 5 failed permission checks within 5 minutes
   *
   * @param userId - The user ID to check
   * @param organizationId - The organization ID
   * @returns true if threshold exceeded
   *
   */
  private async checkFailedPermissionThreshold(
    userId: string,
    organizationId: string,
  ): Promise<boolean> {
    try {
      const cacheKey = `failed-permissions:${organizationId}:${userId}`;

      // Get current count from cache
      const currentCount = (await this.cacheService.get<number>(cacheKey)) || 0;
      const newCount = currentCount + 1;

      // Store updated count with 5-minute TTL (300 seconds)
      await this.cacheService.set(cacheKey, newCount, 300);

      // Check if threshold exceeded
      return newCount >= 5;
    } catch (error) {
      this.logger.error(
        `Failed to check failed permission threshold: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Checks if a role change represents an elevation to ADMIN or OWNER.
   *
   * @param entry - The audit log entry for the role change
   * @returns true if role was elevated to ADMIN or OWNER
   *
   */
  private async checkRoleElevation(entry: AuditLog): Promise<boolean> {
    try {
      const newRole = entry.metadata?.newRole;
      return newRole === Role.ADMIN || newRole === Role.OWNER;
    } catch (error) {
      this.logger.error(
        `Failed to check role elevation: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Checks if an IP address is unusual for a user.
   *
   * An IP is considered unusual if it hasn't been seen in the last 30 days.
   *
   * @param userId - The user ID
   * @param ipAddress - The IP address to check
   * @returns true if IP is unusual
   *
   */
  private async checkUnusualIPAccess(
    userId: string,
    ipAddress: string,
  ): Promise<boolean> {
    try {
      const cacheKey = `known-ips:${userId}`;

      // Get known IPs from cache
      const knownIPs = (await this.cacheService.get<string[]>(cacheKey)) || [];

      // Check if IP is known
      const isKnown = knownIPs.includes(ipAddress);

      if (!isKnown) {
        // Add IP to known IPs
        const updatedIPs = [...knownIPs, ipAddress];

        // Keep only last 10 IPs to prevent unbounded growth
        const limitedIPs = updatedIPs.slice(-10);

        // Store with 30-day TTL (2592000 seconds)
        await this.cacheService.set(cacheKey, limitedIPs, 2592000);

        // Only alert if user has at least one known IP (not first login)
        return knownIPs.length > 0;
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check unusual IP access: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Creates a security alert for a detected suspicious pattern.
   *
   * @param type - The type of security alert
   * @param entry - The audit log entry that triggered the alert
   * @param details - Additional details about the alert
   *
   */
  private async createSecurityAlert(
    type: string,
    entry: AuditLog,
    details: any,
  ): Promise<void> {
    try {
      // Create alert using AlertsService
      await this.alertService.createAlert({
        organizationId: entry.organizationId,
        type: AlertType.ANOMALY, // Use ANOMALY type for security alerts
        message: `Security Alert: ${type} - ${details.message}`,
        anomalyScore: this.getAnomalyScore(type),
      });

      // Emit high-priority event for immediate notification
      this.eventEmitter.emit('audit.security_alert', {
        type,
        entry,
        details,
        timestamp: new Date(),
      });

      this.logger.warn(
        `Security alert created: type=${type}, user=${entry.userId}, org=${entry.organizationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create security alert: ${error.message}`,
        error.stack,
      );
      // Don't throw - alert creation should not block audit logging
    }
  }

  /**
   * Maps security alert types to anomaly scores.
   *
   * @param type - The security alert type
   * @returns The anomaly score (0-1)
   */
  private getAnomalyScore(type: string): number {
    const scoreMap: Record<string, number> = {
      FAILED_PERMISSION_THRESHOLD: 0.8,
      ROLE_ELEVATION: 0.9,
      UNUSUAL_IP_ACCESS: 0.7,
    };

    return scoreMap[type] || 0.5;
  }
}
