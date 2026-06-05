from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class RiskLevel(str, Enum):
    """Risk level categories for project modules."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SQSFeatures(BaseModel):
    """
    Project-level aggregated metrics for calculating Software Quality Score (SQS).
    """
    avg_dqs: float = Field(..., ge=0.0, le=100.0, description="Average Developer Quality Score of the team")
    coverage: float = Field(..., ge=0.0, le=100.0, description="Overall test coverage percentage (0-100)")
    churn_rate: float = Field(..., ge=0.0, le=1.0, description="Project code churn rate (0-1)")
    debt_count: int = Field(..., ge=0, description="Total number of technical debt items found")
    bug_density: float = Field(..., ge=0.0, description="Number of bug fixes per 1000 lines of code")


class ModuleMetrics(BaseModel):
    """Metrics for an individual file/folder module inside the project."""
    path: str = Field(..., description="Relative file path of the module")
    churn_rate: float = Field(..., ge=0.0, le=1.0, description="Code churn rate of the module (0-1)")
    coverage: float = Field(..., ge=0.0, le=100.0, description="Test coverage percentage of the module (0-100)")
    bug_count: int = Field(..., ge=0, description="Number of bug fixes inside the module")
    debt_count: int = Field(..., ge=0, description="Number of tech debt items in the module")
    lines_of_code: int = Field(..., ge=0, description="Total lines of code in the module")


class SQSPredictRequest(BaseModel):
    """Request payload for SQS prediction."""
    project_id: str = Field(..., description="Project unique identifier (UUID)")
    features: SQSFeatures = Field(..., description="Project metrics features")
    modules: Optional[List[ModuleMetrics]] = Field(default=None, description="Metrics per module for risk detection")


class RiskyModule(BaseModel):
    """Represents a risky module detected by the SQS model."""
    path: str = Field(..., description="Relative file path of the module")
    risk_level: RiskLevel = Field(..., description="Risk level (LOW, MEDIUM, HIGH, CRITICAL)")
    reason: str = Field(..., description="Reason for the risk level classification")
    churn_rate: float = Field(..., ge=0.0, le=1.0, description="Module code churn rate")
    coverage: float = Field(..., ge=0.0, le=100.0, description="Module test coverage percentage")
    bug_count: int = Field(..., ge=0, description="Module bug count")


class SQSPredictionResult(BaseModel):
    """Response returned for SQS prediction."""
    score: float = Field(..., ge=0.0, le=100.0, description="Overall Software Quality Score (0-100)")
    model_version: str = Field(..., description="Version of the model used")
    risky_modules: List[RiskyModule] = Field(default_factory=list, description="List of risky modules identified")
    recommendations: List[str] = Field(default_factory=list, description="Actionable recommendations")


class SQSModelInfoResponse(BaseModel):
    """Response returned for SQS model info check."""
    model_type: str = Field(..., description="Type of model (e.g. Random Forest)")
    model_version: str = Field(..., description="Model version string")
    feature_count: int = Field(..., description="Number of features used in SQS model")
    feature_names: List[str] = Field(..., description="Names of the features in training order")