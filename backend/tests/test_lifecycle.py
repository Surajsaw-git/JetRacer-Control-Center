"""Tests for lifecycle hooks registry execution during application startup and shutdown."""

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.lifecycle import (
    clear_lifecycle_hooks,
    register_shutdown_hook,
    register_startup_hook,
)
from app.main import create_app


def test_lifecycle_hooks_execution():
    """Verify registered startup and shutdown hooks execute in order."""
    clear_lifecycle_hooks()
    events = []

    async def on_startup():
        events.append("startup")

    async def on_shutdown():
        events.append("shutdown")

    register_startup_hook(on_startup)
    register_shutdown_hook(on_shutdown)

    app = create_app(Settings(ENVIRONMENT="test", DEBUG=False))
    with TestClient(app) as client:
        # App entered lifespan context
        assert "startup" in events
        response = client.get("/api/health")
        assert response.status_code == 200

    # App exited lifespan context
    assert "shutdown" in events
    clear_lifecycle_hooks()
