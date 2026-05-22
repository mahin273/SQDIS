import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * DQS features for ML prediction
 */
export interface DQSFeatures {
  commit_count_30d: number;
  bug_fix_ratio: number;
  code_churn: number;
  coverage_avg: number;
  review_count: number;
  review_turnaround_avg: number;
}

/**
 * SHAP value for feature explanation
 */
export interface SHAPValue {
  feature: string;
  value: number;
  impact: number;
}

/**
 * DQS prediction result from ML service
 */
export interface DQSPredictionResult {
  score: number;
  model_version: string;
  shap_values: SHAPValue[];
}

/**
 * SQS features for ML prediction
 */
export interface SQSFeatures {
  avg_dqs: number;
  coverage: number;
  churn_rate: number;
  debt_count: number;
  bug_density: number;
}

/**
 * Module metrics for risk identification
 */
export interface ModuleMetrics {
  path: string;
  churn_rate: number;
  coverage: number;
  bug_count: number;
  debt_count: number;
  lines_of_code: number;
}

/**
 * Risky module identified by ML service
 */
export interface RiskyModule {
  path: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason: string;
  churn_rate: number;
  coverage: number;
  bug_count: number;
}

/**
 * SQS prediction result from ML service
 */
export interface SQSPredictionResult {
  score: number;
  model_version: string;
  risky_modules: RiskyModule[];
  recommendations: string[];
}

/**
 * Request payload for DQS prediction
 */
interface DQSPredictRequest {
  developer_id: string;
  features: DQSFeatures;
}

/**
 * Request payload for SQS prediction
 */
interface SQSPredictRequest {
  project_id: string;
  features: SQSFeatures;
  modules?: ModuleMetrics[];
}

/**
 * ML Service client for DQS and SQS score prediction
 */
@Injectable()
export class ScoresMlClientService {
  private readonly logger = new Logger(ScoresMlClientService.name);
  private readonly mlServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.mlServiceUrl = this.configService.get<string>('ML_SERVICE_URL', 'http://localhost:8000');
  }

  /**
   * Predict DQS score for a developer
   *
   * Property 4: DQS Score Bounds
   * For any valid developer metrics input, the DQS score SHALL be within [0, 100].
   *
   * @param developerId - Developer UUID
   * @param features - Developer metrics features
   * @returns DQS prediction result or null if service unavailable
   */
  async predictDQS(
    developerId: string,
    features: DQSFeatures,
  ): Promise<DQSPredictionResult | null> {
    try {
      const payload: DQSPredictRequest = {
        developer_id: developerId,
        features: {
          commit_count_30d: features.commit_count_30d,
          bug_fix_ratio: Math.min(Math.max(features.bug_fix_ratio, 0), 1),
          code_churn: Math.min(Math.max(features.code_churn, 0), 1),
          coverage_avg: Math.min(Math.max(features.coverage_avg, 0), 100),
          review_count: Math.max(features.review_count, 0),
          review_turnaround_avg: Math.max(features.review_turnaround_avg, 0),
        },
      };

      const response = await fetch(`${this.mlServiceUrl}/api/ml/dqs/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service DQS prediction failed with status ${response.status}`);
        return null;
      }

      const result = await response.json();

      this.logger.debug(
        `DQS prediction for ${developerId}: score=${result.score}, model=${result.model_version}`,
      );

      return {
        score: result.score,
        model_version: result.model_version,
        shap_values: result.shap_values || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to predict DQS: ${error}`);
      return null;
    }
  }

  /**
   * Predict SQS score for a project
   *
   * Property 5: SQS Score Bounds
   * For any valid project metrics input, the SQS score SHALL be within [0, 100].
   *
   * @param projectId - Project UUID
   * @param features - Project metrics features
   * @param modules - Optional module metrics for risk identification
   * @returns SQS prediction result or null if service unavailable
   */
  async predictSQS(
    projectId: string,
    features: SQSFeatures,
    modules?: ModuleMetrics[],
  ): Promise<SQSPredictionResult | null> {
    try {
      const payload: SQSPredictRequest = {
        project_id: projectId,
        features: {
          avg_dqs: Math.min(Math.max(features.avg_dqs, 0), 100),
          coverage: Math.min(Math.max(features.coverage, 0), 100),
          churn_rate: Math.min(Math.max(features.churn_rate, 0), 1),
          debt_count: Math.max(features.debt_count, 0),
          bug_density: Math.max(features.bug_density, 0),
        },
      };

      if (modules && modules.length > 0) {
        payload.modules = modules.map((m) => ({
          path: m.path,
          churn_rate: Math.min(Math.max(m.churn_rate, 0), 1),
          coverage: Math.min(Math.max(m.coverage, 0), 100),
          bug_count: Math.max(m.bug_count, 0),
          debt_count: Math.max(m.debt_count, 0),
          lines_of_code: Math.max(m.lines_of_code, 0),
        }));
      }

      const response = await fetch(`${this.mlServiceUrl}/api/ml/sqs/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service SQS prediction failed with status ${response.status}`);
        return null;
      }

      const result = await response.json();

      this.logger.debug(
        `SQS prediction for ${projectId}: score=${result.score}, model=${result.model_version}`,
      );

      return {
        score: result.score,
        model_version: result.model_version,
        risky_modules: result.risky_modules || [],
        recommendations: result.recommendations || [],
      };
    } catch (error) {
      this.logger.warn(`Failed to predict SQS: ${error}`);
      return null;
    }
  }

  /**
   * Get DQS explanation for a developer
   *
   * @param developerId - Developer UUID
   * @param features - Developer metrics features
   * @returns DQS explanation with SHAP values or null if service unavailable
   */
  async explainDQS(
    developerId: string,
    features: DQSFeatures,
  ): Promise<{
    score: number;
    model_version: string;
    shap_values: SHAPValue[];
    feature_descriptions: Record<string, string>;
  } | null> {
    try {
      const payload: DQSPredictRequest = {
        developer_id: developerId,
        features: {
          commit_count_30d: features.commit_count_30d,
          bug_fix_ratio: Math.min(Math.max(features.bug_fix_ratio, 0), 1),
          code_churn: Math.min(Math.max(features.code_churn, 0), 1),
          coverage_avg: Math.min(Math.max(features.coverage_avg, 0), 100),
          review_count: Math.max(features.review_count, 0),
          review_turnaround_avg: Math.max(features.review_turnaround_avg, 0),
        },
      };

      const response = await fetch(`${this.mlServiceUrl}/api/ml/dqs/explain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service DQS explanation failed with status ${response.status}`);
        return null;
      }

      const result = await response.json();

      return {
        score: result.score,
        model_version: result.model_version,
        shap_values: result.shap_values || [],
        feature_descriptions: result.feature_descriptions || {},
      };
    } catch (error) {
      this.logger.warn(`Failed to get DQS explanation: ${error}`);
      return null;
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
   * Get DQS model information
   */
  async getDQSModelInfo(): Promise<{
    model_type: string;
    model_version: string;
    feature_count: number;
    feature_names: string[];
  } | null> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/ml/dqs/model-info`, {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get SQS model information
   */
  async getSQSModelInfo(): Promise<{
    model_type: string;
    model_version: string;
    feature_count: number;
    feature_names: string[];
  } | null> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/ml/sqs/model-info`, {
        method: 'GET',
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }
}
