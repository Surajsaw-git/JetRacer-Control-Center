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
| **1** | **Frontend UI/UX** | Core design system, responsive navigation, dark/light themes, status headers, dashboard layout, and placeholder component cards. | Not started |
| **2** | **Backend Foundation** | Subsystem service interfaces, WebSocket manager, telemetry models, and error handling framework. | Not started |
| **3** | **IP Connection** | Dynamic robot IP discovery, ping latency monitoring, connection state machine, and connection persistence. | Not started |
| **4** | **ROS Integration** | Live on-robot topic inspection, `rosbridge_suite` client, roslibjs bindings, and parameter service queries. | Not started |
| **5** | **Camera** | Real-time video stream player (MJPEG/WebRTC), snapshot capture, frame rate scaling, and camera settings. | Not started |
| **6** | **LiDAR** | 2D LaserScan visualization, radial distance grids, collision zone alerts, and point filter settings. | Not started |
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
- **Next Steps:** Proceed to Phase 1 (Frontend UI/UX) upon user approval.

---

## 4. Reusable Progress Report Template (Copy after each phase)

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
