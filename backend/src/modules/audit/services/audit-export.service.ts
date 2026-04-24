import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { ExportFormat, ExportStatus } from '@prisma/client';
import { AuditLogFilters } from './enhanced-audit-log.service';
import { EXPORT_QUEUE } from '../audit.module';

// Define a minimal interface for file storage to avoid circular dependencies
export interface IFileStorageService {
  saveFile(buffer: Buffer, filename: string, organizationId: string): Promise<string>;
  getFilePath(relativePath: string): string;
}

/**
 * Interface for export result
 */
export interface ExportResult {
  exportId: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  estimatedRecords: number;
  downloadUrl?: string;
  expiresAt?: Date;
}

/**
 * Interface for export status
 */
export interface ExportStatusResult {
  exportId: string;
  status: ExportStatus;
  progress: number;
  totalRecords: number;
  processedRecords: number;
  downloadUrl?: string;
  expiresAt?: Date;
  error?: string;
}

/**
 * Threshold for queuing exports to background job
 * Exports with >= 10,000 records are processed asynchronously
 */
const LARGE_EXPORT_THRESHOLD = 10000;

/**
 * Export file expiry time in hours
 */
const EXPORT_EXPIRY_HOURS = 24;

/**
 * AuditExportService handles export of audit logs to CSV and JSON formats.
 *
 * This service:
 * - Estimates record count for export requests
 * - Processes small exports (<10,000 records) synchronously
 * - Queues large exports (>=10,000 records) to background job
 * - Generates CSV and JSON export files
 * - Stores files with 24-hour expiry
 * - Tracks export status and provides download URLs
 *
 */
@Injectable()
export class AuditExportService {
  private readonly logger = new Logger(AuditExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(EXPORT_QUEUE) private readonly exportQueue: Queue,
    @Inject('FileStorageService') private readonly fileStorageService: IFileStorageService,
  ) {}

