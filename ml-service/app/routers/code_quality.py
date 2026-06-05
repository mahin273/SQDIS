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
        if request.repository_id:
            from app.models.code_quality import get_repo_lock
            async with get_repo_lock(request.repository_id):
                result = code_analyzer.analyze(request)
        else:
            result = code_analyzer.analyze(request)
        return result
    except Exception as e:
        logger.error(f"Code quality analysis failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Code quality analysis failed: {str(e)}"
        )


@router.delete("/code-quality/cache/{repository_id}")
async def clear_code_quality_cache(repository_id: str):
    """
    Clear the AST analysis cache for a specific repository.
    """
    try:
        from app.models.code_quality import get_repo_lock
        import shutil
        import os
        
        async with get_repo_lock(repository_id):
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            cache_dir = os.path.join(base_dir, "data", "ast_cache", repository_id)
            if os.path.exists(cache_dir):
                shutil.rmtree(cache_dir)
                logger.info(f"Successfully cleared AST cache for repository: {repository_id}")
                return {"status": "success", "message": f"Cache cleared for repository {repository_id}"}
            else:
                return {"status": "success", "message": "Cache was already empty"}
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to clear cache: {str(e)}"
        )
