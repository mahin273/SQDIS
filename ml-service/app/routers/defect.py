from fastapi import APIRouter, HTTPException
from app.schemas.defect import DefectPredictRequest, DefectPredictionResult, DefectModelInfoResponse
from app.models.defect_prediction import defect_model
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml/defects", tags=["Defect Prediction"])


@router.post("/predict", response_model=DefectPredictionResult)
async def predict_defect_risk(request: DefectPredictRequest) -> DefectPredictionResult:
    """
    Predict defect risk for a Git commit or pull request delta.

    Evaluates:
    - added_lines & deleted_lines
    - modified_files_count
    - max_cyclomatic_complexity
    - author_experience_commits
    - directory_entropy (Shannon information entropy)

    Returns:
    - defect_probability (0.0 - 1.0)
    - risk_level (LOW, MODERATE, HIGH)
    - is_defect_prone (boolean)
    - top_risk_drivers (explainable human-readable list)
    """
    try:
        result = defect_model.predict(request)
        return result
    except Exception as e:
        logger.error(f"Defect prediction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Defect prediction failed: {str(e)}"
        )


@router.get("/model-info", response_model=DefectModelInfoResponse)
async def get_defect_model_info() -> DefectModelInfoResponse:
    """
    Returns empirical metadata, dataset size, and test ROC-AUC for the active defect classifier.
    """
    return defect_model.get_info()
