"""Top-level API routing aggregator."""

from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.system import router as system_router
from app.api.ws import router as ws_router

api_router = APIRouter(prefix="/api")

# Unversioned health probes (/api/health, /api/health/ready)
api_router.include_router(health_router)

# Versioned operational endpoints (/api/v1/info, /api/v1/config, /api/v1/ws/stats)
api_router.include_router(system_router)

# Versioned WebSocket multiplexer (/api/v1/ws)
api_router.include_router(ws_router)
