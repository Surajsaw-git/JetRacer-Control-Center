# JetRacer Control Center

JetRacer Control Center is a comprehensive, multi-platform robotics command and telemetry dashboard designed to control and monitor the NVIDIA JetRacer ROS AI Kit over a local Wi-Fi network. Running simultaneously as a responsive React web application, an installable Android mobile application (via Capacitor), and a desktop browser interface, it eliminates the need for direct SSH terminals or HDMI monitor connections during autonomous navigation, mapping, and driving experiments.

> **PROJECT STATUS (PHASE 6 COMPLETED):**
> Phase 6 LiDAR Visualization is complete:
> - **High-Performance 2D Planar Radar Canvas:** HTML5 Canvas polar radar rendering with concentric metric range rings ($0.5\text{m}$ to $8.0\text{m}$), 30° azimuth radials, robot footprint glyph (+X forward, +Y left), and pan/zoom interaction.
> - **Proximity Zones & Point Classification:** Distance-colored points (Danger $\le 0.35\text{m}$, Caution $\le 0.70\text{m}$, Clear $> 0.70\text{m}$).
> - **Permanent Non-Safety Notice:** Prominent non-safety disclaimer banner clarifying radar is a visual aid only, not an active collision avoidance system.
> - **Defensive Decoding & Pre-Parsing:** WebSocket regex pre-parser sanitizes bare ECMAScript `Infinity`/`NaN` tokens emitted by ROS 1 Melodic rosbridge server into standard `null` values.
> - **Interactive Reticle & Sector Readouts:** Touch/hover crosshair reticle inspecting point distance, angle, and $(x,y)$, alongside real-time 4-sector distance telemetry (Front, Left, Right, Rear).
> - **Orientation Calibration & Alignment:** Preset offsets ($0^\circ, 90^\circ, 180^\circ, 270^\circ$) and $\pm 5^\circ$ fine steppers for chassis alignment.
> - **Ref-Counted Lidar Manager:** Shared singleton (`lidarManager`) managing subscriptions across LiDAR page and Dashboard card, with watchdog stall detection (2.0s), exponential backoff auto-reconnect, and 50-scan ring buffer JSON export.
> - **Robot Diagnostics Runbook:** `robot/scripts/check_lidar.sh` serial, dialout, and range diagnostics script and [`docs/PHASE6_ROBOT_VERIFICATION.md`](file:///d:/Project/JetRacer%20Control%20Center/docs/PHASE6_ROBOT_VERIFICATION.md).
> - **TESTING STATUS:** Tested against extended local mock rosbridge. **NOT YET TESTED ON PHYSICAL ROBOT.** Real ROS topics remain **NOT YET INSPECTED** until college hardware visit.

---

## Safety Notice

> ⚠️ **CRITICAL SAFETY WARNING:**
> This software is designed to control a physical motorized vehicle. During all early tests and software bring-up:
> 1. **Elevate the Robot:** Keep the JetRacer elevated on a test block so all drive wheels spin freely in the air.
> 2. **Clear Testing Area:** When testing on the ground, only operate in an open, obstacle-free floor area.
> 3. **Accessible Power Switch:** Software emergency stops and speed clampers will be implemented, but **always keep your hand close to the physical battery power switch** on the robot chassis.

---

## Features & Navigation Modules

- **Dashboard (`/`):** Real-time operational overview, connection status chip, telemetry summary grid (battery, CPU/GPU thermals, memory, network), live sensor previews, and quick actions.
- **Manual Control (`/control`):** Multi-touch virtual joystick (auto-returns to center on release or window blur), dynamic portrait and landscape cockpit layouts, keyboard driving (WASD / Arrows), HTML5 Gamepad API integration, and speed cap limiters.
- **Camera Viewport (`/camera`):** 16:9 responsive canvas video viewport with black letterboxing, fullscreen toggle with Screen Wake Lock, toggleable HUD overlays (FPS, resolution, bandwidth, latency), client-side snapshots, and multi-transport failover (HTTP MJPEG + WebSocket Compressed).
- **LiDAR Scanner (`/lidar`):** Hardware-accelerated 2D canvas with polar range rings, 30° radial markers, forward robot marker, interactive touch/mouse pan & zoom, point size/range sliders, and distance color coding.
- **Mapping & SLAM (`/mapping`):** 2D occupancy grid pan/zoom canvas, SLAM session controls, and saved map file library drawer (`.yaml`/`.pgm`).
- **Autonomous Navigation (`/navigation`):** 2D Nav Goal, Pose Estimate, and Waypoint sequencer tool modes with prominent safety layer fail-safe notice.
- **System Health (`/system`):** Jetson CPU, GPU, memory, disk, and thermal envelope gauges, plus service management and typed-confirmation shutdown dialogs.
- **Settings (`/settings`):** Robot host IP/hostname configuration, port tuning, appearance theme switcher (Light / Dark / System), control handedness and axis inversion, and safety speed clamping.
- **Event History (`/history`):** Local 200-event ring buffer tracking session activities, settings adjustments, and safety trigger events with category filters and text search.

---

## Architecture Summary

```
[ Operator Device: Phone / Tablet / Browser ]
           │                         │
      (REST / WebSockets)        (roslibjs)
           │                         │
           ▼                         ▼
   [ FastAPI Backend ]    [ rosbridge_suite (WS :9090) ]
   (Port 8000 on Jetson)             │
           │                         ▼
   [ SQLite / Config ]        [ ROS 1 Master & Nodes ]
                         (Sensors, Motors, SLAM, Nav)
```

---

## Tech Stack

| Domain | Technology / Library | Version / Role |
| :--- | :--- | :--- |
| **Frontend Framework** | React + TypeScript + Vite | React 19, Vite 8, TypeScript 5.8 |
| **Styling & Components** | Tailwind CSS v4 + shadcn/ui | Radix UI primitives, Lucide React icons |
| **State & Networking** | Zustand + TanStack Query + roslibjs | Client state, persisted settings, ROS WebSocket client |
| **Mobile Shell** | Capacitor Android | Native Android container with cleartext LAN support |
| **Backend Framework** | FastAPI + Uvicorn | Python 3.8+ compatible async REST API |
| **Persistence** | SQLAlchemy 2.1.6 (2.x) | SQLite embedded default, PostgreSQL-ready |
| **Quality & Tests** | Vitest + React Testing Library + Axe-Core + Pytest | Automated frontend & backend test gates |

---

## Quick Start Guide (Windows PowerShell)

### 1. Frontend Web Development
```powershell
cd frontend
npm install
npm run dev
# Vite dev server runs at http://localhost:5173 (and your local Wi-Fi IP for phone testing)
```

#### Running in Optional Simulation Mode (UI Dev Only)
To test with synthetic simulated metrics and point cloud data in development:
```powershell
cd frontend
$env:VITE_ENABLE_SIMULATION="true"; npm run dev
```
*(Simulation code is automatically tree-shaken and completely excluded from production builds).*

#### Running the Dev Mock Rosbridge Server (Offline Testing)
```powershell
cd frontend
npm run mock:rosbridge
# Starts mock rosbridge v2 WebSocket server on ws://127.0.0.1:9090
```

#### Frontend Quality Checks
```powershell
cd frontend
npm run typecheck    # TypeScript compiler check (tsc -b)
npm run lint         # ESLint check
npm run test         # Vitest unit & accessibility tests (61 tests)
npm run build        # Production bundle build
```

### 2. Backend Development
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
# Access API at http://127.0.0.1:8000/api/health
# Interactive Swagger docs: http://127.0.0.1:8000/docs
# WebSocket multiplexer: ws://127.0.0.1:8000/api/v1/ws
```

Run backend quality checks via `dev.ps1` helper:
```powershell
cd backend
.\scripts\dev.ps1 lint    # Ruff style check + Mypy static typecheck
.\scripts\dev.ps1 test    # Pytest with terminal coverage report (41 tests, 91% coverage)
.\scripts\dev.ps1 smoke   # Live HTTP + WebSocket smoke verification script
```

### 3. Capacitor Android
```powershell
cd frontend
npm run build
npm run cap:sync     # Sync web assets to native Android container
npm run cap:open     # Open Android project in Android Studio
```

---

## Development Roadmap & Milestones

For a complete breakdown of all 16 project phases (Phase 0 through Phase 15), see [ROADMAP.md](file:///d:/Project/JetRacer%20Control%20Center/ROADMAP.md).

---

## Commit Convention & License

- **Conventional Commits:** All git commits follow standard conventional formatting (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- **License:** MIT License.
