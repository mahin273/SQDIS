from fastapi import Header, HTTPException, status, Security
from fastapi.security import APIKeyHeader
from app.config import get_settings
import secrets

api_key_header = APIKeyHeader(name="X-Service-Key", auto_error=False)


def verify_service_api_key(
    x_service_key: str | None = Security(api_key_header),
    authorization: str | None = Header(default=None),
) -> bool:
    """
    Verify service-to-service authentication using a shared secret.
    Accepts credentials via:
    1. X-Service-Key header
    2. Authorization: Bearer <token> header
    """
    settings = get_settings()
    configured_secret = settings.ml_service_secret

    if not configured_secret:
        return True

    # 1. Check X-Service-Key header
    if x_service_key and secrets.compare_digest(x_service_key, configured_secret):
        return True

    # 2. Check Authorization: Bearer <secret>
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            if secrets.compare_digest(parts[1], configured_secret):
                return True

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid or missing service authentication key",
        headers={"WWW-Authenticate": "ApiKey"},
    )
