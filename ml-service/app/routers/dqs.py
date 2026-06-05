from fastapi import APIRouter, HTTPException, Depends
from app.schemas.dqs import DQSPredictRequest, DQSPredictionResult, DQSExplainResult, DQSModelInfoResponse
from app.models.dqs import dqs_model

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["DQS - Developer Quality Score"])


@router.post("/dqs/predict", response_model=DQSPredictionResult)
async def predict_dqs(request: DQSPredictRequest) -> DQSPredictionResult:
    """
    Predict Developer Quality Score (DQS) for a developer.

    Uses an XGBoost regression model (or heuristic fallback) based on 30-day developer metrics:
    - commit_count_30d
    - bug_fix_ratio
    - code_churn
    - coverage_avg
    - review_count
    - review_turnaround_avg

    Returns the score (0-100), model version, and SHAP feature impact analyses.
    """
    try:
        result = dqs_model.predict(
            developer_id=request.developer_id,
            features=request.features
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"DQS prediction failed: {str(e)}"
        )


@router.post("/dqs/explain", response_model=DQSExplainResult)
async def explain_dqs(request: DQSPredictRequest) -> DQSExplainResult:
    """
    Explain DQS prediction with detailed feature descriptions and SHAP values.
    """
    try:
        result = dqs_model.explain(
            developer_id=request.developer_id,
            features=request.features
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"DQS explanation failed: {str(e)}"
        )


@router.get("/dqs/model-info", response_model=DQSModelInfoResponse)
async def get_dqs_model_info() -> DQSModelInfoResponse:
    """
    Returns metadata about the active DQS model.
    """
    return DQSModelInfoResponse(
      model_type="XGBoost" if dqs_model.model is not None else "Heuristic Fallback",
      model_version=dqs_model.version,
      feature_count=len(dqs_model.FEATURE_NAMES),
      feature_names=dqs_model.FEATURE_NAMES
    )
