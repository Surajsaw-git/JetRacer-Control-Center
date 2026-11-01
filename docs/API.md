# JetRacer Control Center — REST API & WebSocket Specification

> **STATUS:** Phase 0 Active Specification. Only `GET /api/health` is currently implemented and live. All other endpoint groups and WebSockets are planned for subsequent phases.

---

## 1. Conventions

- **Base URL:** `http://<JETSON_IP>:8000/api`
- **Content Type:** `application/json` (unless streaming binary data / MJPEG)
- **CORS:** Strictly restricted to configured development origins and Capacitor origins (`http://localhost`, `capacitor://localhost`). Wildcard origins with credentials are prohibited.
- **Versioning:** Current baseline is `v0.1.0`. All breaking path migrations will adopt URL prefixing (`/api/v1/*`) when introduced.

### Error Envelope Format
All standard HTTP 4xx and 5xx responses conform to the following schema:
```json
{
  "detail": "Description of the error condition",
  "error_code": "RESOURCE_NOT_FOUND",
  "timestamp": "2026-11-01T15:30:00.000000+00:00"
}
```

---

## 2. Active Endpoints (Phase 0)

### `GET /api/health`
Returns runtime backend operational status and service metadata. This endpoint reflects real backend server state and does not report fake robot hardware state.

- **Method:** `GET`
- **Auth Required:** None
- **Response Code:** `200 OK`
- **Example Response:**
```json
{
  "status": "ok",
  "service": "jetracer-control-center-backend",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2026-11-01T15:35:56.698352+00:00"
}
```

---

## 3. Planned Endpoint Groups

| Group Prefix | Planned Phase | Planned Endpoints | Description | Status |
| :--- | :--- | :--- | :--- | :--- |
| `/api/connection` | Phase 3 | `POST /test-ping`, `GET /status`, `POST /reconnect` | Verify IP reachability and latency to Jetson host. | Planned |
| `/api/ros` | Phase 4 | `GET /topics`, `GET /nodes`, `GET /services`, `GET /params` | Introspect running ROS graph and node parameters. | Planned |
| `/api/camera` | Phase 5 | `GET /stream`, `GET /snapshot`, `POST /settings` | Live camera stream proxy and resolution configuration. | Planned |
| `/api/lidar` | Phase 6 | `GET /status`, `POST /configure` | Laser scan frequency and angular range settings. | Planned |
| `/api/maps` | Phase 7 | `GET /`, `POST /save`, `GET /{name}`, `DELETE /{name}` | Manage saved 2D SLAM maps (`.yaml`/`.pgm`). | Planned |
| `/api/control` | Phase 8 | `POST /cmd_vel`, `POST /stop`, `POST /limits` | Velocity dispatch, steering calibration, software E-Stop. | Planned |
| `/api/navigation`| Phase 9 | `POST /goal`, `DELETE /cancel`, `GET /waypoints` | Navigation goal dispatch and waypoint sequencer. | Planned |
| `/api/system` | Phase 10 | `GET /metrics`, `POST /service/{name}/{action}`, `POST /reboot` | Host CPU/GPU thermals, jtop metrics, service control. | Planned |
| `/api/config` | Phase 11 | `GET /settings`, `PUT /settings` | Persistent user preferences and calibration profiles. | Planned |

---

## 4. Planned WebSocket Channels

> **NOTE:** WebSocket channels are not yet active in Phase 0. Architecture stubs will be implemented in Phase 2, and real-time streaming will be hooked to ROS in Phase 4.

- `ws://<JETSON_IP>:8000/ws/telemetry` — High-frequency streaming of battery voltage, motor velocities, and CPU/GPU temperatures (Planned Phase 2 / Phase 10).
- `ws://<JETSON_IP>:8000/ws/alerts` — Real-time emergency stop events, communication drops, and safety watchdog alerts (Planned Phase 8 / Phase 13).
- `ws://<JETSON_IP>:9090` — Native `rosbridge_suite` WebSocket for raw ROS message exchange (Planned Phase 4).
