"""Data Profiling and Chart Aggregation Service."""
import io
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from app.models.schemas import (
    AnalyticsDashboardData,
    BarChartData,
    ChartDataPoint,
    HistogramBin,
    HistogramData,
    KPICard,
    PieChartData,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    """Extracts numeric distributions, dimensions, and chart aggregates from tabular datasets."""

    @classmethod
    def generate_analytics(
        cls,
        filename: str,
        content: bytes,
        classification_domain: Optional[str] = None
    ) -> Optional[AnalyticsDashboardData]:
        """Profile dataset columns, perform aggregations, and structure chart series."""
        ext = Path(filename).suffix.lower()
        df: Optional[pd.DataFrame] = None

        try:
            if ext in [".csv", ".tsv"] or b"," in content[:500] or b"\t" in content[:500]:
                sep = "\t" if (ext == ".tsv" or (b"\t" in content[:200] and b"," not in content[:200])) else ","
                try:
                    df = pd.read_csv(io.BytesIO(content), sep=sep, on_bad_lines="skip")
                    if df is not None and len(df.columns) < 2:
                        df = None
                except Exception:
                    df = None
            if df is None and ext == ".parquet":
                df = pd.read_parquet(io.BytesIO(content))
            elif df is None and (ext == ".json" or content.strip().startswith((b"{", b"["))):
                data = json.loads(content.decode("utf-8", errors="replace"))
                if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                    df = pd.DataFrame(data)
                elif isinstance(data, dict):
                    for v in data.values():
                        if isinstance(v, list) and len(v) > 0 and isinstance(v[0], dict):
                            df = pd.DataFrame(v)
                            break
        except Exception as e:
            logger.warning(f"Analytics parsing failed for {filename}: {e}")
            return None

        if df is None or df.empty or len(df.columns) < 2:
            return None

        # Clean column names
        df.columns = [str(c).strip() for c in df.columns]

        numeric_cols: List[str] = []
        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]):
                if not str(col).lower().endswith(("id", "code", "zip", "phone", "year")) or str(col).lower() in ["id"]:
                    numeric_cols.append(col)
            else:
                try:
                    converted = pd.to_numeric(df[col].dropna().astype(str).str.replace(r"[$,]", "", regex=True))
                    if len(converted) > 0 and len(converted) == len(df[col].dropna()):
                        df[col] = converted
                        numeric_cols.append(col)
                except Exception:
                    pass

        cat_cols: List[str] = []
        for col in df.columns:
            if col not in numeric_cols and not str(col).lower().endswith(("date", "time", "timestamp")):
                n_unique = df[col].nunique()
                if 1 < n_unique <= 60:
                    cat_cols.append(col)

        def rank_metric(col: str) -> int:
            name = str(col).lower()
            if any(k in name for k in ["revenue", "sales", "total", "amount", "profit", "income"]):
                return 100
            if any(k in name for k in ["quantity", "qty", "units", "volume", "count", "items"]):
                return 90
            if any(k in name for k in ["price", "cost", "fee", "rate"]):
                return 70
            return 10

        def rank_dim(col: str) -> int:
            name = str(col).lower()
            if any(k in name for k in ["category", "dept", "department", "type", "segment", "product_category"]):
                return 100
            if any(k in name for k in ["status", "fulfillment", "state", "region", "warehouse_region"]):
                return 85
            if any(k in name for k in ["product", "item", "name", "channel"]):
                return 75
            return 20

        numeric_cols.sort(key=rank_metric, reverse=True)
        cat_cols.sort(key=rank_dim, reverse=True)

        primary_metric = numeric_cols[0] if numeric_cols else None
        primary_dim = cat_cols[0] if cat_cols else None
        secondary_metric = numeric_cols[1] if len(numeric_cols) > 1 else primary_metric
        secondary_dim = cat_cols[1] if len(cat_cols) > 1 else primary_dim

        # 1. Build Executive KPIs
        kpis: List[KPICard] = []
        total_records = len(df)
        kpis.append(
            KPICard(
                label="Total Records",
                value=f"{total_records:,}",
                numeric_value=float(total_records),
                description="Parsed dataset rows",
                category="volume"
            )
        )

        if primary_metric:
            total_sum = float(df[primary_metric].sum())
            avg_val = float(df[primary_metric].mean())
            is_currency = any(k in str(primary_metric).lower() for k in ["revenue", "price", "amount", "sales", "usd", "cost", "income"])
            prefix = "$" if is_currency else ""
            kpis.append(
                KPICard(
                    label=f"Total {str(primary_metric).replace('_', ' ').title()}",
                    value=f"{prefix}{total_sum:,.2f}" if is_currency else f"{total_sum:,.0f}",
                    numeric_value=round(total_sum, 2),
                    description=f"Aggregate {primary_metric}",
                    category="metric"
                )
            )
            kpis.append(
                KPICard(
                    label=f"Average {str(primary_metric).replace('_', ' ').title()}",
                    value=f"{prefix}{avg_val:,.2f}" if is_currency else f"{avg_val:,.1f}",
                    numeric_value=round(avg_val, 2),
                    description="Mean per unit",
                    category="average"
                )
            )

        if secondary_metric and secondary_metric != primary_metric:
            sec_sum = float(df[secondary_metric].sum())
            is_curr_sec = any(k in str(secondary_metric).lower() for k in ["revenue", "price", "amount", "sales", "usd", "cost"])
            pfx = "$" if is_curr_sec else ""
            kpis.append(
                KPICard(
                    label=f"Total {str(secondary_metric).replace('_', ' ').title()}",
                    value=f"{pfx}{sec_sum:,.2f}" if is_curr_sec else f"{sec_sum:,.0f}",
                    numeric_value=round(sec_sum, 2),
                    description=f"Aggregate {secondary_metric}",
                    category="metric"
                )
            )

        if primary_dim:
            n_unique_dim = int(df[primary_dim].nunique())
            kpis.append(
                KPICard(
                    label=f"Distinct {str(primary_dim).replace('_', ' ').title()}s",
                    value=f"{n_unique_dim}",
                    numeric_value=float(n_unique_dim),
                    description="Unique categories",
                    category="dimension"
                )
            )

        # 2. Bar Chart Data (Aggregation by Primary Dimension)
        bar_chart: Optional[BarChartData] = None
        if primary_dim and primary_metric:
            grouped = df.groupby(primary_dim)[primary_metric].sum().sort_values(ascending=False).head(8)
            points = [
                ChartDataPoint(
                    label=str(k),
                    value=round(float(v), 2),
                    count=int(df[df[primary_dim] == k].shape[0])
                )
                for k, v in grouped.items()
            ]
            bar_chart = BarChartData(
                title=f"{str(primary_metric).replace('_', ' ').title()} by {str(primary_dim).replace('_', ' ').title()}",
                metric_label=str(primary_metric).replace('_', ' ').title(),
                dimension_label=str(primary_dim).replace('_', ' ').title(),
                points=points
            )

        # 3. Pie / Donut Chart Data (Composition / Share)
        pie_chart: Optional[PieChartData] = None
        pie_dim = secondary_dim if secondary_dim and df[secondary_dim].nunique() <= 8 else primary_dim
        if pie_dim:
            counts = df[pie_dim].value_counts().head(6)
            total_ct = float(counts.sum())
            slices = [
                ChartDataPoint(
                    label=str(k),
                    value=float(v),
                    count=int(v),
                    percentage=round(float(v / total_ct * 100), 1) if total_ct > 0 else 0.0
                )
                for k, v in counts.items()
            ]
            pie_chart = PieChartData(
                title=f"Composition by {str(pie_dim).replace('_', ' ').title()} Share",
                dimension_label=str(pie_dim).replace('_', ' ').title(),
                slices=slices
            )

        # 4. Histogram Data (Frequency Distribution of Quantity / Numeric Metric)
        histogram: Optional[HistogramData] = None
        hist_col = None
        for nc in numeric_cols:
            if any(k in str(nc).lower() for k in ["quantity", "qty", "units", "items"]):
                hist_col = nc
                break
        if not hist_col and numeric_cols:
            hist_col = numeric_cols[0]

        if hist_col:
            series_clean = df[hist_col].dropna()
            if len(series_clean) > 2:
                n_bins = min(6, max(3, len(series_clean.unique())))
                counts, bin_edges = np.histogram(series_clean, bins=n_bins)
                bins = []
                for i in range(len(counts)):
                    b_start = round(float(bin_edges[i]), 1)
                    b_end = round(float(bin_edges[i + 1]), 1)
                    bins.append(
                        HistogramBin(
                            bin_start=b_start,
                            bin_end=b_end,
                            bin_label=f"{b_start} - {b_end}",
                            frequency=int(counts[i])
                        )
                    )
                histogram = HistogramData(
                    title=f"Frequency Distribution of {str(hist_col).replace('_', ' ').title()}",
                    metric_label=str(hist_col).replace('_', ' ').title(),
                    total_samples=len(series_clean),
                    bins=bins
                )

        headline = f"Analyzed {total_records} rows across {len(numeric_cols)} numeric metric(s) and {len(cat_cols)} dimension(s)."
        recommendation = f"Laya recommends Bar Comparison by '{primary_dim or 'category'}' and Distribution Analysis of '{primary_metric or 'volume'}'."

        return AnalyticsDashboardData(
            headline=headline,
            laya_recommendation=recommendation,
            kpis=kpis,
            bar_chart=bar_chart,
            pie_chart=pie_chart,
            histogram=histogram,
            detected_metrics=[str(c) for c in numeric_cols],
            detected_dimensions=[str(c) for c in cat_cols]
        )
