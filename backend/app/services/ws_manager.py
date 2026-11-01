"""Thread-safe, multiplexed WebSocket connection and room manager with backpressure isolation."""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import WebSocket

from app.core.config import Settings, get_settings
from app.schemas.ws import WsEnvelope

logger = logging.getLogger("app.services.ws_manager")

# Standardized custom WebSocket close codes
CLOSE_NORMAL = 1000
CLOSE_GOING_AWAY = 1001
CLOSE_HEARTBEAT_TIMEOUT = 4000
CLOSE_AUTH_FAILED = 4001  # Phase 13 placeholder
CLOSE_MAX_CONNECTIONS = 4003
CLOSE_POLICY_VIOLATION = 4008
CLOSE_MESSAGE_TOO_LARGE = 4009

# Channels active in Phase 2
VALID_CHANNELS = {"system", "echo-test"}

# Channels reserved for future phases
RESERVED_CHANNELS: Dict[str, int] = {
    "ros": 4,
    "camera": 5,
    "lidar": 6,
    "map": 7,
    "control": 8,
    "safety": 13,
}


def get_utc_iso() -> str:
    """Return current UTC time in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class ConnectionState:
    """Encapsulates a connected client socket, its isolated send queue, and state."""

    def __init__(self, connection_id: str, websocket: WebSocket, queue_size: int) -> None:
        self.connection_id = connection_id
        self.websocket = websocket
        self.connected_at = time.time()
        self.last_seen = time.time()
        self.subscribed_channels: Set[str] = set()
        self.send_queue: asyncio.Queue[str] = asyncio.Queue(maxsize=queue_size)
        self.writer_task: Optional[asyncio.Task[None]] = None
        self.consecutive_errors: int = 0
        self.is_closed = False


class WebSocketManager:
    """Multiplexed WebSocket manager enforcing backpressure limits, heartbeat, and rooms."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self._settings = settings or get_settings()
        self._connections: Dict[str, ConnectionState] = {}
        self._channels: Dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()
        self._heartbeat_task: Optional[asyncio.Task[None]] = None
        self._system_event_task: Optional[asyncio.Task[None]] = None
        self._start_time = time.time()
        self._is_running = False

    @property
    def connection_count(self) -> int:
        """Total active connections."""
        return len(self._connections)

    def get_room_counts(self) -> Dict[str, int]:
        """Return subscriber count per room."""
        return {ch: len(conns) for ch, conns in self._channels.items()}

    async def start(self) -> None:
        """Start background heartbeat watchdog and periodic system event tasks."""
        if self._is_running:
            return
        self._is_running = True
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(), name="ws-heartbeat")
        self._system_event_task = asyncio.create_task(
            self._system_event_loop(), name="ws-system-event"
        )
        logger.info(
            "WebSocketManager started with max %d connections", self._settings.WS_MAX_CONNECTIONS
        )

    async def stop(self) -> None:
        """Gracefully close all client sockets and terminate background tasks."""
        self._is_running = False
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
        if self._system_event_task and not self._system_event_task.done():
            self._system_event_task.cancel()

        # Close all active connections with 1001 Going Away
        async with self._lock:
            conn_items = list(self._connections.items())
            for _conn_id, conn in conn_items:
                await self._close_connection(
                    conn, code=CLOSE_GOING_AWAY, reason="Server shutting down"
                )
            self._connections.clear()
            self._channels.clear()

        logger.info("WebSocketManager stopped cleanly")

    async def authenticate_ws(self, websocket: WebSocket) -> bool:
        """Validate client credentials.

        In Phase 2, all local connections are permitted.
        Real token verification and permission checks arrive in Phase 13.
        """
        # Phase 13 extension point
        if self._settings.AUTH_ENABLED:
            logger.warning("WebSocket auth requested but real authentication arrives in Phase 13")
        return True

    def validate_origin(self, websocket: WebSocket) -> bool:
        """Verify client Origin header against ALLOWED_ORIGINS and ALLOWED_ORIGIN_REGEX."""
        origin = websocket.headers.get("origin")
        if not origin:
            # Native clients (Capacitor/Postman/local scripts) omit Origin header
            return True

        allowed = (
            self._settings.ALLOWED_ORIGINS
            if isinstance(self._settings.ALLOWED_ORIGINS, list)
            else [self._settings.ALLOWED_ORIGINS]
        )
        if origin in allowed:
            return True

        if self._settings.ALLOWED_ORIGIN_REGEX:
            import re
            return bool(re.search(self._settings.ALLOWED_ORIGIN_REGEX, origin))

        return False

    async def connect(self, websocket: WebSocket) -> Optional[ConnectionState]:
        """Accept a new WebSocket connection enforcing capacity and origin checks."""
        # Check Origin
        if not self.validate_origin(websocket):
            logger.warning(
                "Rejected WebSocket connection: forbidden origin '%s'",
                websocket.headers.get("origin"),
            )
            await websocket.close(code=CLOSE_POLICY_VIOLATION, reason="Origin not allowed")
            return None

        # Check Authentication Hook
        if not await self.authenticate_ws(websocket):
            await websocket.close(code=CLOSE_AUTH_FAILED, reason="Authentication failed")
            return None

        # Check Connection Limit
        async with self._lock:
            if len(self._connections) >= self._settings.WS_MAX_CONNECTIONS:
                logger.warning(
                    "Rejected WebSocket connection: limit (%d) reached",
                    self._settings.WS_MAX_CONNECTIONS,
                )
                await websocket.accept()
                await websocket.close(
                    code=CLOSE_MAX_CONNECTIONS, reason="Max connection capacity reached"
                )
                return None

            await websocket.accept()
            conn_id = str(uuid.uuid4())
            conn = ConnectionState(conn_id, websocket, self._settings.WS_SEND_QUEUE_SIZE)
            conn.writer_task = asyncio.create_task(
                self._writer_loop(conn), name=f"ws-writer-{conn_id}"
            )
            self._connections[conn_id] = conn

        logger.info(
            "WebSocket client connected [conn_id=%s] (active: %d)",
            conn_id,
            len(self._connections),
        )

        # Dispatch initial welcome envelope
        welcome_msg = WsEnvelope(
            type="welcome",
            ts=get_utc_iso(),
            payload={
                "connection_id": conn_id,
                "server_version": self._settings.APP_VERSION,
                "heartbeat_interval_s": self._settings.WS_HEARTBEAT_INTERVAL_S,
                "heartbeat_timeout_s": self._settings.WS_HEARTBEAT_TIMEOUT_S,
                "max_message_bytes": self._settings.WS_MAX_MESSAGE_BYTES,
                "active_channels": list(VALID_CHANNELS),
                "robot_status": "not_integrated",
            },
        )
        await self.send_to(conn_id, welcome_msg)
        return conn

    async def disconnect(self, connection_id: str) -> None:
        """Disconnect and clean up a client connection."""
        async with self._lock:
            conn = self._connections.pop(connection_id, None)
            if conn:
                await self._cleanup_connection(conn)

    async def _close_connection(self, conn: ConnectionState, code: int, reason: str) -> None:
        """Safely close and clean up a connection."""
        if conn.is_closed:
            return
        conn.is_closed = True
        try:
            await conn.websocket.close(code=code, reason=reason)
        except Exception:
            pass
        await self._cleanup_connection(conn)

    async def _cleanup_connection(self, conn: ConnectionState) -> None:
        """Cancel writer task and remove from all channel memberships."""
        conn.is_closed = True
        if conn.writer_task and not conn.writer_task.done():
            conn.writer_task.cancel()

        for ch in conn.subscribed_channels:
            if ch in self._channels:
                self._channels[ch].discard(conn.connection_id)
                if not self._channels[ch]:
                    del self._channels[ch]

        logger.info(
            "WebSocket client cleaned up [conn_id=%s] (active: %d)",
            conn.connection_id,
            len(self._connections),
        )

    async def _writer_loop(self, conn: ConnectionState) -> None:
        """Dedicated send queue consumer for a single connection."""
        try:
            while True:
                msg_text = await conn.send_queue.get()
                await conn.websocket.send_text(msg_text)
                conn.send_queue.task_done()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug("Writer error for client [%s]: %s", conn.connection_id, str(e))

    async def send_to(self, connection_id: str, message: WsEnvelope) -> bool:
        """Enqueue a message for a specific client. Drops slow clients if queue is saturated."""
        conn = self._connections.get(connection_id)
        if not conn or conn.is_closed:
            return False

        msg_text = message.model_dump_json()
        try:
            conn.send_queue.put_nowait(msg_text)
            return True
        except asyncio.QueueFull:
            logger.warning(
                "Slow client detected: send queue saturated for conn_id=%s. Dropping.",
                connection_id,
            )
            asyncio.create_task(
                self._close_connection(
                    conn,
                    code=CLOSE_POLICY_VIOLATION,
                    reason="Send queue saturated (slow client)",
                )
            )
            return False

    async def broadcast(self, channel: str, message: WsEnvelope) -> int:
        """Broadcast message to all subscribers of a channel without blocking."""
        subscribers = self._channels.get(channel, set())
        if not subscribers:
            return 0

        delivered = 0
        message.channel = channel
        for conn_id in list(subscribers):
            if await self.send_to(conn_id, message):
                delivered += 1
        return delivered

    async def handle_message(self, conn: ConnectionState, raw_text: str) -> None:
        """Process incoming client message frame."""
        conn.last_seen = time.time()

        # Enforce max message size
        if len(raw_text.encode("utf-8")) > self._settings.WS_MAX_MESSAGE_BYTES:
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    ts=get_utc_iso(),
                    payload={
                        "code": "MESSAGE_TOO_LARGE",
                        "message": (
                            f"Message exceeds limit of {self._settings.WS_MAX_MESSAGE_BYTES} bytes"
                        ),
                    },
                ),
            )
            return

        try:
            data = json.loads(raw_text)
            conn.consecutive_errors = 0
        except json.JSONDecodeError:
            conn.consecutive_errors += 1
            if conn.consecutive_errors >= 5:
                await self._close_connection(
                    conn,
                    code=CLOSE_POLICY_VIOLATION,
                    reason="Abusive behavior: too many consecutive invalid JSON messages",
                )
                return

            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    ts=get_utc_iso(),
                    payload={
                        "code": "INVALID_JSON",
                        "message": "Frame content must be valid JSON",
                    },
                ),
            )
            return

        msg_type = data.get("type")
        msg_id = data.get("id")

        if msg_type == "ping":
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="pong",
                    id=msg_id,
                    ts=get_utc_iso(),
                    payload={"pong_ts": get_utc_iso()},
                ),
            )
        elif msg_type == "echo":
            # Echo is enabled exclusively in development/test
            if self._settings.ENVIRONMENT.lower() == "production":
                await self.send_to(
                    conn.connection_id,
                    WsEnvelope(
                        type="error",
                        id=msg_id,
                        ts=get_utc_iso(),
                        payload={
                            "code": "FORBIDDEN",
                            "message": "Echo testing is disabled in production mode",
                        },
                    ),
                )
            else:
                await self.send_to(
                    conn.connection_id,
                    WsEnvelope(
                        type="ack",
                        id=msg_id,
                        ts=get_utc_iso(),
                        payload={"echo": data.get("payload")},
                    ),
                )
        elif msg_type == "subscribe":
            channel = data.get("channel")
            await self._handle_subscribe(conn, channel, msg_id)
        elif msg_type == "unsubscribe":
            channel = data.get("channel")
            await self._handle_unsubscribe(conn, channel, msg_id)
        else:
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    id=msg_id,
                    ts=get_utc_iso(),
                    payload={
                        "code": "UNKNOWN_TYPE",
                        "message": f"Unsupported message type: '{msg_type}'",
                    },
                ),
            )

    async def _handle_subscribe(
        self, conn: ConnectionState, channel: Optional[str], msg_id: Optional[str]
    ) -> None:
        """Handle channel subscription request."""
        if not channel:
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    id=msg_id,
                    ts=get_utc_iso(),
                    payload={"code": "INVALID_CHANNEL", "message": "Channel name required"},
                ),
            )
            return

        if channel in RESERVED_CHANNELS:
            phase = RESERVED_CHANNELS[channel]
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    id=msg_id,
                    channel=channel,
                    ts=get_utc_iso(),
                    payload={
                        "code": "CHANNEL_NOT_AVAILABLE",
                        "message": (
                            f"Channel '{channel}' is scheduled for Phase {phase}"
                            " and is not implemented yet"
                        ),
                        "planned_phase": phase,
                    },
                ),
            )
            return

        if channel not in VALID_CHANNELS:
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    id=msg_id,
                    channel=channel,
                    ts=get_utc_iso(),
                    payload={
                        "code": "INVALID_CHANNEL",
                        "message": f"Channel '{channel}' does not exist",
                    },
                ),
            )
            return

        async with self._lock:
            conn.subscribed_channels.add(channel)
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(conn.connection_id)

        await self.send_to(
            conn.connection_id,
            WsEnvelope(type="subscribed", id=msg_id, channel=channel, ts=get_utc_iso()),
        )

    async def _handle_unsubscribe(
        self, conn: ConnectionState, channel: Optional[str], msg_id: Optional[str]
    ) -> None:
        """Handle channel unsubscription request."""
        if not channel or channel not in conn.subscribed_channels:
            await self.send_to(
                conn.connection_id,
                WsEnvelope(
                    type="error",
                    id=msg_id,
                    channel=channel,
                    ts=get_utc_iso(),
                    payload={
                        "code": "NOT_SUBSCRIBED",
                        "message": f"Not subscribed to channel '{channel}'",
                    },
                ),
            )
            return

        async with self._lock:
            conn.subscribed_channels.discard(channel)
            if channel in self._channels:
                self._channels[channel].discard(conn.connection_id)
                if not self._channels[channel]:
                    del self._channels[channel]

        await self.send_to(
            conn.connection_id,
            WsEnvelope(type="unsubscribed", id=msg_id, channel=channel, ts=get_utc_iso()),
        )

    async def _heartbeat_loop(self) -> None:
        """Periodic watchdog verifying client responsiveness against timeout threshold."""
        while self._is_running:
            try:
                await asyncio.sleep(self._settings.WS_HEARTBEAT_INTERVAL_S)
                now = time.time()
                timeout = self._settings.WS_HEARTBEAT_TIMEOUT_S

                timed_out_conns: List[ConnectionState] = []
                async with self._lock:
                    for conn in self._connections.values():
                        if now - conn.last_seen > timeout:
                            timed_out_conns.append(conn)

                for conn in timed_out_conns:
                    logger.warning(
                        "Heartbeat timeout for client [%s]. Closing.", conn.connection_id
                    )
                    await self._close_connection(
                        conn, code=CLOSE_HEARTBEAT_TIMEOUT, reason="Heartbeat inactivity timeout"
                    )
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in heartbeat loop: %s", str(e))

    async def _system_event_loop(self) -> None:
        """Periodic server telemetry broadcast to the 'system' channel (real facts only)."""
        while self._is_running:
            try:
                await asyncio.sleep(self._settings.WS_HEARTBEAT_INTERVAL_S)
                if "system" in self._channels:
                    event = WsEnvelope(
                        type="event",
                        channel="system",
                        ts=get_utc_iso(),
                        payload={
                            "server_time": get_utc_iso(),
                            "uptime_seconds": round(time.time() - self._start_time, 2),
                            "active_connections": len(self._connections),
                        },
                    )
                    await self.broadcast("system", event)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in system event loop: %s", str(e))


# Global singleton instance
ws_manager = WebSocketManager()
