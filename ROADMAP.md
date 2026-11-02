# JetRacer Control Center — Development Roadmap

---

## 1. Ground Rules & Principles

1. **Phase-by-Phase Discipline:** Work strictly one phase at a time. Do not jump ahead or write code for future phases until the current phase is fully implemented, tested, and approved.
2. **Never Assume ROS Topics or Services:** Do not guess topic names, message schemas, or node names. Everything ROS-related must remain marked as `NOT YET INSPECTED` until inspected on the live robot in Phase 4.
3. **Preserve Working Robot Configurations:** Never overwrite, upgrade, or reconfigure the working ROS 1 setup on the Jetson without explicit inspection and approval.
4. **Honesty on Hardware Verification:** Never claim any feature works with real hardware unless it was tested and confirmed on physical hardware. Everything tested only in simulation or local mocks must be documented as "Done but not hardware-tested".
5. **Quality Gate:** A phase is only considered complete when its test suite, typecheck, and lint pass with 100% real output.

---

## 2. Phase Milestones Checklist

| Phase | Milestone Name | Scope Description | Status |
| :---: | :--- | :--- | :---: |
| **0** | **Project Setup & Architecture** | Repository scaffolding, multi-platform structure, initial FastAPI backend, Vite+React+Tailwind frontend, Capacitor Android shell, test gates, and architecture docs. | **Done** |
| **1** | **Frontend UI/UX** | Comprehensive dark-first robotics UI, responsive navigation (mobile bottom tabs / desktop sidebar), persistent E-Stop, touch joystick, 9 console modules, canvas visualizers, theme toggle, Zustand stores, unit tests, and isolated simulation mode. | **Done (UI only, not connected to robot, not hardware-tested)** |
| **2** | **Backend Foundation** | FastAPI app factory, liveness/readiness probes, system metadata, sanitised config, multiplexed WebSocket manager with backpressure & rooms, uniform error envelopes, request-ID tracing, and 91% test coverage. | **Done (Backend skeleton, tested on dev machine only, not hardware-tested)** |
| **3** | **IP Connection** | Two-link connection architecture (Link A rosbridge + Link B FastAPI), connection wizard with address parser/validator, exponential backoff with jitter, field testing runbook, and mock rosbridge. | **Done (Tested against local mock only, not tested on robot)** |
| **4** | **ROS Integration** | ROS Master status detection with clock offset, rosapi discovery service with concurrency limit, controlled topic watcher (max 5 watches, heavy-type blocking, LaserScan reduction), user-confirmed topic registry, capability policy, and redacted inspection report export. | **Done (Tested against local mock rosbridge; not tested on robot)** |
| **5** | **Camera** | Real-time video stream player (HTTP MJPEG + WebSocket Compressed fallback), 16:9 canvas letterbox rendering, ref-counted cameraManager, client-side snapshot capture, quality presets & auto-adaptation, stall detection with backoff, and robot setup runbook. | **Done (Mock-tested only; not tested on robot)** |
| **6** | **LiDAR** | 2D LaserScan visualization (REP-103), Canvas radar grid, proximity zones & point classification, bare inf/nan JSON pre-parser, ref-counted LidarManager, stall watchdog & backoff, orientation stepper, and non-safety notices. | **Done (Mock-tested only; not tested on robot)** |
| **7** | **Mapping** | Real-time SLAM occupancy grid streaming, SLAM node launch control, and `.yaml`/`.pgm` map file manager. | Not started |
| **8** | **Manual Control** | Virtual on-screen joystick, keyboard bindings, speed limiters, steering trim calibration, and dead-man switch. | Not started |
| **9** | **Autonomous Navigation** | 2D Nav Goal dispatch, waypoint sequence planner, robot pose tracker, and path execution monitor. | Not started |
| **10** | **Robot System Management** | Jetson hardware health (CPU/GPU thermals, RAM, disk, jtop metrics), and systemd service start/stop controls. | Not started |
| **11** | **Database** | SQLite schema for persistent settings, navigation history, telemetry logs, and map file catalogue via SQLAlchemy. | Not started |
| **12** | **Capacitor Android Integration** | Native Android UI polish, touch gestures, haptic feedback, deep link handling, and mobile network reconnect. | Not started |
| **13** | **Security & Safety** | Heartbeat safety supervisor, software E-Stop, command timeout, and token-based LAN authentication. | Not started |
| **14** | **Testing** | End-to-end integration tests, mobile UI tests, simulated robot test harnesses, and latency benchmarks. | Not started |
| **15** | **Deployment** | Jetson systemd daemon setup, auto-start boot services, production APK build, and final robot verification. | Not started |

---

## 3. Phase 0 Progress Report

