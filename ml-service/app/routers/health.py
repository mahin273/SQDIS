from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import Settings, get_settings
import os

# Create router with prefix and tag for Swagger UI grouping
router = APIRouter(prefix="/api/ml", tags=["Health"])


class ModelStatus(BaseModel):
    """Represents the status of a single ML model"""
    loaded: bool
    version: str


class HealthResponse(BaseModel):
    """Full health check response schema"""
    status: str
    app_name: str
    version: str
    debug: bool
    models: dict[str, ModelStatus]


@router.get("/health", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_settings)):
    """
    Health check endpoint.
    Returns service status and whether each ML model is loaded.
    """

    # Check which model files actually exist on disk
    models = {
        "classification": ModelStatus(
            loaded=os.path.exists(settings.classification_model_path),
            version=settings.classification_model_version
        ),
        "anomaly": ModelStatus(
            loaded=os.path.exists(settings.anomaly_model_path),
            version=settings.anomaly_model_version
        ),
        "dqs": ModelStatus(
            loaded=os.path.exists(settings.dqs_model_path),
            version=settings.dqs_model_version
        ),
        "sqs": ModelStatus(
            loaded=os.path.exists(settings.sqs_model_path),
            version=settings.sqs_model_version
        ),
    }

    return HealthResponse(
        status="healthy",
        app_name=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        models=models
    )


@router.get("/")
async def root():
    """
    Root endpoint — returns basic service info and links to docs.
    """
    return {
        "message": "SQDIS ML Service API",
        "docs": "/docs",
        "health": "/api/ml/health"
    }