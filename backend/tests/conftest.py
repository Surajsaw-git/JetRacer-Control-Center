"""Pytest configuration and global fixtures."""

import pytest

from app.core.lifecycle import clear_lifecycle_hooks
from app.services.ws_manager import ws_manager


@pytest.fixture(autouse=True)
def reset_shared_state():
    """Reset global registries and shared singleton state between tests."""
    clear_lifecycle_hooks()
    # Ensure ws_manager has clean connection tables
    ws_manager._connections.clear()
    ws_manager._channels.clear()
    yield
    clear_lifecycle_hooks()
    ws_manager._connections.clear()
    ws_manager._channels.clear()