- **Date Completed:** 2026-11-01
- **Status:** **Done (Foundation verified; hardware not touched)**
- **What Was Created:**
  - Directory structure initialized with `frontend/`, `backend/`, `robot/`, `docs/`, `README.md`, and `ROADMAP.md`.
  - Frontend: Vite + React 19 + TypeScript 5.8 + Tailwind CSS v4 + shadcn/ui (Button, Card, Badge, Sonner, Separator) + Zustand + TanStack Query + React Router DOM + Vitest + React Testing Library.
  - Capacitor: Android platform initialized (`com.surajsaw.jetracer`), `capacitor.config.ts` configured with cleartext support for local Wi-Fi, Gradle project generated in `frontend/android`.
  - Backend: FastAPI application with `app.core.config` (Pydantic Settings), CORS handling, SQLite session setup, health endpoint (`GET /api/health`), and modular stubs for all planned subsystems.
  - Test suites: Pytest and Ruff linter on backend; Vitest smoke and route tests on frontend. All passing.
  - Live smoke checks: FastAPI server booted and verified via HTTP (`/api/health` -> 200 OK); Vite dev server booted and verified on port 5173 with network host binding.
- **Versions Installed:**
  - Node.js: `v24.16.0`, npm: `11.13.0`
  - Python: `3.14.5` (backend code strictly compatible with Python 3.8+)
  - Git: `2.54.0`
  - FastAPI: `0.162.0`, Uvicorn: `0.54.0`, SQLAlchemy: `2.1.6`, Pydantic: `2.14.2`, Ruff: `0.17.3`
  - React: `19.3.1`, Vite: `8.3.5`, Tailwind CSS: `4.3.3`, Capacitor: `8.6.0`, Vitest: `5.0.5`
- **Test Results:**
  - Frontend `npm run typecheck`: PASS (0 errors)
  - Frontend `npm run lint`: PASS (0 errors, 2 standard react-refresh component warnings in shadcn UI files)
  - Frontend `npm run build`: PASS (built production bundle in `frontend/dist/`)
  - Frontend `npm run test`: PASS (3 test suites, 3 passed)
  - Backend `ruff check .`: PASS (All checks passed)
  - Backend `pytest`: PASS (1 passed)
  - Live Backend Smoke: PASS (HTTP 200, valid JSON payload)
  - Live Frontend Smoke: PASS (HTTP 200, responds with title)
  - Capacitor sync: PASS (`npx cap sync android` completed with zero errors)
- **Known Issues / What is NOT Verified:**
  - Physical Robot: Never touched or connected. ROS topics remain strictly `NOT YET INSPECTED`.
  - Android APK: APK compilation (`./gradlew assembleDebug`) was skipped because JDK 17+ and Android SDK are not yet installed on this Windows development machine.
- **Next Steps:** Proceeded to Phase 1 (Frontend UI/UX).

---

## 4. Phase 1 Progress Report: Frontend UI/UX

- **Date Completed:** 2026-11-01
- **Status:** **Done (UI only, not connected to robot, not hardware-tested)**
- **What Was Created / Modified:**
  - **Design System & Shell:** Implemented dark-first robotics console with CSS variables theme switcher (Light / Dark / System), semantic status system (`StatusBadge`), persistent top app bar with single-tap Emergency Stop, connection status chip, responsive navigation (bottom 5-tab bar + "More" sheet on mobile; collapsible sidebar on desktop), and safe-area wrappers.
  - **Shared UI Components:** `EmergencyStopButton`, `StatusBadge`, `ConnectionChip`, `PageHeader`, `MetricCard`, `Gauge`, `VideoViewport`, `PanZoomCanvas`, `LidarCanvas`, `VirtualJoystick`, `ConfirmDialog`, `SimulationBanner`, `ThemeToggle`, `SafeAreaContainer`, `SkeletonCard`, `EmptyState`, `ErrorState`, `ErrorBoundary`.
  - **Pages Implemented (All 9 Modules):**
    - `Dashboard`: Connection card, telemetry grid, camera & LiDAR split viewports, quick launch actions, recent activity.
    - `Control`: Cockpit with portrait/landscape support, virtual touch joystick (pointer capture & auto-zeroing), keyboard WASD, Gamepad API listener, speed limiter slider, dead-man switch toggle, normalized readout.
    - `Camera`: 16:9 viewport with HUD overlay, disabled snapshot/record/stream controls with tooltips, driver specs.
    - `Lidar`: Interactive high-DPI polar laser scan canvas with range rings, point size and range sliders, proximity danger zone legend, scanner specs.
    - `Mapping`: 2D occupancy grid pan/zoom viewport, SLAM launch controls, empty map library, map metadata sheet.
    - `Navigation`: Map canvas with 2D Nav Goal, Pose Estimate, and Waypoints tool modes, waypoint queue, and fail-safe safety banner.
    - `System`: Hardware load & thermal gauges, OS profile, ROS node inspection placeholder, and typed confirmation shutdown/reboot dialogs.
    - `Settings`: 5 tabs (Connection with IPv4/hostname and port validators, Appearance, Control, Safety limits preview, About with backend health probe and factory reset).
    - `History`: Local 200-event ring buffer with type filtering (`safety`, `settings`, `navigation`, `system`, `general`), search, and clear log with confirmation.
    - `NotFoundPage`: 404 fallback page.
  - **State Stores & Services:**
    - `settingsStore`: Persisted via `localStorage` (robot IP, ports, theme, control preferences, safety limits).
    - `connectionStore`: Finite state machine (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `ERROR`) with transition guards.
    - `uiStore`: Sidebar collapse and mobile "More" sheet toggles.
    - `eventLogStore`: In-memory 200-item ring buffer for local safety and user event logging.
    - `validators`: Strict pure regex validators for IPv4, hostname, combined host, and TCP ports (1-65535).
    - `robotClient`: Clean abstraction with `NotConnectedClient` (zero network calls) and isolated `MockRobotClient` (isolated simulation mode).
  - **Simulation Mode:** Tree-shakable simulation harness isolated under `import.meta.env.VITE_ENABLE_SIMULATION`. Verified that zero mock payloads leak into standard production builds.
  - **Documentation:** Created `docs/UI_DESIGN.md` with complete wireframes, tokens, and navigation map. Updated `docs/ARCHITECTURE.md` with Zustand store specs.
