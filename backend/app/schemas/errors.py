"""Uniform error response schemas."""

from typing import Any, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """Payload inside uniform error envelope."""

    code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error description")
    details: Optional[Any] = Field(
        None, description="Optional diagnostic details or validation errors"
    )
    request_id: Optional[str] = Field(None, description="Unique identifier for request tracing")


class ErrorEnvelope(BaseModel):
    """Uniform error envelope returned on all 4xx and 5xx responses."""

    error: ErrorDetail
