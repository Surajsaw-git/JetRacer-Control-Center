# JetRacer Control Center

JetRacer Control Center is a comprehensive, multi-platform robotics command and telemetry dashboard designed to control and monitor the NVIDIA JetRacer ROS AI Kit over a local Wi-Fi network. Running simultaneously as a responsive React web application, an installable Android mobile application (via Capacitor), and a desktop browser interface, it eliminates the need for direct SSH terminals or HDMI monitor connections during autonomous navigation, mapping, and driving experiments.

> **PROJECT STATUS (PHASE 1 COMPLETED):**
> Phase 1 Frontend UI/UX is complete. The application features a dark-first console design system, responsive mobile & desktop navigation shells, virtual touch joystick with keyboard & gamepad support, interactive LiDAR & mapping canvases, 9 module pages, local settings persistence, and local event history.
> **IMPORTANT:** All UI is preview-only and **not connected to real robot hardware yet**. All ROS configurations remain marked as **NOT YET INSPECTED**.

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
- **Camera Viewport (`/camera`):** 16:9 responsive video frame with fullscreen toggle, FPS/latency HUD overlays, and stream controls (MJPEG/WebRTC streaming arrives in Phase 5).
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

#### Frontend Quality Checks
```powershell
cd frontend
npm run typecheck    # TypeScript compiler check (tsc -b)
npm run lint         # ESLint check
npm run test         # Vitest unit & accessibility tests (31 tests)
npm run build        # Production bundle build
```

### 2. Backend Development
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Access API at http://localhost:8000/api/health
# Interactive Swagger docs: http://localhost:8000/docs
```

Run backend quality checks:
```powershell
cd backend
.\.venv\Scripts\ruff check .
.\.venv\Scripts\pytest
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
