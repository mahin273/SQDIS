from pydantic import BaseModel, Field
from typing import List, Dict, Optional


# ==================== Request Schemas ====================

class FileInput(BaseModel):
    """Represents a code file to analyze."""
    path: str = Field(..., description="Relative file path in the repository")
    content: str = Field(..., description="Source code text content")


class FileChangeInfo(BaseModel):
    """File modifications in a commit."""
    path: str = Field(..., description="Relative file path")
    lines_added: int = Field(0, ge=0)
    lines_removed: int = Field(0, ge=0)


class CommitInfo(BaseModel):
    """Represents a commit in the project history."""
    sha: str = Field(..., description="Commit SHA-1 hash")
    author_email: str = Field(..., description="Author's email address")
    message: Optional[str] = Field(default=None, description="Commit message")
    files_changed: List[FileChangeInfo] = Field(..., description="List of files modified in this commit")



class CodeAnalysisRequest(BaseModel):
    """Request schema for code quality analysis."""
    files: List[FileInput] = Field(..., description="List of source code files to scan")
    git_history: Optional[List[CommitInfo]] = Field(default=None, description="Optional commit history for ownership and hotspot analysis")
    coverage_metadata: Optional[Dict[str, float]] = Field(default=None, description="Optional map of file path to test coverage percentage")
    repository_id: Optional[str] = Field(default=None, description="Optional repository ID for caching and delta analysis")


# ==================== Response Schemas ====================

class DuplicateBlock(BaseModel):
    """Duplicate code block description."""
    matching_file: str = Field(..., description="File containing duplicate code")
    start_line: int
    line_count: int
    snippet: str


class ComplexityResult(BaseModel):
    """Code complexity analysis result per file."""
    path: str
    cyclomatic_complexity: int = Field(..., description="McCabe cyclomatic complexity score")
    cognitive_complexity: int = Field(..., description="Cognitive complexity rating")
    maintainability_index: float = Field(..., description="Maintainability Index (0-100)")
    duplicate_blocks: List[DuplicateBlock] = Field(default_factory=list)


class SecurityIssue(BaseModel):
    """Security vulnerability or hardcoded secret detected."""
    path: str
    type: str = Field(..., description="sast, secret, or dependency")
    severity: str = Field(..., description="LOW, MEDIUM, HIGH, CRITICAL")
    message: str = Field(..., description="Warning message describing the issue")
    line_number: Optional[int] = Field(None, description="Line number of the issue, if available")


class OwnershipResult(BaseModel):
    """Code ownership and knowledge silo analysis result per file."""
    path: str
    bus_factor: int = Field(..., description="Minimum number of authors collectively owning >80% of commits")
    primary_author: str = Field(..., description="Primary author's email")
    author_distribution: Dict[str, float] = Field(..., description="Mapping of author email to commit ratio (0-1)")


class HotspotResult(BaseModel):
    """Flagged hotspot where code is complex, churned, and poorly tested."""
    path: str
    hotspot_score: float = Field(..., ge=0.0, le=100.0, description="Hotspot prioritization score (0-100)")
    reasons: List[str] = Field(..., description="Why this file was flagged as a hotspot")


class CodeSmell(BaseModel):
    """Represents a code smell identified in code structural patterns."""
    file_path: str
    smell_type: str = Field(..., description="God Class, Feature Envy, Long Parameter List, Deep Nesting")
    location: str = Field(..., description="Name of class/method or line range")
    description: str
    severity: str = Field(..., description="LOW, WARNING, ERROR")


class DependencyCycle(BaseModel):
    """Represents a circular dependency path detected between files."""
    files: List[str] = Field(..., description="The path of files forming a loop, e.g., ['a.py', 'b.py', 'a.py']")
    description: str


class SemanticClone(BaseModel):
    """Represents high semantic similarity detected between files."""
    file_a: str
    file_b: str
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    description: str


class TaintIssue(BaseModel):
    """Represents user input propagating unchecked into a dangerous sink."""
    path: str
    source: str = Field(..., description="Where the tainted variable was introduced")
    sink: str = Field(..., description="Where the tainted variable is used dangerously")
    line_number: int
    variable_name: str
    message: str
    severity: str = Field("HIGH", description="HIGH, CRITICAL")


class JITCommitRisk(BaseModel):
    """Evaluates commit defect introduction risk based on churn metadata and sentiment."""
    sha: str
    risk_score: float = Field(..., ge=0.0, le=100.0)
    risk_factors: List[str] = Field(default_factory=list)
    author_email: str


class KnowledgeSiloGraph(BaseModel):
    """Represents high reliance risk on a single developer or decay of code ownership."""
    file_path: str
    primary_owner: str
    silo_risk: str = Field(..., description="LOW, MEDIUM, HIGH")
    decay_score: float = Field(..., description="Decay score (0.0 to 1.0) indicating inactive primary maintainer")
    reasons: List[str] = Field(default_factory=list)


class CodeAnalysisResult(BaseModel):
    """Complete code quality scan results."""
    complexity: List[ComplexityResult] = Field(default_factory=list)
    security: List[SecurityIssue] = Field(default_factory=list)
    ownership: List[OwnershipResult] = Field(default_factory=list)
    hotspots: List[HotspotResult] = Field(default_factory=list)
    
    # Advanced metrics
    code_smells: List[CodeSmell] = Field(default_factory=list)
    dependency_cycles: List[DependencyCycle] = Field(default_factory=list)
    semantic_clones: List[SemanticClone] = Field(default_factory=list)
    taint_issues: List[TaintIssue] = Field(default_factory=list)
    jit_commit_risks: List[JITCommitRisk] = Field(default_factory=list)
    knowledge_decay: List[KnowledgeSiloGraph] = Field(default_factory=list)

