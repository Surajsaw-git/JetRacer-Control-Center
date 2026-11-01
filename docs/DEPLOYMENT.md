# JetRacer Control Center — Deployment Specification

> **STATUS:** Planned Blueprint (Phase 0).
> **NOTHING IN THIS DOCUMENT HAS BEEN EXECUTED OR DEPLOYED YET.**
> Full production deployment and service installation is scheduled for Phase 15.

---

## 1. Jetson Host Prerequisites (Planned for Phase 15)

- **Hardware:** NVIDIA Jetson Nano / Xavier NX / Orin Nano running official JetPack.
- **Operating System:** Ubuntu 18.04 LTS (Bionic) or Ubuntu 20.04 LTS (Focal).
- **ROS 1:** Melodic Morenia or Noetic Ninjemys configured with `roscore` and robot drivers.
- **Python Environment:** System Python 3 (3.8+ recommended) with `python3-venv` and `python3-pip`.
- **ROS Packages:** `ros-<distro>-rosbridge-suite`, `ros-<distro>-web-video-server` (optional for camera).

---

## 2. On-Robot Backend Systemd Service

A systemd service file will be created in `robot/systemd/jetracer-backend.service` to ensure the FastAPI backend starts automatically upon boot:

```ini
[Unit]
Description=JetRacer Control Center FastAPI Backend
After=network.target roscore.service

[Service]
Type=simple
User=jetson
WorkingDirectory=/home/jetson/JetRacer-Control-Center/backend
ExecStart=/home/jetson/JetRacer-Control-Center/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5s
Environment=ENVIRONMENT=production

[Install]
WantedBy=multi-user.target
```

---

## 3. Rosbridge WebSocket Service

A companion systemd service `robot/systemd/rosbridge.service` or roslaunch integration will manage the `rosbridge_websocket` node:

```ini
[Unit]
Description=Rosbridge WebSocket Server
After=network.target roscore.service

[Service]
Type=simple
User=jetson
ExecStart=/bin/bash -c "source /opt/ros/$ROS_DISTRO/setup.bash; roslaunch rosbridge_server rosbridge_websocket.launch port:=9090"
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

---

## 4. Frontend Web Production Build

Building the static bundle for browser hosting or embedding:

```bash
cd frontend
npm run build
# Outputs optimized production assets to frontend/dist/
```

Static web assets can be hosted directly by the FastAPI backend or served via a lightweight Nginx web server on the Jetson.

---

## 5. Android APK Build (Capacitor)

Building the native Android debug and release packages:

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# Generated APK location: frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 6. Pre-Flight Release Checklist

- [ ] Confirm robot wheels are off the floor on a testing stand.
- [ ] Confirm emergency stop button responds and kills drive motors immediately.
- [ ] Verify local Wi-Fi signal strength and static IP / mDNS hostname resolution.
- [ ] Test FastAPI `/api/health` response from mobile client browser.
- [ ] Test `rosbridge_suite` connection from mobile client browser.
- [ ] Verify battery voltage telemetry is reporting safe operating thresholds.
- [ ] Confirm hardware battery power switch is easily accessible by hand.
