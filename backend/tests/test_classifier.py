"""Integration tests for LayaClassifier service and /api/v1/classify/file endpoint."""
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.classifier import laya_service

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def ensure_model_loaded():
    """Ensure Laya model is initialized once for the test session."""
    if not laya_service.is_loaded():
        laya_service.initialize()


def test_health_reports_model_loaded():
    """Verify /health reports model_loaded is True."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True


def test_classify_financial_csv():
    """Verify accurate classification of financial transaction data."""
    csv_bytes = b"transaction_id,account_number,amount_usd,currency,status,created_at\nTX10928,AC88127,12500.00,USD,CLEARED,2026-09-01T10:00:00Z\nTX10929,AC99281,4500.50,USD,PENDING,2026-09-01T10:05:00Z\n"
    files = {"file": ("financial_records.csv", io.BytesIO(csv_bytes), "text/csv")}

    response = client.post("/api/v1/classify/file", files=files)
    assert response.status_code == 200
    data = response.json()

    assert data["filename"] == "financial_records.csv"
    assert data["format_type"] == "tabular_csv"
    assert "classifications" in data

    classifications = data["classifications"]
    assert classifications["domain"]["decision"] == "financial"
    assert classifications["domain"]["confidence"] > 0.5
    assert classifications["data_structure"]["decision"] == "tabular_structured"
    assert data["inference_time_ms"] > 0


def test_classify_customer_support_json():
    """Verify accurate classification of customer support complaints."""
    json_bytes = b"""[
      {
        "ticket_id": "TICKET-4481",
        "customer_email": "john.doe@example.com",
        "subject": "Double charged on my credit card and unable to log in",
        "priority": "HIGH",
        "message": "I was charged twice for the monthly subscription and my account was locked immediately. Please refund and fix this immediately!"
      }
    ]"""
    files = {"file": ("support_complaint.json", io.BytesIO(json_bytes), "application/json")}

    response = client.post("/api/v1/classify/file", files=files)
    assert response.status_code == 200
    data = response.json()

    assert data["format_type"] == "semi_structured_json"
    classifications = data["classifications"]
    assert classifications["domain"]["decision"] == "customer_support"
    assert classifications["action_priority"]["decision"] in ["urgent", "needs_review"]


def test_classify_technical_server_log():
    """Verify accurate classification of technical crash logs."""
    log_bytes = b"""2026-09-26 11:15:02.102 ERROR [EngineWorker-4] ConnectionRefusedError: Failed to connect to Redis cache cluster at 10.0.4.12:6379
Traceback (most recent call last):
  File "/app/cache/redis.py", line 42, in connect
    raise ConnectionRefusedError("Host unreachable")
2026-09-26 11:15:03.450 CRITICAL [SystemMonitor] Node health check failed on cluster worker-us-east-1a
"""
    files = {"file": ("redis_crash.log", io.BytesIO(log_bytes), "text/plain")}

    response = client.post("/api/v1/classify/file", files=files)
    assert response.status_code == 200
    data = response.json()

    assert data["format_type"] in ["plain_text", "generic_text"]
    classifications = data["classifications"]
    assert classifications["domain"]["decision"] == "technical_logs"
    assert classifications["data_structure"]["decision"] == "unstructured_prose"
