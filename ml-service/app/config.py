from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All values are automatically read from the .env file.
    """

    # Application Settings
    app_name: str = "SQDIS ML Service"
    app_version: str = "1.0.0"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # Model Paths
    classification_model_path: str = "data/models/classification_model.pkl"
    anomaly_model_path: str = "data/models/anomaly_model.pkl"
    dqs_model_path: str = "data/models/dqs_model.pkl"
    sqs_model_path: str = "data/models/sqs_model.pkl"

    # Model Versions
    classification_model_version: str = "1.0.0"
    anomaly_model_version: str = "1.0.0"
    dqs_model_version: str = "1.0.0"
    sqs_model_version: str = "1.0.0"

    # CORS Settings
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    # Logging
    log_level: str = "INFO"

    class Config:
        # Tell pydantic to read from .env file
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """
    Returns a cached instance of Settings.
    Using lru_cache means Settings is only created once — efficient!
    """
    return Settings()