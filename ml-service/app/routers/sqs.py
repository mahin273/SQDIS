from fastapi import APIRouter, HTTPException, Query
from typing import List
from app.schemas.sqs import SQSRequest, SQSResult
from app.models.sqs import sqs_model
import logging

logger = logging.getLogger(__name__)

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["SQS - Software Quality Score"])


@router.post("/sqs/calculate", response_model=SQSResult)
async def calculate_sqs(request: SQSRequest) -> SQSResult:
    """
    Calculate Software Quality Score (SQS) for a project.

    Analyzes 10 project metrics across 5 categories:
    - Commit Quality (30%)
    - Activity (20%)
    - Code Health (25%)
    - Team Sentiment (15%)
    - Documentation (10%)

    Returns overall score (0-100), grade, risk level,
    risky modules, and actionable recommendations.
    """
    try:
        # Validate metric ratios sum makes sense
        total_ratio = (
            request.metrics.bug_fix_ratio +
            request.metrics.feature_commit_ratio +
            request.metrics.doc_commit_ratio
        )
        if total_ratio > 1.05:
            raise HTTPException(
                status_code=422,
                detail="bug_fix_ratio + feature_commit_ratio + doc_commit_ratio cannot exceed 1.0"
            )

        # Calculate SQS
        result = sqs_model.calculate(
            project_id=request.project_id,
            project_name=request.project_name,
            metrics=request.metrics,
            period_days=request.period_days or 30
        )

        return result

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise

    except ValueError as e:
        logger.error(f"Validation error in SQS calculation: {str(e)}")
        raise HTTPException(
            status_code=422,
            detail=f"Invalid metric values: {str(e)}"
        )

    except Exception as e:
        logger.error(f"Unexpected error in SQS calculation: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"SQS calculation failed: {str(e)}"
        )


@router.post("/sqs/calculate/batch", response_model=List[SQSResult])
async def calculate_sqs_batch(requests: List[SQSRequest]) -> List[SQSResult]:
    """
    Calculate SQS for multiple projects at once.

    Accepts up to 50 projects in a single request.
    Results are returned in the same order as input.
    """
    # Limit batch size
    if len(requests) > 50:
        raise HTTPException(
            status_code=400,
            detail="Batch size cannot exceed 50 projects"
        )

    if len(requests) == 0:
        raise HTTPException(
            status_code=400,
            detail="At least one project is required"
        )

    results = []
    errors = []

    for i, request in enumerate(requests):
        try:
            result = sqs_model.calculate(
                project_id=request.project_id,
                project_name=request.project_name,
                metrics=request.metrics,
                period_days=request.period_days or 30
            )
            results.append(result)

        except Exception as e:
            logger.error(f"Error processing project {request.project_id}: {str(e)}")
            errors.append(f"Project {request.project_id}: {str(e)}")

    # If all failed, return error
    if len(errors) == len(requests):
        raise HTTPException(
            status_code=500,
            detail=f"All projects failed: {errors}"
        )

    return results


@router.get("/sqs/grade-info")
async def get_grade_info():
    """
    Returns the grading criteria used for SQS scoring.
    Useful for frontend to display grade thresholds.
    """
    return {
        "grades": {
            "A": {"min_score": 85, "label": "Excellent", "description": "Project is in outstanding health"},
            "B": {"min_score": 70, "label": "Good", "description": "Project is healthy with minor issues"},
            "C": {"min_score": 55, "label": "Fair", "description": "Project needs attention in several areas"},
            "D": {"min_score": 40, "label": "Poor", "description": "Project has significant quality issues"},
            "F": {"min_score": 0, "label": "Critical", "description": "Project requires immediate intervention"},
        },
        "risk_levels": {
            "LOW": "Score >= 75 — Project is stable",
            "MEDIUM": "Score 55-74 — Some risks present",
            "HIGH": "Score 35-54 — Significant risks",
            "CRITICAL": "Score < 35 — Immediate action needed"
        },
        "weights": {
            "commit_quality": "30%",
            "activity": "20%",
            "code_health": "25%",
            "team_sentiment": "15%",
            "documentation": "10%"
        }
    }