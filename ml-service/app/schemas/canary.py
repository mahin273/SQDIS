from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class MetricSnapshot(BaseModel):
    """Point-in-time metrics snapshot."""
    p95_latency_ms: float = Field(..., description="P95 response time in milliseconds")
    error_rate_5xx: float = Field(..., description="5xx HTTP error rate in requests per second")
    memory_rss_mb: float = Field(..., description="Process resident memory usage in megabytes")
    cpu_utilization_pct: Optional[float] = Field(default=None, description="Optional CPU usage percentage")


class MetricDelta(BaseModel):
    """Calculated shifts between baseline and canary windows."""
    latency_delta_pct: float = Field(..., description="Percentage change in P95 latency")
    error_rate_delta: float = Field(..., description="Absolute change in 5xx error rate (req/s)")
    memory_delta_pct: float = Field(..., description="Percentage change in memory RSS usage")


class CanaryViolation(BaseModel):
    """Detailed operational regression rule breach."""
    metric: str = Field(..., description="Metric name: p95_latency, error_rate_5xx, or memory_rss")
    severity: str = Field(..., description="WARNING or CRITICAL")
    description: str = Field(..., description="Human-readable violation summary")
    observed_value: float = Field(..., description="Value observed during canary observation")
    baseline_value: float = Field(..., description="Value observed during pre-deployment baseline")
    threshold: str = Field(..., description="Configured tolerance threshold")


class CanaryAnalysisRequest(BaseModel):
    """Request schema for automated canary regression analysis."""
    commit_sha: str = Field(..., description="Git commit SHA under evaluation")
    author_email: str = Field(..., description="Author email of the commit for incident attribution")
    service_name: Optional[str] = Field(default="sqdis-backend", description="Target service to evaluate")
    baseline_duration_minutes: Optional[int] = Field(default=15, ge=1, le=1440)
    canary_duration_minutes: Optional[int] = Field(default=10, ge=1, le=1440)
    custom_baseline: Optional[MetricSnapshot] = Field(default=None, description="Optional custom baseline snapshot for offline/synthetic testing")
    custom_canary: Optional[MetricSnapshot] = Field(default=None, description="Optional custom canary snapshot for offline/synthetic testing")
    prometheus_url: Optional[str] = Field(default=None, description="Optional custom Prometheus API URL")


class CanaryAnalysisResult(BaseModel):
    """Result of Canary Performance Regression analysis."""
    commit_sha: str
    author_email: str
    service_name: str
    verdict: str = Field(..., description="HEALTHY, DEGRADED, or CRITICAL_REGRESSION")
    recommendation: str = Field(..., description="PROCEED, MONITOR_CLOSELY, or TRIGGER_ROLLBACK")
    baseline_metrics: MetricSnapshot
    canary_metrics: MetricSnapshot
    deltas: MetricDelta
    violations: List[CanaryViolation] = Field(default_factory=list)
