/**
 * Score calculation job types
 */

/**
 * Score type enum for job processing
 */
export enum ScoreJobType {
  DQS = 'dqs',
  SQS = 'sqs',
}

/**
 * Job data for score calculation
 * review metrics change triggers DQS recalculation
 */
export interface ScoreJobData {
  entityId: string;
  type: ScoreJobType | string;
  organizationId: string;
  triggeredBy?: 'commit' | 'manual' | 'scheduled' | 'review';
  commitId?: string;
}

/**
 * Result of score calculation job
 */
export interface ScoreJobResult {
  entityId: string;
  type: ScoreJobType;
  score: number | null;
  modelVersion: string | null;
  calculatedAt: Date;
  success: boolean;
  message?: string;
}
