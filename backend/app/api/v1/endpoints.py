"""FastAPI v1 API routes."""
import asyncio
import json
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.models.schemas import (
    BatchDemoResult,
    DemoEvaluationResponse,
    FileClassificationResponse,
    FileSummaryResponse,
)
from app.services.analytics import AnalyticsService
from app.services.classifier import laya_service
from app.services.extractor import ContentExtractor

router = APIRouter()


@router.post(
    "/files/parse",
    response_model=FileSummaryResponse,
    summary="Upload and extract structural file preview",
    description="Uploads a dataset or document file and extracts metadata, schema, and sample preview.",
)
async def parse_uploaded_file(file: UploadFile = File(...)):
    """Parse an uploaded file and extract summary/schema."""
    filename = file.filename or "uploaded_dataset.csv"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    try:
        summary = ContentExtractor.extract(file.filename, content)
        return FileSummaryResponse(
            filename=summary.filename,
            extension=summary.extension,
            size_bytes=summary.size_bytes,
            format_type=summary.format_type,
            row_count=summary.row_count,
            column_count=summary.column_count,
            column_names=summary.column_names,
            text_sample_preview=summary.text_sample[:1000],
            metadata=summary.metadata
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )


@router.post(
    "/classify/file",
    response_model=FileClassificationResponse,
    summary="Classify uploaded file content with LayaClassifier",
    description="Uploads a file, extracts its structural preview, and runs single-pass LayaClassifier System 1 decision engine.",
)
async def classify_file(file: UploadFile = File(...)):
    """Classify an uploaded file across business domain, sensitivity, structure, and action priority."""
    filename = file.filename or "uploaded_dataset.csv"
    ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file extension '{ext}'. Allowed: {', '.join(settings.ALLOWED_EXTENSIONS)}"
        )

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_SIZE_MB}MB."
        )

    try:
        summary = ContentExtractor.extract(filename, content)
        classification_result = laya_service.classify_file(summary)
        domain_decision = classification_result.classifications.get("domain").decision if classification_result.classifications.get("domain") else None
        classification_result.analytics = AnalyticsService.generate_analytics(
            filename, content, domain_decision
        )
        return classification_result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification failed: {str(e)}"
        )


@router.get(
    "/analytics/demo/zee",
    response_model=FileClassificationResponse,
    summary="Directly load and analyze ZEE E-Commerce Report demo",
    description="Loads the curated ZEE e-commerce sales report and returns Laya classification with complete visual analytics."
)
async def load_zee_demo_analytics():
    """Load and analyze ZEE e-commerce report demo."""
    file_path = settings.DEMO_FILES_DIR / "zee_ecommerce_report_2026.csv"
    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ZEE demo file not found."
        )

    with open(file_path, "rb") as f:
        content = f.read()

    summary = ContentExtractor.extract("zee_ecommerce_report_2026.csv", content)
    classification_result = laya_service.classify_file(summary)
    domain_decision = classification_result.classifications.get("domain").decision if classification_result.classifications.get("domain") else None
    classification_result.analytics = AnalyticsService.generate_analytics(
        "zee_ecommerce_report_2026.csv", content, domain_decision
    )
    return classification_result


def _evaluate_demo_item(item: dict) -> BatchDemoResult:
    """Helper to evaluate a single demo item against ground truth."""
    filename = item["filename"]
    expected = item["expected"]
    file_path = settings.DEMO_FILES_DIR / filename

    if not file_path.exists():
        return BatchDemoResult(
            filename=filename,
            status="file_missing",
            expected=expected,
            predicted={},
            confidences={},
            matches={},
            all_matched=False
        )

    try:
        with open(file_path, "rb") as f:
            content = f.read()

        summary = ContentExtractor.extract(filename, content)
        resp = laya_service.classify_file(summary)

        predicted: dict = {}
        confidences: dict = {}
        matches: dict = {}

        for dim, exp_val in expected.items():
            pred_val = resp.classifications.get(dim).decision if resp.classifications.get(dim) else ""
            conf_val = resp.classifications.get(dim).confidence if resp.classifications.get(dim) else 0.0
            predicted[dim] = pred_val
            confidences[dim] = conf_val
            matches[dim] = (pred_val == exp_val)

        all_matched = all(matches.values())
        return BatchDemoResult(
            filename=filename,
            status="passed" if all_matched else "mismatched",
            expected=expected,
            predicted=predicted,
            confidences=confidences,
            matches=matches,
            all_matched=all_matched
        )
    except Exception as e:
        return BatchDemoResult(
            filename=filename,
            status=f"error: {str(e)}",
            expected=expected,
            predicted={},
            confidences={},
            matches={},
            all_matched=False
        )


@router.get(
    "/classify/demo",
    response_model=DemoEvaluationResponse,
    summary="Batch evaluate all demo files against ground truth manifest",
    description="Loads all curated demo files from demo_files directory, runs LayaClassifier, and compares predictions against manifest ground truth.",
)
async def evaluate_demo_files():
    """Execute automated classification over demo files and compute accuracy."""
    manifest_path = settings.DEMO_FILES_DIR / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Demo manifest file not found at '{manifest_path}'."
        )

    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read demo manifest: {str(e)}"
        )

    results = []
    passed_count = 0
    items = manifest.get("files", [])
    total_files = len(items)

    for item in items:
        res = _evaluate_demo_item(item)
        if res.all_matched:
            passed_count += 1
        results.append(res)

    accuracy = round((passed_count / total_files * 100) if total_files > 0 else 0.0, 2)

    return DemoEvaluationResponse(
        total_files=total_files,
        passed_files=passed_count,
        failed_files=total_files - passed_count,
        accuracy_percentage=accuracy,
        results=results
    )


@router.get(
    "/classify/demo/stream",
    summary="Live stream evaluation of demo files (SSE)",
    description="Streams Server-Sent Events (SSE) in real time as Laya classifies each individual demo file.",
)
async def stream_evaluate_demo_files():
    """Stream live classification events as each demo file is processed."""
    manifest_path = settings.DEMO_FILES_DIR / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo manifest file not found."
        )

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    items = manifest.get("files", [])
    total = len(items)

    async def event_generator():
        # Emit initial suite info
        initial_payload = {
            "type": "suite_start",
            "total": total,
            "filenames": [it["filename"] for it in items]
        }
        yield f"data: {json.dumps(initial_payload)}\n\n"
        await asyncio.sleep(0.1)

        passed = 0
        for idx, it in enumerate(items):
            # Emit starting file event
            start_payload = {
                "type": "file_start",
                "filename": it["filename"],
                "index": idx,
                "total": total
            }
            yield f"data: {json.dumps(start_payload)}\n\n"
            await asyncio.sleep(0.05)

            # Perform single classification
            res = _evaluate_demo_item(it)
            if res.all_matched:
                passed += 1

            result_payload = {
                "type": "file_complete",
                "filename": it["filename"],
                "index": idx,
                "total": total,
                "data": res.model_dump()
            }
            yield f"data: {json.dumps(result_payload)}\n\n"
            await asyncio.sleep(0.1)

        # Emit completion summary
        accuracy = round((passed / total * 100) if total > 0 else 0.0, 2)
        done_payload = {
            "type": "suite_complete",
            "total": total,
            "passed": passed,
            "failed": total - passed,
            "accuracy": accuracy
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
