from fastapi import FastAPI, Response, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from app.config import get_settings
from app.routers import health, classification, anomaly, sentiment, sqs, dqs, code_quality, telemetry, defect

# Load settings once at startup
settings = get_settings()

# Create the FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="SQDIS ML Service — Developer Quality Score & Project Health API",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow frontend to talk to this API (CORS middleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(health.router)
app.include_router(classification.router)
app.include_router(anomaly.router)
app.include_router(sentiment.router)
app.include_router(sqs.router)
app.include_router(dqs.router)
app.include_router(code_quality.router)
app.include_router(telemetry.router)
app.include_router(defect.router)

# V1 Route Aliases for backwards compatibility and benchmark testing
v1_router = APIRouter(prefix="/api/v1", tags=["API v1 Compatibility"])
v1_router.add_api_route("/dqs/predict", dqs.predict_dqs, methods=["POST"])
v1_router.add_api_route("/dqs/explain", dqs.explain_dqs, methods=["POST"])
v1_router.add_api_route("/dqs/model-info", dqs.get_dqs_model_info, methods=["GET"])
v1_router.add_api_route("/sqs/predict", sqs.predict_sqs, methods=["POST"])
v1_router.add_api_route("/sqs/model-info", sqs.get_sqs_model_info, methods=["GET"])
v1_router.add_api_route("/defects/predict", defect.predict_defect_risk, methods=["POST"])
v1_router.add_api_route("/defects/model-info", defect.get_defect_model_info, methods=["GET"])
app.include_router(v1_router)


@app.get("/metrics", tags=["Monitoring"])
def metrics():
    """Expose Prometheus metrics for scraping."""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )