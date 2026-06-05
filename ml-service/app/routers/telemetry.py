from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional
from app.utils.telemetry import log_override_telemetry
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml", tags=["Telemetry & Training Data"])

class OverrideRequest(BaseModel):
    score_type: str = Field(..., description="Type of score: 'sqs' or 'dqs'")
    target_id: str = Field(..., description="Project ID or Developer ID")
    original_score: float
    corrected_score: float
    features: Dict[str, Any] = Field(..., description="Metrics/features at calculation time")
    notes: Optional[str] = None

class OverrideResponse(BaseModel):
    success: bool
    message: str

@router.post("/telemetry/override", response_model=OverrideResponse)
async def submit_override(request: OverrideRequest) -> OverrideResponse:
    """
    Submit manual score correction / feedback telemetry.
    This logs the override event to disk, building a dataset of user-corrected examples for retraining.
    """
    try:
        if request.score_type not in ["sqs", "dqs"]:
            raise HTTPException(status_code=400, detail="Invalid score_type. Must be 'sqs' or 'dqs'.")
        
        log_override_telemetry(request.model_dump())
        return OverrideResponse(
            success=True,
            message="Feedback logged successfully for model retraining"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit override: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log override: {str(e)}"
        )
