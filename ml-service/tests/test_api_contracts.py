from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.code_quality import CodeAnalysisResult, ComplexityResult
from app.schemas.dqs import DQSExplainResult, DQSPredictionResult, SHAPValue
from app.schemas.sentiment import SentimentAnalysisResult, SentimentScore
from app.schemas.sqs import SQSPredictionResult


client = TestClient(app)


@pytest.fixture(autouse=True)
def ml_contract_mocks(monkeypatch):
    """Patch model singletons so API contract tests are deterministic and fast."""

    monkeypatch.setattr(
        "app.routers.classification.classifier",
        SimpleNamespace(
            classify=lambda **_: {
                "classification": "FEATURE",
                "confidence": 0.91,
                "method": "contract-test",
            }
        ),
    )
    monkeypatch.setattr(
        "app.routers.anomaly.detector",
        SimpleNamespace(
            detect=lambda _: {
                "is_anomaly": True,
                "anomaly_score": 0.82,
                "severity": "HIGH",
                "model_version": "contract-test",
            }
        ),
    )
    monkeypatch.setattr(
        "app.routers.sqs.sqs_model",
        SimpleNamespace(
            model=None,
            version="contract-test",
            FEATURE_NAMES=["avg_dqs", "coverage", "churn_rate", "debt_count", "bug_density"],
            predict=lambda **_: SQSPredictionResult(
                score=78.5,
                model_version="contract-test",
                risky_modules=[],
                recommendations=["Keep current quality practices"],
            ),
        ),
    )
    monkeypatch.setattr(
        "app.routers.dqs.dqs_model",
        SimpleNamespace(
            model=None,
            version="contract-test",
            FEATURE_NAMES=[
                "commit_count_30d",
                "bug_fix_ratio",
                "code_churn",
                "coverage_avg",
                "review_count",
                "review_turnaround_avg",
            ],
            predict=lambda **_: DQSPredictionResult(
                score=84.2,
                model_version="contract-test",
                shap_values=[
                    SHAPValue(feature="coverage_avg", value=88.0, impact=5.7),
                ],
            ),
            explain=lambda **_: DQSExplainResult(
                score=84.2,
                model_version="contract-test",
                shap_values=[
                    SHAPValue(feature="coverage_avg", value=88.0, impact=5.7),
                ],
                feature_descriptions={"coverage_avg": "Average touched-file coverage"},
            ),
        ),
    )
    monkeypatch.setattr(
        "app.routers.code_quality.code_analyzer",
        SimpleNamespace(
            analyze=lambda _: CodeAnalysisResult(
                complexity=[
                    ComplexityResult(
                        path="src/app.py",
                        cyclomatic_complexity=2,
                        cognitive_complexity=1,
                        maintainability_index=92.0,
                        duplicate_blocks=[],
                    )
                ],
                security=[],
                ownership=[],
                hotspots=[],
            )
        ),
    )

    sentiment_result = SentimentAnalysisResult(
        commit_id="commit-1",
        sentiment="POSITIVE",
        scores=SentimentScore(positive=0.7, negative=0.0, neutral=0.3, compound=0.6),
        confidence=0.8,
        indicators=["fix"],
        timestamp=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )
    monkeypatch.setattr(
        "app.routers.sentiment.sentiment_analyzer",
        SimpleNamespace(
            analyze=lambda commit_message, commit_id=None: sentiment_result.model_copy(
                update={"commit_id": commit_id}
            ),
            analyze_batch=lambda messages, commit_ids=None: [
                sentiment_result.model_copy(
                    update={"commit_id": commit_ids[index] if commit_ids else None}
                )
                for index, _ in enumerate(messages)
            ],
        ),
    )
    monkeypatch.setattr("app.routers.telemetry.log_override_telemetry", lambda _: None)


def assert_keys(payload, expected_keys):
    assert set(payload.keys()) == set(expected_keys)


def test_health_and_root_contracts():
    root_response = client.get("/api/ml/")
    assert root_response.status_code == 200
    assert root_response.json() == {
        "message": "SQDIS ML Service API",
        "docs": "/docs",
        "health": "/api/ml/health",
    }

    health_response = client.get("/api/ml/health")
    assert health_response.status_code == 200
    payload = health_response.json()
    assert_keys(payload, ["status", "app_name", "version", "debug", "models"])
    assert payload["status"] == "healthy"
    assert set(payload["models"]) == {"classification", "anomaly", "dqs", "sqs"}
    for model_status in payload["models"].values():
        assert_keys(model_status, ["loaded", "version"])
        assert isinstance(model_status["loaded"], bool)


