from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"


class DefectPredictRequest(BaseModel):
    """
    Features describing a commit or pull request delta for defect prediction.
    Derived from empirical JIT (Just-In-Time) software engineering benchmarks.
    """
    commit_id: Optional[str] = Field(None, description="Optional SHA or identifier of the commit")
    added_lines: int = Field(..., ge=0, description="Total lines of code added in this change")
    deleted_lines: int = Field(..., ge=0, description="Total lines of code deleted in this change")
    modified_files_count: int = Field(..., ge=0, description="Number of distinct files modified")
    max_cyclomatic_complexity: float = Field(1.0, ge=1.0, description="Peak cyclomatic complexity among touched functions")
    author_experience_commits: int = Field(10, ge=0, description="Historical commits contributed by author")
    directory_entropy: float = Field(0.0, ge=0.0, description="Shannon entropy of modifications across directories")


class DefectPredictionResult(BaseModel):
    """
    Inference result predicting the defect risk of a commit or pull request.
    """
    commit_id: Optional[str] = None
    defect_probability: float = Field(..., ge=0.0, le=1.0, description="Predicted probability that this commit induces a defect")
    risk_level: RiskLevel = Field(..., description="Categorical risk level: LOW (<0.35), MODERATE (0.35-0.70), HIGH (>0.70)")
    is_defect_prone: bool = Field(..., description="True if defect probability exceeds the standard 0.50 threshold")
    top_risk_drivers: List[str] = Field(default_factory=list, description="List of primary features driving the risk assessment")
    model_version: str = Field(..., description="Version of the model used for inference")


class DefectModelInfoResponse(BaseModel):
    """
    Metadata about the active defect prediction model.
    """
    model_name: str
    model_type: str
    model_version: str
    dataset_samples: int
    test_roc_auc: float
    feature_names: List[str]
