"""Comprehensive tests for WebSocket manager, protocols, backpressure, and rooms."""

import json

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.config import Settings
from app.main import create_app
from app.services.ws_manager import (
    CLOSE_MAX_CONNECTIONS,
    CLOSE_POLICY_VIOLATION,
)


@pytest.fixture
def test_settings():
    return Settings(
        ENVIRONMENT="test",
        DEBUG=False,
        WS_MAX_CONNECTIONS=3,
        WS_MAX_MESSAGE_BYTES=1024,
        WS_SEND_QUEUE_SIZE=5,
        WS_HEARTBEAT_INTERVAL_S=0.1,
        WS_HEARTBEAT_TIMEOUT_S=0.3,
    )


@pytest.fixture
def app(test_settings):
    return create_app(test_settings)


def test_ws_connect_welcome(app):
    """Test connecting to WebSocket receives immediate welcome envelope."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            welcome_raw = websocket.receive_text()
            data = json.loads(welcome_raw)
            assert data["type"] == "welcome"
            assert data["v"] == 1
            payload = data["payload"]
            assert "connection_id" in payload
            assert payload["robot_status"] == "not_integrated"


def test_ws_ping_pong(app):
    """Test client ping receives pong with matching correlation id."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            ping_msg = json.dumps({"type": "ping", "id": "test-ping-1"})
            websocket.send_text(ping_msg)

            pong_raw = websocket.receive_text()
            pong_data = json.loads(pong_raw)
            assert pong_data["type"] == "pong"
            assert pong_data["id"] == "test-ping-1"
            assert "pong_ts" in pong_data["payload"]


def test_ws_echo_in_test_mode(app):
    """Test echo utility works in test/development mode."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            echo_msg = json.dumps({"type": "echo", "id": "echo-1", "payload": {"foo": "bar"}})
            websocket.send_text(echo_msg)

            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "ack"
            assert reply["id"] == "echo-1"
            assert reply["payload"]["echo"] == {"foo": "bar"}


def test_ws_echo_forbidden_in_production():
    """Test echo utility is rejected with error in production mode."""
    prod_app = create_app(Settings(ENVIRONMENT="production", DEBUG=False))
    with TestClient(prod_app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            echo_msg = json.dumps({"type": "echo", "id": "echo-prod", "payload": "test"})
            websocket.send_text(echo_msg)

            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "error"
            assert reply["payload"]["code"] == "FORBIDDEN"


def test_ws_subscribe_valid_channel(app):
    """Test subscribing to valid channel ('system')."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            sub_msg = json.dumps({"type": "subscribe", "channel": "system", "id": "sub-1"})
            websocket.send_text(sub_msg)

            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "subscribed"
            assert reply["channel"] == "system"


def test_ws_subscribe_reserved_channel_rejected(app):
    """Test subscribing to reserved future channels returns honest planned phase error."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            for channel, phase in [
                ("ros", 4),
                ("camera", 5),
                ("lidar", 6),
                ("map", 7),
                ("control", 8),
                ("safety", 13),
            ]:
                sub_msg = json.dumps(
                    {"type": "subscribe", "channel": channel, "id": f"sub-{channel}"}
                )
                websocket.send_text(sub_msg)

                reply = json.loads(websocket.receive_text())
                assert reply["type"] == "error"
                assert reply["payload"]["code"] == "CHANNEL_NOT_AVAILABLE"
                assert reply["payload"]["planned_phase"] == phase


def test_ws_subscribe_invalid_channel(app):
    """Test subscribing to non-existent channel."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            sub_msg = json.dumps({"type": "subscribe", "channel": "unknown-nonexistent"})
            websocket.send_text(sub_msg)

            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "error"
            assert reply["payload"]["code"] == "INVALID_CHANNEL"


def test_ws_unsubscribe(app):
    """Test unsubscribing from a channel."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            # Subscribe first
            websocket.send_text(json.dumps({"type": "subscribe", "channel": "system"}))
            websocket.receive_text()  # consume subscribed ack

            # Now unsubscribe
            websocket.send_text(
                json.dumps({"type": "unsubscribe", "channel": "system", "id": "unsub-1"})
            )
            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "unsubscribed"
            assert reply["channel"] == "system"


def test_ws_invalid_json(app):
    """Test non-JSON text frame returns INVALID_JSON error envelope."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            websocket.send_text("this is not valid json")
            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "error"
            assert reply["payload"]["code"] == "INVALID_JSON"


