"""Liveness and readiness health check endpoints."""

import os
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status

from app.core.config import Settings, get_settings
from app.core.errors import ServiceUnavailableError
from app.schemas.health import HealthResponse, ReadinessComponentStatus, ReadinessResponse
from app.services.ws_manager import ws_manager

router = APIRouter(tags=["Health"])


def get_utc_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness Probe",
    description="Returns HTTP 200 if the FastAPI application server process is running.",
)
async def get_health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Liveness probe returning application version and timestamp."""
    return HealthResponse(
        status="ok",
        timestamp=get_utc_iso(),
        version=settings.APP_VERSION,
    )


@router.get(
    "/health/ready",
    response_model=ReadinessResponse,
    status_code=status.HTTP_200_OK,
    summary="Readiness Probe",
    description="Evaluates readiness of backend services. Returns 503 if not ready.",
)
async def get_readiness(settings: Settings = Depends(get_settings)) -> ReadinessResponse:
    """Readiness probe verifying configuration, storage path access, and WebSocket manager."""
    components = {}
    is_ready = True

    # 1. Configuration check
    components["settings"] = ReadinessComponentStatus(
        status="ok",
        message="Application settings loaded and validated",
    )

    # 2. Data directory storage access check
    try:
        os.makedirs(settings.DATA_DIR, exist_ok=True)
        test_file = os.path.join(settings.DATA_DIR, ".write_test")
        with open(test_file, "w") as f:
            f.write(str(time.time()))
        os.remove(test_file)
        components["storage"] = ReadinessComponentStatus(
            status="ok",
            message=f"Storage directory '{settings.DATA_DIR}' is writable",
        )
    except Exception as e:
        is_ready = False
        components["storage"] = ReadinessComponentStatus(
            status="not_ready",
            message=f"Storage directory write failure: {e}",
        )

    # 3. WebSocket Manager check
    if ws_manager._is_running:
        components["ws_manager"] = ReadinessComponentStatus(
            status="ok",
            message="WebSocket manager background tasks running",
        )
    else:
        components["ws_manager"] = ReadinessComponentStatus(
            status="degraded",
            message="WebSocket manager background tasks inactive",
        )

    # 4. Robot connection status (Honest non-integrated state)
    components["robot"] = ReadinessComponentStatus(
        status="not_integrated",
        message="Robot hardware connection scheduled for Phase 4 (rosbridge over WebSocket)",
    )

    if not is_ready:
        raise ServiceUnavailableError(
            message="One or more critical backend dependencies are not ready",
            details=components,
        )

    return ReadinessResponse(
        status="ready",
        timestamp=get_utc_iso(),
        components=components,
    )
