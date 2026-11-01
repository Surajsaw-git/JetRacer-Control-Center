"""System information and configuration schemas."""

from typing import Dict

from pydantic import BaseModel, Field


class SubsystemCapability(BaseModel):
    """Honest implementation state for a specific robotics capability."""

    status: str = Field(..., description="Implementation status (e.g., 'not_implemented')")
    planned_phase: int = Field(..., description="Target phase for real implementation")
    description: str = Field(..., description="Capability description and notes")


class CapabilityMap(BaseModel):
    """Overview of robot subsystem capabilities."""

    ros: SubsystemCapability
    camera: SubsystemCapability
    lidar: SubsystemCapability
    mapping: SubsystemCapability
    navigation: SubsystemCapability
    control: SubsystemCapability


class InfoResponse(BaseModel):
    """Runtime environment and honesty manifest."""

    app_name: str
    app_version: str
    environment: str
    python_version: str
    platform: str
    uptime_seconds: float
    server_time: str
    capabilities: CapabilityMap


class ConfigResponse(BaseModel):
    """Safe, non-sensitive configuration exposed to clients."""

    app_name: str
    environment: str
    debug: bool
    log_level: str
    ws_heartbeat_interval_s: float
    ws_heartbeat_timeout_s: float
    ws_max_connections: int
    ws_max_message_bytes: int
    allowed_origins_count: int


class WsStatsResponse(BaseModel):
    """WebSocket connection and room metrics."""

    total_connections: int
    max_connections: int
    rooms: Dict[str, int]
