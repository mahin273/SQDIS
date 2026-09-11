from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from app.schemas.code_quality import FileInput


class TestImpactRequest(BaseModel):
    """Request schema for Test Impact Analysis (TIA via DAG)."""
    files: List[FileInput] = Field(..., description="List of source and test files representing the repository snapshot")
    changed_files: List[str] = Field(..., description="List of file paths modified in the commit or pull request")
    test_file_patterns: Optional[List[str]] = Field(
        default=["*.spec.*", "*.test.*", "*_test.*", "test_*.*"],
        description="Glob patterns used to identify test suite files"
    )
    repository_id: Optional[str] = Field(default=None, description="Optional repository ID for telemetry and caching")


class ImpactedNode(BaseModel):
    """Represents an impacted test file with its causal dependency propagation chain."""
    file_path: str = Field(..., description="Path of the impacted test file")
    depth: int = Field(..., description="Topological distance (hops) from the nearest changed file")
    impact_chain: List[str] = Field(..., description="Sequential file path chain explaining why this test was triggered")


class DagEdge(BaseModel):
    """Represents a directed dependency edge in the repository DAG."""
    source: str = Field(..., description="Caller file that contains the import statement")
    target: str = Field(..., description="Callee file being imported")


class TestImpactResult(BaseModel):
    """Result of Test Impact Analysis pruning."""
    changed_files: List[str] = Field(..., description="The original modified files analyzed")
    total_tests_in_repo: int = Field(..., description="Total number of test suites discovered in the repository")
    impacted_tests_count: int = Field(..., description="Number of test suites impacted by the changes")
    impacted_test_files: List[str] = Field(..., description="List of test suite files that MUST be executed")
    skipped_test_files: List[str] = Field(..., description="List of test suite files that can be safely skipped")
    time_savings_percentage: float = Field(..., description="Estimated percentage of CI test execution time saved (0-100%)")
    impact_chains: List[ImpactedNode] = Field(default_factory=list, description="Causal dependency propagation chains for each impacted test")
    dag_edges: List[DagEdge] = Field(default_factory=list, description="All directed edges in the forward dependency DAG")
