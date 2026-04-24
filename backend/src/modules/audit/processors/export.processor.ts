import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EXPORT_QUEUE } from '../audit.module';
import { AuditExportService } from '../services/audit-export.service';
import { ExportFormat } from '@prisma/client';
import { AuditLogFilters } from '../services/enhanced-audit-log.service';

/**
 * Interface for export job data
 */
interface ExportJobData {
  exportId: string;
  userId: string;
  organizationId: string;
  format: ExportFormat;
  filters: AuditLogFilters;
}

/**
 * ExportProcessor handles background processing of large audit log exports.
 *
 * This processor:
 * - Generates CSV or JSON export files
 * - Applies query filters
 * - Stores files with 24-hour expiry
 * - Updates export status on completion
 *
 */
@Processor(EXPORT_QUEUE)
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(private readonly auditExportService: AuditExportService) {
    super();
  }

  /**
   * Processes an export job.
   *
   * @param job - The BullMQ job containing export parameters
   * @returns Export result with download URL
   */
  async process(job: Job<ExportJobData>): Promise<any> {
    this.logger.debug(`Processing export job ${job.id}`);

    const { exportId, filters, format, organizationId } = job.data;

    try {
      const result = await this.auditExportService.processExport(
        exportId,
        filters,
        format,
        organizationId,
      );

      return {
        exportId,
        status: 'COMPLETED',
        downloadUrl: result.downloadUrl,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      this.logger.error(
        `Export job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Called when a job completes successfully.
   */
  async onCompleted(job: Job<ExportJobData>, result: any): Promise<void> {
    this.logger.log(
      `Export job ${job.id} completed for user ${job.data.userId}`,
    );
  }

  /**
   * Called when a job fails after all retry attempts.
   */
  async onFailed(job: Job<ExportJobData>, error: Error): Promise<void> {
    this.logger.error(
      `Export job ${job.id} failed: ${error.message}`,
      error.stack,
    );
  }
}
