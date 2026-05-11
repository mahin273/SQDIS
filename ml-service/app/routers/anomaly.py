from fastapi import APIRouter, HTTPException
from app.schemas.anomaly import AnomalyDetectRequest, AnomalyDetectionResult
from app.models.anomaly import AnomalyDetector
from app.config import get_settings
import logging

logger = logging.getLogger(__name__)

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["Anomaly Detection"])

# Load settings and initialize detector with saved model
settings = get_settings()
detector = AnomalyDetector(model_path=settings.anomaly_model_path)


@router.post("/anomaly/detect", response_model=AnomalyDetectionResult)
async def detect_anomaly(request: AnomalyDetectRequest) -> AnomalyDetectionResult:
    """
    Detect if a commit is anomalous based on its characteristics.

    Accepts commit features and returns anomaly score,
    severity level, and whether it is classified as anomalous.
    """
    try:
        result = detector.detect(request.features)
        return AnomalyDetectionResult(**result)

    except Exception as e:
        logger.error(f"Anomaly detection error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Anomaly detection failed: {str(e)}"
        )