def test_classification_contracts_and_validation():
    response = client.post(
        "/api/ml/classify",
        json={
            "commit_message": "feat: add contract tests",
            "files_changed": ["tests/test_api_contracts.py"],
            "diff_stats": {"additions": 12, "deletions": 1},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert_keys(payload, ["classification", "confidence", "method"])
    assert payload["classification"] in ["BUGFIX", "FEATURE", "REFACTOR", "TEST", "DOCS"]
    assert 0.0 <= payload["confidence"] <= 1.0

    batch_response = client.post(
        "/api/ml/classify/batch",
        json=[{"commit_message": "fix: stabilize endpoint"}, {"commit_message": "docs: update"}],
    )
    assert batch_response.status_code == 200
    assert len(batch_response.json()) == 2

    oversized_response = client.post(
        "/api/ml/classify/batch",
        json=[{"commit_message": f"commit {index}"} for index in range(101)],
    )
    assert oversized_response.status_code == 400
    assert oversized_response.json()["detail"] == "Batch size cannot exceed 100 commits"

    invalid_response = client.post("/api/ml/classify", json={"commit_message": ""})
    assert invalid_response.status_code == 422


def test_anomaly_detection_contract():
    response = client.post(
        "/api/ml/anomaly/detect",
        json={
            "commit_id": "abc123",
            "features": {
                "lines_changed": 1200,
                "files_changed": 12,
                "time_of_day": 3,
                "churn_ratio": 0.7,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert_keys(payload, ["is_anomaly", "anomaly_score", "severity", "model_version"])
    assert isinstance(payload["is_anomaly"], bool)
    assert 0.0 <= payload["anomaly_score"] <= 1.0
    assert payload["severity"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def test_sqs_contracts_and_model_info():
    request = {
        "project_id": "project-1",
        "features": {
            "avg_dqs": 82.0,
            "coverage": 76.5,
            "churn_rate": 0.18,
            "debt_count": 4,
            "bug_density": 1.2,
        },
        "modules": [
            {
                "path": "src/app.py",
                "churn_rate": 0.1,
                "coverage": 88.0,
                "bug_count": 1,
                "debt_count": 0,
                "lines_of_code": 120,
            }
        ],
    }

    response = client.post("/api/ml/sqs/predict", json=request)
    assert response.status_code == 200
    payload = response.json()
    assert_keys(payload, ["score", "model_version", "risky_modules", "recommendations"])
    assert 0.0 <= payload["score"] <= 100.0
    assert isinstance(payload["risky_modules"], list)
    assert isinstance(payload["recommendations"], list)

    info_response = client.get("/api/ml/sqs/model-info")
    assert info_response.status_code == 200
    info = info_response.json()
    assert_keys(info, ["model_type", "model_version", "feature_count", "feature_names"])
    assert info["feature_count"] == len(info["feature_names"])

    invalid_response = client.post(
        "/api/ml/sqs/predict",
        json={**request, "features": {**request["features"], "coverage": 101}},
    )
    assert invalid_response.status_code == 422


def test_dqs_prediction_explanation_and_model_info_contracts():
    request = {
        "developer_id": "developer-1",
        "features": {
            "commit_count_30d": 22,
            "bug_fix_ratio": 0.2,
            "code_churn": 0.15,
            "coverage_avg": 88.0,
            "review_count": 7,
            "review_turnaround_avg": 5.5,
        },
    }

    predict_response = client.post("/api/ml/dqs/predict", json=request)
    assert predict_response.status_code == 200
    prediction = predict_response.json()
    assert_keys(prediction, ["score", "model_version", "shap_values"])
    assert 0.0 <= prediction["score"] <= 100.0
    assert_keys(prediction["shap_values"][0], ["feature", "value", "impact"])

    explain_response = client.post("/api/ml/dqs/explain", json=request)
    assert explain_response.status_code == 200
    explanation = explain_response.json()
    assert_keys(explanation, ["score", "model_version", "shap_values", "feature_descriptions"])
    assert "coverage_avg" in explanation["feature_descriptions"]

    info_response = client.get("/api/ml/dqs/model-info")
    assert info_response.status_code == 200
    info = info_response.json()
    assert_keys(info, ["model_type", "model_version", "feature_count", "feature_names"])
    assert info["feature_count"] == len(info["feature_names"])

    invalid_response = client.post(
        "/api/ml/dqs/predict",
        json={**request, "features": {**request["features"], "bug_fix_ratio": 1.5}},
    )
    assert invalid_response.status_code == 422


def test_sentiment_contracts():
    response = client.post(
        "/api/ml/sentiment/analyze",
        json={"commit_message": "fix: great improvement", "commit_id": "commit-1"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert_keys(payload, ["commit_id", "sentiment", "scores", "confidence", "indicators", "timestamp"])
    assert_keys(payload["scores"], ["positive", "negative", "neutral", "compound"])
    assert 0.0 <= payload["confidence"] <= 1.0

    batch_response = client.post(
        "/api/ml/sentiment/analyze/batch",
        json={"messages": ["fix: great improvement"], "commit_ids": ["commit-1"]},
    )
    assert batch_response.status_code == 200
    batch = batch_response.json()
    assert_keys(batch, ["results", "summary", "processed_count"])
    assert batch["processed_count"] == 1
    assert batch["summary"]["positive_count"] == 1

    health_response = client.get("/api/ml/sentiment/health")
    assert health_response.status_code == 200
    assert health_response.json() == {
        "status": "healthy",
        "service": "sentiment_analysis",
        "analyzer": "VADER",
        "test_passed": True,
    }


def test_code_quality_contracts_and_cache_validation():
    response = client.post(
        "/api/ml/code-quality/analyze",
        json={
            "files": [
                {
                    "path": "src/app.py",
                    "content": "def handler(value):\n    return value\n",
                }
            ],
            "coverage_metadata": {"src/app.py": 90.0},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert_keys(
        payload,
        [
            "complexity",
            "security",
            "ownership",
            "hotspots",
            "code_smells",
            "dependency_cycles",
            "semantic_clones",
            "taint_issues",
            "jit_commit_risks",
            "knowledge_decay",
        ],
    )
    assert payload["complexity"][0]["path"] == "src/app.py"

    invalid_response = client.post("/api/ml/code-quality/analyze", json={"files": [{}]})
    assert invalid_response.status_code == 422

    traversal_response = client.delete("/api/ml/code-quality/cache/..%5Coutside")
    assert traversal_response.status_code == 400
    assert "path traversal" in traversal_response.json()["detail"]


def test_telemetry_override_contracts():
    response = client.post(
        "/api/ml/telemetry/override",
        json={
            "score_type": "sqs",
            "target_id": "project-1",
            "original_score": 70.0,
            "corrected_score": 82.0,
            "features": {"coverage": 90.0},
            "notes": "Manual review found newer coverage data",
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "message": "Feedback logged successfully for model retraining",
    }

    invalid_response = client.post(
        "/api/ml/telemetry/override",
        json={
            "score_type": "unknown",
            "target_id": "project-1",
            "original_score": 70.0,
            "corrected_score": 82.0,
            "features": {},
        },
    )
    assert invalid_response.status_code == 400
    assert invalid_response.json()["detail"] == "Invalid score_type. Must be 'sqs' or 'dqs'."


def test_openapi_contract_includes_public_ml_routes():
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]

    assert {
        "/api/ml/",
        "/api/ml/health",
        "/api/ml/classify",
        "/api/ml/classify/batch",
        "/api/ml/anomaly/detect",
        "/api/ml/sqs/predict",
        "/api/ml/sqs/model-info",
        "/api/ml/dqs/predict",
        "/api/ml/dqs/explain",
        "/api/ml/dqs/model-info",
        "/api/ml/sentiment/analyze",
        "/api/ml/sentiment/analyze/batch",
        "/api/ml/sentiment/health",
        "/api/ml/code-quality/analyze",
        "/api/ml/code-quality/cache/{repository_id}",
        "/api/ml/telemetry/override",
    }.issubset(paths.keys())
