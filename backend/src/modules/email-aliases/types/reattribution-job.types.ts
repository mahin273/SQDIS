/**
 * Types for commit re-attribution job processing
 */

/**
 * Job data for commit re-attribution
 */
export interface ReattributionJobData {
  /** The email alias that was verified or removed */
  email: string;
  /** The user ID to attribute commits to (null for unattribution) */
  userId: string | null;
  /** The organization ID for scoping the re-attribution */
  organizationId?: string;
  /** Type of re-attribution operation */
  operation: 'attribute' | 'unattribute';
}

/**
 * Result of a re-attribution job
 */
export interface ReattributionResult {
  /** Total commits processed */
  totalProcessed: number;
  /** Number of commits updated */
  commitsUpdated: number;
  /** Number of batches processed */
  batchesProcessed: number;
  /** Time taken in milliseconds */
  durationMs: number;
}

/**
 * Batch processing options
 */
export const REATTRIBUTION_BATCH_SIZE = 1000;
