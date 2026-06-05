import os
import pickle
import numpy as np
import logging
from typing import List, Optional
from app.schemas.sqs import SQSFeatures, ModuleMetrics, RiskyModule, SQSPredictionResult, RiskLevel
from app.config import get_settings

logger = logging.getLogger(__name__)


class SQSModel:
    """
    Software Quality Score (SQS) Calculator.

    Predicts overall project-level code health using a Random Forest model
    trained on metrics: avg_dqs, coverage, churn_rate, debt_count, and bug_density.
    Detects risky modules and generates actionable recommendations.
    Provides a heuristic fallback if the model is not trained.
    """

    FEATURE_NAMES = [
        "avg_dqs",
        "coverage",
        "churn_rate",
        "debt_count",
        "bug_density"
    ]

    def __init__(self):
        self.model = None
        self.version = get_settings().sqs_model_version
        self.model_path = get_settings().sqs_model_path
        self.load_model()

    def load_model(self) -> bool:
        """Attempt to load the pre-trained SQS model from disk."""
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, "rb") as f:
                    data = pickle.load(f)
                    self.model = data.get("model")
                    self.version = data.get("version", self.version)
                logger.info(f"Successfully loaded SQS model from {self.model_path}")
                return True
            except Exception as e:
                logger.error(f"Failed to load SQS model from {self.model_path}: {e}")
        else:
            logger.warning(f"SQS model path {self.model_path} not found. Operating in fallback mode.")
        return False

    def _predict_heuristic(self, features: SQSFeatures) -> float:
        """Calculate SQS using a rule-based heuristic fallback."""
        # Start at a baseline of 50.0
        score = 50.0

        # Positive impacts
        score += (features.avg_dqs / 100.0) * 30.0
        score += (features.coverage / 100.0) * 25.0

        # Negative impacts
        score -= features.churn_rate * 15.0
        score -= min((features.debt_count / 10.0) * 10.0, 10.0)
        score -= min(features.bug_density * 2.0, 20.0)

        return round(max(0.0, min(100.0, score)), 2)

    def _detect_risky_modules(self, modules: Optional[List[ModuleMetrics]]) -> List[RiskyModule]:
        """Analyze individual modules to detect code quality or stability risks."""
        risky_list = []
        if not modules:
            return risky_list

        for m in modules:
            risk_score = 0.0
            reasons = []

            # 1. High Churn Risk (maximum 0.4 impact)
            if m.churn_rate > 0.4:
                risk_score += 0.3
                reasons.append(f"High code churn rate ({m.churn_rate:.0%}) indicates unstable logic")

            # 2. Low Coverage Risk (maximum 0.3 impact)
            if m.coverage < 50.0:
                risk_score += 0.3
                reasons.append(f"Low test coverage ({m.coverage:.1f}%) lacks regression protection")

            # 3. High Bug Count Risk (maximum 0.3 impact)
            if m.bug_count > 5:
                risk_score += 0.2
                reasons.append(f"High bug fix activity ({m.bug_count} fixes) indicates post-release instability")

            # 4. Technical Debt Risk
            if m.debt_count > 5:
                risk_score += 0.2
                reasons.append(f"High debt markers count ({m.debt_count} TODOs/FIXMEs)")

            # Normalize final risk score
            risk_score = min(risk_score, 1.0)

            # Determine risk level category
            if risk_score >= 0.7:
                level = RiskLevel.CRITICAL
            elif risk_score >= 0.5:
                level = RiskLevel.HIGH
            elif risk_score >= 0.3:
                level = RiskLevel.MEDIUM
            elif risk_score > 0.0:
                level = RiskLevel.LOW
            else:
                continue

            risky_list.append(RiskyModule(
                path=m.path,
                risk_level=level,
                reason=" & ".join(reasons),
                churn_rate=m.churn_rate,
                coverage=m.coverage,
                bug_count=m.bug_count
            ))

        # Sort risky modules by risk score descending
        return risky_list

    def _generate_recommendations(self, features: SQSFeatures, score: float) -> List[str]:
        """Generate actionable recommendations based on features and overall score."""
        recs = []

        if features.coverage < 70.0:
            recs.append("Increase automated test coverage. Focus on writing unit tests for modules with low coverage (<50%).")

        if features.churn_rate > 0.3:
            recs.append("Implement robust software design reviews. High code churn indicates frequent refactoring and requirement changes.")

        if features.bug_density > 3.0:
            recs.append("Establish strict pull request guidelines and pre-merge validation tests to reduce bug density.")

        if features.debt_count > 15:
            recs.append("Schedule a technical debt refactoring sprint. Debt items (TODOs/FIXMEs) are beginning to accumulate.")

        if features.avg_dqs < 70.0:
            recs.append("Introduce developer mentorship programs. Focus on improving conventional commit quality and testing practices.")

        if score < 45.0:
            recs.append("CRITICAL: Codebase health is severely degraded. Hold a post-mortem review and prioritize stability over features.")

        if not recs:
            recs.append("Project health is stable. Continue maintaining current testing practices and code reviews.")

        return recs

    def predict(
        self,
        project_id: str,
        features: SQSFeatures,
        modules: Optional[List[ModuleMetrics]] = None
    ) -> SQSPredictionResult:
        """
        Calculate overall SQS, detect risky modules, and yield recommendations.
        """
        if self.model is None:
            # Fallback heuristic calculation
            score = self._predict_heuristic(features)
            method = "heuristic-fallback"
        else:
            try:
                X = np.array([[
                    features.avg_dqs,
                    features.coverage,
                    features.churn_rate,
                    features.debt_count,
                    features.bug_density
                ]])
                score = float(self.model.predict(X)[0])
                score = round(max(0.0, min(100.0, score)), 2)
                method = "random-forest"
            except Exception as e:
                logger.error(f"Error predicting with Random Forest model: {e}. Falling back to heuristic.")
                score = self._predict_heuristic(features)
                method = "heuristic-recovery"

        # Detect risky modules and recommendations
        risky_modules = self._detect_risky_modules(modules)
        recommendations = self._generate_recommendations(features, score)

        return SQSPredictionResult(
            score=score,
            model_version=f"{self.version}-{method}",
            risky_modules=risky_modules,
            recommendations=recommendations
        )


# Shared instance of the model
sqs_model = SQSModel()