- **Installed Packages / Tools:**
  - shadcn/ui primitives: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-progress`, `@radix-ui/react-scroll-area`, `@radix-ui/react-select`, `@radix-ui/react-slider`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`.
  - Testing & Accessibility: `axe-core` (v4.11.1).
- **Verification & Test Results:**
  - `npm run typecheck` (`tsc -b`): PASS (0 errors)
  - `npm run lint` (`eslint .`): PASS (0 errors, 3 standard shadcn UI export warnings)
  - `npm run test` (`vitest run`): PASS (9 test suites, 31 tests passed, including zero-network-on-load assertion, axe-core accessibility checks, pointer events, and store transitions)
  - `npm run build` (`tsc -b && vite build`): PASS (production dist output generated, 371 kB main JS / 115 kB gzip)
  - `npx cap sync android`: PASS (Synced latest web build into `frontend/android` with zero errors)
- **Known Limitations & Issues:**
  - Physical Robot: Never touched or connected. ROS topics remain strictly `NOT YET INSPECTED`.
  - Android APK: APK compilation was skipped because Android SDK is not installed on this Windows development machine. Web assets are fully synced to the native Android shell via `cap sync`.
- **Hardware Verification:**
  - **NOT HARDWARE TESTED.** Verified solely in local web preview, Vitest unit/component suite, and JSDOM. No connection to robot hardware was established.
- **Next Steps:** Proceed to Phase 2 (Backend Foundation).

---

## 5. Phase 2 Progress Report: Backend Foundation

- **Date Completed:** 2026-11-01
- **Status:** **Done (Backend skeleton, tested on dev machine only, not hardware-tested)**
- **What Was Created / Modified:**
  - **Part A (Phase 1 Audit):**
    - Audited frontend dependencies: removed redundant `"cn"` package and unused `"next-themes"`; re-aliased `cn` in all 18 shadcn UI components to internal `@/lib/utils`.
    - Proved tree-shaking: confirmed simulation marker `SIMULATION_MODULE_ACTIVE_MOCK_PAYLOAD_PHASE1` is absent from production builds.
    - Added JSDOM `HTMLCanvasElement.prototype.getContext` stub in `test/setup.ts`, eliminating test noise.
    - Generated 54 responsive UI screenshots across all 9 pages at 360x800, 800x360, and 1366x768 in dark and light themes under `docs/screenshots/phase1/` (all images < 125 kB).
    - Aligned `SQLAlchemy 2.1.6` references across `README.md`, `docs/ARCHITECTURE.md`, and `requirements.txt`.
    - Tagged `v0.2.1-phase1-audit` and merged to `main`.
  - **Part B (Phase 2 Backend Foundation):**
    - Application factory `create_app(settings: Optional[Settings] = None)` with full lifespan management, startup/shutdown hook registries (`core/lifecycle.py`), and OpenAPI interactive doc controls (disabled in production mode).
    - Central configuration `core/config.py` using `pydantic-settings` with strict production validation (prohibits `*` origins in production), safe default `127.0.0.1` binding, and documented placeholders for Phase 4 (`ROSBRIDGE_URL`) and Phase 13 (`AUTH_ENABLED`, `SECRET_KEY`).
    - Comprehensive `.env.example` documenting all configuration parameters.
    - Uniform error envelope and domain exception hierarchy (`NotFoundError`, `ValidationFailedError`, `ServiceUnavailableError`, `AppError`) with zero internal traceback leakage on unhandled 500 errors.
    - Contextvars-based Request-ID tracing middleware (`X-Request-ID` validation/generation), structured latency access logger, and security headers middleware (`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`).
    - REST Endpoints:
      - `GET /api/health`: Liveness probe returning application version and timestamp.
      - `GET /api/health/ready`: Readiness probe checking settings, data storage write access, and WebSocket manager, with honest `"robot": "not_integrated"`.
      - `GET /api/v1/info`: Metadata manifest reporting Python runtime, OS platform, process uptime, and honest capability map (`"not_implemented"` with target phase).
      - `GET /api/v1/config`: Non-secret sanitized operational configuration.
      - `GET /api/v1/ws/stats`: Real-time WebSocket connection count and room memberships.
    - Multiplexed WebSocket Manager (`services/ws_manager.py` & `api/ws.py`):
      - Framing envelope v1 (`type`, `id`, `channel`, `ts`, `payload`).
      - Client-to-server handlers for `ping`, `echo` (test only), `subscribe`, `unsubscribe`.
      - Server-to-client handlers for `welcome`, `pong`, `ack`, `subscribed`, `unsubscribed`, `error`, `event`.
      - Bounded per-client send queue (`put_nowait`) with dedicated writer task, dropping slow/stalled clients (`4008`) without blocking broadcasts or fast clients.
      - 30-second heartbeat inactivity watchdog (`4000`) and periodic system telemetry heartbeat on `system` channel.
      - Channel allowlist (`system`, `echo-test`) and phase reservation enforcement rejecting future channels (`ros`, `camera`, `lidar`, `map`, `control`, `safety`) with `CHANNEL_NOT_AVAILABLE`.
      - Origin validation and Phase 13 auth hook (`authenticate_ws`).
    - Tooling & Live Smoke Script:
      - `backend/scripts/ws_smoke.py`: Live end-to-end HTTP and WebSocket verification script.
      - `backend/scripts/dev.ps1`: Windows PowerShell developer task runner (`run`, `test`, `lint`, `format`, `smoke`).
