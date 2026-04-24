import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ARCHIVAL_QUEUE } from '../audit.module';
import { AuditRetentionService } from '../services/audit-retention.service';
import { EnhancedAuditLogService } from '../services/enhanced-audit-log.service';

/**
 * Interface for archival job data
 */
interface ArchivalJobData {
  organizationId?: string;
  retentionDays?: number;
  batchSize?: number;
}

/**
 * ArchivalProcessor handles background processing of audit log archival.
 *
 * This processor:
 * - Identifies audit entries older than retention period
 * - Moves entries to archived_audit_logs table
 * - Compresses data to reduce storage costs
 * - Processes in batches to avoid performance impact
 * - Logs archival operation with statistics
 *
 */
@Processor(ARCHIVAL_QUEUE)
export class ArchivalProcessor extends WorkerHost {
  private readonly logger = new Logger(ArchivalProcessor.name);

  constructor(
    private readonly retentionService: AuditRetentionService,
    private readonly auditLogService: EnhancedAuditLogService,
  ) {
    super();
  }

  /**
   * Processes an archival job.
   *
   * @param job - The BullMQ job containing archival parameters
   * @returns Archival result with statistics
   */
  async process(job: Job<ArchivalJobData>): Promise<any> {
    this.logger.debug(`Processing archival job ${job.id}`);

    try {
      // Execute archival process
      const result = await this.retentionService.archiveOldLogs(
        job.data.organizationId,
      );

      // Log the archival operation to audit log
      if (result.totalArchived > 0) {
        await this.auditLogService.logAction({
          userId: 'system',
          organizationId: job.data.organizationId || 'system',
          action: 'ARCHIVAL',
          resourceType: 'AuditLog',
          resourceId: null,
          metadata: {
            totalArchived: result.totalArchived,
            archivedByAction: result.archivedByAction,
            duration: result.duration,
            startTime: result.startTime,
            endTime: result.endTime,
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Archival job ${job.id} failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Called when a job completes successfully.
   */
  async onCompleted(job: Job<ArchivalJobData>, result: any): Promise<void> {
    this.logger.log(
      `Archival job ${job.id} completed: ${result.totalArchived} entries archived in ${result.duration}ms`,
    );
  }

  /**
   * Called when a job fails after all retry attempts.
   */
  async onFailed(job: Job<ArchivalJobData>, error: Error): Promise<void> {
    this.logger.error(
      `Archival job ${job.id} failed after all retries: ${error.message}`,
      error.stack,
    );
  }
}
