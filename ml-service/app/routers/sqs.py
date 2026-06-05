from fastapi import APIRouter, HTTPException
from app.schemas.sqs import SQSPredictRequest, SQSPredictionResult, SQSModelInfoResponse
from app.models.sqs import sqs_model
import logging

logger = logging.getLogger(__name__)

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["SQS - Software Quality Score"])


@router.post("/sqs/predict", response_model=SQSPredictionResult)
async def predict_sqs(request: SQSPredictRequest) -> SQSPredictionResult:
    """
    Predict Software Quality Score (SQS) for a project.

    Uses a Random Forest regression model (or heuristic fallback) based on aggregated project metrics:
    - avg_dqs
    - coverage
    - churn_rate
    - debt_count
    - bug_density

    Optionally reviews directory modules for code quality and stability risks.

    Returns the health score (0-100), model version, flagged risky modules, and actionable recommendations.
    """
    try:
        result = sqs_model.predict(
            project_id=request.project_id,
            features=request.features,
            modules=request.modules
        )
        return result
    except Exception as e:
        logger.error(f"SQS prediction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"SQS prediction failed: {str(e)}"
        )


@router.get("/sqs/model-info", response_model=SQSModelInfoResponse)
async def get_sqs_model_info() -> SQSModelInfoResponse:
    """
    Returns metadata about the active SQS model.
    """
    return SQSModelInfoResponse(
      model_type="Random Forest" if sqs_model.model is not None else "Heuristic Fallback",
      model_version=sqs_model.version,
      feature_count=len(sqs_model.FEATURE_NAMES),
      feature_names=sqs_model.FEATURE_NAMES
    )