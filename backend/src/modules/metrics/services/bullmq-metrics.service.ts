import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../metrics.service.js';

/**
 * BullMQ Metrics Helper Service
 * Provides helper methods for recording BullMQ job metrics
 */
@Injectable()
export class BullMQMetricsService {
  private readonly logger = new Logger(BullMQMetricsService.name);

  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Record job start
   * @param queue - Queue name
   */
  recordJobStart(queue: string): void {
    this.metricsService.bullmqJobsTotal.inc({ queue, status: 'started' });
    this.metricsService.bullmqJobsActive.inc({ queue });
  }

  /**
   * Record job completion
   * @param queue - Queue name
   * @param jobType - Type of job
   * @param startTime - Job start time in milliseconds
   */
  recordJobComplete(queue: string, jobType: string, startTime: number): void {
    const duration = (Date.now() - startTime) / 1000;

    this.metricsService.bullmqJobsCompleted.inc({ queue });
    this.metricsService.bullmqJobDuration.observe({ queue, job_type: jobType }, duration);
    this.metricsService.bullmqJobsActive.dec({ queue });
  }

  /**
   * Record job failure
   * @param queue - Queue name
   * @param jobType - Type of job
   * @param startTime - Job start time in milliseconds
   */
  recordJobFailed(queue: string, jobType: string, startTime: number): void {
    const duration = (Date.now() - startTime) / 1000;

    this.metricsService.bullmqJobsFailed.inc({ queue });
    this.metricsService.bullmqJobDuration.observe({ queue, job_type: jobType }, duration);
    this.metricsService.bullmqJobsActive.dec({ queue });
  }

  /**
   * Update waiting jobs count
   * @param queue - Queue name
   * @param count - Number of waiting jobs
   */
  updateWaitingJobs(queue: string, count: number): void {
    this.metricsService.bullmqJobsWaiting.set({ queue }, count);
  }

  /**
   * Update active jobs count
   * @param queue - Queue name
   * @param count - Number of active jobs
   */
  updateActiveJobs(queue: string, count: number): void {
    this.metricsService.bullmqJobsActive.set({ queue }, count);
  }
}
