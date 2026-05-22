import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { COMMIT_QUEUE } from '../../../config';
import { CommitJobData, ProcessedCommitResult } from '../types';
import { CommitsService } from '../commits.service';
import { BullMQMetricsService } from '../../metrics';

/**
 * BullMQ Worker for processing commit jobs
 */
@Processor(COMMIT_QUEUE)
export class CommitProcessor extends WorkerHost {
  private readonly logger = new Logger(CommitProcessor.name);

  constructor(
    private readonly commitsService: CommitsService,
    @Optional() @Inject(BullMQMetricsService) private readonly bullmqMetrics?: BullMQMetricsService,
  ) {
    super();
  }

  /**
   * Process a commit job from the queue
   */
  async process(job: Job<CommitJobData>): Promise<ProcessedCommitResult> {
    const startTime = Date.now();
    this.bullmqMetrics?.recordJobStart(COMMIT_QUEUE);

    this.logger.log(`Processing commit job ${job.id}: ${job.data.commit.sha}`);

    try {
      const { commit, repositoryId, organizationId } = job.data;

      // Process the commit using the commits service
      const result = await this.commitsService.processCommit(commit, repositoryId, organizationId);

      this.logger.log(
        `Successfully processed commit ${commit.sha}: ${result.filesChanged} files, ${result.linesAdded}+ ${result.linesDeleted}-`,
      );

      this.bullmqMetrics?.recordJobComplete(COMMIT_QUEUE, 'commit', startTime);
      return result;
    } catch (error) {
      this.logger.error(`Failed to process commit ${job.data.commit.sha}: ${error}`);
      this.bullmqMetrics?.recordJobFailed(COMMIT_QUEUE, 'commit', startTime);
      throw error;
    }
  }
}
