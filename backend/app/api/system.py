"""System metadata, configuration, and WebSocket statistics endpoints."""

import platform
import sys
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status

from app.core.config import Settings, get_settings
from app.schemas.system import (
    CapabilityMap,
    ConfigResponse,
    InfoResponse,
    SubsystemCapability,
    WsStatsResponse,
)
from app.services.ws_manager import ws_manager

router = APIRouter(prefix="/v1", tags=["System"])

_START_TIME = time.time()


def get_utc_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


@router.get(
    "/info",
    response_model=InfoResponse,
    status_code=status.HTTP_200_OK,
    summary="Application & Subsystem Info",
    description="Returns runtime versioning, host platform, uptime, and honest capability status.",
)
async def get_info(settings: Settings = Depends(get_settings)) -> InfoResponse:
    """Provide application information and honest capability manifest."""
    capabilities = CapabilityMap(
        ros=SubsystemCapability(
            status="not_implemented",
            planned_phase=4,
            description="rosbridge suite WebSocket client for ROS 1 Melodic/Noetic",
        ),
        camera=SubsystemCapability(
            status="not_implemented",
            planned_phase=5,
            description="Low-latency MJPEG / WebRTC live video streaming pipeline",
        ),
        lidar=SubsystemCapability(
            status="not_implemented",
            planned_phase=6,
            description="2D LaserScan visualization and obstacle proximity alerting",
        ),
        mapping=SubsystemCapability(
            status="not_implemented",
            planned_phase=7,
            description="2D SLAM occupancy grid streaming and map library management",
        ),
        control=SubsystemCapability(
            status="not_implemented",
            planned_phase=8,
            description="Virtual touch joystick and velocity frame rate limiter",
        ),
        navigation=SubsystemCapability(
            status="not_implemented",
            planned_phase=9,
            description="2D Nav Goal dispatch, waypoint sequence execution, and pose monitor",
        ),
    )

    return InfoResponse(
        app_name=settings.APP_NAME,
        app_version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        python_version=sys.version.split()[0],
        platform=platform.platform(),
        uptime_seconds=round(time.time() - _START_TIME, 2),
        server_time=get_utc_iso(),
        capabilities=capabilities,
    )


@router.get(
    "/config",
    response_model=ConfigResponse,
    status_code=status.HTTP_200_OK,
    summary="Effective Non-Secret Configuration",
    description="Exposes safe operational settings without leaking passwords, paths, or keys.",
)
async def get_config(settings: Settings = Depends(get_settings)) -> ConfigResponse:
    """Return sanitized client-safe configuration parameters."""
    origins = (
        settings.ALLOWED_ORIGINS
        if isinstance(settings.ALLOWED_ORIGINS, list)
        else [settings.ALLOWED_ORIGINS]
    )

    return ConfigResponse(
        app_name=settings.APP_NAME,
        environment=settings.ENVIRONMENT,
        debug=settings.DEBUG,
        log_level=settings.LOG_LEVEL,
        ws_heartbeat_interval_s=settings.WS_HEARTBEAT_INTERVAL_S,
        ws_heartbeat_timeout_s=settings.WS_HEARTBEAT_TIMEOUT_S,
        ws_max_connections=settings.WS_MAX_CONNECTIONS,
        ws_max_message_bytes=settings.WS_MAX_MESSAGE_BYTES,
        allowed_origins_count=len(origins),
    )


@router.get(
    "/ws/stats",
    response_model=WsStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="WebSocket Connection Statistics",
    description="Returns aggregate connected client counts and active room distribution.",
)
async def get_ws_stats(settings: Settings = Depends(get_settings)) -> WsStatsResponse:
    """Return WebSocket connection and room subscription metrics."""
    return WsStatsResponse(
        total_connections=ws_manager.connection_count,
        max_connections=settings.WS_MAX_CONNECTIONS,
        rooms=ws_manager.get_room_counts(),
    )
