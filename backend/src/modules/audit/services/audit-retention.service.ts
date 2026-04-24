import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { AuditLogFilters, PaginationOptions, PaginatedAuditLogs } from './enhanced-audit-log.service';
import { AuditLog, AuditRetentionPolicy, Prisma } from '@prisma/client';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/**
 * Interface for retention policy input
 */
export interface RetentionPolicyInput {
  defaultRetentionDays: number;
  actionSpecificRetention?: Record<string, number>;
}

/**
 * Interface for archival result
 */
export interface ArchivalResult {
  organizationId?: string;
  totalArchived: number;
  archivedByAction: Record<string, number>;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Interface for compressed archive entry
 */
interface CompressedArchiveEntry {
  originalId: string;
  compressedData: Buffer;
  compressionRatio: number;
}

/**
 * Service for managing audit log retention policies and archival
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);
  private readonly MINIMUM_RETENTION_DAYS = 90;
  private readonly BATCH_SIZE = 1000;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('archival') private readonly archivalQueue: Queue,
  ) {}

  /**
   * Get retention policy for an organization
   * Creates default policy if none exists
   */
  async getRetentionPolicy(organizationId: string): Promise<AuditRetentionPolicy> {
    let policy = await this.prisma.auditRetentionPolicy.findUnique({
      where: { organizationId },
    });

    if (!policy) {
      // Create default policy with 90-day retention
      policy = await this.prisma.auditRetentionPolicy.create({
        data: {
          organizationId,
          defaultRetentionDays: this.MINIMUM_RETENTION_DAYS,
        },
      });
      this.logger.log(`Created default retention policy for organization ${organizationId}`);
    }

    return policy;
  }

  /**
   * Update retention policy for an organization
   * Enforces minimum 90-day retention period
   */
  async updateRetentionPolicy(
    organizationId: string,
    policyInput: RetentionPolicyInput,
  ): Promise<AuditRetentionPolicy> {
    // Validate minimum retention period
    if (policyInput.defaultRetentionDays < this.MINIMUM_RETENTION_DAYS) {
      throw new BadRequestException(
        `Retention period must be at least ${this.MINIMUM_RETENTION_DAYS} days. Provided: ${policyInput.defaultRetentionDays} days`,
      );
    }

    // Validate action-specific retention periods
    if (policyInput.actionSpecificRetention) {
      for (const [action, days] of Object.entries(policyInput.actionSpecificRetention)) {
        if (days < this.MINIMUM_RETENTION_DAYS) {
          throw new BadRequestException(
            `Retention period for action ${action} must be at least ${this.MINIMUM_RETENTION_DAYS} days. Provided: ${days} days`,
          );
        }
      }
    }

    // Upsert the policy
    const policy = await this.prisma.auditRetentionPolicy.upsert({
      where: { organizationId },
      update: {
        defaultRetentionDays: policyInput.defaultRetentionDays,
        actionSpecificRetention: policyInput.actionSpecificRetention as Prisma.JsonValue,
      },
      create: {
        organizationId,
        defaultRetentionDays: policyInput.defaultRetentionDays,
        actionSpecificRetention: policyInput.actionSpecificRetention as Prisma.JsonValue,
      },
    });

    this.logger.log(`Updated retention policy for organization ${organizationId}`);
    return policy;
  }

