"""WebSocket message envelope and payload schemas."""

from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class WsEnvelope(BaseModel):
    """Standardized WebSocket framing envelope (v1)."""

    v: int = Field(default=1, description="Protocol envelope version")
    type: str = Field(..., description="Message type identifier")
    id: Optional[str] = Field(default=None, description="Optional client-specified correlation ID")
    channel: Optional[str] = Field(default=None, description="Target or source channel name")
    ts: str = Field(..., description="UTC ISO 8601 timestamp")
    payload: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Typed message payload"
    )