- **Installed Packages & Versions:**
  - `pytest-asyncio==1.4.1`, `pytest-cov==7.1.0`, `mypy==2.4.1`, `coverage==7.17.0` (pinned in `requirements-dev.txt`).
- **Verification & Test Results:**
  - Ruff format & lint (`ruff format .`, `ruff check .`): PASS (0 errors across 26 source files).
  - Static type check (`mypy app`): PASS (0 errors across 26 source files).
  - Pytest with coverage (`pytest --cov=app --cov-report=term-missing`): PASS (**41 passed tests, 91% total coverage**).
  - Live smoke test (`ws_smoke.py` against live uvicorn server): PASS (All 5 verification stages green).
  - Frontend regression gate (`typecheck`, `lint`, `test`, `build`, `cap sync`): PASS (31 tests passed, 0 errors, 100% green).
- **Known Limitations & Issues:**
  - Physical Robot: Never touched or connected. ROS topics remain strictly `NOT YET INSPECTED`.
  - Jetson Python Compatibility: Installed dependencies require Python 3.10+ (and some 3.11+). If the Jetson runs an older OS (Ubuntu 18.04 with Python 3.6 or 20.04 with Python 3.8), the backend will require an isolated venv (via pyenv/deadsnakes), a container, or LAN offboard execution.
  - Android APK: APK compilation skipped because Android SDK is not installed on the dev machine.
- **Hardware Verification:**
  - **NOT HARDWARE TESTED.** Verified exclusively on local development machine with simulated ASGI tests and live local loopback sockets.
- **Next Steps:** Proceed to Phase 3 (IP Connection Flow) upon user approval.

---

## 6. Phase 3 Progress Report: IP Connection Flow

- **Date Completed:** 2026-11-01
- **Status:** **Done, tested against local mock only, not tested on the physical robot**
- **What Was Created / Modified:**
  - **Operator Handoff Review & Safety Audit:**
    - Read operator handoff notes (`docs/references/JETRACER_HANDOFF1.md` and `JETRACER_HANDOFF2.md.MD`); safeguarded private notes by adding `docs/references/` to `.gitignore`.
    - Created `docs/ROBOT_STATE.md` documenting JetRacer hardware (Nano eMMC, RP2040, RPLIDAR A1, TGZ controller), Ubuntu 18.04 / Python 3.6 / ROS Melodic environment, and continuous 20 Hz zero-velocity publication by `joy_teleop.py`.
    - Updated `docs/ROS_TOPICS.md` with an "Operator-Reported, Unverified Topics" section while keeping all verification status strictly `NOT YET INSPECTED`.
  - **Two-Link Architecture Alignment:**
    - Documented Link A (rosbridge WebSocket port 9090, mandatory for robot state) and Link B (FastAPI backend port 8000, optional auxiliary API) in `docs/ARCHITECTURE.md` and `docs/DEPLOYMENT.md`.
  - **Backend LAN Development Support:**
    - Added `ALLOWED_ORIGIN_REGEX: Optional[str] = None` to `backend/app/core/config.py` with syntax compilation validation and strict production guard rejecting match-all wildcards.
    - Updated `CORSMiddleware` in `main.py` and `validate_origin()` in `services/ws_manager.py` to match client origins against the regex.
    - Added unit tests in `test_settings.py` and `test_websocket.py` (all 48 tests passing).
  - **Robot Field Tools & Scripts (`robot/`):**
    - `robot/scripts/preflight.sh`: 100% read-only diagnostic audit of OS, kernel, resources, IP, ROS distro, master status, and rosbridge installation.
    - `robot/scripts/install_rosbridge.sh`: Purely additive apt installer requiring operator typed confirmation (`INSTALL`).
    - `robot/launch/jetracer_rosbridge.launch`: Standard launch wrapper for port 9090 on `0.0.0.0` with `authenticate: false`.
    - `robot/scripts/start_rosbridge.sh`: Safe launcher that verifies master is alive before starting port 9090.
    - `robot/scripts/collect_ros_info.sh`: 100% read-only deep inspection tool querying all nodes, topics, Hz rates (3s timeout per topic), services, parameters, and TF transforms into `~/jetracer_inspection_<timestamp>.txt`.
    - `robot/README.md` and `docs/FIRST_CONNECTION_RUNBOOK.md` detailing step-by-step procedures and fallback matrix for tomorrow's live college visit.
  - **Dev-Only Mock Rosbridge Server (`tools/mock-rosbridge/`):**
    - Standalone Node.js server speaking rosbridge v2 protocol on `127.0.0.1:9090`.
    - Handles `/rosapi/get_time` with live timestamps; rejects unallowed services with polite `result: false`.
    - Edge-case testing flags: `--refuse`, `--hang`, `--drop`, `--delay <ms>`.
    - NPM script: `npm run mock:rosbridge`.
  - **Frontend UI & Connection Lifecycle:**
    - Address parser & URL builder (`utils/validators.ts`): Parses bare IPs, hostnames (`jetracer.local`), URLs, port numbers, trailing slashes; detects loopback addresses and mixed-content HTTPS risks; explicitly rejects `0.0.0.0` and `255.255.255.255`.
    - Rosbridge client wrapper (`services/rosbridgeClient.ts`): State machine (`disconnected`, `connecting`, `connected`, `reconnecting`, `error`), connect timeout (5000 ms), exponential backoff with jitter (1s -> 2s -> 4s -> max 10s, max 5 attempts), heartbeat via `/rosapi/get_time` (5s active, 15s battery-saver hidden), and online/offline listeners.
    - **Strict Read-Only Enforcement:** Guard allowing solely `/rosapi/get_time` service calls; throws `SECURITY VIOLATION` error in dev/test if publish, advertise, subscribe, or any other service is invoked.
    - UI Components:
      - `ConnectionWizard` in Settings with target address input, Quick-fill Mock (127.0.0.1) button, localStorage persistence and forget button, Link A & Link B diagnostic cards, and Redacted Copy Diagnostics export.
      - `ConnectionChip` in top header with status-colored indicator dots, latency display, and tooltips.
      - Prominent safety warning banners and confirmation modals on `ControlPage.tsx` and `EmergencyStopButton.tsx` warning that software E-Stop is NOT wired in Phase 3.