  /**
   * Archive old audit logs based on retention policies
   * Processes in batches to avoid performance impact
   */
  async archiveOldLogs(organizationId?: string): Promise<ArchivalResult> {
    const startTime = new Date();
    let totalArchived = 0;
    const archivedByAction: Record<string, number> = {};

    try {
      // Get organizations to process
      const organizations = organizationId
        ? [{ id: organizationId }]
        : await this.prisma.organization.findMany({ select: { id: true } });

      for (const org of organizations) {
        const policy = await this.getRetentionPolicy(org.id);

        // Identify logs for archival
        const logIds = await this.identifyLogsForArchival(
          org.id,
          policy.defaultRetentionDays,
          policy.actionSpecificRetention as Record<string, number> | null,
        );

        if (logIds.length === 0) {
          this.logger.log(`No logs to archive for organization ${org.id}`);
          continue;
        }

        // Process in batches
        for (let i = 0; i < logIds.length; i += this.BATCH_SIZE) {
          const batchIds = logIds.slice(i, i + this.BATCH_SIZE);
          const archived = await this.moveToArchive(batchIds);

          // Count by action
          for (const entry of archived) {
            archivedByAction[entry.action] = (archivedByAction[entry.action] || 0) + 1;
          }

          totalArchived += archived.length;
          this.logger.log(
            `Archived batch ${Math.floor(i / this.BATCH_SIZE) + 1} for organization ${org.id}: ${archived.length} entries`,
          );
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.log(
        `Archival complete: ${totalArchived} entries archived in ${duration}ms`,
      );

      return {
        organizationId,
        totalArchived,
        archivedByAction,
        startTime,
        endTime,
        duration,
      };
    } catch (error) {
      this.logger.error(`Archival failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Query archived audit logs
   */
  async queryArchivedLogs(
    filters: AuditLogFilters,
    pagination: PaginationOptions,
  ): Promise<PaginatedAuditLogs> {
    const { page, pageSize, sortBy, sortOrder } = pagination;
    const skip = (page - 1) * pageSize;

    // Build where clause
    const where: any = {
      organizationId: filters.organizationId,
    };

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.action) {
      where.action = Array.isArray(filters.action)
        ? { in: filters.action }
        : filters.action;
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

    // Execute query with pagination
    const [archivedLogs, total] = await Promise.all([
      this.prisma.archivedAuditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.archivedAuditLog.count({ where }),
    ]);

    // Decompress metadata for each log
    const data = await Promise.all(
      archivedLogs.map(async (log) => {
        let metadata = null;
        if (log.compressedMetadata) {
          try {
            const decompressed = await gunzip(log.compressedMetadata);
            metadata = JSON.parse(decompressed.toString('utf-8'));
          } catch (error) {
            this.logger.error(
              `Failed to decompress metadata for archived log ${log.id}: ${error.message}`,
            );
          }
        }

        return {
          ...log,
          metadata,
          compressedMetadata: undefined, // Remove compressed data from response
        };
      }),
    );

    return {
      data: data as any[],
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Identify audit logs that should be archived based on retention policy
   */
  private async identifyLogsForArchival(
    organizationId: string,
    defaultRetentionDays: number,
    actionSpecificRetention: Record<string, number> | null,
  ): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - defaultRetentionDays);

    // Build query to find logs older than retention period
    const where: any = {
      organizationId,
      timestamp: { lt: cutoffDate },
    };

    // If action-specific retention exists, we need to handle it differently
    if (actionSpecificRetention && Object.keys(actionSpecificRetention).length > 0) {
      // For actions with specific retention, calculate their cutoff dates
      const actionQueries = [];

      // Add query for actions with default retention
      const actionsWithSpecificRetention = Object.keys(actionSpecificRetention);
      actionQueries.push({
        organizationId,
        timestamp: { lt: cutoffDate },
        action: { notIn: actionsWithSpecificRetention },
      });

      // Add queries for each action with specific retention
      for (const [action, retentionDays] of Object.entries(actionSpecificRetention)) {
        const actionCutoffDate = new Date();
        actionCutoffDate.setDate(actionCutoffDate.getDate() - retentionDays);

        actionQueries.push({
          organizationId,
          timestamp: { lt: actionCutoffDate },
          action,
        });
      }

      // Find logs matching any of the queries
      const logs = await this.prisma.auditLog.findMany({
        where: { OR: actionQueries },
        select: { id: true },
      });

      return logs.map((log) => log.id);
    }

    // Simple case: all actions use default retention
    const logs = await this.prisma.auditLog.findMany({
      where,
      select: { id: true },
    });

    return logs.map((log) => log.id);
  }

  /**
   * Move audit logs to archive table with compression
   */
  private async moveToArchive(logIds: string[]): Promise<any[]> {
    // Fetch the logs to archive
    const logs = await this.prisma.auditLog.findMany({
      where: { id: { in: logIds } },
    });

    if (logs.length === 0) {
      return [];
    }

    // Compress and prepare archive entries
    const compressedEntries = await this.compressArchiveData(logs);

    // Create archived entries in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Insert into archive table
      for (const entry of compressedEntries) {
        const log = logs.find((l) => l.id === entry.originalId);
        if (!log) continue;

        await tx.archivedAuditLog.create({
          data: {
            id: log.id,
            userId: log.userId,
            organizationId: log.organizationId,
            action: log.action,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            compressedMetadata: entry.compressedData,
            granted: log.granted,
            requiredRole: log.requiredRole,
            userRole: log.userRole,
            timestamp: log.timestamp,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            entryHash: log.entryHash,
            previousEntryHash: log.previousEntryHash,
            severity: log.severity,
          },
        });
      }

      // Delete from active table
      await tx.auditLog.deleteMany({
        where: { id: { in: logIds } },
      });
    });

    this.logger.log(`Moved ${logs.length} logs to archive`);
    return logs;
  }

  /**
   * Compress audit log metadata using gzip
   */
  private async compressArchiveData(
    logs: AuditLog[],
  ): Promise<CompressedArchiveEntry[]> {
    const compressed: CompressedArchiveEntry[] = [];

    for (const log of logs) {
      let compressedData: Buffer | null = null;
      let compressionRatio = 1;

      if (log.metadata) {
        const metadataString = JSON.stringify(log.metadata);
        const originalSize = Buffer.byteLength(metadataString, 'utf-8');

        compressedData = await gzip(metadataString);
        const compressedSize = compressedData.length;

        compressionRatio = originalSize / compressedSize;

        this.logger.debug(
          `Compressed metadata for log ${log.id}: ${originalSize} -> ${compressedSize} bytes (${compressionRatio.toFixed(2)}x)`,
        );
      }

      compressed.push({
        originalId: log.id,
        compressedData: compressedData || Buffer.from(''),
        compressionRatio,
      });
    }

    return compressed;
  }
}
