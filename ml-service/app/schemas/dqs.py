from pydantic import BaseModel, Field
from typing import List, Dict


class DQSFeatures(BaseModel):
    """
    Input metrics for calculating Developer Quality Score (DQS).
    These represent developer performance over the last 30 days.
    """
    commit_count_30d: int = Field(..., ge=0, description="Number of commits in the last 30 days")
    bug_fix_ratio: float = Field(..., ge=0.0, le=1.0, description="Ratio of bug-fix commits to total commits (0-1)")
    code_churn: float = Field(..., ge=0.0, le=1.0, description="Code churn rate (0-1)")
    coverage_avg: float = Field(..., ge=0.0, le=100.0, description="Average code coverage of files touched (0-100)")
    review_count: int = Field(..., ge=0, description="Number of PR reviews performed")
    review_turnaround_avg: float = Field(..., ge=0.0, description="Average PR review turnaround time in hours")


class DQSPredictRequest(BaseModel):
    """Request payload for DQS prediction and explanation."""
    developer_id: str = Field(..., description="Developer unique identifier (UUID)")
    features: DQSFeatures = Field(..., description="Developer metrics features")


class SHAPValue(BaseModel):
    """Represents the impact of a specific feature on the computed score."""
    feature: str = Field(..., description="Name of the feature")
    value: float = Field(..., description="Actual feature value")
    impact: float = Field(..., description="SHAP value indicating direction and magnitude of impact")


class DQSPredictionResult(BaseModel):
    """Response returned for DQS prediction."""
    score: float = Field(..., ge=0.0, le=100.0, description="Overall DQS score (0-100)")
    model_version: str = Field(..., description="Version of the model used")
    shap_values: List[SHAPValue] = Field(default_factory=list, description="SHAP feature attribution analysis")


class DQSExplainResult(BaseModel):
    """Response returned for DQS explanation."""
    score: float = Field(..., ge=0.0, le=100.0, description="Overall DQS score (0-100)")
    model_version: str = Field(..., description="Version of the model used")
    shap_values: List[SHAPValue] = Field(default_factory=list, description="SHAP feature attribution analysis")
    feature_descriptions: Dict[str, str] = Field(default_factory=dict, description="Descriptions of the features and their impacts")


class DQSModelInfoResponse(BaseModel):
    """Response returned for DQS model info check."""
    model_type: str = Field(..., description="Type of model (e.g. XGBoost)")
    model_version: str = Field(..., description="Model version string")
    feature_count: int = Field(..., description="Number of features used in the model")
    feature_names: List[str] = Field(..., description="Names of the features in training order")
