import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional, Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { SCORE_QUEUE } from '../../../config';
import { ScoreJobData, ScoreJobResult, ScoreJobType } from '../types';
import { ScoresService } from '../scores.service';
import { BullMQMetricsService } from '../../metrics';

/**
 * BullMQ Worker for processing score calculation jobs
 */
@Processor(SCORE_QUEUE)
export class ScoreProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoreProcessor.name);

  constructor(
    private readonly scoresService: ScoresService,
    @Optional() @Inject(BullMQMetricsService) private readonly bullmqMetrics?: BullMQMetricsService,
  ) {
    super();
  }

  /**
   * Process a score calculation job from the queue
   */
  async process(job: Job<ScoreJobData>): Promise<ScoreJobResult> {
    const startTime = Date.now();
    const { entityId, type, organizationId, triggeredBy, commitId } = job.data;

    this.bullmqMetrics?.recordJobStart(SCORE_QUEUE);

    this.logger.log(
      `Processing ${type.toUpperCase()} score job ${job.id} for entity ${entityId} ` +
        `(triggered by: ${triggeredBy || 'unknown'}${commitId ? `, commit: ${commitId}` : ''})`,
    );

    try {
      let result;

      if (type === ScoreJobType.DQS) {
        result = await this.scoresService.calculateDQS(entityId, organizationId);
      } else {
        result = await this.scoresService.calculateSQS(entityId, organizationId);
      }

      const jobResult: ScoreJobResult = {
        entityId,
        type: type as ScoreJobType,
        score: result.score,
        modelVersion: result.modelVersion || null,
        calculatedAt: result.calculatedAt || new Date(),
        success: result.score !== null,
        message: result.message,
      };

      this.logger.log(
        `Successfully calculated ${type.toUpperCase()} score for ${entityId}: ${result.score ?? 'N/A'}`,
      );

      this.bullmqMetrics?.recordJobComplete(SCORE_QUEUE, type, startTime);
      return jobResult;
    } catch (error) {
      this.logger.error(
        `Failed to calculate ${type.toUpperCase()} score for ${entityId}: ${error}`,
      );

      this.bullmqMetrics?.recordJobFailed(SCORE_QUEUE, type, startTime);
      return {
        entityId,
        type: type as ScoreJobType,
        score: null,
        modelVersion: null,
        calculatedAt: new Date(),
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
