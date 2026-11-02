# Changelog

All notable changes to the JetRacer Control Center project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.6.2] - 2026-11-02 (v0.6.2-field-fixes)

### Fixed
- **Indefinite Auto-Reconnect:** Fixed reconnect policy where retries gave up after 5 attempts (~25s). Client now retries indefinitely with exponential backoff capped at 30 seconds plus jitter.
- **Stop Trying Action:** Added "Stop trying" control to Connection Wizard and reconnect banner allowing user to permanently halt retry attempts.
- **Honest Link-Down State:** Fixed false `master_unreachable` state when WebSocket disconnects. Status now accurately indicates `disconnected` with explanation "Link to robot is down; the ROS master state is unknown".
- **Address Typo Validation:** Fixed `isValidHostname` validator to reject purely numeric dotted strings like `192.168137.43`.
- **Clock Offset Midpoint RTT:** Updated clock synchronization formula to $t_{\text{robot}} - (t_{\text{send}} + \text{rtt}/2)$ using round-trip midpoint.
- **Rolling Median Latency:** Added 5-sample rolling median latency filter and high-latency guidance warning for congested Wi-Fi links.
- **Disarmed System Dangerous Buttons:** Disabled `Restart Backend`, `Reboot Jetson`, and `Shutdown` buttons on System page with explanatory tooltip for Phase 10.
- **Stale Phase Labels:** Removed obsolete `v0.2.0` / `Phase 1 UI` footer labels in favor of package version metadata, and updated "NOT WIRED IN PHASE 3" E-Stop labels to "NOT WIRED YET (planned for Phase 8/13)".
- **Connection Subnet Hints:** Added guidance notes explaining hotspot, Tailscale, and LAN addresses, and browser ICMP limitations.

---

## [0.6.0] - 2026-11-02 (v0.6.0-phase5)

### Added
- Phase 5 Camera streaming module (HTTP multipart MJPEG + WebSocket sensor_msgs/CompressedImage fallback).
- 16:9 canvas letterbox viewport rendering, ref-counted cameraManager, snapshot capture, auto-adaptation, stall detection with backoff.

---

## [0.5.0] - 2026-11-02 (v0.5.0-phase4)

### Added
- Phase 4 ROS 1 introspection: master reachability, rosapi node discovery, topic watcher with rate-reduction, data-driven topic registry, and capability policy.

---

## [0.4.0] - 2026-11-01 (v0.4.0-phase3)

### Added
- Phase 3 IP Connection flow: two-link architecture (rosbridge + FastAPI), target validation, and connection runbook.

---

## [0.3.0] - 2026-11-01 (v0.3.0-phase2)

### Added
- Phase 2 Backend Foundation: FastAPI application skeleton, WebSocket manager with rooms and backpressure, health endpoints, and request ID tracing.

---

## [0.2.0] - 2026-11-01 (v0.2.0-phase1)

### Added
- Phase 1 UI/UX: Dark-first robotics dashboard, responsive navigation, 9 console views, touch joystick, and mock visualizers.

---

## [0.1.0] - 2026-11-01 (v0.1.0-phase0)

### Added
- Initial project scaffolding: React 19 + TypeScript + Tailwind v4 + Vite, Capacitor Android shell, FastAPI backend foundation, and documentation.
