from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class SentimentAnalyzeRequest(BaseModel):
    """
    Request model for sentiment analysis.
    Defines what data the client must send for analysis.
    """
    commit_message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The commit message to analyze for sentiment"
    )
    commit_id: Optional[str] = Field(
        None,
        description="Optional commit ID for tracking"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "commit_message": "fix: resolved the annoying bug that was driving me crazy",
                "commit_id": "abc123"
            }
        }


class SentimentScore(BaseModel):
    """
    Detailed sentiment scores from VADER.
    VADER provides multiple dimensions, not just positive/negative.
    """
    positive: float = Field(..., ge=0.0, le=1.0, description="Positive sentiment score (0-1)")
    negative: float = Field(..., ge=0.0, le=1.0, description="Negative sentiment score (0-1)")
    neutral: float = Field(..., ge=0.0, le=1.0, description="Neutral sentiment score (0-1)")
    compound: float = Field(..., ge=-1.0, le=1.0, description="Compound sentiment score (-1 to 1)")


class SentimentAnalysisResult(BaseModel):
    """
    Complete sentiment analysis result.
    Combines VADER scores with human-readable categories.
    """
    commit_id: Optional[str] = Field(None, description="The commit ID that was analyzed")
    sentiment: str = Field(..., description="Overall sentiment category")
    scores: SentimentScore = Field(..., description="Detailed sentiment scores")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence in the classification")
    indicators: List[str] = Field(default_factory=list, description="Words that influenced the sentiment")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When the analysis was performed")

    class Config:
        json_schema_extra = {
            "example": {
                "commit_id": "abc123",
                "sentiment": "NEGATIVE",
                "scores": {
                    "positive": 0.1,
                    "negative": 0.6,
                    "neutral": 0.3,
                    "compound": -0.5
                },
                "confidence": 0.75,
                "indicators": ["annoying", "crazy", "bug"],
                "timestamp": "2024-01-15T10:30:00Z"
            }
        }


class BatchSentimentRequest(BaseModel):
    """
    Request model for batch sentiment analysis.
    Analyzing multiple commits at once is more efficient.
    """
    messages: List[str] = Field(
        ...,
        min_length=1,
        max_length=100,
        description="List of commit messages to analyze"
    )
    commit_ids: Optional[List[str]] = Field(
        None,
        description="Optional list of commit IDs (must match messages length)"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "messages": [
                    "fix: resolved critical bug",
                    "feat: added amazing new feature",
                    "chore: updated dependencies"
                ],
                "commit_ids": ["abc123", "def456", "ghi789"]
            }
        }


class BatchSentimentResponse(BaseModel):
    """
    Response model for batch sentiment analysis.
    Returns individual results plus aggregate statistics.
    """
    results: List[SentimentAnalysisResult] = Field(..., description="Individual sentiment results")
    summary: dict = Field(..., description="Summary statistics for the batch")
    processed_count: int = Field(..., description="Number of messages successfully processed")