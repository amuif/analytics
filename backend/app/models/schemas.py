"""Pydantic data models for requests, responses, and visual analytics charts."""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str = "ok"
    service: str = "analytics-classifier"
    version: str = "1.0.0"
    model_loaded: bool = False
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FileSummaryResponse(BaseModel):
    """Extracted file summary response schema."""
    filename: str
    extension: str
    size_bytes: int
    format_type: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    column_names: Optional[List[str]] = None
    text_sample_preview: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ClassificationDecision(BaseModel):
    """Single decision dimension output with confidence score."""
    decision: str
    confidence: float
    probabilities: Optional[Dict[str, float]] = None


# --- Visual Analytics & Charting Schemas ---

class KPICard(BaseModel):
    """Key Performance Indicator summary metric."""
    label: str
    value: str
    numeric_value: Optional[float] = None
    description: Optional[str] = None
    category: str = "general"


class ChartDataPoint(BaseModel):
    """Single bar or slice data point."""
    label: str
    value: float
    percentage: Optional[float] = None
    count: Optional[int] = None


class BarChartData(BaseModel):
    """Aggregated bar chart data."""
    title: str
    metric_label: str
    dimension_label: str
    points: List[ChartDataPoint]


class PieChartData(BaseModel):
    """Aggregated pie / donut composition data."""
    title: str
    dimension_label: str
    slices: List[ChartDataPoint]


class HistogramBin(BaseModel):
    """Single bucket in a numeric frequency distribution."""
    bin_start: float
    bin_end: float
    bin_label: str
    frequency: int


class HistogramData(BaseModel):
    """Numeric frequency distribution histogram data."""
    title: str
    metric_label: str
    total_samples: int
    bins: List[HistogramBin]


class AnalyticsDashboardData(BaseModel):
    """Full visual analytics dashboard payload."""
    headline: str
    laya_recommendation: str
    kpis: List[KPICard]
    bar_chart: Optional[BarChartData] = None
    pie_chart: Optional[PieChartData] = None
    histogram: Optional[HistogramData] = None
    detected_metrics: List[str] = Field(default_factory=list)
    detected_dimensions: List[str] = Field(default_factory=list)


class FileClassificationResponse(BaseModel):
    """Complete file classification response enriched with visual analytics."""
    filename: str
    size_bytes: int
    format_type: str
    classifications: Dict[str, ClassificationDecision]
    inference_time_ms: float
    file_summary: FileSummaryResponse
    analytics: Optional[AnalyticsDashboardData] = None


class BatchDemoResult(BaseModel):
    """Result for demo file evaluation."""
    filename: str
    status: str
    expected: Dict[str, str]
    predicted: Dict[str, str]
    confidences: Dict[str, float]
    matches: Dict[str, bool]
    all_matched: bool


class DemoEvaluationResponse(BaseModel):
    """Overall demo batch evaluation response."""
    total_files: int
    passed_files: int
    failed_files: int
    accuracy_percentage: float
    results: List[BatchDemoResult]