  /**
   * Exports audit logs to CSV or JSON format.
   *
   * For small exports (<10,000 records): Processes synchronously and returns download URL
   * For large exports (>=10,000 records): Queues to background job and returns export ID
   *
   * @param filters - Query filters to apply
   * @param format - Export format (CSV or JSON)
   * @param userId - User requesting the export
   * @param organizationId - Organization ID
   * @returns Export result with status and download URL (if synchronous)
   *
   */
  async exportLogs(
    filters: AuditLogFilters,
    format: ExportFormat,
    userId: string,
    organizationId: string,
  ): Promise<ExportResult> {
    try {
      // Estimate record count
      const estimatedRecords = await this.estimateRecordCount(filters);

      // Create export record
      const exportRecord = await this.prisma.auditExport.create({
        data: {
          userId,
          organizationId,
          format,
          status: ExportStatus.QUEUED,
          filters: filters as any,
          estimatedRecords,
        },
      });

      this.logger.log(
        `Export ${exportRecord.id} created: ${estimatedRecords} estimated records`,
      );

      // Determine if this is a large export
      if (estimatedRecords >= LARGE_EXPORT_THRESHOLD) {
        // Queue to background job
        await this.exportQueue.add(
          'process-export',
          {
            exportId: exportRecord.id,
            userId,
            organizationId,
            format,
            filters,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1500,
            },
          },
        );

        return {
          exportId: exportRecord.id,
          status: 'PROCESSING',
          estimatedRecords,
        };
      } else {
        // Process synchronously
        const result = await this.processExport(
          exportRecord.id,
          filters,
          format,
          organizationId,
        );

        return {
          exportId: exportRecord.id,
          status: 'COMPLETED',
          estimatedRecords,
          downloadUrl: result.downloadUrl,
          expiresAt: result.expiresAt,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to export audit logs: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Gets the status of an export job.
   *
   * @param exportId - The export ID
   * @returns Export status with progress and download URL
   *
   */
  async getExportStatus(exportId: string): Promise<ExportStatusResult> {
    const exportRecord = await this.prisma.auditExport.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      throw new NotFoundException(`Export ${exportId} not found`);
    }

    const progress =
      exportRecord.actualRecords && exportRecord.estimatedRecords
        ? Math.round(
            (exportRecord.actualRecords / exportRecord.estimatedRecords) * 100,
          )
        : 0;

    return {
      exportId: exportRecord.id,
      status: exportRecord.status,
      progress,
      totalRecords: exportRecord.estimatedRecords,
      processedRecords: exportRecord.actualRecords || 0,
      downloadUrl: exportRecord.downloadUrl || undefined,
      expiresAt: exportRecord.expiresAt || undefined,
      error: exportRecord.error || undefined,
    };
  }

  /**
   * Gets the download URL for a completed export.
   *
   * @param exportId - The export ID
   * @param userId - User requesting the download (for access control)
   * @returns Download URL
   *
   */
  async downloadExport(exportId: string, userId: string): Promise<string> {
    const exportRecord = await this.prisma.auditExport.findFirst({
      where: {
        id: exportId,
        userId, // Ensure user can only download their own exports
      },
    });

    if (!exportRecord) {
      throw new NotFoundException(`Export ${exportId} not found`);
    }

    if (exportRecord.status !== ExportStatus.COMPLETED) {
      throw new Error('Export is not completed yet');
    }

    if (!exportRecord.downloadUrl) {
      throw new Error('Download URL not available');
    }

    // Check if export has expired
    if (exportRecord.expiresAt && exportRecord.expiresAt < new Date()) {
      throw new Error('Export has expired');
    }

    return exportRecord.downloadUrl;
  }

  /**
   * Processes an export job (called by processor or for synchronous exports).
   *
   * @param exportId - The export ID
   * @param filters - Query filters
   * @param format - Export format
   * @param organizationId - Organization ID
   * @returns Export result with download URL
   *
   */
  async processExport(
    exportId: string,
    filters: AuditLogFilters,
    format: ExportFormat,
    organizationId: string,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    try {
      // Update status to PROCESSING
      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: { status: ExportStatus.PROCESSING },
      });

      // Build where clause from filters
      const where = this.buildWhereClause(filters);

      // Fetch all matching audit logs
      const logs = await this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
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

      this.logger.log(`Export ${exportId}: Fetched ${logs.length} records`);

      // Generate export file
      let content: string;
      let filename: string;

      if (format === ExportFormat.CSV) {
        content = await this.generateCSV(logs);
        filename = `audit-export-${exportId}.csv`;
      } else {
        content = await this.generateJSON(logs);
        filename = `audit-export-${exportId}.json`;
      }

      // Save file to storage
      const buffer = Buffer.from(content, 'utf-8');
      const filePath = await this.fileStorageService.saveFile(
        buffer,
        filename,
        organizationId,
      );

      // Calculate expiry time (24 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + EXPORT_EXPIRY_HOURS);

      // Generate download URL (relative path for now)
      const downloadUrl = `/api/audit-logs/export/${exportId}/download`;

      // Update export record
      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.COMPLETED,
          actualRecords: logs.length,
          filename,
          s3Key: filePath, // Using s3Key field to store file path
          downloadUrl,
          expiresAt,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Export ${exportId} completed: ${logs.length} records`);

      return { downloadUrl, expiresAt };
    } catch (error) {
      this.logger.error(
        `Failed to process export ${exportId}: ${error.message}`,
        error.stack,
      );

      // Update export record with error
      await this.prisma.auditExport.update({
        where: { id: exportId },
        data: {
          status: ExportStatus.FAILED,
          error: error.message,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Estimates the number of records that will be exported.
   *
   * @param filters - Query filters
   * @returns Estimated record count
   *
   */
  private async estimateRecordCount(filters: AuditLogFilters): Promise<number> {
    const where = this.buildWhereClause(filters);
    return this.prisma.auditLog.count({ where });
  }

  /**
   * Generates a CSV export from audit logs.
   *
   * @param logs - Audit log entries
   * @returns CSV content as string
   *
   */
  private async generateCSV(logs: any[]): Promise<string> {
    // CSV headers
    const headers = [
      'ID',
      'Timestamp',
      'User ID',
      'User Email',
      'User Name',
      'Organization ID',
      'Action',
      'Resource Type',
      'Resource ID',
      'IP Address',
      'User Agent',
      'Granted',
      'Required Role',
      'User Role',
      'Severity',
      'Entry Hash',
      'Previous Entry Hash',
      'Metadata',
    ];

    // Build CSV rows
    const rows = logs.map((log) => [
      log.id,
      log.timestamp && !isNaN(log.timestamp.getTime()) ? log.timestamp.toISOString() : '',
      log.userId,
      log.user?.email || '',
      log.user?.name || '',
      log.organizationId,
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.ipAddress || '',
      log.userAgent || '',
      log.granted !== null ? log.granted.toString() : '',
      log.requiredRole || '',
      log.userRole || '',
      log.severity || '',
      log.entryHash,
      log.previousEntryHash || '',
      log.metadata ? JSON.stringify(log.metadata) : '',
    ]);

    // Escape CSV values
    const escapeCsvValue = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvLines = [
      headers.map(escapeCsvValue).join(','),
      ...rows.map((row) => row.map((v) => escapeCsvValue(v)).join(',')),
    ];

    return csvLines.join('\n');
  }

  /**
   * Generates a JSON export from audit logs.
   *
   * @param logs - Audit log entries
   * @returns JSON content as string
   *
   */
  private async generateJSON(logs: any[]): Promise<string> {
    // Format logs for JSON export
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      timestamp: log.timestamp && !isNaN(log.timestamp.getTime()) ? log.timestamp.toISOString() : new Date().toISOString(),
      userId: log.userId,
      user: log.user
        ? {
            id: log.user.id,
            email: log.user.email,
            name: log.user.name,
          }
        : null,
      organizationId: log.organizationId,
      action: log.action,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      granted: log.granted,
      requiredRole: log.requiredRole,
      userRole: log.userRole,
      severity: log.severity,
      entryHash: log.entryHash,
      previousEntryHash: log.previousEntryHash,
      metadata: log.metadata,
    }));

    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalRecords: logs.length,
        logs: formattedLogs,
      },
      null,
      2,
    );
  }

  /**
   * Builds a Prisma where clause from filters.
   *
   * @param filters - Query filters
   * @returns Prisma where clause
   *
   */
  private buildWhereClause(filters: AuditLogFilters): any {
    const where: any = {
      organizationId: filters.organizationId,
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

    return where;
  }
}