- **Installed Packages / Tools:**
  - `ws==8.22.1` and `@types/ws==8.5.14` added to frontend devDependencies.
- **Verification & Test Results:**
  - `backend/`: `ruff check .` passed (0 errors), `pytest` passed (**48 tests passed**).
  - `frontend/`: `npm run typecheck` passed (0 errors), `npm run lint` passed (0 errors), `npm run test` passed (**61 tests passed across 13 test suites**), `npm run build` passed (401 kB JS bundle).
- **Known Limitations & Issues:**
  - Physical Robot: NOT YET TESTED ON THE PHYSICAL ROBOT. Testing scheduled for tomorrow's field visit.
  - College Wi-Fi Isolation: University networks frequently block peer-to-peer packets; runbook instructs using smartphone mobile hotspot as fallback.
  - Jetson Python 3.6: FastAPI backend cannot be installed directly on Jetson Nano; Link B is treated as optional in Phase 3.
- **Hardware Verification:**
  - **NOT HARDWARE TESTED.** Verified solely against local mock rosbridge server and automated Vitest/Pytest suites.
- **Next Steps:** Physical field testing tomorrow following `docs/FIRST_CONNECTION_RUNBOOK.md`, followed by Phase 4 (ROS Integration & Topic Mapping).

---

## 7. Phase 4 Progress Report (ROS Integration & Introspection)

- **Date Completed:** 2026-11-02
- **Status:** **Done (Tested against extended local mock rosbridge v2; not tested on physical robot)**
- **What Was Created / Modified:**
  - **ROS Capability Policy (`services/rosPolicy.ts`):** Strict allow-list of 11 approved read-only rosapi services (`/rosapi/get_time`, `/rosapi/topics`, `/rosapi/topic_type`, `/rosapi/topics_and_raw_types`, `/rosapi/nodes`, `/rosapi/node_details`, `/rosapi/services`, `/rosapi/service_type`, `/rosapi/publishers`, `/rosapi/subscribers`, `/rosapi/message_details`). Deny regex strictly rejecting any parameter manipulation (`set_param`, `delete_param`, `get_param`) or destructive services (`shutdown`, `kill`, `reboot`, `restart`, `launch`, `spawn`). Static and wire-level security verification tests (`rosPolicySecurity.test.ts`).
  - **Runtime ROS Master Status Detection (`services/rosStatusService.ts`, `store/rosStatusStore.ts`):** Live status (`ok`, `degraded`, `rosbridge_only`, `master_unreachable`, `disconnected`) with flapping protection / hysteresis. Clock offset calculation comparing robot ROS clock with browser clock with plain-language explanations.
  - **ROS Discovery Service (`services/rosDiscoveryService.ts`, `store/rosDiscoveryStore.ts`):** Concurrency-bounded introspection (max 4 concurrent requests), state diff tracking (highlighting new/removed topics and nodes), on-demand publisher/subscriber lookup, auto-refresh intervals with document visibility pausing, and manual topic fallback.
  - **Controlled Topic Watcher (`services/subscriptionManager.ts`, `store/subscriptionStore.ts`):** On-demand user-initiated topic subscription (max 5 watches), customizable rate throttling (default 200ms), heavy-type blocking (`sensor_msgs/Image`, `sensor_msgs/CompressedImage`, `sensor_msgs/PointCloud`, `sensor_msgs/PointCloud2`, `nav_msgs/OccupancyGrid`), LaserScan summary reduction (ranges array replaced with min/max/mean stats), defensive value decoding (NaN/Infinity safety), and sliding-window measured Hz.
  - **User-Confirmed Topic Registry (`services/topicRegistry.ts`, `store/topicRegistryStore.ts`):** 10 typed application roles (`cmd_vel`, `odometry`, `imu`, `laser_scan`, `occupancy_map`, `camera_image`, `joystick`, `tf`, `tf_static`, `battery`). Topic suggestions strictly filtered by expected ROS message types. Verification state machine (`unmapped`, `mapped_unverified`, `verified_live`, `stale`, `missing`) requiring real incoming messages. JSON profile export and versioned schema import (`version: 1.0.0`).
  - **Frontend UI & System Tabs (`pages/System/`):** Complete tabbed interface with `Status`, `Topics`, `Nodes`, `Services`, `Watch` (Topic Inspector), and `Registry`. Redacted ROS Inspection Report modal with IP masking. Compact `RosStatusCard` on Dashboard. Secondary `RosHeaderIndicator` in top application header.
  - **Extended Mock Rosbridge (`tools/mock-rosbridge/server.js`):** Supports rosapi introspection services, fake computation graph with strictly non-robot mock names (`/mock_world/*`), rate-throttled synthetic telemetry publishers with NaN/Infinity test values, and failure simulation flags (`--refuse`, `--hang`, `--drop`, `--no-rosapi`, `--flood`).
  - **Documentation & Verification Checklist:** `docs/PHASE4_ROBOT_VERIFICATION.md` field testing checklist, updated `docs/ROS_TOPICS.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/UI_DESIGN.md`, and 7 verification screenshots captured at 1366x768 and 360x800 in `docs/screenshots/phase4/`.
