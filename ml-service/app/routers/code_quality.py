from fastapi import APIRouter, HTTPException
from app.schemas.code_quality import CodeAnalysisRequest, CodeAnalysisResult
from app.models.code_quality import code_analyzer
import logging

logger = logging.getLogger(__name__)

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["Code Quality & Security"])


@router.post("/code-quality/analyze", response_model=CodeAnalysisResult)
async def analyze_code(request: CodeAnalysisRequest) -> CodeAnalysisResult:
    """
    Run deep Code Quality and Security Analysis on files.

    Performs:
    - **Deep Complexity (AST)**: McCabe CC, cognitive complexity, maintainability index.
    - **Code Duplication**: Sliding-window hashing of duplicate lines.
    - **SAST & Secrets**: Security rules scanner for injection vulnerability and hardcoded credentials.
    - **Bus Factor & Silos**: Calculates developer ownership distributions and tags knowledge silos.
    - **Hotspots Identification**: Multi-variable correlation of complexity, git churn, and test coverage.
    """
    try:
        result = code_analyzer.analyze(request)
        return result
    except Exception as e:
        logger.error(f"Code quality analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Code quality analysis failed: {str(e)}"
        )
