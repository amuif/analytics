"""File content extraction and sampling service for file classification."""
import io
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
from pydantic import BaseModel


class FileSummary(BaseModel):
    """Extracted file content and structural metadata."""
    filename: str
    extension: str
    size_bytes: int
    format_type: str
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    column_names: Optional[List[str]] = None
    text_sample: str
    metadata: Dict[str, Any] = {}


class ContentExtractor:
    """Safe extraction of sample content from multi-format files."""

    MAX_SAMPLE_CHARS = 4000
    MAX_ROWS_PREVIEW = 20

    @classmethod
    def extract(cls, filename: str, content: bytes) -> FileSummary:
        """Extract structural summary and text representation from raw bytes."""
        ext = Path(filename).suffix.lower()
        size = len(content)

        if size == 0:
            raise ValueError(f"File '{filename}' is empty (0 bytes).")

        if ext in [".csv", ".tsv"] or (b"," in content[:500] and b"\n" in content[:500]):
            try:
                return cls._extract_delimited(filename, ext or ".csv", content, size)
            except Exception:
                pass

        if ext == ".json" or content.strip().startswith((b"{", b"[")):
            try:
                return cls._extract_json(filename, ext or ".json", content, size)
            except Exception:
                pass

        if ext == ".parquet":
            return cls._extract_parquet(filename, ext, content, size)
        elif ext in [".txt", ".log"]:
            return cls._extract_text(filename, ext, content, size)
        else:
            # Fallback text decoding
            return cls._extract_text(filename, ext, content, size, format_type="generic_text")

    @classmethod
    def _extract_delimited(cls, filename: str, ext: str, content: bytes, size: int) -> FileSummary:
        sep = "\t" if ext == ".tsv" else ","
        try:
            # Read sample with pandas
            buffer = io.BytesIO(content)
            df = pd.read_csv(buffer, sep=sep, nrows=cls.MAX_ROWS_PREVIEW, on_bad_lines="skip")
            
            # Count total rows roughly by line breaks if not too large
            line_count = content.count(b"\n")
            
            cols = [str(c) for c in df.columns.tolist()]
            preview_csv = df.head(10).to_csv(index=False)
            
            text_sample = (
                f"File: {filename}\n"
                f"Format: Delimited ({ext})\n"
                f"Columns ({len(cols)}): {', '.join(cols)}\n"
                f"Preview:\n{preview_csv[:cls.MAX_SAMPLE_CHARS]}"
            )
            
            return FileSummary(
                filename=filename,
                extension=ext,
                size_bytes=size,
                format_type="tabular_csv" if ext == ".csv" else "tabular_tsv",
                row_count=line_count,
                column_count=len(cols),
                column_names=cols,
                text_sample=text_sample,
                metadata={"dtypes": {str(k): str(v) for k, v in df.dtypes.items()}}
            )
        except Exception as e:
            # Fallback to plain text read
            return cls._extract_text(filename, ext, content, size, format_type="delimited_raw_text")

    @classmethod
    def _extract_json(cls, filename: str, ext: str, content: bytes, size: int) -> FileSummary:
        try:
            text = content.decode("utf-8", errors="replace")
            parsed = json.loads(text)
            
            row_count = None
            cols = None
            
            if isinstance(parsed, list):
                row_count = len(parsed)
                if parsed and isinstance(parsed[0], dict):
                    cols = list(parsed[0].keys())
                preview_str = json.dumps(parsed[:5], indent=2)
            elif isinstance(parsed, dict):
                cols = list(parsed.keys())
                preview_str = json.dumps({k: parsed[k] for k in list(parsed.keys())[:15]}, indent=2)
            else:
                preview_str = text[:cls.MAX_SAMPLE_CHARS]

            text_sample = (
                f"File: {filename}\n"
                f"Format: JSON\n"
                f"Root Type: {type(parsed).__name__}\n"
                f"Keys/Columns: {cols}\n"
                f"Preview:\n{preview_str[:cls.MAX_SAMPLE_CHARS]}"
            )

            return FileSummary(
                filename=filename,
                extension=ext,
                size_bytes=size,
                format_type="semi_structured_json",
                row_count=row_count,
                column_count=len(cols) if cols else None,
                column_names=cols,
                text_sample=text_sample,
                metadata={"root_type": type(parsed).__name__}
            )
        except Exception:
            return cls._extract_text(filename, ext, content, size, format_type="json_unparsed")

    @classmethod
    def _extract_parquet(cls, filename: str, ext: str, content: bytes, size: int) -> FileSummary:
        try:
            buffer = io.BytesIO(content)
            df = pd.read_parquet(buffer)
            cols = [str(c) for c in df.columns.tolist()]
            preview = df.head(10).to_string()
            
            text_sample = (
                f"File: {filename}\n"
                f"Format: Apache Parquet\n"
                f"Columns: {', '.join(cols)}\n"
                f"Rows: {len(df)}\n"
                f"Preview:\n{preview[:cls.MAX_SAMPLE_CHARS]}"
            )
            
            return FileSummary(
                filename=filename,
                extension=ext,
                size_bytes=size,
                format_type="tabular_parquet",
                row_count=len(df),
                column_count=len(cols),
                column_names=cols,
                text_sample=text_sample,
                metadata={"dtypes": {str(k): str(v) for k, v in df.dtypes.items()}}
            )
        except Exception as e:
            text_sample = f"File: {filename}\nFormat: Parquet (binary extraction failed: {str(e)})\nSize: {size} bytes"
            return FileSummary(
                filename=filename,
                extension=ext,
                size_bytes=size,
                format_type="binary_parquet",
                text_sample=text_sample
            )

    @classmethod
    def _extract_text(cls, filename: str, ext: str, content: bytes, size: int, format_type: str = "plain_text") -> FileSummary:
        try:
            text = content.decode("utf-8")
        except UnicodeDecodeError:
            text = content.decode("latin-1", errors="replace")

        lines = text.splitlines()
        row_count = len(lines)
        sample = text[:cls.MAX_SAMPLE_CHARS]
        
        text_sample = (
            f"File: {filename}\n"
            f"Format: Text/Log\n"
            f"Lines: {row_count}\n"
            f"Content Sample:\n{sample}"
        )

        return FileSummary(
            filename=filename,
            extension=ext,
            size_bytes=size,
            format_type=format_type,
            row_count=row_count,
            text_sample=text_sample,
            metadata={"sample_lines": min(len(lines), 30)}
        )
