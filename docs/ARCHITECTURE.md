# JetRacer Control Center — Architecture Specification

> **STATUS:** Phase 0 Architecture Blueprint. All hardware integrations, telemetry streams, ROS communications, and security policies are planned and NOT yet hardware-tested or inspected on the physical robot.

---

## 1. System Overview

JetRacer Control Center is an integrated robotics management interface designed to eliminate the need for direct SSH sessions or HDMI display cables when operating the Waveshare / NVIDIA JetRacer ROS AI Kit. It provides a multi-platform operator interface (responsive web app, installable Android APK via Capacitor, and desktop browser client) communicating over the local Wi-Fi network with an on-robot FastAPI backend and a ROS 1 ecosystem (`rosbridge_suite`).

```mermaid
flowchart TD
    subgraph OperatorDevice["Operator Client (Phone / Tablet / Laptop)"]
        UI["React 19 + Vite + Tailwind UI"]
        Store["Zustand State & TanStack Query"]
        CapBridge["Capacitor Android Shell"]
        ROSLib["roslibjs Client"]
    end

    subgraph JetsonHost["NVIDIA Jetson Host (Ubuntu Linux)"]
        subgraph Backend["FastAPI Backend (Port 8000)"]
            REST["REST API (/api/*)"]
            WS["WebSocket Endpoints (/ws/*)"]
            Safety["Safety Supervisor & Watchdog"]
            DB[(SQLite / PostgreSQL DB)]
            FS["Local Maps / Config Storage"]
        end

        subgraph ROSLayer["ROS 1 Ecosystem (Melodic / Noetic)"]
            Rosbridge["rosbridge_server (Port 9090 WebSocket)"]
            RosMaster["ROS Master / roscore"]
            CameraNode["Camera Node (CSI / USB)"]
            LidarNode["2D LiDAR Node"]
            SlamNode["SLAM Node (Gmapping / Cartographer)"]
            NavNode["Move Base / Path Planner"]
            MotorNode["JetRacer Motor & Servo Controller"]
        end
    end

    UI -->|REST Operations| REST
    UI -->|High-rate Telemetry| WS
    ROSLib -->|ROS Messages & Services| Rosbridge
    REST --> DB
    REST --> FS
    Safety -->|Emergency Brake / Heartbeat| MotorNode
    Rosbridge <--> RosMaster
    RosMaster <--> CameraNode
    RosMaster <--> LidarNode
    RosMaster <--> SlamNode
    RosMaster <--> NavNode
    RosMaster <--> MotorNode
```

---

## 2. Planned Modular Subsystems

| Subsystem | Planned Backend Folder | Planned Implementation Phase | Primary Responsibility |
| :--- | :--- | :--- | :--- |
| **Robot Connection** | `app/api/`, `app/core/` | Phase 3 | Dynamic IP discovery, target reachability ping, persistent host settings, and connection heartbeat. |
| **ROS Integration** | `app/ros/` | Phase 4 | ROS topic inspection, service proxying, parameter retrieval, and rosbridge WebSocket session lifecycle. |
| **Camera Streaming** | `app/services/` | Phase 5 | WebRTC/MJPEG camera proxying, frame rate scaling, resolution adjustments, and latency optimization. |
| **LiDAR Visualization** | `app/services/`, `app/ros/` | Phase 6 | 2D laser scan parsing, point cloud downsampling, obstacle proximity alerts, and polar coordinate rendering. |
| **Mapping & SLAM** | `app/services/` | Phase 7 | SLAM launch orchestration, occupancy grid map tile streaming, map saving (`.yaml` / `.pgm`), and map listing. |
| **Manual Control** | `app/safety/`, `app/ros/` | Phase 8 | Virtual joystick control, keyboard bindings, steering trim calibration, and acceleration profiling. |
| **Autonomous Navigation** | `app/services/`, `app/ros/` | Phase 9 | Waypoint sequence delivery, 2D goal pose dispatch, localization verification, and path obstacle replanning. |
| **System Management** | `app/services/` | Phase 10 | Jetson hardware health (CPU, GPU, RAM, disk, thermal zones, Tegrastats/jtop), and systemd service controls. |
| **Database & History** | `app/database/`, `app/models/` | Phase 11 | SQLite persistence for navigation logs, telemetry events, saved configurations, and map catalogue metadata. |
| **Safety Supervisor** | `app/safety/` | Phase 8 & Phase 13 | Hardware/software watchdog, packet loss dead-man switch, speed limiting, and unconditional Emergency Stop (E-Stop). |

