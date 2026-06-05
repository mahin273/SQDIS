from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class RiskLevel(str, Enum):
    """Risk level categories for project health assessment."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ProjectMetrics(BaseModel):
    """
    Input metrics for calculating Software Quality Score (SQS).
    These are project-level features collected from GitHub data.
    """
    # Commit quality metrics
    bug_fix_ratio: float = Field(
        ..., ge=0.0, le=1.0,
        description="Ratio of bug fix commits to total commits (0-1)"
    )
    feature_commit_ratio: float = Field(
        ..., ge=0.0, le=1.0,
        description="Ratio of feature commits to total commits (0-1)"
    )
    avg_commit_message_quality: float = Field(
        ..., ge=0.0, le=1.0,
        description="Average quality score of commit messages (0-1)"
    )

    # Activity metrics
    commit_frequency: float = Field(
        ..., ge=0.0,
        description="Average commits per day"
    )
    active_contributors: int = Field(
        ..., ge=0,
        description="Number of active contributors in the period"
    )

    # Code quality metrics
    avg_anomaly_score: float = Field(
        ..., ge=0.0, le=1.0,
        description="Average anomaly score across all commits (0-1)"
    )
    code_churn_rate: float = Field(
        ..., ge=0.0, le=1.0,
        description="Rate of code being rewritten (0-1)"
    )

    # Sentiment metrics
    avg_sentiment_score: float = Field(
        ..., ge=-1.0, le=1.0,
        description="Average sentiment compound score (-1 to 1)"
    )
    negative_sentiment_ratio: float = Field(
        ..., ge=0.0, le=1.0,
        description="Ratio of negative sentiment commits (0-1)"
    )

    # Documentation metrics
    doc_commit_ratio: float = Field(
        ..., ge=0.0, le=1.0,
        description="Ratio of documentation commits to total commits (0-1)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "bug_fix_ratio": 0.2,
                "feature_commit_ratio": 0.5,
                "avg_commit_message_quality": 0.75,
                "commit_frequency": 3.5,
                "active_contributors": 5,
                "avg_anomaly_score": 0.15,
                "code_churn_rate": 0.3,
                "avg_sentiment_score": 0.2,
                "negative_sentiment_ratio": 0.1,
                "doc_commit_ratio": 0.1
            }
        }


class RiskyModule(BaseModel):
    """Represents a risky area detected in the project."""
    module: str = Field(..., description="Name of the risky module or area")
    risk_level: RiskLevel = Field(..., description="Risk level of the module")
    reason: str = Field(..., description="Why this module is considered risky")
    score: float = Field(..., ge=0.0, le=1.0, description="Risk score (0-1)")


class Recommendation(BaseModel):
    """A single actionable recommendation for improving project health."""
    priority: str = Field(..., description="Priority level: HIGH, MEDIUM, LOW")
    category: str = Field(..., description="Category of recommendation")
    message: str = Field(..., description="Actionable recommendation message")


class SQSRequest(BaseModel):
    """Request schema for SQS calculation."""
    project_id: str = Field(..., description="Unique project identifier")
    project_name: str = Field(..., description="Human readable project name")
    metrics: ProjectMetrics = Field(..., description="Project metrics for scoring")
    period_days: Optional[int] = Field(
        30, ge=1, le=365,
        description="Analysis period in days"
    )


class SQSResult(BaseModel):
    """
    Complete Software Quality Score result.
    Includes overall score, component scores, risks, and recommendations.
    """
    project_id: str = Field(..., description="Project identifier")
    project_name: str = Field(..., description="Project name")
    sqs_score: float = Field(
        ..., ge=0.0, le=100.0,
        description="Overall Software Quality Score (0-100)"
    )
    grade: str = Field(..., description="Letter grade: A, B, C, D, F")
    risk_level: RiskLevel = Field(..., description="Overall project risk level")

    # Component scores
    commit_quality_score: float = Field(..., ge=0.0, le=100.0)
    activity_score: float = Field(..., ge=0.0, le=100.0)
    code_health_score: float = Field(..., ge=0.0, le=100.0)
    team_sentiment_score: float = Field(..., ge=0.0, le=100.0)
    documentation_score: float = Field(..., ge=0.0, le=100.0)

    # Analysis results
    risky_modules: List[RiskyModule] = Field(
        default_factory=list,
        description="List of risky modules detected"
    )
    recommendations: List[Recommendation] = Field(
        default_factory=list,
        description="Actionable recommendations"
    )
    period_days: int = Field(..., description="Analysis period in days")

    class Config:
        json_schema_extra = {
            "example": {
                "project_id": "proj_123",
                "project_name": "SQDIS Backend",
                "sqs_score": 72.5,
                "grade": "B",
                "risk_level": "MEDIUM",
                "commit_quality_score": 75.0,
                "activity_score": 80.0,
                "code_health_score": 65.0,
                "team_sentiment_score": 70.0,
                "documentation_score": 60.0,
                "risky_modules": [],
                "recommendations": [],
                "period_days": 30
            }
        }