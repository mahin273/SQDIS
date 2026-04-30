from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import health

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

# Register routers
app.include_router(health.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )