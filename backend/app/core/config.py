"""Application configuration settings."""
from pathlib import Path
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for Analytics backend."""
    
    PROJECT_NAME: str = "Analytics Content Classifier"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server configs
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    
    # Allowed CORS Origins
    CORS_ORIGINS: List[str] = ["*"]
    
    # Laya model settings
    LAYA_MODEL_NAME: str = "convaiinnovations/laya"
    LAYA_SUBFOLDER: Optional[str] = None
    LAYA_DEVICE: str = "auto"
    
    # File upload limits
    MAX_UPLOAD_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: List[str] = [
        ".csv", ".tsv", ".txt", ".json", ".parquet", ".log", ".blob", ""
    ]
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    DEMO_FILES_DIR: Path = BASE_DIR.parent / "demo_files"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
