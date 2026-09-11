from pydantic import BaseModel, Field
from typing import List, Optional
from enum import Enum


class SiloRiskLevel(str, Enum):
    CRITICAL_SILO = "CRITICAL_SILO"    # Bus Factor == 1: Single developer holds >= 80% ownership
    VULNERABLE = "VULNERABLE"          # Bus Factor == 2: Only 2 developers cover >= 80%
    RESILIENT = "RESILIENT"            # Bus Factor >= 3: Broad, distributed knowledge base
    UNKNOWN = "UNKNOWN"                # Zero activity / insufficient data


class AuthorContribution(BaseModel):
    """Git activity metrics for an individual author within a module/directory."""
    developer_id: str = Field(..., description="Developer unique identifier or canonical email")
    author_name: str = Field(..., description="Display name of contributor")
    commit_count: int = Field(..., ge=0, description="Total commits authored in this module")
    lines_added: int = Field(..., ge=0, description="Total lines added")
    lines_deleted: int = Field(..., ge=0, description="Total lines removed")


class ModuleContribution(BaseModel):
    """Aggregated author contributions for a repository module or subsystem."""
    module_name: str = Field(..., description="Name or path prefix of module, e.g. 'src/auth'")
    authors: List[AuthorContribution] = Field(..., min_items=1, description="List of author activity records")


class BusFactorAnalysisRequest(BaseModel):
    """Request payload for multi-module knowledge silo and bus factor evaluation."""
    repository_name: Optional[str] = Field("repository", description="Repository name")
    modules: List[ModuleContribution] = Field(..., min_items=1, description="List of modules to evaluate")


class AuthorOwnership(BaseModel):
    """Standardized ownership and contribution share for an author."""
    developer_id: str
    author_name: str
    contribution_ratio: float = Field(..., description="Combined weighted score (50% commits + 50% churn)")
    commit_share: float = Field(..., description="Fraction of total commits in module")
    churn_share: float = Field(..., description="Fraction of total lines touched")
    is_key_owner: bool = Field(..., description="True if part of the minimal set covering 80% of knowledge")


class ModuleBusFactorResult(BaseModel):
    """Detailed bus factor analysis for a specific module."""
    module_name: str
    bus_factor: int = Field(..., ge=0, description="Minimum authors required to account for >= 80% contribution")
    gini_coefficient: float = Field(..., ge=0.0, le=1.0, description="Inequality of code ownership (0=equal, 1=monopoly)")
    risk_level: SiloRiskLevel = Field(..., description="Organizational fragility level")
    total_commits: int
    total_churn: int
    key_owners: List[str] = Field(default_factory=list, description="Names of developers in the 80% knowledge set")
    author_ownerships: List[AuthorOwnership] = Field(default_factory=list)
    cross_training_recommendation: str = Field(..., description="Actionable advice to reduce knowledge silo")


class BusFactorAnalysisResponse(BaseModel):
    """Top-level organizational resilience and knowledge silo report."""
    repository_name: str
    overall_bus_factor: int = Field(..., ge=0, description="Minimum bus factor across critical modules")
    average_gini: float = Field(..., ge=0.0, le=1.0, description="Mean Gini coefficient across all modules")
    total_modules_analyzed: int
    critical_silos_count: int
    vulnerable_count: int
    resilient_count: int
    module_results: List[ModuleBusFactorResult]