def test_ws_abusive_invalid_json_disconnects(app):
    """Test sending 5 consecutive invalid JSON frames closes connection."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            for _ in range(4):
                websocket.send_text("bad json")
                websocket.receive_text()

            # 5th invalid message causes server to close connection with 4008
            with pytest.raises(WebSocketDisconnect) as exc_info:
                websocket.send_text("bad json 5")
                websocket.receive_text()
            assert exc_info.value.code == CLOSE_POLICY_VIOLATION


def test_ws_oversized_message_rejected(app):
    """Test frames exceeding WS_MAX_MESSAGE_BYTES receive MESSAGE_TOO_LARGE error."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            # test_settings.WS_MAX_MESSAGE_BYTES is 1024; send 2000 bytes
            oversized_payload = "A" * 2000
            websocket.send_text(json.dumps({"type": "echo", "payload": oversized_payload}))

            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "error"
            assert reply["payload"]["code"] == "MESSAGE_TOO_LARGE"


def test_ws_unknown_message_type(app):
    """Test unrecognized message type returns UNKNOWN_TYPE error."""
    with TestClient(app) as client:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.receive_text()  # consume welcome

            websocket.send_text(json.dumps({"type": "do_magic"}))
            reply = json.loads(websocket.receive_text())
            assert reply["type"] == "error"
            assert reply["payload"]["code"] == "UNKNOWN_TYPE"


def test_ws_bad_origin_rejected(app):
    """Test connection with disallowed Origin header is rejected with 4008."""
    with TestClient(app) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                "/api/v1/ws", headers={"Origin": "http://evil-attacker.com"}
            ):
                pass
        assert exc_info.value.code == CLOSE_POLICY_VIOLATION


def test_ws_origin_regex_matches_lan_ip(test_settings):
    """Test connection with origin matching ALLOWED_ORIGIN_REGEX succeeds."""
    test_settings.ALLOWED_ORIGIN_REGEX = r"^https?://192\.168\.\d+\.\d+(:\d+)?$"
    app_with_regex = create_app(test_settings)
    with TestClient(app_with_regex) as client:
        with client.websocket_connect(
            "/api/v1/ws", headers={"Origin": "http://192.168.1.150:5173"}
        ) as websocket:
            raw = websocket.receive_text()
            data = json.loads(raw)
            assert data["type"] == "welcome"


def test_ws_origin_regex_rejects_unmatched_origin(test_settings):
    """Test connection with origin NOT matching ALLOWED_ORIGIN_REGEX is rejected with 4008."""
    test_settings.ALLOWED_ORIGIN_REGEX = r"^https?://192\.168\.\d+\.\d+(:\d+)?$"
    app_with_regex = create_app(test_settings)
    with TestClient(app_with_regex) as client:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            with client.websocket_connect(
                "/api/v1/ws", headers={"Origin": "http://10.0.0.5:5173"}
            ):
                pass
        assert exc_info.value.code == CLOSE_POLICY_VIOLATION



def test_ws_max_connections_enforced(test_settings):
    """Test connecting beyond WS_MAX_CONNECTIONS is rejected with 4003."""
    # WS_MAX_CONNECTIONS is 3
    test_settings.WS_MAX_CONNECTIONS = 2
    app_limited = create_app(test_settings)
    with TestClient(app_limited) as client:
        with client.websocket_connect("/api/v1/ws") as ws1:
            ws1.receive_text()
            with client.websocket_connect("/api/v1/ws") as ws2:
                ws2.receive_text()
                # 3rd connection exceeds capacity of 2
                with pytest.raises(WebSocketDisconnect) as exc_info:
                    with client.websocket_connect("/api/v1/ws") as ws3:
                        ws3.receive_text()
                assert exc_info.value.code == CLOSE_MAX_CONNECTIONS
