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
        this.logger.warn(
          `ML service DQS prediction failed with status ${response.status}. Falling back to local heuristic.`,
        );
        return this.predictDQSHeuristic(features, developerId);
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
    } catch (error: any) {
      this.logger.warn(
        `Failed to predict DQS: ${error?.message || error}. Falling back to local heuristic.`,
      );
      return this.predictDQSHeuristic(features, developerId);
    }
  }

  /**
   * Calculate DQS locally using a rule-based fallback heuristic.
   */
  private predictDQSHeuristic(features: DQSFeatures, developerId: string): DQSPredictionResult {
    // Base score
    let score = 70.0;

    // Positive impacts
    score += Math.min((features.commit_count_30d / 30.0) * 10.0, 10.0);
    score += (features.coverage_avg / 100.0) * 15.0;
    score += Math.min((features.review_count / 10.0) * 10.0, 10.0);

    // Negative impacts
    score -= features.bug_fix_ratio * 20.0;
    score -= features.code_churn * 15.0;
    score -= Math.min((features.review_turnaround_avg / 24.0) * 10.0, 10.0);

    const finalScore = Math.round(Math.max(0.0, Math.min(100.0, score)) * 100) / 100;

    // Simulated SHAP values
    const baselines = {
      commit_count_30d: 15,
      coverage_avg: 50.0,
      review_count: 5,
      bug_fix_ratio: 0.2,
      code_churn: 0.3,
      review_turnaround_avg: 12.0,
    };

    const shap_values = [
      {
        feature: 'commit_count_30d',
        value: features.commit_count_30d,
        impact: Math.round(Math.max(-5.0, Math.min((features.commit_count_30d - baselines.commit_count_30d) * 0.33, 5.0)) * 100) / 100,
      },
      {
        feature: 'coverage_avg',
        value: features.coverage_avg,
        impact: Math.round((features.coverage_avg - baselines.coverage_avg) * 0.15 * 100) / 100,
      },
      {
        feature: 'review_count',
        value: features.review_count,
        impact: Math.round(Math.max(-5.0, Math.min((features.review_count - baselines.review_count) * 1.0, 5.0)) * 100) / 100,
      },
      {
        feature: 'bug_fix_ratio',
        value: features.bug_fix_ratio,
        impact: Math.round(-(features.bug_fix_ratio - baselines.bug_fix_ratio) * 20.0 * 100) / 100,
      },
      {
        feature: 'code_churn',
        value: features.code_churn,
        impact: Math.round(-(features.code_churn - baselines.code_churn) * 15.0 * 100) / 100,
      },
      {
        feature: 'review_turnaround_avg',
        value: features.review_turnaround_avg,
        impact: Math.round(Math.max(-10.0, Math.min(-(features.review_turnaround_avg - baselines.review_turnaround_avg) * 0.42, 5.0)) * 100) / 100,
      },
    ];

    return {
      score: finalScore,
      model_version: '1.0.0-client-heuristic-fallback',
      shap_values,
    };
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
        this.logger.warn(
          `ML service SQS prediction failed with status ${response.status}. Falling back to local heuristic.`,
        );
        return this.predictSQSHeuristic(features, projectId, modules);
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
    } catch (error: any) {
      this.logger.warn(
        `Failed to predict SQS: ${error?.message || error}. Falling back to local heuristic.`,
      );
      return this.predictSQSHeuristic(features, projectId, modules);
    }
  }

  /**
   * Calculate SQS locally using a rule-based fallback heuristic.
   */
  private predictSQSHeuristic(
    features: SQSFeatures,
    projectId: string,
    modules?: ModuleMetrics[],
  ): SQSPredictionResult {
    let score = 50.0;

    // Positive impacts
    score += (features.avg_dqs / 100.0) * 30.0;
    score += (features.coverage / 100.0) * 25.0;

    // Negative impacts
    score -= features.churn_rate * 15.0;
    score -= Math.min((features.debt_count / 10.0) * 10.0, 10.0);
    score -= Math.min(features.bug_density * 20.0, 20.0);

    const finalScore = Math.round(Math.max(0.0, Math.min(100.0, score)) * 100) / 100;

    // Detect risky modules
    const risky_modules: RiskyModule[] = [];
    if (modules) {
      for (const m of modules) {
        let risk_score = 0.0;
        const reasons: string[] = [];

        if (m.churn_rate > 0.4) {
          risk_score += 0.3;
          reasons.push(`High code churn rate (${(m.churn_rate * 100).toFixed(0)}%) indicates unstable logic`);
        }
        if (m.coverage < 50.0) {
          risk_score += 0.3;
          reasons.push(`Low test coverage (${m.coverage.toFixed(1)}%) lacks regression protection`);
        }
        if (m.bug_count > 5) {
          risk_score += 0.2;
          reasons.push(`High bug fix activity (${m.bug_count} fixes) indicates post-release instability`);
        }
        if (m.debt_count > 5) {
          risk_score += 0.2;
          reasons.push(`High debt markers count (${m.debt_count} TODOs/FIXMEs)`);
        }

        risk_score = Math.min(risk_score, 1.0);
        let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (risk_score >= 0.7) level = 'CRITICAL';
        else if (risk_score >= 0.5) level = 'HIGH';
        else if (risk_score >= 0.3) level = 'MEDIUM';

        if (risk_score > 0.0) {
          risky_modules.push({
            path: m.path,
            risk_level: level,
            reason: reasons.join(' & '),
            churn_rate: m.churn_rate,
            coverage: m.coverage,
            bug_count: m.bug_count,
          });
        }
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (features.coverage < 70.0) {
      recommendations.push(
        'Increase automated test coverage. Focus on writing unit tests for modules with low coverage (<50%).',
      );
    }
    if (features.churn_rate > 0.3) {
      recommendations.push(
        'Implement robust software design reviews. High code churn indicates frequent refactoring and requirement changes.',
      );
    }
    if (features.bug_density > 0.3) {
      recommendations.push(
        'Establish strict pull request guidelines and pre-merge validation tests to reduce bug density.',
      );
    }
    if (features.debt_count > 15) {
      recommendations.push(
        'Schedule a technical debt refactoring sprint. Debt items (TODOs/FIXMEs) are beginning to accumulate.',
      );
    }
    if (features.avg_dqs < 70.0) {
      recommendations.push(
        'Introduce developer mentorship programs. Focus on improving conventional commit quality and testing practices.',
      );
    }
    if (finalScore < 45.0) {
      recommendations.push(
        'CRITICAL: Codebase health is severely degraded. Hold a post-mortem review and prioritize stability over features.',
      );
    }
    if (recommendations.length === 0) {
      recommendations.push(
        'Project health is stable. Continue maintaining current testing practices and code reviews.',
      );
    }

    return {
      score: finalScore,
      model_version: '1.0.0-client-heuristic-fallback',
      risky_modules,
      recommendations,
    };
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

  /**
   * Run deep Code Quality and Security Analysis on files via the AST static analyzer.
   *
   * @param payload - Payload containing files, optional git history and coverage
   * @returns Code quality static analysis results
   */
  async analyzeCodeQuality(
    payload: {
      files: Array<{ path: string; content: string }>;
      git_history?: Array<{
        sha: string;
        author_email: string;
        message?: string;
        files_changed: Array<{ path: string; lines_added: number; lines_removed: number }>;
      }>;
      coverage_metadata?: Record<string, number>;
      repository_id?: string;
    }
  ): Promise<{
    complexity: Array<{
      path: string;
      cyclomatic_complexity: number;
      cognitive_complexity: number;
      maintainability_index: number;
      duplicate_blocks: Array<{
        matching_file: string;
        start_line: number;
        line_count: number;
        snippet: string;
      }>;
    }>;
    security: Array<{
      path: string;
      type: string;
      severity: string;
      message: string;
      line_number?: number;
    }>;
    code_smells: Array<{
      file_path: string;
      smell_type: string;
      location: string;
      description: string;
      severity: string;
    }>;
    dependency_cycles: Array<{
      files: string[];
      description: string;
    }>;
    semantic_clones: Array<{
      file_a: string;
      file_b: string;
      similarity_score: number;
      description: string;
    }>;
    taint_issues: Array<{
      path: string;
      source: string;
      sink: string;
      line_number: number;
      variable_name: string;
      message: string;
      severity: string;
    }>;
  } | null> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/ml/code-quality/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logger.warn(`ML service code quality analysis failed with status ${response.status}`);
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.warn(`Failed to analyze code quality: ${error}`);
      return null;
    }
  }

  /**
   * Clear AST analysis cache for a specific repository.
   */
  async clearCodeQualityCache(repositoryId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.mlServiceUrl}/api/ml/code-quality/cache/${repositoryId}`, {
        method: 'DELETE',
      });
      return response.ok;
    } catch (error) {
      this.logger.warn(`Failed to clear ML service code quality cache: ${error}`);
      return false;
    }
  }
}
