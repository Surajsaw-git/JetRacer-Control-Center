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
- **CORS Policy:** Strictly restricted to configured explicit origins (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost`, `capacitor://localhost`) or matching `ALLOWED_ORIGIN_REGEX` for LAN development. Wildcard `*` or match-all regex is strictly prohibited in production mode.
- **Two-Link Architecture:**
  - **Link A (Robotics):** `ws://<ROBOT_IP>:9090` handled by `rosbridge_suite` (`roslibjs`). Phase 3 is read-only (`/rosapi/get_time`).
  - **Link B (Backend):** `http://<IP>:8000/api` handled by FastAPI for auxiliary persistence and telemetry cache. Optional in Phase 3.

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

---

## 5. Rosbridge WebSocket Protocol (Link A — Port 9090)

Link A connects directly to the robot's `rosbridge_server` WebSocket endpoint on port `9090`. In Phase 4, the connection operates under a strict read-only capability policy.

### 5.1 Protocol Frames

#### Service Request (`call_service`)
Client invocation of allow-listed rosapi services:
```json
{
  "op": "call_service",
  "id": "call_service:/rosapi/get_time:1",
  "service": "/rosapi/get_time",
  "args": {}
}
```

#### Service Response (`service_response`)
Robot response frame:
```json
{
  "op": "service_response",
  "id": "call_service:/rosapi/get_time:1",
  "service": "/rosapi/get_time",
  "values": {
    "time": {
      "secs": 1730500000,
      "nsecs": 42000000
    }
  },
  "result": true
}
```

#### Controlled Topic Subscription (`subscribe`)
Rate-throttled subscription for topic inspection (max 5 concurrent watches):
```json
{
  "op": "subscribe",
  "id": "subscribe:/mock_world/odom:1",
  "topic": "/mock_world/odom",
  "type": "nav_msgs/Odometry",
  "throttle_rate": 200
}
```

#### Topic Unsubscription (`unsubscribe`)
```json
{
  "op": "unsubscribe",
  "id": "subscribe:/mock_world/odom:1",
  "topic": "/mock_world/odom"
}
```

### 5.2 Topic Registry Export Schema (`version: 1.0.0`)
Profiles exported and imported via the System Registry tab:
```json
{
  "version": "1.0.0",
  "profileName": "Default Profile",
  "robotHost": "192.168.1.105",
  "updatedAt": "2026-11-02T00:00:00.000Z",
  "mappings": {
    "cmd_vel": {
      "role": "cmd_vel",
      "expectedTypes": ["geometry_msgs/Twist"],
      "assignedTopic": "/mock_world/cmd_vel",
      "detectedType": "geometry_msgs/Twist",
      "verification": "mapped_unverified",
      "lastSeenAt": null,
      "hz": null,
      "notes": ""
    }
  }
}
```

---

## 6. Camera Streaming Protocol (Phase 5)

### 6.1 `web_video_server` HTTP MJPEG Stream (Primary Transport)
- **Base URL:** `http://<ROBOT_IP>:8080`
- **Stream Endpoint:** `GET /stream?topic=<base_topic>&quality=<1-100>&width=<w>&height=<h>&type=mjpeg`
  - **Content-Type:** `multipart/x-mixed-replace; boundary=--boundarydonotcross`
  - **Frame Format:** Standard binary JPEG chunks separated by boundary delimiter.
- **Snapshot Endpoint:** `GET /snapshot?topic=<base_topic>&quality=<1-100>&width=<w>&height=<h>`
  - **Content-Type:** `image/jpeg`
  - **Headers:** `Access-Control-Allow-Origin: *`, `Cache-Control: no-cache`

### 6.2 Rosbridge WebSocket Compressed Transport (Fallback Transport)
- **Subscription Operation:**
  ```json
  {
    "op": "subscribe",
    "topic": "<topic>/compressed",
    "type": "sensor_msgs/CompressedImage",
    "throttle_rate": 100,
    "queue_length": 1
  }
  ```
- **Incoming Frame Payload:**
  ```json
  {
    "op": "publish",
    "topic": "/csi_cam_0/image_raw/compressed",
    "msg": {
      "header": { "seq": 102, "stamp": { "secs": 1700000000, "nsecs": 500000000 }, "frame_id": "camera_link" },
      "format": "jpeg",
      "data": "<base64_encoded_jpeg_string>"
    }
  }
  ```
- **Safety Enforcement:**
  - Maximum 1 active camera stream over rosbridge.
  - Throttle floor $\ge 100\text{ ms}$ (max 10 Hz).
  - Raw `sensor_msgs/Image` is strictly blocked.
  - Latest-frame-wins drop policy prevents backpressure.

---

## 7. LiDAR Streaming Protocol (Phase 6)

### 7.1 Rosbridge WebSocket `sensor_msgs/LaserScan` Transport
- **Subscription Operation:**
  ```json
  {
    "op": "subscribe",
    "topic": "<laser_topic>",
    "type": "sensor_msgs/LaserScan",
    "throttle_rate": 100,
    "queue_length": 1
  }
  ```
- **Incoming Message Schema (`sensor_msgs/LaserScan`):**
  ```json
  {
    "op": "publish",
    "topic": "/scan",
    "msg": {
      "header": { "seq": 450, "stamp": { "secs": 1700000000, "nsecs": 0 }, "frame_id": "laser_frame" },
      "angle_min": -3.14159,
      "angle_max": 3.14159,
      "angle_increment": 0.01745,
      "time_increment": 0.0001,
      "scan_time": 0.1,
      "range_min": 0.15,
      "range_max": 12.0,
      "ranges": [1.25, null, 3.4, 0.28, 5.0],
      "intensities": [100.0, 0.0, 150.0, 80.0, 200.0]
    }
  }
  ```
- **Safety & Policy Enforcement:**
  - `MAX_LIDAR_SUBSCRIPTIONS = 1`: strictly 1 active subscription application-wide.
  - `MIN_LIDAR_THROTTLE_MS = 50`: minimum throttle floor 50 ms (20 Hz max).
  - `MAX_LIDAR_RANGES_LENGTH = 8192`: oversized packet rejection.
  - Pre-deserialization regex sanitizes bare non-standard `Infinity` and `NaN` tokens to `null`.
  - Watchdog triggers `stalled` state if no scan is received within 2.0 s.

