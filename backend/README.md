# Analytics Content Classifier Backend (FastAPI + Laya)

High-performance, non-autoregressive "System 1" file content classification service built with **FastAPI** and powered by **LayaClassifier** (`convaiinnovations/laya`).

---

## 1. Overview

This service replaces the initial SvelteKit frontend data handler with a specialized Python FastAPI backend capable of ingesting diverse dataset and document formats (`.csv`, `.tsv`, `.parquet`, `.json`, `.txt`, `.log`), extracting structural previews, and performing instantaneous schema-based decision classification.

### Classification Dimensions
Every uploaded file is evaluated across 4 dimensions:
1. **Domain**: `financial`, `customer_support`, `technical_logs`, `hr_operations`
2. **Sensitivity**: `public`, `internal`, `confidential_pii`, `restricted_financial`
3. **Data Structure**: `tabular_structured`, `semi_structured_json`, `unstructured_prose`
4. **Action Priority**: `routine`, `urgent`, `needs_review`

---

## 2. Directory Layout

```text
D:\Work\analytics\
├── backend/
│   ├── app/
│   │   ├── api/v1/endpoints.py    # Route definitions (parse, classify, demo)
│   │   ├── core/config.py         # Application settings
│   │   ├── models/schemas.py      # Pydantic data schemas
│   │   ├── services/
│   │   │   ├── classifier.py      # LayaService singleton wrapper
│   │   │   └── extractor.py       # Multi-format content extractor
│   │   └── main.py                # FastAPI entrypoint and lifespan management
│   ├── tests/
│   │   ├── test_api_ingestion.py  # Ingestion and health integration tests
│   │   ├── test_classifier.py     # LayaClassifier inference tests
│   │   ├── test_demo_classification.py # Demo batch evaluation tests
│   │   └── test_extractor.py      # ContentExtractor unit tests
│   ├── requirements.txt           # Python package requirements
│   ├── run.ps1 / run.sh           # Convenience startup scripts
│   └── .env.example               # Environment variables example
└── demo_files/                    # Curated ground-truth test datasets
    ├── financial_statement_2026.csv
    ├── customer_dispute_ticket.json
    ├── server_syslog_auth_failure.log
    ├── employee_review_notes.txt
    ├── sales_order_summary.csv
    └── manifest.json              # Ground truth labels & confidence thresholds
```

---

## 3. Quick Start

### Installation
Ensure Python 3.10+ is installed:
```powershell
cd D:\Work\analytics\backend
pip install -r requirements.txt
```

### Running the Server
PowerShell:
```powershell
.\run.ps1
```
Or directly via Uvicorn:
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The interactive OpenAPI documentation will be accessible at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

---

## 4. API Endpoints

### `POST /api/v1/classify/file`
Upload a file (`multipart/form-data`) and receive instant classification decisions, calibrated confidence scores, and structural summaries.

**Example Request (cURL):**
```bash
curl -X POST "http://localhost:8000/api/v1/classify/file" \
  -F "file=@demo_files/financial_statement_2026.csv"
```

**Example Response:**
```json
{
  "filename": "financial_statement_2026.csv",
  "size_bytes": 439,
  "format_type": "tabular_csv",
  "classifications": {
    "domain": {
      "decision": "financial",
      "confidence": 0.8717,
      "probabilities": { "financial": 0.8717, "customer_support": 0.0382, ... }
    },
    "sensitivity": {
      "decision": "restricted_financial",
      "confidence": 0.7091,
      "probabilities": { "restricted_financial": 0.7091, "internal": 0.1420, ... }
    },
    "data_structure": {
      "decision": "tabular_structured",
      "confidence": 0.9395,
      "probabilities": { "tabular_structured": 0.9395, ... }
    },
    "action_priority": {
      "decision": "routine",
      "confidence": 0.8405,
      "probabilities": { "routine": 0.8405, ... }
    }
  },
  "inference_time_ms": 38.45,
  "file_summary": { ... }
}
```

### `GET /api/v1/classify/demo`
Automatically evaluates all files in `demo_files/` against `manifest.json` and outputs a complete scorecard with accuracy percentage.

---

## 5. Running the Automated Test Suite

Run all unit, integration, and demo classification tests:
```powershell
pytest -v
```