---

## 3. Communication Protocols and Data Flow

1. **Standard Operations (REST API):**
   - Transports CRUD operations, system configurations, map management, historical queries, and service triggers over HTTP/1.1 (`/api/*`).
   - Clean separation of concerns with standard HTTP response codes and typed JSON payloads.

2. **Real-time Subsystem Telemetry (WebSockets):**
   - Direct duplex WebSockets (`/ws/*`) for high-frequency internal telemetry (e.g. CPU/GPU thermals, motor feedback) without polling overhead.

3. **Robotics Protocol (`rosbridge_suite`):**
   - The browser and Capacitor client connect directly or via backend proxy to `rosbridge_server` (standard port `9090`) using `roslibjs`.
   - Used for streaming ROS standard topics (`sensor_msgs/LaserScan`, `geometry_msgs/Twist`, `nav_msgs/OccupancyGrid`, `nav_msgs/Odometry`).
   - Rosbridge protocol specifications and actual topic mappings remain marked as **NOT YET INSPECTED** until Phase 4.

---

## 4. Storage Architecture

- **Primary Database:** Local SQLite database (`sqlite:///./data/jetracer.db`) stored on the Jetson flash storage. SQLite provides zero-configuration, zero-dependency embedded transactions ideal for single-robot deployments.
- **Relational Schema Readiness:** Built on top of SQLAlchemy 2.1.6 (2.x ORM). All database access uses declarative models and session factories. If scaling to a multi-robot fleet or central telemetry server in the future, transitioning to PostgreSQL requires modifying only the `DATABASE_URL` environment configuration.
- **Large Binary Files (Maps & Logs):** 2D SLAM maps (`.yaml` metadata and `.pgm` bitmap files) are stored directly on the Jetson filesystem under a dedicated storage directory, with file metadata, timestamps, and thumbnails catalogued in SQLite.

---

## 5. Network, Safety, and Security Principles

### Network Design (Local-First)
- **Zero Cloud Dependency:** JetRacer Control Center operates exclusively over the local area network (LAN / Wi-Fi). No external internet connectivity, paid APIs, or telemetry beacons are utilized.
- **Android Cleartext Policy:** Android 9+ enforces HTTPS by default. In Phase 0-12 development, `cleartext: true` in `capacitor.config.ts` and `android:usesCleartextTraffic="true"` in the Android manifest allow local LAN communication with `http://<JETSON_IP>:8000` and `ws://<JETSON_IP>:9090`. Complete TLS hardening (WSS/HTTPS) is scheduled for Phase 13.

### Safety Design (Required for Physical Robot Testing)
- **Watchdog / Dead-Man Switch:** Velocity commands (`geometry_msgs/Twist`) must have an active heartbeat (e.g. every 100-200ms). If communication drops for more than 500ms, the robot controller automatically zeros the velocity vector and applies braking.
- **Hardware Emergency Stop:** The UI will feature a prominent, sticky E-Stop button that immediately dispatches stop frames and cuts motor enable lines. Regardless of software state, the operator must always maintain physical access to the JetRacer's hardware battery power switch.
- **Software Speed Clamping:** The backend enforces maximum linear and angular speed caps regardless of raw user input, preventing accidental high-speed collisions in confined spaces.

---

## 6. Python Version Compatibility Note (Jetson vs Development Host)

