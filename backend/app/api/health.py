"""Health check API endpoint."""

from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=Dict[str, Any])
async def get_health() -> Dict[str, Any]:
    """Return backend operational status and metadata."""
    return {
        "status": "ok",
        "service": "jetracer-control-center-backend",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
