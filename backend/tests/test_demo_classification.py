"""Integration tests for demo file evaluation suite and ground truth validation."""
from fastapi.testclient import TestClient
from app.main import app
from app.services.classifier import laya_service

client = TestClient(app)


def setup_module():
    """Pre-initialize model once before test run."""
    if not laya_service.is_loaded():
        laya_service.initialize()


def test_demo_batch_classification_endpoint():
    """Verify that all demo files pass their expected classifications via /api/v1/classify/demo."""
    response = client.get("/api/v1/classify/demo")
    assert response.status_code == 200
    data = response.json()

    assert data["total_files"] == 5
    print("\n--- Demo Evaluation Results ---")
    for r in data["results"]:
        print(f"File: {r['filename']} | Status: {r['status']}")
        for dim, matched in r["matches"].items():
            print(f"  [{'PASS' if matched else 'FAIL'}] {dim}: expected='{r['expected'][dim]}', predicted='{r['predicted'].get(dim)}' (conf: {r['confidences'].get(dim)})")

    # Assert accuracy
    assert data["passed_files"] == 5, f"Expected 5 passed files, but got {data['passed_files']} (Accuracy: {data['accuracy_percentage']}%)"
    assert data["accuracy_percentage"] == 100.0