- **Verification & Test Results:**
  - `backend/`: `ruff format --check .` passed, `ruff check .` passed, `mypy app` passed (0 errors in 26 source files), `pytest --cov=app` passed (**48 tests passed, 91% coverage**).
  - `frontend/`: `npm run typecheck` passed (0 errors), `npm run lint` passed (0 errors), `npm test` passed (**85 tests passed across 19 test suites**), `npm run build` passed (production build in 746ms; `roslib` lazy-loaded into independent 248 kB chunk).
  - Android: `npm run cap:sync` passed.
  - Shell scripts: `bash -n` passed on all 4 scripts in `robot/scripts/`.
- **Hardware Verification:**
  - **NOT HARDWARE TESTED.** Verified solely against extended local mock rosbridge server and automated Vitest/Pytest suites. Physical robot testing scheduled at college.

---

## 8. Phase 5 Progress Report (Camera Module)

- **Date Completed:** 2026-11-02
- **Status:** **Done (Tested against extended local mock rosbridge + mock web_video_server; not tested on physical robot)**
- **What Was Created / Modified:**
  - **Camera Service Layer (`services/camera/`):**
    - `cameraTypes.ts`: Source types (`web_video_server`, `rosbridge_compressed`, `none`), presets (`low`, `medium`, `high`, `auto`, `custom`), metrics interfaces (`fps`, `width`, `height`, `bandwidthKbps`, `droppedFrames`, `latencyMs`), frame events.
    - `cameraUrl.ts`: Pure URL builder for `/stream` and `/snapshot` with parameter clamping, query encoding, base topic resolution, and browser mixed-content guard.
    - `WebVideoServerSource.ts`: Primary HTTP MJPEG streamer on port 8080 with stall detection (3000ms), exponential backoff with jitter (max 8 attempts), and real-time FPS/bandwidth calculations.
    - `rosbridgeCompressedSource.ts`: Fallback WebSocket transport subscribing to `sensor_msgs/CompressedImage` with latest-frame-wins drop policy, base64 JPEG decode to Blob/ImageBitmap, memory release (`bitmap.close()`), and clock-adjusted latency.
    - `cameraManager.ts`: Singleton coordinator with consumer ref-counting (`attachConsumer` / `detachConsumer`), auto-quality adaptation loop with hysteresis (10s dwell time), and client-side snapshot capture with timestamped PNG downloads.
  - **Evolved Video Viewport (`components/common/VideoViewport.tsx`):**
    - 16:9 aspect ratio preservation with black letterboxing rendered via HTML5 Canvas and `requestAnimationFrame`.
    - Fullscreen API support with CSS pseudo-fullscreen fallback, Android back button popstate handling, Screen Wake Lock API, and 3-second auto-hide controls overlay.
    - Toggleable HUD overlay showing LIVE state, transport badge, FPS, resolution, bandwidth, drop counter, and latency.
    - Multi-view integration across Camera page (`camera_page`), Dashboard (`dashboard_preview`), and Control page (`control_landscape` / `control_portrait`).
  - **Camera Page UI (`pages/Camera/CameraPage.tsx`):**
    - Dynamic image topic discovery (`sensor_msgs/Image` and `sensor_msgs/CompressedImage`), base topic grouping, Topic Registry role (`camera_image`) assignment awareness, and manual topic fallback.
    - Dual transport selector (`web_video_server` vs `rosbridge`), port configuration, quality preset selector, and explicit Start/Stop stream button (autoStart toggle strictly default OFF).
    - Diagnostic drawer with command runbook for Jetson Nano terminal.
  - **ROS Capability Policy Update (`services/rosPolicy.ts`):**
    - Added `assertCameraCompressedSubscriptionAllowed`: enforces that only `RosbridgeCompressedSource` can subscribe to `sensor_msgs/CompressedImage`, throttle $\ge 100\text{ ms}$, max 1 camera subscription over rosbridge.
    - Generic watcher tab remains blocked from subscribing to camera streams.
    - Raw uncompressed `sensor_msgs/Image` is strictly prohibited from WebSocket transmission.
    - Publishing and parameter writes remain strictly denied.
  - **Robot-Side Scripts (`robot/`):**
    - `robot/scripts/check_camera.sh`: Read-only camera diagnostic script with `--probe` hardware capture flag.
    - `robot/scripts/install_camera_stack.sh`: Safe package installer requiring typed `INSTALL` confirmation.
    - `robot/launch/jetracer_web_video.launch`: Launch file for `web_video_server` on port 8080.
    - `robot/scripts/start_camera.sh`: Startup wrapper.
  - **Dev-Only Mock Server (`tools/mock-rosbridge/server.js`):**
    - Synthetic `sensor_msgs/CompressedImage` publisher using pinned dev dependency `jpeg-js`.
    - Mock HTTP `web_video_server` on port 8080 providing `/stream` (multipart MJPEG) and `/snapshot` (single JPEG) with CORS headers.
    - Failure injection flags: `--camera-stall`, `--camera-fail`, `--camera-cors-block`.
  - **Documentation & Evidence:**
    - `docs/PHASE5_ROBOT_VERIFICATION.md` runbook.
    - 7 screenshots captured in `docs/screenshots/phase5/`.
