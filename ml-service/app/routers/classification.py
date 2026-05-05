from fastapi import APIRouter, HTTPException
from typing import List
from app.schemas.classification import ClassifyRequest, ClassificationResult
from app.models.classification import classifier
import logging

logger = logging.getLogger(__name__)

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["Commit Classification"])


@router.post("/classify", response_model=ClassificationResult)
async def classify_commit(request: ClassifyRequest) -> ClassificationResult:
    """
    Classify a single commit message into a commit type.

    Accepts a commit message and optional file changes,
    returns the predicted commit type with confidence score.
    """
    try:
        result = classifier.classify(
            commit_message=request.commit_message,
            files_changed=request.files_changed,
            diff_stats=request.diff_stats
        )
        return result

    except Exception as e:
        logger.error(f"Classification error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Classification failed: {str(e)}"
        )


@router.post("/classify/batch", response_model=List[ClassificationResult])
async def classify_batch(requests: List[ClassifyRequest]) -> List[ClassificationResult]:
    """
    Classify multiple commit messages in a single request.

    Accepts a list of commit messages and returns
    a list of classification results in the same order.
    """
    # Limit batch size to prevent overload
    if len(requests) > 100:
        raise HTTPException(
            status_code=400,
            detail="Batch size cannot exceed 100 commits"
        )

    try:
        results = []
        for request in requests:
            result = classifier.classify(
                commit_message=request.commit_message,
                files_changed=request.files_changed,
                diff_stats=request.diff_stats
            )
            results.append(result)

        return results

    except Exception as e:
        logger.error(f"Batch classification error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Batch classification failed: {str(e)}"
        )