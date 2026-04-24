import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { AUDIT_WRITE_QUEUE } from '../audit.module';
import { AuditSeverity, Role } from '@prisma/client';
import { AuditMonitorService } from '../services/audit-monitor.service';

/**
 * Interface for audit write job data
 */
interface AuditWriteJobData {
  userId: string;
  organizationId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  timestamp: Date;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  granted?: boolean;
  requiredRole?: Role;
  userRole?: Role;
  severity?: AuditSeverity;
  entryHash: string;
  previousEntryHash: string | null;
}

/**
 * AuditWriteProcessor handles background processing of audit entry creation.
 *
 * This processor:
 * - Writes audit entries to the database asynchronously
 * - Implements retry logic (3 attempts) for failed writes
 * - Handles errors gracefully without blocking main operations
 * - Logs processing metrics for monitoring
 *
 */
@Processor(AUDIT_WRITE_QUEUE)
export class AuditWriteProcessor extends WorkerHost {
  private readonly logger = new Logger(AuditWriteProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditMonitorService: AuditMonitorService,
  ) {
    super();
  }

  /**
   * Processes an audit write job.
   *
   * @param job - The BullMQ job containing audit entry data
   * @returns The created audit log entry
   *
   */
  async process(job: Job<AuditWriteJobData>): Promise<any> {
    const startTime = Date.now();
    const { data } = job;

    try {
      this.logger.debug(
        `Processing audit write job ${job.id} (attempt ${job.attemptsMade + 1}/3)`,
      );

      // Create the audit log entry in the database
      const auditLog = await this.prisma.auditLog.create({
        data: {
          userId: data.userId,
          organizationId: data.organizationId,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          timestamp: new Date(data.timestamp),
          metadata: data.metadata || {},
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          granted: data.granted,
          requiredRole: data.requiredRole,
          userRole: data.userRole,
          severity: data.severity,
          entryHash: data.entryHash,
          previousEntryHash: data.previousEntryHash,
        },
      });

      const duration = Date.now() - startTime;
      this.logger.debug(
        `Successfully processed audit write job ${job.id} in ${duration}ms`,
      );

      // Emit real-time event for security-relevant entries
      await this.auditMonitorService.emitAuditEvent(auditLog);

      // Detect suspicious patterns
      await this.auditMonitorService.detectSuspiciousPatterns(auditLog);

      return auditLog;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Failed to process audit write job ${job.id} (attempt ${job.attemptsMade + 1}/3) after ${duration}ms: ${error.message}`,
        error.stack,
      );

      // Re-throw to trigger retry logic
      throw error;
    }
  }

  /**
   * Called when a job completes successfully.
   *
   * @param job - The completed job
   * @param result - The result of the job processing
   */
  async onCompleted(job: Job<AuditWriteJobData>, result: any): Promise<void> {
    this.logger.debug(
      `Audit write job ${job.id} completed successfully for organization ${job.data.organizationId}`,
    );
  }

  /**
   * Called when a job fails after all retry attempts.
   *
   * @param job - The failed job
   * @param error - The error that caused the failure
   */
  async onFailed(job: Job<AuditWriteJobData>, error: Error): Promise<void> {
    this.logger.error(
      `Audit write job ${job.id} failed after ${job.attemptsMade} attempts for organization ${job.data.organizationId}: ${error.message}`,
      error.stack,
    );

    // Log the failure to a separate error tracking system if needed
    // This ensures we don't lose track of failed audit entries
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: 'system',
          organizationId: job.data.organizationId,
          action: 'AUDIT_WRITE_FAILURE',
          resourceType: 'AuditLog',
          resourceId: null,
          timestamp: new Date(),
          metadata: {
            originalJobId: job.id,
            originalAction: job.data.action,
            originalResourceType: job.data.resourceType,
            originalResourceId: job.data.resourceId,
            error: error.message,
            attempts: job.attemptsMade,
          },
          severity: AuditSeverity.CRITICAL,
          entryHash: 'failed-entry',
          previousEntryHash: null,
        },
      });
    } catch (logError) {
      this.logger.error(
        `Failed to log audit write failure: ${logError.message}`,
        logError.stack,
      );
    }
  }

  /**
   * Called when a job is active (being processed).
   *
   * @param job - The active job
   */
  async onActive(job: Job<AuditWriteJobData>): Promise<void> {
    this.logger.debug(
      `Audit write job ${job.id} is now active (attempt ${job.attemptsMade + 1}/3)`,
    );
  }

  /**
   * Called when a job is stalled (worker crashed or took too long).
   *
   * @param jobId - The ID of the stalled job
   */
  async onStalled(jobId: string): Promise<void> {
    this.logger.warn(`Audit write job ${jobId} has stalled`);
  }
}
