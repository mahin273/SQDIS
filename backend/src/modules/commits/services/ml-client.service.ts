import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Classification result from ML service
 */
export interface ClassificationResult {
  classification: 'BUGFIX' | 'FEATURE' | 'REFACTOR' | 'TEST' | 'DOCS';
  confidence: number;
  method: string;
}

/**
 * Anomaly detection result from ML service
 * Validates: Requirements 1.10.1, 1.10.2, 8.2
 */
export interface AnomalyDetectionResult {
  is_anomaly: boolean;
  anomaly_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  model_version?: string;
}

/**
 * Request payload for anomaly detection
 */
export interface AnomalyDetectRequest {
  commit_id: string;
  features: {
    lines_changed: number;
    files_changed: number;
    time_of_day: number;
    churn_ratio: number;
  };
}

/**
 * Request payload for classification
 */
export interface ClassifyRequest {
  commit_message: string;
  files_changed?: string[];
  diff_stats?: {
    additions: number;
    deletions: number;
  };
}

/**
 * ML Service client for commit classification
 * Validates: Requirements 1.7.1, 1.7.2
 */
@Injectable()
export class MlClientService {
  private readonly logger = new Logger(MlClientService.name);
  private readonly mlServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.mlServiceUrl = this.configService.get<string>('ML_SERVICE_URL', 'http://localhost:8000');
  }

  /**
   * Classify a commit using the ML service
   * Validates: Requirements 1.7.1, 1.7.2
   *
   * @param commitMessage - The commit message
   * @param filesChanged - List of file paths changed
   * @param additions - Number of lines added
   * @param deletions - Number of lines deleted
   * @returns Classification result or null if service unavailable
   */
  async classifyCommit(
    commitMessage: string,
    filesChanged?: string[],
    additions?: number,
    deletions?: number,
  ): Promise<ClassificationResult | null> {
    try {
      const payload: ClassifyRequest = {
        commit_message: commitMessage,
      };

      if (filesChanged && filesChanged.length > 0) {
        payload.files_changed = filesChanged;
      }

      if (additions !== undefined && deletions !== undefined) {
        payload.diff_stats = { additions, deletions };
      }

      const response = await fetch(`${this.mlServiceUrl}/api/ml/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service classification failed with status ${response.status}`);
        return null;
      }

      const result = await response.json();
      return result as ClassificationResult;
    } catch (error) {
      this.logger.warn(`Failed to classify commit: ${error}`);
      // Return null to allow commit processing to continue without classification
      return null;
    }
  }

  /**
   * Classify multiple commits in batch
   *
   * @param commits - Array of commit data to classify
   * @returns Array of classification results
   */
  async classifyCommitsBatch(
    commits: Array<{
      commitMessage: string;
      filesChanged?: string[];
      additions?: number;
      deletions?: number;
    }>,
  ): Promise<(ClassificationResult | null)[]> {
    try {
      const payload = commits.map((c) => ({
        commit_message: c.commitMessage,
        files_changed: c.filesChanged,
        diff_stats:
          c.additions !== undefined && c.deletions !== undefined
            ? { additions: c.additions, deletions: c.deletions }
            : undefined,
      }));

      const response = await fetch(`${this.mlServiceUrl}/api/ml/classify/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service batch classification failed with status ${response.status}`);
        return commits.map(() => null);
      }

      const results = await response.json();
      return results as ClassificationResult[];
    } catch (error) {
      this.logger.warn(`Failed to classify commits batch: ${error}`);
      return commits.map(() => null);
    }
  }

  /**
   * Check if ML service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/ml/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Detect anomaly in a commit using the ML service
   * Validates: Requirements 1.10.1, 1.10.2, 1.10.5, 8.2
   *
   * Property 12: Anomaly Severity Mapping
   * For any anomaly score, the severity SHALL be mapped to exactly one of
   * {LOW, MEDIUM, HIGH, CRITICAL} based on defined thresholds.
   *
   * @param commitId - The commit ID
   * @param linesChanged - Total lines added + deleted
   * @param filesChanged - Number of files changed
   * @param timeOfDay - Hour of day (0-23) when commit was made
   * @param churnRatio - Code churn ratio for the commit
   * @returns Anomaly detection result or null if service unavailable
   */
  async detectAnomaly(
    commitId: string,
    linesChanged: number,
    filesChanged: number,
    timeOfDay: number,
    churnRatio: number,
  ): Promise<AnomalyDetectionResult | null> {
    try {
      const payload: AnomalyDetectRequest = {
        commit_id: commitId,
        features: {
          lines_changed: linesChanged,
          files_changed: filesChanged,
          time_of_day: timeOfDay,
          churn_ratio: churnRatio,
        },
      };

      const response = await fetch(`${this.mlServiceUrl}/api/ml/anomaly/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service anomaly detection failed with status ${response.status}`);
        return null;
      }

      const result = await response.json();
      return result as AnomalyDetectionResult;
    } catch (error) {
      this.logger.warn(`Failed to detect anomaly: ${error}`);
      // Return null to allow commit processing to continue without anomaly detection
      return null;
    }
  }
}