- **Verification & Test Results:**
  - `frontend/`: `npm run typecheck` passed (0 errors), `npm run lint` passed (0 errors), `npm test` passed (**104 tests passed across 24 test suites**), `npm run build` passed (bundle built in 763ms).
  - `backend/`: `pytest` passed (**48 tests passed**), `ruff check backend` passed, `mypy backend` passed (0 errors in 37 source files).
  - Android: `npx cap sync` passed.
  - Mock audit: 0 mock strings in `dist/assets/`, `npm audit --omit=dev` 0 vulnerabilities.
- **Hardware Verification:**
  - **NOT HARDWARE TESTED.** Verified solely against extended local mock rosbridge + mock web_video_server. Physical robot testing scheduled at college.

---

## 9. Field Fix Pass Progress Report: v0.6.2-field-fixes (Post First Robot Contact)

- **Date Completed:** 2026-11-02
- **Status:** **Done (Field fixes verified against extended local mock; tested on robot by operator earlier)**
- **What Was Created / Modified:**
  - **Bug 1 (Indefinite Auto-Reconnect & Jittered Backoff):** Reconnect loop no longer gives up after 5 attempts. Retries indefinitely while auto-reconnect is active with exponential backoff capped at 30s + 20% jitter. Added "Stop trying" control to cancel retries, tab visibility throttling, and backoff reset after 10s stable connection.
  - **Bug 2 (Honest ROS Status on Link Drop):** Eliminated spurious `master_unreachable` status when WebSocket link drops; status now correctly reports `disconnected` with explanation `"Link to robot is down; the ROS master state is unknown"`. Clarified TCP socket error messages to specify rosbridge rather than robot.
  - **Bug 3 (Strict Hostname & Dotted Address Validation):** Fixed `isValidHostname` regex to reject purely numeric dotted strings (e.g. `192.168137.43`), ensuring typos cannot bypass IPv4 validation.
  - **Bug 4 (Latency & Clock Offset Accuracy):** Implemented midpoint RTT clock offset formula $t_{\text{robot}} - (t_{\text{send}} + \text{rtt}/2)$. Added rolling median latency window (5 samples) and high-latency guidance hint when median $> 250\text{ms}$.
  - **Bug 5 (System Page Dangerous Buttons Disarmed):** Visibly disabled `Restart Backend`, `Reboot Jetson`, and `Shutdown` buttons with informative tooltips explaining Phase 10 integration and ensuring zero network calls or modal dialogues.
  - **Bug 6 (Stale Labels Removed):** Replaced hard-coded `v0.2.0 / Phase 1 UI` in RootLayout footer with dynamic version `0.6.2 / Phase 5 Integration`. Updated all "NOT WIRED IN PHASE 3" labels to "NOT WIRED YET (planned for Phase 8/13)".
  - **Bug 7 (Settings Hints Added):** Added connection guidance notes for hotspot, Tailscale, and LAN subnets, plus reachability note explaining ICMP limitations in web browsers.
- **Verification & Test Results:**
  - **Frontend:** 125 tests passed across 30 test files (including 6 dedicated field-fix test suites: `reconnectPolicy.test.ts`, `rosStatusDerivation.test.ts`, `addressValidationFix.test.ts`, `latencyClockOffset.test.ts`, `systemPageDangerousButtons.test.tsx`, `staleLabels.test.ts`).
  - **Typecheck & Lint:** `tsc -b` passed with 0 errors, `eslint .` passed with 0 errors.
  - **Production Build & Security:** Vite build succeeded, 0 mock strings in `dist/assets/`, `npm audit --omit=dev` reported 0 vulnerabilities.
  - **Backend:** 48 pytest passed, `ruff check backend` passed, `mypy backend` passed with 0 errors across 37 files.
  - **Capacitor Android:** `npx cap sync` passed.
  - **Visual Capture:** 4 screenshots captured in `docs/screenshots/field-fix-1/`.
