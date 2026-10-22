from fastapi.testclient import TestClient
from app.main import app
from app.config import get_settings

client = TestClient(app)


def test_health_endpoint_is_public():
    """Verify health endpoint is accessible without authentication."""
    response = client.get("/api/ml/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_metrics_endpoint_is_public():
    """Verify prometheus metrics endpoint is accessible without authentication."""
    response = client.get("/metrics")
    assert response.status_code == 200


def test_protected_endpoint_rejects_unauthenticated():
    """Verify protected endpoints return 401 when no auth key is provided."""
    # Test AST cache clearing route
    response = client.delete("/api/ml/code-quality/cache/test-repo-123")
    assert response.status_code == 401
    assert "Unauthorized" in response.json().get("detail", "")

    # Test DQS predict route
    response = client.post("/api/ml/dqs/predict", json={
        "developer_id": "dev-1",
        "features": {
            "commit_count_30d": 10,
            "bug_fix_ratio": 0.2,
            "code_churn": 0.3,
            "coverage_avg": 80.0,
            "review_count": 5,
            "review_turnaround_avg": 2.0,
        }
    })
    assert response.status_code == 401

    # Test telemetry override route
    response = client.post("/api/ml/telemetry/override", json={
        "score_type": "dqs",
        "target_id": "dev-1",
        "original_score": 75.0,
        "corrected_score": 82.0,
        "features": {},
    })
    assert response.status_code == 401

    # Test v1 compatibility route
    response = client.post("/api/v1/dqs/predict", json={
        "developer_id": "dev-1",
        "features": {
            "commit_count_30d": 10,
            "bug_fix_ratio": 0.2,
            "code_churn": 0.3,
            "coverage_avg": 80.0,
            "review_count": 5,
            "review_turnaround_avg": 2.0,
        }
    })
    assert response.status_code == 401


def test_protected_endpoint_rejects_invalid_key():
    """Verify protected endpoints return 401 when invalid auth key is provided."""
    response = client.delete(
        "/api/ml/code-quality/cache/test-repo-123",
        headers={"X-Service-Key": "invalid-wrong-secret"},
    )
    assert response.status_code == 401

    response = client.delete(
        "/api/ml/code-quality/cache/test-repo-123",
        headers={"Authorization": "Bearer invalid-wrong-secret"},
    )
    assert response.status_code == 401


def test_protected_endpoint_accepts_valid_service_key():
    """Verify protected endpoints allow access with valid X-Service-Key or Bearer token."""
    secret = get_settings().ml_service_secret

    # Valid X-Service-Key header
    response = client.delete(
        "/api/ml/code-quality/cache/test-repo-123",
        headers={"X-Service-Key": secret},
    )
    # 404 because test-repo-123 cache does not exist, but auth check succeeded (not 401)
    assert response.status_code in [200, 404]

    # Valid Authorization: Bearer <secret>
    response = client.delete(
        "/api/ml/code-quality/cache/test-repo-123",
        headers={"Authorization": f"Bearer {secret}"},
    )
    assert response.status_code in [200, 404]
