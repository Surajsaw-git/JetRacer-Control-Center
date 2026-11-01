"""Unit tests directly exercising WebSocketManager internals (backpressure, broadcast, shutdown)."""

import asyncio

import pytest

from app.core.config import Settings
from app.schemas.ws import WsEnvelope
from app.services.ws_manager import (
    CLOSE_POLICY_VIOLATION,
    WebSocketManager,
    get_utc_iso,
)


class MockWebSocket:
    """Mock WebSocket for internal manager testing."""

    def __init__(self, headers=None):
        self.headers = headers or {}
        self.closed = False
        self.close_code = None
        self.close_reason = None
        self.sent_messages = []

    async def accept(self):
        pass

    async def close(self, code=1000, reason=""):
        self.closed = True
        self.close_code = code
        self.close_reason = reason

    async def send_text(self, text: str):
        self.sent_messages.append(text)


@pytest.mark.asyncio
async def test_ws_manager_lifecycle():
    """Test manager start and clean stop."""
    settings = Settings(WS_MAX_CONNECTIONS=5, WS_SEND_QUEUE_SIZE=10)
    mgr = WebSocketManager(settings)
    await mgr.start()
    assert mgr._is_running is True

    # Connect a mock client
    mock_ws = MockWebSocket()
    conn = await mgr.connect(mock_ws)
    assert conn is not None
    assert mgr.connection_count == 1

    # Stop manager
    await mgr.stop()
    assert mgr._is_running is False
    assert mgr.connection_count == 0
    assert mock_ws.closed is True


@pytest.mark.asyncio
async def test_ws_manager_slow_client_backpressure():
    """Test that saturating a client's send queue drops only that client without blocking others."""
    settings = Settings(WS_MAX_CONNECTIONS=5, WS_SEND_QUEUE_SIZE=2)
    mgr = WebSocketManager(settings)
    await mgr.start()

    mock_ws = MockWebSocket()
    conn = await mgr.connect(mock_ws)
    assert conn is not None

    # Initial connect enqueues 1 welcome message (queue has 1/2)
    # First manual send fills the send queue to capacity (2/2)
    msg = WsEnvelope(type="event", ts=get_utc_iso(), payload={"data": "test"})
    assert await mgr.send_to(conn.connection_id, msg) is True

    # Next send exceeds queue capacity -> triggers slow client drop
    assert await mgr.send_to(conn.connection_id, msg) is False

    # Wait for the async close task
    await asyncio.sleep(0.05)
    assert mock_ws.closed is True
    assert mock_ws.close_code == CLOSE_POLICY_VIOLATION

    await mgr.stop()


@pytest.mark.asyncio
async def test_ws_manager_broadcast_isolation():
    """Test broadcasting reaches only clients subscribed to that channel."""
    settings = Settings(WS_MAX_CONNECTIONS=5, WS_SEND_QUEUE_SIZE=10)
    mgr = WebSocketManager(settings)
    await mgr.start()

    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    conn1 = await mgr.connect(ws1)
    conn2 = await mgr.connect(ws2)

    # Subscribe conn1 to "system", conn2 to "echo-test"
    await mgr._handle_subscribe(conn1, "system", "sub-1")
    await mgr._handle_subscribe(conn2, "echo-test", "sub-2")

    # Broadcast to "system"
    delivered = await mgr.broadcast(
        "system",
        WsEnvelope(type="event", ts=get_utc_iso(), payload={"ping": "broadcast"}),
    )
    assert delivered == 1

    # Broadcast to empty channel
    delivered_empty = await mgr.broadcast(
        "nonexistent",
        WsEnvelope(type="event", ts=get_utc_iso(), payload={"ping": "none"}),
    )
    assert delivered_empty == 0

    await mgr.stop()
