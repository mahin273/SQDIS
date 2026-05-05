from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class CommitType(str, Enum):
    """
    Enumeration of commit classification types.
    Using str inheritance allows these to be serialized as strings in JSON.
    """
    BUGFIX = "BUGFIX"
    FEATURE = "FEATURE"
    REFACTOR = "REFACTOR"
    TEST = "TEST"
    DOCS = "DOCS"


class ClassifyRequest(BaseModel):
    """
    Request schema for commit classification.
    Defines what data the client must send when requesting classification.
    """
    commit_message: str = Field(
        ...,
        description="Commit message text",
        min_length=1,
        max_length=5000
    )
    files_changed: Optional[List[str]] = Field(
        None,
        description="List of file paths changed in the commit"
    )
    diff_stats: Optional[dict] = Field(
        None,
        description="Diff statistics with additions and deletions"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "commit_message": "fix: resolve null pointer exception in user service",
                "files_changed": [
                    "src/services/user.service.ts",
                    "src/tests/user.test.ts"
                ],
                "diff_stats": {
                    "additions": 15,
                    "deletions": 8
                }
            }
        }


class ClassificationResult(BaseModel):
    """
    Response schema for commit classification.
    Defines what data the API returns after classifying a commit.
    """
    classification: CommitType = Field(
        ...,
        description="Predicted commit type"
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Prediction confidence score"
    )
    method: str = Field(
        default="rule-based",
        description="Classification method used"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "classification": "BUGFIX",
                "confidence": 0.92,
                "method": "rule-based"
            }
        }