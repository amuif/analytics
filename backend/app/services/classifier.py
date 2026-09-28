"""LayaClassifier service for rapid non-autoregressive content classification."""
import logging
import time
from typing import Any, Dict, Optional

from app.core.config import settings
from app.models.schemas import (
    ClassificationDecision,
    FileClassificationResponse,
    FileSummaryResponse,
)
from app.services.extractor import FileSummary

logger = logging.getLogger(__name__)


class LayaService:
    """Singleton service wrapping the Laya System 1 decision engine."""

    _instance: Optional["LayaService"] = None

    def __init__(self):
        self.agent: Any = None
        self._is_loaded: bool = False
        self._questions: Dict[str, Any] = self._build_questions()

    @classmethod
    def get_instance(cls) -> "LayaService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def is_loaded(self) -> bool:
        return self._is_loaded

    def _build_questions(self) -> Dict[str, Any]:
        """Define structured decision dimensions and criteria."""
        return {
            "domain": {
                "type": "choice",
                "instructions": "What is the primary business or data domain of the file?",
                "criteria": {
                    "financial": "corporate finance, earnings, invoices, accounting, transactions, revenue ledgers",
                    "customer_support": "support tickets, customer complaints, helpdesk queries, user disputes",
                    "technical_logs": "server logs, crash dumps, security audit logs, stack traces, system telemetry",
                    "hr_operations": "employee reviews, salaries, talent management, performance feedback, resumes"
                }
            },
            "sensitivity": {
                "type": "choice",
                "instructions": "What is the confidentiality or sensitivity level of the data?",
                "criteria": {
                    "public": "publicly available datasets, marketing content, open documentation",
                    "internal": "standard internal operations, non-sensitive internal logs or procedures",
                    "confidential_pii": "personally identifiable customer or employee information (names, emails, SSN)",
                    "restricted_financial": "sensitive revenue, bank transactions, confidential payroll, profit figures"
                }
            },
            "data_structure": {
                "type": "choice",
                "instructions": "What is the underlying data structure of the content?",
                "criteria": {
                    "tabular_structured": "delimited rows and columns, CSV, TSV, Parquet tables",
                    "semi_structured_json": "nested objects, key-value trees, JSON payloads",
                    "unstructured_prose": "free-form narrative text, documents, meeting notes, memos"
                }
            },
            "action_priority": {
                "type": "choice",
                "instructions": "What level of urgency or priority does this file require?",
                "criteria": {
                    "routine": "standard regular operations, recurring reports, batch records",
                    "urgent": "critical grievance, production outage, security breach, immediate escalation",
                    "needs_review": "flagged for audit, anomaly, or compliance verification"
                }
            }
        }

    def initialize(self) -> None:
        """Load the Laya model into memory."""
        if self._is_loaded:
            return

        try:
            import laya
            logger.info(f"Loading Laya model: {settings.LAYA_MODEL_NAME}...")
            start_t = time.perf_counter()
            self.agent = laya.load(
                settings.LAYA_MODEL_NAME,
                subfolder=settings.LAYA_SUBFOLDER
            )
            self._is_loaded = True
            load_ms = (time.perf_counter() - start_t) * 1000
            logger.info(f"Laya model loaded successfully in {load_ms:.2f}ms.")
        except Exception as e:
            logger.error(f"Failed to load Laya model: {e}")
            self._is_loaded = False
            raise e

    def classify_file(self, summary: FileSummary) -> FileClassificationResponse:
        """Run single-pass decision classification over extracted file summary."""
        if not self._is_loaded or self.agent is None:
            self.initialize()

        state = summary.text_sample
        start_time = time.perf_counter()
        
        raw_result = self.agent.predict(state, self._questions)
        inference_time_ms = round((time.perf_counter() - start_time) * 1000, 2)

        answers = raw_result.get("answers", {})
        decisions: Dict[str, ClassificationDecision] = {}

        for dim_name in self._questions.keys():
            dim_data = answers.get(dim_name, {})
            chosen = dim_data.get("choice", "unknown")
            # Use calibrated answer_confidence if present, or fallback to confidence
            conf = float(dim_data.get("answer_confidence", dim_data.get("confidence", 0.0)))
            probs = {k: round(float(v), 4) for k, v in dim_data.get("probabilities", {}).items()}

            decisions[dim_name] = ClassificationDecision(
                decision=chosen,
                confidence=round(conf, 4),
                probabilities=probs
            )

        summary_response = FileSummaryResponse(
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

        return FileClassificationResponse(
            filename=summary.filename,
            size_bytes=summary.size_bytes,
            format_type=summary.format_type,
            classifications=decisions,
            inference_time_ms=inference_time_ms,
            file_summary=summary_response
        )


laya_service = LayaService.get_instance()
