import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { CoverageService } from '../coverage.service';
import { COVERAGE_QUEUE, CoverageFormat, CoverageStatus } from '../constants';
import { CoverageParserFactory } from '../parsers';

/**
 * Job data for coverage parsing
 */
interface CoverageJobData {
  reportId: string;
  filePath: string;
  format: CoverageFormat;
  repositoryId: string;
  organizationId: string;
}

/**
 * BullMQ processor for coverage report parsing
 */
@Processor(COVERAGE_QUEUE)
export class CoverageProcessor extends WorkerHost {
  private readonly logger = new Logger(CoverageProcessor.name);

  constructor(private readonly coverageService: CoverageService) {
    super();
  }

  /**
   * Process coverage parsing job
   */
  async process(job: Job<CoverageJobData>): Promise<void> {
    const { reportId, filePath, format, repositoryId } = job.data;

    this.logger.log(`Processing coverage report ${reportId} (format: ${format})`);

    try {
      // Update status to processing
      await this.coverageService.updateReport(reportId, {
        status: CoverageStatus.PROCESSING,
      });

      // Read file content
      if (!existsSync(filePath)) {
        throw new Error(`Coverage file not found: ${filePath}`);
      }

      const content = readFileSync(filePath, 'utf-8');

      // Parse coverage using appropriate parser
      const parseResult = CoverageParserFactory.parse(content, format);

      this.logger.debug(
        `Parsed coverage: ${parseResult.modules.length} modules, ` +
          `${parseResult.linesCovered}/${parseResult.linesTotal} lines (${parseResult.coveragePercentage}%)`,
      );

      // Get current report to extract branch for branch-aware delta calculation
      const currentReport = await this.coverageService.findById(reportId, job.data.organizationId);
      const branch = currentReport?.branch;

      // Get previous coverage for delta calculation
      const previousCoverage = await this.coverageService.getPreviousCoverage(
        repositoryId,
        reportId,
        branch,
      );

      const coverageDelta =
        previousCoverage !== null
          ? Math.round((parseResult.coveragePercentage - previousCoverage) * 100) / 100
          : null;

      // Create module records
      if (parseResult.modules.length > 0) {
        await this.coverageService.createModules(reportId, parseResult.modules);
      }

      // Update report with results
      await this.coverageService.updateReport(reportId, {
        status: CoverageStatus.COMPLETED,
        linesTotal: parseResult.linesTotal,
        linesCovered: parseResult.linesCovered,
        coveragePercentage: parseResult.coveragePercentage,
        previousCoveragePercentage: previousCoverage ?? undefined,
        coverageDelta: coverageDelta ?? undefined,
      });

      this.logger.log(
        `Coverage report ${reportId} processed successfully: ` +
          `${parseResult.coveragePercentage}% coverage` +
          (coverageDelta !== null
            ? ` (delta: ${coverageDelta > 0 ? '+' : ''}${coverageDelta}%)`
            : ''),
      );

      // Clean up uploaded file after successful processing
      this.cleanupFile(filePath, reportId);
    } catch (error) {
      this.logger.error(`Failed to process coverage report ${reportId}:`, error);

      // Update report with error
      await this.coverageService.updateReport(reportId, {
        status: CoverageStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      // Retain file on failure for debugging purposes
      this.logger.debug(`Retaining coverage file for debugging: ${filePath}`);

      throw error;
    }
  }

  /**
   * Clean up uploaded file
   */
  private cleanupFile(filePath: string, reportId?: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        const logMessage = reportId
          ? `Cleaned up coverage file for report ${reportId}: ${filePath}`
          : `Cleaned up coverage file: ${filePath}`;
        this.logger.log(logMessage);
      }
    } catch (error) {
      // Log error but don't fail the operation
      const errorMessage = reportId
        ? `Failed to clean up coverage file for report ${reportId} at ${filePath}`
        : `Failed to clean up coverage file at ${filePath}`;
      this.logger.warn(errorMessage, error);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<CoverageJobData>): void {
    this.logger.debug(`Coverage job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<CoverageJobData>, error: Error): void {
    this.logger.error(`Coverage job ${job.id} failed:`, error.message);
  }
}
