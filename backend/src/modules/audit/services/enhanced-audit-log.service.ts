import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { HashService, AuditEntry } from './hash.service';
import { Role, AuditSeverity } from '@prisma/client';

/**
 * Interface for general CRUD operation audit entries
 */
export interface AuditActionEntry {
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Interface for data modification audit entries with snapshots
 */
export interface DataModificationEntry extends AuditActionEntry {
  beforeSnapshot?: Record<string, any>;
  afterSnapshot?: Record<string, any>;
}

/**
 * Interface for authentication event audit entries
 */
export interface AuthenticationEntry {
  userId: string;
  organizationId: string;
  action: 'LOGIN' | 'LOGOUT' | 'SESSION_EXPIRED' | 'SESSION_REVOKED';
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string;
}

/**
 * Interface for permission check audit entries
 */
export interface PermissionCheckEntry {
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  granted: boolean;
  requiredRole: Role;
  userRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Interface for role change audit entries
 */
export interface RoleChangeEntry {
  userId: string;
  organizationId: string;
  targetUserId: string;
  oldRole: Role;
  newRole: Role;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Interface for export audit entries
 */
export interface ExportEntry {
  userId: string;
  organizationId: string;
  exportType: 'CSV' | 'JSON';
  scope: string;
  recordCount?: number;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Interface for data snapshots
 */
export interface DataSnapshot {
  before?: Record<string, any>;
  after?: Record<string, any>;
  changedFields?: string[];
  redactedFields?: string[];
}

/**
 * Interface for audit log query filters
 */
export interface AuditLogFilters {
  userId?: string;
  organizationId: string;
  action?: string | string[];
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  severity?: AuditSeverity;
}

/**
 * Interface for pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy: 'timestamp';
  sortOrder: 'asc' | 'desc';
}

/**
 * Interface for paginated audit log results
 */
export interface PaginatedAuditLogs {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Interface for integrity check results
 */
export interface IntegrityCheckResult {
  valid: boolean;
  expectedHash: string;
  actualHash: string;
  tamperedFields?: string[];
}

/**
 * Sensitive field names that should be redacted in snapshots
 */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'secret',
  'apiKey',
  'privateKey',
  'accessToken',
  'refreshToken',
];

/**
 * EnhancedAuditLogService provides comprehensive audit logging functionality.
 *
 * This service extends the basic audit logging with:
 * - Comprehensive action tracking (CRUD, authentication, permissions, exports)
 * - Data modification snapshots with sensitive field redaction
 * - Tamper-proof logging with cryptographic hashing and chain linking
 * - Asynchronous processing via BullMQ for performance
 * - Real-time event emission for security monitoring
 */
@Injectable()
export class EnhancedAuditLogService {
  private readonly logger = new Logger(EnhancedAuditLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('audit-write') private readonly auditWriteQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
    private readonly hashService: HashService,
  ) {}

