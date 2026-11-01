"""Application settings and configuration management."""

from functools import lru_cache
from typing import List, Optional, Union

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration with environment variable support."""

    # Identity
    APP_NAME: str = "JetRacer Control Center Backend"
    APP_VERSION: str = "0.2.1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Server binding
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Cross-Origin Resource Sharing (CORS)
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost",
        "capacitor://localhost",
    ]

    # Storage paths
    DATA_DIR: str = "./data"
    LOG_DIR: str = "./logs"
    DATABASE_URL: str = "sqlite:///./data/jetracer.db"

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "text"  # "text" | "json"
    LOG_TO_FILE: bool = False

    # WebSocket limits and watchdog intervals
    WS_HEARTBEAT_INTERVAL_S: float = 15.0
    WS_HEARTBEAT_TIMEOUT_S: float = 30.0
    WS_MAX_CONNECTIONS: int = 10
    WS_MAX_MESSAGE_BYTES: int = 65536
    WS_SEND_QUEUE_SIZE: int = 100

    # Phase 4 placeholder: rosbridge WebSocket endpoint (None until inspected on physical robot)
    ROSBRIDGE_URL: Optional[str] = None

    # Phase 13 placeholder: authentication and secret keys (disabled in Phase 2)
    AUTH_ENABLED: bool = False
    SECRET_KEY: Optional[str] = None

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        """Parse comma-separated origin strings into a list."""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return [v] if isinstance(v, str) else []

    @model_validator(mode="after")
    def validate_production_security(self) -> "Settings":
        """Enforce strict security constraints in production."""
        origins = (
            self.ALLOWED_ORIGINS
            if isinstance(self.ALLOWED_ORIGINS, list)
            else [self.ALLOWED_ORIGINS]
        )
        if self.ENVIRONMENT.lower() == "production" and "*" in origins:
            raise ValueError(
                "Security violation: Wildcard '*' in ALLOWED_ORIGINS is prohibited in production."
            )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings instance."""
    return Settings()
