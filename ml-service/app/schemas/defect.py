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


class ModuleDefectPredictRequest(BaseModel):
    """
    Features describing a static code module / file for NASA MDP defect prediction.
    Can be supplied as precomputed AST metrics or as raw code content.
    """
    file_path: Optional[str] = Field(None, description="Path of the source file")
    content: Optional[str] = Field(None, description="Optional raw code content for automated Tree-sitter AST metric extraction")
    loc: Optional[float] = Field(None, ge=0.0, description="Lines of code")
    cyclomatic_complexity: Optional[float] = Field(None, ge=1.0, description="McCabe Cyclomatic Complexity v(g)")
    halstead_volume: Optional[float] = Field(None, ge=0.0, description="Halstead Program Volume V")
    halstead_difficulty: Optional[float] = Field(None, ge=0.0, description="Halstead Difficulty D")
    halstead_effort: Optional[float] = Field(None, ge=0.0, description="Halstead Mental Effort E")
    unique_operators: Optional[float] = Field(None, ge=0.0, description="Count of unique operators (n1)")
    unique_operands: Optional[float] = Field(None, ge=0.0, description="Count of unique operands (n2)")


class ModuleDefectResult(BaseModel):
    """
    Inference result predicting the defect risk of a static code module using the NASA MDP model.
    """
    file_path: Optional[str] = None
    defect_probability: float = Field(..., ge=0.0, le=1.0, description="Predicted probability that this module contains a defect")
    risk_level: RiskLevel = Field(..., description="Risk category: LOW (<0.35), MODERATE (0.35-0.70), HIGH (>0.70)")
    is_defect_prone: bool = Field(..., description="True if defect probability >= 0.50")
    metrics_analyzed: dict = Field(default_factory=dict, description="Normalized AST metrics evaluated by model")
    top_risk_drivers: List[str] = Field(default_factory=list, description="Primary complexity indicators driving risk")
    model_version: str = Field(..., description="Model version identifier")
    benchmark: str = Field(default="NASA MDP / PROMISE (JM1, KC1, KC2, PC1)")
