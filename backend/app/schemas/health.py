"""Health and readiness check response schemas."""

from typing import Dict, Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """Liveness probe response."""

    status: Literal["ok"] = "ok"
    timestamp: str = Field(..., description="Server UTC time in ISO 8601 format")
    version: str = Field(..., description="Application semantic version")


class ReadinessComponentStatus(BaseModel):
    """Status of an individual backend subsystem."""

    status: Literal["ok", "degraded", "not_ready", "not_integrated"]
    message: str


class ReadinessResponse(BaseModel):
    """Readiness probe response reflecting subsystem availability."""

    status: Literal["ready", "not_ready"]
    timestamp: str = Field(..., description="Server UTC time in ISO 8601 format")
    components: Dict[str, ReadinessComponentStatus]