  /**
   * Logs a general CRUD operation.
   *
   * @param entry - The audit action entry details
   */
  async logAction(entry: AuditActionEntry): Promise<void> {
    await this.queueAuditEntry({
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      timestamp: new Date(),
      metadata: entry.metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
  }

  /**
   * Logs an authentication event (login, logout, session expiration/revocation).
   *
   * @param entry - The authentication entry details
   *
   */
  async logAuthentication(entry: AuthenticationEntry): Promise<void> {
    const metadata: Record<string, any> = {
      success: entry.success,
    };

    if (entry.failureReason) {
      metadata.failureReason = entry.failureReason;
    }

    await this.queueAuditEntry({
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: entry.action,
      resourceType: 'Authentication',
      resourceId: entry.userId,
      timestamp: new Date(),
      metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      severity: entry.success ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
    });
  }

  /**
   * Logs a data modification operation with before/after snapshots.
   *
   * @param entry - The data modification entry details
   *
   */
  async logDataModification(entry: DataModificationEntry): Promise<void> {
    const snapshot = this.captureDataSnapshot(
      entry.beforeSnapshot,
      entry.afterSnapshot,
    );

    const metadata = {
      ...entry.metadata,
      ...snapshot,
    };

    await this.queueAuditEntry({
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      timestamp: new Date(),
      metadata,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
    });
  }

  /**
   * Logs a permission check operation.
   *
   * @param entry - The permission check entry details
   *
   */
  async logPermissionCheck(entry: PermissionCheckEntry): Promise<void> {
    await this.queueAuditEntry({
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: 'PERMISSION_CHECK',
      resourceType: entry.resourceType,
      resourceId: entry.resourceId || null,
      timestamp: new Date(),
      metadata: {
        attemptedAction: entry.action,
        granted: entry.granted,
        requiredRole: entry.requiredRole,
        userRole: entry.userRole,
      },
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      granted: entry.granted,
      requiredRole: entry.requiredRole,
      userRole: entry.userRole,
      severity: entry.granted ? AuditSeverity.LOW : AuditSeverity.MEDIUM,
    });
  }

  /**
   * Logs a role change operation.
   *
   * @param entry - The role change entry details
   *

   */
  async logRoleChange(entry: RoleChangeEntry): Promise<void> {
    await this.queueAuditEntry({
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: 'ROLE_CHANGE',
      resourceType: 'User',
      resourceId: entry.targetUserId,
      timestamp: new Date(),
      metadata: {
        targetUserId: entry.targetUserId,
        oldRole: entry.oldRole,
        newRole: entry.newRole,
        changedBy: entry.userId,
      },
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      severity:
        entry.newRole === Role.ADMIN || entry.newRole === Role.OWNER
          ? AuditSeverity.HIGH
          : AuditSeverity.MEDIUM,
    });
  }

  /**
   * Logs an export operation.
   *
   * @param entry - The export entry details
   *
   */
  async logExport(entry: ExportEntry): Promise<void> {
    await this.queueAuditEntry({
      userId: entry.userId,
      organizationId: entry.organizationId,
      action: 'EXPORT',
      resourceType: entry.scope,
      resourceId: null,
      timestamp: new Date(),
      metadata: {
        exportType: entry.exportType,
        scope: entry.scope,
        recordCount: entry.recordCount,
      },
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      severity: AuditSeverity.MEDIUM,
    });
  }

  /**
   * Queues an audit entry for asynchronous processing via BullMQ.
   *
   * This method:
   * 1. Generates a cryptographic hash for the entry
   * 2. Links to the previous entry hash (chain)
   * 3. Queues the entry to the audit-write queue
   * 4. Emits real-time events for security-relevant entries
   *
   * @param entry - The audit entry to queue
   *
   */
  private async queueAuditEntry(
    entry: AuditEntry & {
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
      granted?: boolean;
      requiredRole?: Role;
      userRole?: Role;
      severity?: AuditSeverity;
    },
  ): Promise<void> {
    try {
      // Generate entry hash
      const entryHash = await this.hashService.generateEntryHash(entry);

      // Get the last entry hash for chain linking
      const previousEntryHash = await this.getLastEntryHash(
        entry.organizationId,
      );

      // Queue the entry for async processing
      await this.auditWriteQueue.add(
        'create-audit-entry',
        {
          ...entry,
          entryHash,
          previousEntryHash,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
        },
      );

      // Emit real-time event for security-relevant entries
      if (this.isSecurityRelevant(entry)) {
        this.eventEmitter.emit('audit.created', {
          ...entry,
          entryHash,
          previousEntryHash,
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to queue audit entry: ${error.message}`,
        error.stack,
      );
      // Don't throw - audit logging should not block main operations
    }
  }

  /**
   * Captures a data snapshot with before/after states and identifies changed fields.
   *
   * @param before - The state before modification
   * @param after - The state after modification
   * @returns A data snapshot with redacted sensitive fields
   *
   */
  private captureDataSnapshot(
    before?: Record<string, any>,
    after?: Record<string, any>,
  ): DataSnapshot {
    const snapshot: DataSnapshot = {};
    const redactedFields: string[] = [];

    if (before) {
      const { redacted, fields } = this.redactSensitiveFields(before);
      snapshot.before = redacted;
      redactedFields.push(...fields);
    }

    if (after) {
      const { redacted, fields } = this.redactSensitiveFields(after);
      snapshot.after = redacted;
      redactedFields.push(...fields);
    }

    // Identify changed fields
    if (before && after) {
      const changedFields: string[] = [];
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

      for (const key of allKeys) {
        if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
          changedFields.push(key);
        }
      }

      snapshot.changedFields = changedFields;
    }

    // Always set redactedFields, even if empty
    snapshot.redactedFields = [...new Set(redactedFields)];

    return snapshot;
  }

  /**
   * Redacts sensitive fields from data objects.
   *
   * @param data - The data object to redact
   * @returns The redacted data and list of redacted field names
   *
   */
  private redactSensitiveFields(data: Record<string, any>): {
    redacted: Record<string, any>;
    fields: string[];
  } {
    const redacted = { ...data };
    const fields: string[] = [];

    for (const key of Object.keys(redacted)) {
      // Normalize field names by removing underscores and converting to lowercase for matching
      const normalizedKey = key.toLowerCase().replace(/_/g, '');
      const isSensitive = SENSITIVE_FIELDS.some((field) =>
        normalizedKey.includes(field.toLowerCase().replace(/_/g, ''))
      );

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
        fields.push(key);
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        // Recursively redact nested objects
        const nested = this.redactSensitiveFields(redacted[key]);
        redacted[key] = nested.redacted;
        fields.push(...nested.fields.map((f) => `${key}.${f}`));
      }
    }

    return { redacted, fields };
  }

  /**
   * Gets the hash of the last audit entry for the organization (for chain linking).
   *
   * @param organizationId - The organization ID
   * @returns The hash of the last entry, or null if no entries exist
   *
   */
  private async getLastEntryHash(
    organizationId: string,
  ): Promise<string | null> {
    try {
      const lastEntry = await this.prisma.auditLog.findFirst({
        where: { organizationId },
        orderBy: { timestamp: 'desc' },
        select: { entryHash: true },
      });

      return lastEntry?.entryHash || null;
    } catch (error) {
      this.logger.error(
        `Failed to get last entry hash: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Determines if an audit entry is security-relevant and should emit real-time events.
   *
   * @param entry - The audit entry to check
   * @returns true if the entry is security-relevant
   */
  private isSecurityRelevant(entry: AuditEntry & { severity?: AuditSeverity }): boolean {
    const securityActions = [
      'LOGIN',
      'LOGOUT',
      'PERMISSION_CHECK',
      'ROLE_CHANGE',
      'SESSION_EXPIRED',
      'SESSION_REVOKED',
    ];

    return (
      securityActions.includes(entry.action) ||
      entry.severity === AuditSeverity.HIGH ||
      entry.severity === AuditSeverity.CRITICAL
    );
  }

  /**
   * Queries audit logs with advanced filtering and pagination.
   *
   * @param filters - The filter criteria
   * @param pagination - The pagination options
   * @returns Paginated audit log results
   *
   */
  async queryLogs(
    filters: AuditLogFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedAuditLogs> {
    try {
      // Build the where clause
      const where: any = {
        organizationId: filters.organizationId, // Always filter by organization
      };

      if (filters.userId) {
        where.userId = filters.userId;
      }

      if (filters.action) {
        if (Array.isArray(filters.action)) {
          where.action = { in: filters.action };
        } else {
          where.action = filters.action;
        }
      }

      if (filters.resourceType) {
        where.resourceType = filters.resourceType;
      }

      if (filters.resourceId) {
        where.resourceId = filters.resourceId;
      }

      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) {
          where.timestamp.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.timestamp.lte = filters.endDate;
        }
      }

      if (filters.severity) {
        where.severity = filters.severity;
      }

      // Get total count
      const total = await this.prisma.auditLog.count({ where });

      // Calculate pagination
      const skip = (pagination.page - 1) * pagination.pageSize;
      const totalPages = Math.ceil(total / pagination.pageSize);

      // Query with pagination and sorting
      const data = await this.prisma.auditLog.findMany({
        where,
        skip,
        take: pagination.pageSize,
        orderBy: {
          [pagination.sortBy]: pagination.sortOrder,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return {
        data,
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalPages,
      };
    } catch (error) {
      this.logger.error(
        `Failed to query audit logs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Gets a single audit log entry by ID with integrity verification.
   *
   * @param id - The audit log entry ID
   * @param organizationId - The organization ID (for access control)
   * @returns The audit log entry with integrity status, or null if not found
   *
   */
  async getLogById(
    id: string,
    organizationId: string,
  ): Promise<any | null> {
    try {
      const entry = await this.prisma.auditLog.findFirst({
        where: {
          id,
          organizationId, // Ensure organization isolation
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!entry) {
        return null;
      }

      // Verify hash integrity
      const integrityCheck = await this.verifyLogIntegrity(entry);

      return {
        ...entry,
        integrityCheck,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get audit log by ID: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Verifies the integrity of an audit log entry by recalculating its hash.
   *
   * @param entry - The audit log entry to verify
   * @returns The integrity check result
   *
   */
  async verifyLogIntegrity(entry: any): Promise<IntegrityCheckResult> {
    try {
      const auditEntry: AuditEntry = {
        userId: entry.userId,
        organizationId: entry.organizationId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
      };

      const expectedHash = await this.hashService.generateEntryHash(auditEntry);
      const actualHash = entry.entryHash;
      const valid = expectedHash === actualHash;

      return {
        valid,
        expectedHash,
        actualHash,
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify log integrity: ${error.message}`,
        error.stack,
      );
      return {
        valid: false,
        expectedHash: '',
        actualHash: entry.entryHash,
      };
    }
  }


  /**
   * Anonymizes all audit entries for a specific user (GDPR right to be forgotten).
   * Replaces userId with an anonymized identifier while preserving the audit trail.
   *
   * @param userId - The user ID to anonymize
   * @param organizationId - The organization ID for isolation
   * @returns The count of anonymized entries
   *
   */
  async anonymizeUserData(
    userId: string,
    organizationId: string,
  ): Promise<{ anonymizedCount: number; anonymizedId: string }> {
    try {
      // Generate anonymized identifier (hash of userId for consistency)
      const anonymizedId = `anon_${await this.hashService['sha256'](userId)}`;

      // Update all audit entries for this user
      const result = await this.prisma.auditLog.updateMany({
        where: {
          userId,
          organizationId, // Ensure organization isolation
        },
        data: {
          userId: anonymizedId,
          // Preserve timestamp, action, resourceType as required
          // metadata is preserved but sensitive fields should already be redacted
        },
      });

      // Also update archived audit logs
      await this.prisma.archivedAuditLog.updateMany({
        where: {
          userId,
          organizationId,
        },
        data: {
          userId: anonymizedId,
        },
      });

      this.logger.log(
        `Anonymized ${result.count} audit entries for user ${userId} in organization ${organizationId}`,
      );

      return {
        anonymizedCount: result.count,
        anonymizedId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to anonymize user data: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generates a compliance report for the organization.
   * Includes certification statement with report timestamp and hash.
   *
   * @param organizationId - The organization ID
   * @param reportType - The type of compliance report (SOC2, GDPR, HIPAA)
   * @param startDate - Start date for the report period
   * @param endDate - End date for the report period
   * @returns The compliance report with certification
   *
   */
  async generateComplianceReport(
    organizationId: string,
    reportType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    try {
      // Query all audit logs for the period
      const filters = {
        organizationId,
        startDate,
        endDate,
      };

      const pagination = {
        page: 1,
        pageSize: 999999, // Get all records for compliance
        sortBy: 'timestamp' as const,
        sortOrder: 'asc' as const,
      };

      const auditLogs = await this.queryLogs(filters, pagination);

      // Generate report metadata
      const reportTimestamp = new Date();
      const reportData = {
        reportType,
        organizationId,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        generatedAt: reportTimestamp.toISOString(),
        summary: {
          totalEntries: auditLogs.total,
          actionBreakdown: this.calculateActionBreakdown(auditLogs.data),
          userCount: this.calculateUniqueUsers(auditLogs.data),
          securityEvents: this.calculateSecurityEvents(auditLogs.data),
        },
        entries: auditLogs.data,
      };

      // Generate certification hash
      const certificationHash = await this.hashService.generateEntryHash({
        userId: 'system',
        organizationId,
        action: 'COMPLIANCE_REPORT',
        resourceType: 'ComplianceReport',
        resourceId: reportType,
        timestamp: reportTimestamp,
        metadata: {
          reportType,
          period: reportData.period,
          totalEntries: auditLogs.total,
        },
      });

      // Add certification statement
      const certification = {
        statement: `This ${reportType} compliance report was generated on ${reportTimestamp.toISOString()} and contains ${auditLogs.total} audit entries for the period ${startDate.toISOString()} to ${endDate.toISOString()}. The integrity of this report is verified by the certification hash.`,
        timestamp: reportTimestamp.toISOString(),
        hash: certificationHash,
        reportType,
      };

      this.logger.log(
        `Generated ${reportType} compliance report for organization ${organizationId} with ${auditLogs.total} entries`,
      );

      return {
        ...reportData,
        certification,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate compliance report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate action breakdown for compliance report
   */
  private calculateActionBreakdown(entries: any[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const entry of entries) {
      breakdown[entry.action] = (breakdown[entry.action] || 0) + 1;
    }
    return breakdown;
  }

  /**
   * Calculate unique users for compliance report
   */
  private calculateUniqueUsers(entries: any[]): number {
    const uniqueUsers = new Set(entries.map(entry => entry.userId));
    return uniqueUsers.size;
  }

  /**
   * Calculate security events for compliance report
   */
  private calculateSecurityEvents(entries: any[]): number {
    return entries.filter(entry =>
      entry.severity === 'HIGH' ||
      entry.severity === 'CRITICAL' ||
      entry.action === 'PERMISSION_CHECK' && entry.granted === false
    ).length;
  }

}
