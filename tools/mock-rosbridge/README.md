# Mock Rosbridge Server (Dev Only)

> ⚠️ **DEVELOPMENT TOOL ONLY — NOT A REAL ROBOT**
>
> This standalone mock server emulates `rosbridge_server` (rosbridge v2 protocol) on `ws://127.0.0.1:9090`. It is used during development when the physical JetRacer robot is not connected.
>
> This server is strictly a dev utility and is **never** bundled into the production frontend application or Android APK.

---

## 1. Running the Mock Server

From the project root or the `frontend/` directory:

```bash
cd frontend
npm run mock:rosbridge
```

You will see:
```text
================================================================
[MOCK ROSBRIDGE] DEV ONLY — NOT A REAL ROBOT — listening on ws://127.0.0.1:9090
================================================================
```

---

## 2. Testing Edge Cases & Failure Modes

You can launch the mock server with simulated failure modes to test the frontend connection state machine:

| Flag | Purpose | Command |
| :--- | :--- | :--- |
| **Normal** | Responds to `/rosapi/get_time` with valid ROS timestamps. | `npm run mock:rosbridge` |
| `--refuse` | Rejects/closes incoming connections immediately. | `node ../tools/mock-rosbridge/server.js --refuse` |
| `--hang` | Accepts TCP connection but never completes WebSocket handshake. | `node ../tools/mock-rosbridge/server.js --hang` |
| `--drop` | Accepts connection, replies to the first ping, then forcibly drops. | `node ../tools/mock-rosbridge/server.js --drop` |
| `--delay <ms>` | Simulates high network latency (e.g. 500ms). | `node ../tools/mock-rosbridge/server.js --delay 500` |

---

## 3. Supported Protocol Operations

- **`call_service` (`/rosapi/get_time`):** Returns valid `service_response` with `{ time: { secs, nsecs } }` and `result: true`.
- **Other services:** Polite `result: false` response.
- **`publish` / `advertise`:** Logs a caution notice because Phase 3 is strictly read-only.
