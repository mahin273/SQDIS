from pydantic import BaseModel, Field
from typing import Literal


class AnomalyDetectRequest(BaseModel):
    """
    Request schema for anomaly detection.
    Defines the data needed to detect if a commit is anomalous.
    """
    commit_id: str = Field(
        ...,
        description="Unique commit identifier (SHA)",
        min_length=1,
        max_length=100
    )
    features: dict = Field(
        ...,
        description="Commit features for anomaly detection"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "commit_id": "abc123def456",
                "features": {
                    "lines_changed": 1500,
                    "files_changed": 45,
                    "time_of_day": 14,
                    "churn_ratio": 0.65
                }
            }
        }


class AnomalyDetectionResult(BaseModel):
    """
    Response schema for anomaly detection.
    Defines what the API returns after analyzing a commit.
    """
    is_anomaly: bool = Field(
        ...,
        description="Whether commit is classified as anomalous"
    )
    anomaly_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Anomaly score (0=normal, 1=anomalous)"
    )
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(
        ...,
        description="Severity level of the anomaly"
    )
    model_version: str = Field(
        default="1.0.0",
        description="Model version used for detection"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "is_anomaly": True,
                "anomaly_score": 0.85,
                "severity": "HIGH",
                "model_version": "1.0.0"
            }
        }