- **Development Environment:** Windows host running modern Python 3.14.
- **Jetson Runtime Environment:** NVIDIA Jetson devices running JetPack 4.x / 5.x with Ubuntu 18.04 (ROS 1 Melodic) or Ubuntu 20.04 (ROS 1 Noetic) typically run **Python 3.6, Python 3.8, or Python 3.10**.
- **Compatibility Guideline:**
  - Backend source code must adhere strictly to Python 3.8+ compatible syntax (e.g., using `typing.List`, `typing.Optional`, `typing.Dict`, avoiding `match/case` statements and union operators `|` in type annotations).
  - All dependency versions specified in `backend/requirements.txt` will be validated against the Jetson's specific Python runtime during Phase 15 deployment. If the Jetson runs Python 3.8, compatible wheels for FastAPI, Pydantic, and SQLAlchemy are available.

---

## 7. Real vs Simulated Data Policy

- **Zero Mock / Fake Telemetry in Production:** No fake velocity values, synthesized camera streams, or simulated LiDAR ranges may be emitted by production backend services or UI pages.
- **Explicit Labelling:** Any testing stubs or simulation adapters developed in Phase 14 or enabled via local dev flags must be isolated under separate test harnesses or clearly stamped with a visual "SIMULATED DATA" badge in the UI. In Phase 0 & 1, all pages connect to a `NotConnectedClient` by default with zero outgoing network traffic.
- **Tree-Shaking Isolation:** Simulated data generators in `frontend/src/simulation/` are guarded behind compile-time `import.meta.env.VITE_ENABLE_SIMULATION`. In standard production builds, all simulation code and markers are stripped out by Vite/Rollup.

---

## 8. Frontend Architecture & State Management (Phase 1)

### 8.1 State Architecture (Zustand Stores)
The client UI relies on lightweight, decoupled Zustand stores located in `frontend/src/store/`:
- **`connectionStore`**: Finite state machine governing connection states (`DISCONNECTED`, `CONNECTING`, `CONNECTED`, `RECONNECTING`, `ERROR`). Implements pure transition guards (`canTransition()`), latency tracking, reconnect counter, and last-seen timestamps.
- **`settingsStore`**: Persistent operator preferences via `localStorage`:
  - Target Robot IP / Hostname (default `192.168.1.100`), Backend Port (`8000`), Rosbridge Port (`9090`), Camera Port (`8080`)
  - Theme mode (`dark`, `light`, `system`)
  - Control settings: Inverted steering, dead-man switch requirement, max speed cap (0.1 to 1.0), steering sensitivity (0.1 to 2.0), gamepad index
  - Safety limits: Max linear velocity (0.1 to 1.5 m/s), max angular velocity (0.2 to 3.0 rad/s), obstacle stop distance (0.1 to 1.0 m)
- **`uiStore`**: Navigation shell states, desktop sidebar collapse toggle, and mobile "More" drawer sheet toggle.
- **`eventLogStore`**: High-performance 200-item in-memory ring buffer recording timestamped safety triggers, navigation goals, setting updates, and system events.

### 8.2 Client Service Layer
- **`robotClient`**: Contract defining `connect()`, `disconnect()`, `sendVelocity()`, `emergencyStop()`, `getTelemetry()`, and telemetry subscription listener.
- **`NotConnectedClient`**: Default production client in Phase 1. Performs zero outbound network calls, emits no fake values, and safely drops control frames without throwing errors.
- **`MockRobotClient`**: Isolated development harness enabled only when `VITE_ENABLE_SIMULATION === 'true'`. Emits clearly stamped synthetic telemetry and marks `isSimulated: true`.

### 8.3 Mobile & Responsive Ergonomics
- Responsive breakpoints: Mobile (`< 768px`) utilizes an accessible top header and a fixed 5-item bottom tab bar (`Dashboard`, `Control`, `Camera`, `Nav/Map`, `More`); Tablet/Desktop (`>= 768px`) displays a collapsible left sidebar with full navigation.
- Touch ergonomics: 44×44px minimum touch targets, hardware-accelerated High-DPI canvas (`PanZoomCanvas`, `LidarCanvas`), zero-dependency virtual touch joystick with pointer capture and automatic zeroing on window blur, pointer cancel, or touch release.
- Persistent Emergency Stop: Sticky E-STOP button mounted in the application header across all viewports.

