from fastapi import APIRouter, HTTPException
from app.schemas.defect import (
    DefectPredictRequest, DefectPredictionResult, DefectModelInfoResponse,
    ModuleDefectPredictRequest, ModuleDefectResult
)
from app.models.defect_prediction import defect_model, nasa_defect_model
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml/defects", tags=["Defect Prediction"])


@router.post("/predict", response_model=DefectPredictionResult)
async def predict_defect_risk(request: DefectPredictRequest) -> DefectPredictionResult:
    """
    Predict defect risk for a Git commit or pull request delta (Tier 1: Kamei JIT Model).

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


@router.post("/predict-module", response_model=ModuleDefectResult)
async def predict_module_defect(request: ModuleDefectPredictRequest) -> ModuleDefectResult:
    """
    Predict defect risk for a static source code file or module (Tier 2: NASA MDP Model).

    Evaluates:
    - Lines of code (LOC)
    - McCabe Cyclomatic Complexity v(g)
    - Halstead Software Science (Volume, Difficulty, Effort)
    - Vocabulary & operand/operator distributions

    Returns:
    - defect_probability (0.0 - 1.0)
    - risk_level (LOW, MODERATE, HIGH)
    - is_defect_prone (boolean)
    - top_risk_drivers
    """
    try:
        result = nasa_defect_model.predict(request)
        return result
    except Exception as e:
        logger.error(f"NASA module defect prediction failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"NASA module defect prediction failed: {str(e)}"
        )


@router.get("/model-info", response_model=DefectModelInfoResponse)
async def get_defect_model_info() -> DefectModelInfoResponse:
    """
    Returns empirical metadata, dataset size, and test ROC-AUC for the active JIT defect classifier.
    """
    return defect_model.get_info()


@router.get("/nasa-model-info")
async def get_nasa_model_info():
    """
    Returns empirical metadata, dataset size, and test metrics for the active NASA MDP module defect classifier.
    """
    return {
        "model_name": "NASA MDP Module-Level Defect Prediction Classifier",
        "benchmark": "NASA Metrics Data Program (JM1, KC1, KC2, PC1)",
        "model_type": "XGBClassifier" if nasa_defect_model.model is not None else "Heuristic Fallback",
        "model_version": nasa_defect_model.version,
        "dataset_samples": nasa_defect_model.dataset_samples,
        "metrics": nasa_defect_model.metrics,
        "features": nasa_defect_model.FEATURE_COLS
    }
