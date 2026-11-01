# JetRacer Control Center — REST API & WebSocket Protocol Reference

> **STATUS:** Phase 2 Active Specification. Core REST health/system endpoints, multiplexed WebSocket manager, and uniform error envelopes are implemented and verified. All robotics and hardware integrations remain scheduled for subsequent phases.

---

## 1. Global Conventions & Protocol Standards

- **Base URL:** `http://<JETSON_IP>:8000/api`
- **WebSocket URL:** `ws://<JETSON_IP>:8000/api/v1/ws`
- **Content-Type:** `application/json` (UTF-8)
- **Time Representation:** All timestamps use UTC ISO 8601 formatting (`YYYY-MM-DDTHH:MM:SS.ffffff+00:00` or `...Z`).
- **Request Tracing:** All HTTP requests accept an optional `X-Request-ID` header. If absent or invalid, a random UUIDv4 is assigned and returned in the `X-Request-ID` response header and logged.
- **Security Headers:** Every API response attaches `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Cache-Control: no-store, no-cache, must-revalidate`.
- **CORS Policy:** Strictly restricted to configured explicit origins (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost`, `capacitor://localhost`). Wildcard `*` is prohibited in production mode.

---

## 2. Uniform Error Envelope

All 4xx and 5xx HTTP responses conform to a predictable, machine-readable envelope:

```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable explanation of error condition",
    "details": null,
    "request_id": "a59855c8-80b3-4430-bf23-efa2b5bdbee3"
  }
}
```

### Standard Error Code Registry

| Error Code | HTTP Status | Description |
| :--- | :--- | :--- |
| `NOT_FOUND` | 404 | The requested route or resource does not exist. |
| `METHOD_NOT_ALLOWED` | 405 | The HTTP method is not permitted on this path. |
| `VALIDATION_ERROR` | 422 | Request body, query parameter, or path parameter failed validation. Details array contains field-level errors. |
| `VALIDATION_FAILED` | 422 | Semantic validation error thrown by business logic (`ValidationFailedError`). |
| `SERVICE_UNAVAILABLE` | 503 | A required backend subsystem or storage path is not operational. |
| `INTERNAL_SERVER_ERROR` | 500 | Catch-all for unhandled exceptions. Internal details and tracebacks are logged on the server but **never leaked** in the response. |

---

## 3. Active REST Endpoints (Phase 2)

### 3.1 `GET /api/health`
**Liveness Probe:** Lightweight check verifying the FastAPI ASGI server process is alive and accepting requests.

- **Status Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-11-01T22:28:24.123456+00:00",
  "version": "0.2.1"
}
```

---

### 3.2 `GET /api/health/ready`
**Readiness Probe:** Assesses whether all registered subsystems and storage paths are operational before routing traffic. Returns `503 SERVICE_UNAVAILABLE` if any critical dependency fails.

- **Status Code:** `200 OK` (Ready) or `503 Service Unavailable` (Not Ready)
- **Example Response (200 OK):**
```json
{
  "status": "ready",
  "timestamp": "2026-11-01T22:28:24.125000+00:00",
  "components": {
    "settings": {
      "status": "ok",
      "message": "Application settings loaded and validated"
    },
    "storage": {
      "status": "ok",
      "message": "Storage directory './data' is writable"
    },
    "ws_manager": {
      "status": "ok",
      "message": "WebSocket manager background tasks running"
    },
    "robot": {
      "status": "not_integrated",
      "message": "Robot hardware connection scheduled for Phase 4 (rosbridge over WebSocket)"
    }
  }
}
```

---

### 3.3 `GET /api/v1/info`
**Application & Capabilities Manifest:** Exposes backend version, environment, runtime platform, process uptime, and an honest status map of planned robotics capabilities.

- **Status Code:** `200 OK`
- **Example Response:**
```json
{
  "app_name": "JetRacer Control Center Backend",
  "app_version": "0.2.1",
  "environment": "development",
  "python_version": "3.14.5",
  "platform": "Windows-11-10.0.26300-SP0",
  "uptime_seconds": 124.52,
  "server_time": "2026-11-01T22:28:24.130000+00:00",
  "capabilities": {
    "ros": {
      "status": "not_implemented",
      "planned_phase": 4,
      "description": "rosbridge suite WebSocket client for ROS 1 Melodic/Noetic"
    },
    "camera": {
      "status": "not_implemented",
      "planned_phase": 5,
      "description": "Low-latency MJPEG / WebRTC live video streaming pipeline"
    },
    "lidar": {
      "status": "not_implemented",
      "planned_phase": 6,
      "description": "2D LaserScan visualization and obstacle proximity alerting"
    },
    "mapping": {
      "status": "not_implemented",
      "planned_phase": 7,
      "description": "2D SLAM occupancy grid streaming and map library management"
    },
    "control": {
      "status": "not_implemented",
      "planned_phase": 8,
      "description": "Virtual touch joystick and velocity frame rate limiter"
    },
    "navigation": {
      "status": "not_implemented",
      "planned_phase": 9,
      "description": "2D Nav Goal dispatch, waypoint sequence execution, and pose monitor"
    }
  }
}
```

---

### 3.4 `GET /api/v1/config`
**Effective Non-Secret Configuration:** Returns sanitized configuration parameters to frontend clients. Never leaks secrets, passwords, or filesystem paths.

- **Status Code:** `200 OK`
- **Example Response:**
```json
{
  "app_name": "JetRacer Control Center Backend",
  "environment": "development",
  "debug": false,
  "log_level": "INFO",
  "ws_heartbeat_interval_s": 15.0,
  "ws_heartbeat_timeout_s": 30.0,
  "ws_max_connections": 10,
  "ws_max_message_bytes": 65536,
  "allowed_origins_count": 4
}
```

---

### 3.5 `GET /api/v1/ws/stats`
**WebSocket Statistics:** Real-time metrics on connected clients and room memberships. Client IP addresses are not stored or exposed.

- **Status Code:** `200 OK`
- **Example Response:**
```json
{
  "total_connections": 2,
  "max_connections": 10,
  "rooms": {
    "system": 2,
    "echo-test": 0
  }
}
```

---

## 4. Multiplexed WebSocket Protocol (`/api/v1/ws`)

A single, bidirectional WebSocket endpoint handles all real-time notifications, heartbeat probes, and pub/sub channels.

### 4.1 Framing Envelope (Version 1)
All WebSocket frames are encoded as JSON text matching this schema:

```json
{
  "v": 1,
  "type": "message_type",
  "id": "optional-client-correlation-id",
  "channel": "optional-channel-name",
  "ts": "2026-11-01T22:28:24.135000+00:00",
  "payload": {}
}
```

### 4.2 Protocol Handshake & Lifecycle

1. **Connection & Origin Check:**
   - The server validates the client `Origin` header against `ALLOWED_ORIGINS`.
   - Disallowed origins are rejected with close code `4008`.
   - Native mobile clients omitting the `Origin` header are permitted.
2. **Initial Welcome:**
   - Upon connection, the server immediately sends a `welcome` message containing server version, heartbeat intervals, and assigned `connection_id`:
```json
{
  "v": 1,
  "type": "welcome",
  "ts": "2026-11-01T22:28:24.136000+00:00",
  "payload": {
    "connection_id": "247d3f47-c5fc-4363-aea6-3aa958ce8332",
    "server_version": "0.2.1",
    "heartbeat_interval_s": 15.0,
    "heartbeat_timeout_s": 30.0,
    "max_message_bytes": 65536,
    "active_channels": ["system", "echo-test"],
    "robot_status": "not_integrated"
  }
}
```
3. **Heartbeat & Inactivity Watchdog:**
   - Clients periodically send `{"type": "ping", "id": "..."}`.
   - The server replies with `{"type": "pong", "id": "...", "payload": {"pong_ts": "..."}}`.
   - If a connection remains silent for more than `WS_HEARTBEAT_TIMEOUT_S` (default 30s), the server terminates the connection with close code `4000` (Heartbeat Timeout).
4. **Periodic System Telemetry Broadcast:**
   - Every `WS_HEARTBEAT_INTERVAL_S` seconds, the server broadcasts a heartbeat event to all subscribers of the `system` channel:
```json
{
  "v": 1,
  "type": "event",
  "channel": "system",
  "ts": "2026-11-01T22:28:39.000000+00:00",
  "payload": {
    "server_time": "2026-11-01T22:28:39.000000+00:00",
    "uptime_seconds": 139.0,
    "active_connections": 2
  }
}
```
   *(Contains real backend facts only; never fake robot telemetry).*

---

### 4.3 Pub/Sub Channels (Rooms)

Clients manage channel subscriptions by sending `subscribe` and `unsubscribe` envelopes:

#### Subscribe
- **Client Frame:** `{"type": "subscribe", "channel": "system", "id": "req-1"}`
- **Server Response:** `{"v": 1, "type": "subscribed", "channel": "system", "id": "req-1", "ts": "..."}`

#### Channel Allowlist & Phase Reservations

| Channel | Implemented In | Description |
| :--- | :--- | :--- |
| `system` | Phase 2 | Real backend server metrics, uptime, connection count. |
| `echo-test` | Phase 2 | Dev/test only echo utility. Rejected with `FORBIDDEN` in production. |
| `ros` | Phase 4 | Raw ROS bridge event stream. (Subscribing returns `CHANNEL_NOT_AVAILABLE`). |
| `camera` | Phase 5 | Camera frame rate & streaming status. (Returns `CHANNEL_NOT_AVAILABLE`). |
| `lidar` | Phase 6 | 2D LaserScan point streaming. (Returns `CHANNEL_NOT_AVAILABLE`). |
| `map` | Phase 7 | SLAM map updates and metadata. (Returns `CHANNEL_NOT_AVAILABLE`). |
| `control` | Phase 8 | Driving velocity feedback & dead-man state. (Returns `CHANNEL_NOT_AVAILABLE`). |
| `safety` | Phase 13 | Hardware E-Stop and watchdog alerts. (Returns `CHANNEL_NOT_AVAILABLE`). |

---

### 4.4 WebSocket Close Codes

| Code | Name | Description |
| :--- | :--- | :--- |
| `1000` | Normal Closure | Clean client-initiated or server-initiated disconnection. |
| `1001` | Going Away | Server process is shutting down. |
| `4000` | Heartbeat Timeout | Client was silent beyond the configured `WS_HEARTBEAT_TIMEOUT_S`. |
| `4001` | Authentication Failed | Invalid or expired token (Phase 13 placeholder). |
| `4003` | Max Connections Reached | Server is at full capacity (`WS_MAX_CONNECTIONS`). |
| `4008` | Policy Violation | Disallowed Origin header, slow-client queue saturation, or abusive malformed frames (>5 consecutive non-JSON messages). |
| `4009` | Message Too Large | Client frame exceeded `WS_MAX_MESSAGE_BYTES`. |

---

### 4.5 Backpressure & Slow-Client Isolation Policy

Every connected client possesses an independent, bounded FIFO queue (`WS_SEND_QUEUE_SIZE`, default 100 messages) and an isolated consumer task. When broadcasting messages:
- If a client is slow or stalling, its queue fills up.
- The manager's `send_to()` detects saturation non-blockingly via `put_nowait()`.
- The saturated client is immediately disconnected with close code `4008` (Slow Client) and cleaned up.
- **Other clients and the server broadcast pipeline are completely unaffected.**
