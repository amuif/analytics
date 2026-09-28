"""Unit tests for ContentExtractor service."""
import pytest
from app.services.extractor import ContentExtractor, FileSummary


def test_extractor_csv():
    csv_bytes = b"user_id,email,sign_up_date\n1,u1@test.com,2026-01-01\n2,u2@test.com,2026-01-02\n"
    summary = ContentExtractor.extract("users.csv", csv_bytes)

    assert isinstance(summary, FileSummary)
    assert summary.filename == "users.csv"
    assert summary.extension == ".csv"
    assert summary.format_type == "tabular_csv"
    assert summary.column_count == 3
    assert "email" in summary.column_names
    assert summary.row_count >= 2


def test_extractor_tsv():
    tsv_bytes = b"colA\tcolB\tcolC\n100\t200\t300\n400\t500\t600\n"
    summary = ContentExtractor.extract("data.tsv", tsv_bytes)

    assert summary.extension == ".tsv"
    assert summary.format_type == "tabular_tsv"
    assert summary.column_count == 3
    assert "colA" in summary.column_names


def test_extractor_json_array():
    json_bytes = b'[{"key1": "val1", "key2": 123}, {"key1": "val2", "key2": 456}]'
    summary = ContentExtractor.extract("items.json", json_bytes)

    assert summary.extension == ".json"
    assert summary.format_type == "semi_structured_json"
    assert summary.row_count == 2
    assert "key1" in summary.column_names


def test_extractor_json_object():
    json_bytes = b'{"status": "ok", "metrics": {"cpu": 12.5, "mem": 45.2}}'
    summary = ContentExtractor.extract("health.json", json_bytes)

    assert summary.extension == ".json"
    assert summary.format_type == "semi_structured_json"
    assert "status" in summary.column_names
    assert summary.metadata["root_type"] == "dict"


def test_extractor_text_log():
    log_bytes = b"2026-09-26 12:00:00 [INFO] System initialized\n2026-09-26 12:00:01 [DEBUG] Listening on port 8000"
    summary = ContentExtractor.extract("server.log", log_bytes)

    assert summary.extension == ".log"
    assert summary.row_count == 2
    assert "System initialized" in summary.text_sample


def test_extractor_empty_raises_value_error():
    with pytest.raises(ValueError) as exc:
        ContentExtractor.extract("empty.txt", b"")
    assert "empty" in str(exc.value).lower()