- **Hardware Verification:**
  - **Tested against local mock rosbridge; not tested on robot hardware by assistant.** (Field reproduction derived from physical test by operator on 2026-11-02).

---

## 10. Phase 6 Progress Report: LiDAR Visualization

- **Date Completed:** 2026-11-02
- **Status:** **Done (Mock-tested only; not tested on robot hardware)**
- **What Was Created / Modified:**
  - **Rosbridge Serialization & Defensive Parsing:** Developed `sanitizeRosJson` in `frontend/src/services/rosbridgeClient.ts` to neutralize bare, non-standard ECMAScript `Infinity`, `-Infinity`, and `NaN` tokens emitted by ROS 1 Melodic rosbridge server into standard `null` values before `JSON.parse`.
  - **Typed Scan Decoder & Classifications:** Float32Array-backed parser in `frontend/src/services/lidar/scanDecoder.ts` classifying rays into `VALID`, `OUT_OF_RANGE`, `TOO_CLOSE`, and `INVALID_OR_NAN`.
  - **REP-103 Geometry & Trigonometric Cache:** `scanGeometry.ts` implementing ROS REP-103 standard (+X forward, +Y left, CCW positive angle increment), pre-allocated sin/cos cache, polar-to-Cartesian transforms, and 4-sector distance calculations.
  - **Scan Processor & Streaming Watchdog:** `scanProcessor.ts` tracking publication Hz, bandwidth, frozen scan detection (14 consecutive identical comparisons), and frame_id change detection.
  - **Ref-Counted Lidar Manager:** `lidarManager.ts` managing single application-wide subscription (`MAX_LIDAR_SUBSCRIPTIONS = 1`), stall watchdog (2.0s without scans -> `stalled`), exponential backoff auto-reconnect (1s, 2s, 4s, 8s, 16s with ±20% jitter), and 50-scan ring buffer JSON export.
  - **Radar Canvas & Proximity UI:** `frontend/src/components/common/LidarCanvas.tsx` rendering high-DPI polar radar grid, danger ($\le 0.35\text{m}$), caution ($\le 0.70\text{m}$), and clear ($> 0.70\text{m}$) zones, robot footprint, point inspection crosshair reticle, and non-safety warning banner.
  - **Lidar Page & Dashboard Card:** `pages/Lidar/LidarPage.tsx` with dynamic discovery dropdown, throttle rate selector (50ms, 100ms, 200ms, 500ms), orientation stepper ($0^\circ, 90^\circ, 180^\circ, 270^\circ$ and $\pm 5^\circ$), and `pages/Dashboard/DashboardLidarCard.tsx` live preview card.
  - **Mock Server Extensions:** `tools/mock-rosbridge/server.js` generating synthetic 2D scans for `/mock_world/lidar_main/scan` and secondary scanner, room boundary walls + obstacle boxes, and CLI fault flags (`--lidar-inf-nan-bare`, `--lidar-stall`, `--lidar-flood`, etc.).
  - **Robot Diagnostics Script:** `robot/scripts/check_lidar.sh` reporting `/dev/ttyUSB*`, `lsusb`, `dialout` group membership, topic Hz, and Python range statistics.
- **Verification & Test Results:**
  - **Vitest Frontend Tests:** 164 passed across 38 test files (including `lidarIntegration.test.ts`, `lidarManager.test.ts`, `lidarPolicy.test.ts`, `scanDecoder.test.ts`, `scanGeometry.test.ts`, `scanProcessor.test.ts`, and `LidarPage.test.tsx`).
  - **TypeScript & Lint:** `tsc -b` passed with 0 errors, `eslint .` passed with 0 errors.
  - **Production Build:** Vite built in 709ms, verified 0 mock strings in `dist/assets/*`.
  - **Accessibility (axe-core):** 0 critical or serious violations on LidarPage.
  - **Backend Tests:** 48 pytest passed, `ruff` passed, `mypy` passed across 37 source files.
  - **Capacitor Android:** `npx cap sync android` completed in 0.255s.
  - **Visual Capture:** 5 screenshots captured in `docs/screenshots/phase6/`.
- **Hardware Verification:**
  - **Mock-tested only; not tested on robot.** Real robot verification scheduled for next college hardware session.

---

## 11. Reusable Progress Report Template (Copy after each phase)

```markdown
### Phase X Progress Report: [Phase Title]
- **Date Completed:** YYYY-MM-DD
- **Status:** [Done / Done but not hardware-tested]
- **What Was Created / Modified:**
  - [Bullet points of deliverables]
- **Installed Packages / Tools:**
  - [List any new packages added and their versions]
- **Verification & Test Results:**
  - [Commands executed and their outputs]
- **Known Limitations & Issues:**
  - [Any unresolved bugs, performance constraints, or missing prerequisites]
- **Hardware Verification:**
  - [Explicitly confirm whether tested on physical hardware or only mocked/simulated]
- **User Decisions Needed:**
  - [Questions or design choices for the operator]
```
