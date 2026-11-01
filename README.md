# JetRacer Control Center

JetRacer Control Center is a comprehensive, multi-platform robotics command and telemetry dashboard designed to control and monitor the NVIDIA JetRacer ROS AI Kit over a local Wi-Fi network. Running simultaneously as a responsive React web application, an installable Android mobile application (via Capacitor), and a desktop browser interface, it eliminates the need for direct SSH terminals or HDMI monitor connections during autonomous navigation, mapping, and driving experiments.

> **PROJECT STATUS (PHASE 0 COMPLETED):**
> The foundational project architecture, frontend skeleton, backend API, Android container, test suites, and documentation have been initialized and verified locally. **No real robot hardware has been connected, tested, or modified yet.** All ROS-related configurations remain marked as **NOT YET INSPECTED**.

---

## Safety Notice

> ⚠️ **CRITICAL SAFETY WARNING:**
> This software is designed to control a physical motorized vehicle. During all early tests and software bring-up:
> 1. **Elevate the Robot:** Keep the JetRacer elevated on a test block so all drive wheels spin freely in the air.
> 2. **Clear Testing Area:** When testing on the ground, only operate in an open, obstacle-free floor area.
> 3. **Accessible Power Switch:** Software emergency stops and speed clampers will be implemented, but **always keep your hand close to the physical battery power switch** on the robot chassis.

---

## Goals & Feature Modules

- **Dynamic Connection & Discovery:** Connect to the robot via IP address or mDNS hostname without hardcoding settings.
- **Manual Teleoperation:** Responsive virtual joystick, keyboard drive controls, steering trim adjustment, and dead-man switch.
- **Live Video Streaming:** Real-time CSI/USB camera feed with low latency for remote visual driving.
- **2D LiDAR Visualization:** Polar laser scan radar view with distance markers and collision proximity warnings.
- **SLAM & Mapping:** Real-time occupancy grid mapping, SLAM start/stop control, and map file saving (`.yaml`/`.pgm`).
- **Autonomous Navigation:** Interactive 2D navigation goal dispatch, waypoint planning, and obstacle avoidance monitoring.
- **Hardware Telemetry & Health:** Real-time monitoring of Jetson CPU/GPU thermals, RAM, disk, battery voltage, and system services.
- **Cross-Platform Delivery:** One TypeScript/React codebase serving web browsers and Android mobile devices natively.

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
| **State & Networking** | Zustand + TanStack Query + roslibjs | Client state, caching, ROS WebSocket client |
| **Mobile Shell** | Capacitor Android | Native Android container with cleartext LAN support |
| **Backend Framework** | FastAPI + Uvicorn | Python 3.8+ compatible async REST API |
| **Persistence** | SQLAlchemy 2.0 | SQLite embedded default, PostgreSQL-ready |
| **Quality & Tests** | Vitest + React Testing Library + Ruff + Pytest | Automated frontend & backend test gates |

---

## Folder Structure

```
JetRacer-Control-Center/
├── frontend/                     # React + Vite + Capacitor client application
│   ├── src/
│   │   ├── components/ui/        # shadcn/ui base components
│   │   ├── layouts/              # Responsive desktop sidebar & mobile bottom bar
│   │   ├── pages/                # 8 module pages (Dashboard, Control, Camera, etc.)
│   │   ├── hooks/                # Custom React hooks
│   │   ├── services/             # Environment configuration and API clients
│   │   ├── store/                # Typed Zustand state stores
│   │   ├── types/                # Core TypeScript interfaces
│   │   └── utils/                # Utility helpers (cn class merger)
│   ├── android/                  # Native Android Gradle project (Capacitor)
│   ├── public/                   # Static public assets
│   ├── capacitor.config.ts       # Capacitor native bridge configuration
│   └── vitest.config.ts          # Vitest unit test suite configuration
├── backend/                      # FastAPI Python backend application
│   ├── app/
│   │   ├── api/                  # REST API routes (/api/health)
│   │   ├── core/                 # Pydantic Settings and application configuration
│   │   ├── database/             # SQLAlchemy engine, session maker, and Base
│   │   ├── models/               # SQLAlchemy ORM models (Phase 11)
│   │   ├── schemas/              # Pydantic validation schemas (Phase 2)
│   │   ├── services/             # Business logic and background tasks
│   │   ├── ros/                  # ROS 1 client adapters (Phase 4)
│   │   ├── safety/               # Safety supervisor and E-Stop (Phase 8 & 13)
│   │   └── main.py               # FastAPI application entrypoint and CORS
│   ├── tests/                    # Pytest test suite
│   ├── requirements.txt          # Pinned Python package dependencies
│   └── pyproject.toml            # Ruff linter and pytest configurations
├── robot/                        # On-robot scripts and service definitions
│   ├── launch/                   # ROS launch files (NOT YET INSPECTED)
│   ├── scripts/                  # Jetson maintenance and helper scripts
│   ├── systemd/                  # Background service unit definitions
│   └── config/                   # Robot hardware parameters and calibrations
├── docs/                         # Technical specifications and guides
│   ├── ARCHITECTURE.md           # System architecture and data flow design
│   ├── API.md                    # REST API endpoints and error envelopes
│   ├── ROS_TOPICS.md             # ROS inspection commands and registries
│   └── DEPLOYMENT.md             # On-robot deployment and systemd setup
├── README.md                     # Project overview and quick start guide
└── ROADMAP.md                    # 16-phase milestone roadmap and status tracker
```

---

## Prerequisites

- **Node.js:** Node 20 LTS or newer (tested on v24.16.0), npm 10+ (tested on 11.13.0)
- **Python:** Python 3.10+ on development host (tested on 3.14.5); Jetson target compatible with Python 3.8+
- **Git:** Git 2.40+ (tested on 2.54.0)
- **JDK (for Android builds):** OpenJDK 17 or newer
- **Android SDK:** Android Studio / Command Line Tools with `ANDROID_HOME` configured

---

## Quick Start Guide (Windows PowerShell)

### 1. Frontend Web Development
```powershell
cd frontend
npm install
npm run dev
# Vite dev server runs at http://localhost:5173 (and your local Wi-Fi IP for phone testing)
```

Run frontend quality checks:
```powershell
cd frontend
npm run typecheck    # TypeScript compiler check
npm run lint         # ESLint check
npm run test         # Vitest unit and route smoke tests
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
- **License:** MIT License (placeholder).
