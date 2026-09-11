from fastapi import APIRouter, HTTPException
from app.schemas.test_impact import TestImpactRequest, TestImpactResult
from app.models.test_impact import test_impact_analyzer
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["Test Impact Analysis (TIA)"])


@router.post("/code-quality/test-impact", response_model=TestImpactResult)
@router.post("/test-impact", response_model=TestImpactResult)
async def analyze_test_impact(request: TestImpactRequest) -> TestImpactResult:
    """
    Run enterprise Test Impact Analysis (TIA via DAG).
    
    Parses code imports, constructs an in-memory dependency DAG, and calculates
    transitive test impact closures to selectively run only affected tests.
    """
    try:
        result = test_impact_analyzer.analyze(request)
        return result
    except Exception as e:
        logger.error(f"Test Impact Analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Test Impact Analysis failed: {str(e)}"
        )


@router.get("/test-impact/info")
async def get_test_impact_info():
    """Returns metadata and default configuration for Test Impact Analysis."""
    return {
        "engine": "SQDIS Transitive DAG Test Impact Analyzer",
        "algorithm": "Transposed Graph (G^T) Breadth-First Search Closure",
        "supported_languages": ["typescript", "javascript", "python", "java"],
        "default_test_patterns": test_impact_analyzer.DEFAULT_TEST_PATTERNS
    }
