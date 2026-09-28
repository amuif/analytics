"""Integration tests for FastAPI core and file ingestion endpoints."""
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify root status response."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "Analytics Content Classifier"
    assert "health" in data


def test_health_endpoint():
    """Verify health probe response."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Analytics Content Classifier"


def test_upload_and_parse_csv():
    """Verify CSV file upload and schema extraction."""
    csv_content = b"id,name,amount,status\n1,Alice,150.50,completed\n2,Bob,45.00,pending\n3,Charlie,99.99,refunded\n"
    files = {"file": ("test_transactions.csv", io.BytesIO(csv_content), "text/csv")}
    
    response = client.post("/api/v1/files/parse", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "test_transactions.csv"
    assert data["extension"] == ".csv"
    assert data["format_type"] == "tabular_csv"
    assert data["column_count"] == 4
    assert "amount" in data["column_names"]
    assert data["row_count"] >= 3


def test_upload_and_parse_json():
    """Verify JSON file upload and key extraction."""
    json_content = b'[{"customer_id": "C001", "ticket_priority": "urgent", "issue": "Payment failed"}]'
    files = {"file": ("tickets.json", io.BytesIO(json_content), "application/json")}
    
    response = client.post("/api/v1/files/parse", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "tickets.json"
    assert data["extension"] == ".json"
    assert data["format_type"] == "semi_structured_json"
    assert data["row_count"] == 1
    assert "customer_id" in data["column_names"]


def test_upload_and_parse_text():
    """Verify Plain text / log upload."""
    text_content = b"2026-09-26 10:00:01 INFO [Auth] User login successful for admin\n2026-09-26 10:01:05 WARN [Auth] Failed attempt for user test"
    files = {"file": ("system.log", io.BytesIO(text_content), "text/plain")}
    
    response = client.post("/api/v1/files/parse", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["filename"] == "system.log"
    assert data["extension"] == ".log"
    assert data["row_count"] == 2


def test_upload_empty_file_rejected():
    """Verify empty file raises 400."""
    files = {"file": ("empty.csv", io.BytesIO(b""), "text/csv")}
    response = client.post("/api/v1/files/parse", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_unsupported_file_extension():
    """Verify invalid file type returns 415."""
    files = {"file": ("unsupported.exe", io.BytesIO(b"binarycontent"), "application/octet-stream")}
    response = client.post("/api/v1/files/parse", files=files)
    assert response.status_code == 415
