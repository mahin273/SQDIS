import os
import pickle
import numpy as np
import logging
from typing import List, Dict, Tuple, Optional
from app.schemas.dqs import DQSFeatures, SHAPValue, DQSPredictionResult, DQSExplainResult
from app.config import get_settings

logger = logging.getLogger(__name__)


class DQSModel:
    """
    Developer Quality Score (DQS) Model.

    Uses an XGBoost model to calculate a score (0-100) representing a developer's
    code quality, test practices, and review collaboration.
    Uses SHAP to explain the feature contributions to the final score.
    Provides a high-quality heuristic fallback if the model file is not found.
    """

    FEATURE_NAMES = [
        "commit_count_30d",
        "bug_fix_ratio",
        "code_churn",
        "coverage_avg",
        "review_count",
        "review_turnaround_avg"
    ]

    FEATURE_DESCRIPTIONS = {
        "commit_count_30d": "Commit volume over the last 30 days. Higher activity demonstrates productive consistency.",
        "bug_fix_ratio": "Percentage of bug fix commits. A lower ratio suggests higher initial code stability and thorough design.",
        "code_churn": "Code churn rate (deleted/modified lines vs added lines). Stable development has moderate churn.",
        "coverage_avg": "Average test coverage of files touched. High coverage indicates robust automated testing.",
        "review_count": "Pull requests reviewed. Active review contribution shows strong teamwork and mentorship.",
        "review_turnaround_avg": "Average PR review completion time in hours. Faster turnaround avoids review debt."
    }

    def __init__(self):
        self.model = None
        self.explainer = None
        self.version = get_settings().dqs_model_version
        self.model_path = get_settings().dqs_model_path
        self.load_model()

    def load_model(self) -> bool:
        """Attempt to load the pre-trained model and explainer from disk."""
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, "rb") as f:
                    data = pickle.load(f)
                    self.model = data.get("model")
                    self.explainer = data.get("explainer")
                    self.version = data.get("version", self.version)
                logger.info(f"Successfully loaded DQS model from {self.model_path}")
                return True
            except Exception as e:
                logger.error(f"Failed to load DQS model from {self.model_path}: {e}")
        else:
            logger.warning(f"DQS model path {self.model_path} not found. Operating in fallback mode.")
        return False

    def _predict_heuristic(self, features: DQSFeatures) -> float:
        """
        Calculate DQS using a rule-based heuristic fallback.
        """
        # Base score
        score = 70.0

        # Positive impacts
        score += min((features.commit_count_30d / 30.0) * 10.0, 10.0)
        score += (features.coverage_avg / 100.0) * 15.0
        score += min((features.review_count / 10.0) * 10.0, 10.0)

        # Negative impacts
        score -= features.bug_fix_ratio * 20.0
        score -= features.code_churn * 15.0
        score -= min((features.review_turnaround_avg / 24.0) * 10.0, 10.0)

        return round(max(0.0, min(100.0, score)), 2)

    def _explain_heuristic(self, features: DQSFeatures) -> List[SHAPValue]:
        """
        Compute simulated linear SHAP values for the fallback heuristic.
        Calculates each feature's impact relative to a standard baseline value.
        """
        baselines = {
            "commit_count_30d": 15,
            "coverage_avg": 50.0,
            "review_count": 5,
            "bug_fix_ratio": 0.2,
            "code_churn": 0.3,
            "review_turnaround_avg": 12.0
        }

        shap_values = []

        # 1. Commit count impact (1 commit = +0.33 points, max 10 points total)
        commit_val = features.commit_count_30d
        commit_impact = (commit_val - baselines["commit_count_30d"]) * 0.33
        commit_impact = max(-5.0, min(commit_impact, 5.0)) # Clamp impact
        shap_values.append(SHAPValue(feature="commit_count_30d", value=float(commit_val), impact=round(commit_impact, 2)))

        # 2. Coverage impact (1% = +0.15 points)
        cov_val = features.coverage_avg
        cov_impact = (cov_val - baselines["coverage_avg"]) * 0.15
        shap_values.append(SHAPValue(feature="coverage_avg", value=float(cov_val), impact=round(cov_impact, 2)))

        # 3. Review count impact (1 review = +1.0 points, max 10 points total)
        rev_val = features.review_count
        rev_impact = (rev_val - baselines["review_count"]) * 1.0
        rev_impact = max(-5.0, min(rev_impact, 5.0))
        shap_values.append(SHAPValue(feature="review_count", value=float(rev_val), impact=round(rev_impact, 2)))

        # 4. Bug fix ratio impact (penalty multiplier of 20)
        bug_val = features.bug_fix_ratio
        bug_impact = -(bug_val - baselines["bug_fix_ratio"]) * 20.0
        shap_values.append(SHAPValue(feature="bug_fix_ratio", value=float(bug_val), impact=round(bug_impact, 2)))

        # 5. Code churn impact (penalty multiplier of 15)
        churn_val = features.code_churn
        churn_impact = -(churn_val - baselines["code_churn"]) * 15.0
        shap_values.append(SHAPValue(feature="code_churn", value=float(churn_val), impact=round(churn_impact, 2)))

        # 6. Turnaround time impact (penalty of -0.42 points per hour, baseline 12h)
        turn_val = features.review_turnaround_avg
        turn_impact = -(turn_val - baselines["review_turnaround_avg"]) * 0.42
        turn_impact = max(-10.0, min(turn_impact, 5.0))
        shap_values.append(SHAPValue(feature="review_turnaround_avg", value=float(turn_val), impact=round(turn_impact, 2)))

        return shap_values

    def predict(self, developer_id: str, features: DQSFeatures) -> DQSPredictionResult:
        """
        Calculate DQS and explain the scores.
        """
        if self.model is None:
            # Fallback mode
            score = self._predict_heuristic(features)
            shap_values = self._explain_heuristic(features)
            method = "heuristic-fallback"
        else:
            # Machine Learning mode
            try:
                X = np.array([[
                    features.commit_count_30d,
                    features.bug_fix_ratio,
                    features.code_churn,
                    features.coverage_avg,
                    features.review_count,
                    features.review_turnaround_avg
                ]])
                # Predict
                score = float(self.model.predict(X)[0])
                score = round(max(0.0, min(100.0, score)), 2)

                # Compute SHAP values
                shap_values = []
                if self.explainer is not None:
                    shap_outs = self.explainer(X)
                    for i, name in enumerate(self.FEATURE_NAMES):
                        val = X[0][i]
                        impact = float(shap_outs.values[0][i])
                        shap_values.append(SHAPValue(feature=name, value=float(val), impact=round(impact, 2)))
                else:
                    # Fallback to simulated SHAP if explainer failed
                    shap_values = self._explain_heuristic(features)
                method = "xgboost"
            except Exception as e:
                logger.error(f"Error executing ML model prediction: {e}. Falling back to heuristic.")
                score = self._predict_heuristic(features)
                shap_values = self._explain_heuristic(features)
                method = "heuristic-recovery"

        return DQSPredictionResult(
            score=score,
            model_version=f"{self.version}-{method}",
            shap_values=shap_values
        )

    def explain(self, developer_id: str, features: DQSFeatures) -> DQSExplainResult:
        """
        Calculate DQS and return detailed explanations and text descriptions.
        """
        pred_result = self.predict(developer_id, features)
        return DQSExplainResult(
            score=pred_result.score,
            model_version=pred_result.model_version,
            shap_values=pred_result.shap_values,
            feature_descriptions=self.FEATURE_DESCRIPTIONS
        )


# Shared instance of the model
dqs_model = DQSModel()
