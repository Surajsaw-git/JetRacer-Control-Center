# JetRacer Control Center — UI/UX Design Specification

> **STATUS:** Phase 1 Design Specification.
> **SCOPE:** Frontend UI/UX design architecture, design tokens, responsive layouts, component contracts, and interaction models. Hardware testing and real robot connections remain unverified until subsequent phases.

---

## 1. Design Principles

1. **Console, Not Admin Template:** JetRacer Control Center is a real-time field console for physical robotics, operated outdoors, in test arenas, or in laboratories. Visual clutter is eliminated in favor of high-contrast readability, clear hierarchy, and unambiguous status indicators.
2. **Dark-First Visual Tone:** The interface defaults to dark mode (`hsl(224, 71%, 4%)` deep slate/black background) to minimize eye fatigue during operations and ensure optimal visibility under ambient lab and outdoor lighting. A polished light mode is fully supported via CSS variables.
3. **Strict Color Semantics (Non-Decorative Danger):**
   - **Accent (`Primary`):** Restrained emerald/teal (`hsl(142, 71%, 45%)` / NVIDIA-inspired green hue) for primary focus, active navigation, and confirmed actions.
   - **Emergency / Danger (`Destructive`):** **Strictly reserved** for emergency stop (E-Stop), critical faults, and safety violations. Never used as a decorative background or accent.
   - **Warning (`Amber`):** Strictly reserved for degraded communication, high latencies, and thermal/battery warning thresholds.
   - **Informational / Connecting (`Blue`):** Handshake, discovery, and in-flight connection states.
   - **Muted / Disconnected (`Slate`):** Offline or unconfigured states.
   - **Simulation (`Purple`):** Reserved exclusively for simulated/demo widgets when running in simulation mode.
4. **Touch-First Ergonomics (Android & Field Operation):**
   - All interactive controls (buttons, joystick handle, tabs, switches) enforce a minimum touch bounding box of **44x44 CSS pixels**.
   - Generous spacing between destructive actions and continuous controls.
   - Zero hover-dependent interactions; all interactive affordances are visually explicit.
   - Controls support multi-touch (e.g. holding throttle while steering).
   - CSS properties `touch-action: none`, `user-select: none`, and safe-area inset padding (`env(safe-area-inset-*)`) protect the driving surfaces from pull-to-refresh or accidental zoom.
5. **Tabular Numerals & Monospaced Telemetry:** All real-time telemetry readouts, coordinates, angles, and percentages use tabular numerals (`tabular-nums font-mono`) to prevent layout jitter as numbers fluctuate.
6. **Honest Empty & Error States:** In the absence of an active robot connection, every telemetry card honestly displays an empty state ("No data — connect to robot") rather than rendering zeroed fake metrics.

---

## 2. Design Tokens & Semantic Status Mapping

### Theme CSS Variables (`src/index.css`)
```css
:root {
  --background: hsl(0 0% 100%);
  --foreground: hsl(224 71% 4%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(224 71% 4%);
  --primary: hsl(142 71% 38%);
  --primary-foreground: hsl(355 100% 97%);
  --destructive: hsl(0 84% 60%);
  --destructive-foreground: hsl(0 0% 98%);
  --muted: hsl(220 14% 96%);
  --muted-foreground: hsl(220 9% 46%);
  --border: hsl(220 13% 91%);
}

.dark {
  --background: hsl(224 71% 4%);
  --foreground: hsl(210 20% 98%);
  --card: hsl(224 71% 7%);
  --card-foreground: hsl(210 20% 98%);
  --primary: hsl(142 71% 45%);
  --primary-foreground: hsl(144 100% 97%);
  --destructive: hsl(0 84% 60%);
  --destructive-foreground: hsl(0 0% 98%);
  --muted: hsl(217 33% 15%);
  --muted-foreground: hsl(215 20% 65%);
  --border: hsl(217 33% 18%);
}
```

### Status Tokens & Semantics (`StatusBadge`)

| Status | Badge Color | Icon | Semantic Meaning |
| :--- | :--- | :--- | :--- |
| **Connected** | Green / Emerald | `CheckCircle2` | Robot communication verified and active. |
| **Connecting** | Blue | `Loader2` (animate-spin) | Active handshake or ping in progress. |
| **Reconnecting** | Amber | `RefreshCw` (animate-spin) | Heartbeat temporarily dropped; re-establishing connection. |
| **Disconnected** | Muted Slate | `XCircle` | No robot connection active (Default Phase 1 state). |
| **Error / Fault** | Red | `AlertTriangle` | Hard socket error or safety violation. |
| **Not Available** | Gray | `Slash` | Hardware subsystem not detected or disabled. |
| **Simulated** | Purple / Violet | `Sparkles` | Artificial mock data for UI testing only. |

---

## 3. Breakpoint & Responsive Layout Strategy

- **Mobile (< 768px):**
  - Top Bar: App title, persistent `ConnectionChip`, theme toggle, and sticky `EmergencyStopButton`.
  - Content Area: Scrollable viewport using dynamic viewport units (`100dvh`) with safe-area insets.
  - Bottom Tab Bar: Fixed 5-destination navigation (Dashboard, Control, Camera, Navigation, More Sheet).
  - "More Sheet": Bottom sheet exposing LiDAR, Mapping, System, History, and Settings.
- **Tablet (768px - 1024px) & Desktop (>= 1024px):**
  - Collapsible Left Sidebar (64px icon-only rail or 256px expanded drawer) containing all 9 destinations.
  - Sticky Top Bar: Route breadcrumb/title, active host address chip, connection status chip, theme toggle, and prominent `EmergencyStopButton`.
  - Multi-column dashboard grid (2 columns on tablet, 3-4 columns on desktop).

---

## 4. Navigation Architecture

```
                                  [RootLayout]
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   / (Dashboard)   /control        /camera          /lidar        /mapping
        │              │               │               │              │
        ▼              ▼               ▼               ▼              ▼
  /navigation      /system         /settings        /history      /* (404)
```

---

## 5. Per-Page Wireframe Descriptions

### 1. Dashboard (`/`)
```
+-------------------------------------------------------------------+
| [!] JETRACER CONSOLE   [Disconnected: No Host] [Theme] [E-STOP!]  |
+-------------------------------------------------------------------+
| [ Connection Summary Card: Robot Address, Status, Latency ]       |
+------------------+------------------+------------------+----------+
| Battery Gauge    | CPU / GPU Temps  | ROS Nodes Status | Network  |
| "No data"        | "No data"        | "No data"        | "No data"|
+------------------+------------------+------------------+----------+
| Camera Feed Preview                 | LiDAR Proximity Radar       |
| [ Aspect 16:9 - No active stream ]  | [ Canvas - Empty polar grid]|
+-------------------------------------+-----------------------------+
| Quick Actions: [Drive] [Camera] [Map] | Local Activity Log (recent)|
+-------------------------------------+-----------------------------+
```

### 2. Camera Viewport (`/camera`) (Phase 5 Evolved)
- **Main Viewport:** 16:9 aspect ratio responsive HTML5 canvas with black letterboxing and pixel-perfect rendering.
- **States:** `Idle` (standby), `Connecting`, `Streaming`, `Stalled` (3s timeout alert), `Reconnecting` (exponential backoff), `Failed` (with diagnosis hints), `No Source`.
- **Overlay HUD (Toggleable via button or 'H' key):**
  - Top-left: Live stream badge (`LIVE`), transport badge (`HTTP MJPEG` vs `ROSBRIDGE`), frame rate (`FPS`), native resolution (`WxH`), estimated bandwidth (`kB/s`), dropped frames counter, and clock-adjusted end-to-end latency (`ms`).
  - Top-right: HUD toggle button, Fullscreen toggle button ('F' key).
  - Bottom controls: Client-side PNG snapshot capture with timestamped downloads, quality preset indicator.
  - Fullscreen features: Fullscreen API with CSS fallback, Android back button popstate handling, Screen Wake Lock API, 3-second auto-hide controls overlay.
- **Controls & Configuration Toolbar:**
  - Topic Selector with dynamic discovery, base topic grouping, Topic Registry role (`camera_image`) assignment badge, and manual topic fallback.
  - Transport selector: `web_video_server (HTTP Port 8080)` vs `rosbridge (sensor_msgs/CompressedImage)`.
  - Quality selector: Low (320x240, 15fps), Medium (640x480, 20fps), High (720p, 30fps), Auto (hysteresis controller).
  - Explicit Start / Stop stream action button (auto-start toggle strictly defaults to OFF).
  - On-robot runbook & diagnostic terminal cheat-sheet.

### 3. LiDAR Radar (`/lidar`)
- **Interactive `<LidarCanvas>`:** High-DPI canvas supporting pan and zoom via touch drag/pinch and mouse wheel.
- **Radar Visuals:** Concentric metric range rings (0.5m, 1.0m, 2.0m, 5.0m), 30-degree radial angle markers, center robot glyph indicating forward heading.
- **Controls Toolbar:** Zoom in/out/reset buttons, maximum range slider, point size slider, color-by-intensity toggle, and pause/resume button.

### 4. Mapping & SLAM (`/mapping`)
- **Map Viewport:** 2D occupancy grid view with pan/zoom controls.
- **SLAM Controls Bar:** Start SLAM session button (disabled), Save Map button (disabled), Reset mapping button (disabled).
- **Map Library Drawer:** List of saved maps with metadata (resolution, creation date, grid dimensions) and empty placeholder.

### 5. Autonomous Navigation (`/navigation`)
- **Interactive Map:** Pan/zoom field supporting goal targeting.
- **Mode Selection:** Toggle tools for `Set 2D Goal`, `Set Initial Pose`, `Waypoint Sequence`.
- **Action Drawer:** Navigation waypoint queue, Cancel Navigation button (disabled), estimated time of arrival, and obstacle warning banner.

### 6. Control Screen (`/control`)
- **Portrait View:** Top half features camera preview slot; bottom half features large centered `VirtualJoystick` with speed limit slider.
- **Landscape View:** Center camera preview slot flanked by virtual steering stick on left and virtual throttle slider on right.
- **Input Channels:** Multi-touch pointer events, keyboard bindings (WASD / Arrows), and HTML5 Gamepad API polling for USB/Bluetooth gamepads.
- **Safety Features:** Normalized output (-1.0 to 1.0), dead-man switch toggle, command timeout warning, and persistent "Control Preview Only" banner.

### 7. Robot System Management & ROS Introspection (`/system`)
- **ROS 1 Introspection Tabs:**
  - `Status`: ROS master status badge (`OK`, `Degraded`, `Rosbridge Only`, `Master Unreachable`), clock offset gauge with plain-language explanation, rosapi ping latency, and Redacted ROS Inspection Report modal export.
  - `Topics`: Filterable table of discovered topics and types, publisher/subscriber inspector, "Watch" topic action, and manual fallback entry.
  - `Nodes`: Registered ROS nodes list with baseline diff and on-demand details inspector.
  - `Services`: Registered services list with capability policy tags ("Allowed Read-Only" vs "Blocked Policy").
  - `Watch`: Controlled Topic Watcher (up to 5 concurrent watches), rate throttle selector (100ms-1000ms), LaserScan summary reduction, defensive decoding (NaN/Infinity guards), and sliding-window Hz indicator.
  - `Registry`: Typed role mapping table (10 subsystems: cmd_vel, odom, imu, scan, map, camera, joy, tf, tf_static, battery), message-type suggestions, live verification status, and JSON profile import/export.
- **Resource Gauges:** Reusable radial/bar `Gauge` components for CPU utilization, GPU load, RAM usage, Disk space, and Thermal zones.
- **System Power Actions:** `Restart Robot Service`, `Reboot Jetson`, and `Shutdown Robot` protected by `ConfirmDialog`.

### 8. Settings & Network Configuration (`/settings`)
- **Tabs:** `Connection`, `Appearance`, `Control Preferences`, `Safety Limits`, `About`.
- **Connection Tab:** IPv4 / Hostname input, backend REST port (8000), rosbridge WebSocket port (9090), HTTPS/WSS toggle, inline validation errors, and Test Connection button (disabled in Phase 1).
- **Control Preferences:** Joystick sensitivity, axis inversion, handedness (left/right throttle), dead-man switch requirement.
- **Safety Limits (Preview):** Maximum speed percentage limiter (10% to 100%), command timeout duration display.
- **About Tab:** Version string from package metadata, links to documentation, and Factory Reset configuration button with confirmation.

### 9. Local History (`/history`)
- **Event Log:** In-memory ring buffer (up to 200 entries) tracking local UI actions (route visits, settings edits, mock E-stop presses).
- **Filters & Search:** Filter by event type (`Navigation`, `Safety`, `Settings`, `System`) and free-text search. Clear history with confirmation.

---

## 6. Shared Component Inventory

1. `StatusBadge`: Semantic badge rendering icon and label for connection and hardware states.
2. `ConnectionChip`: Header chip displaying current target address and status badge, linking to connection settings.
3. `EmergencyStopButton`: Prominent single-tap red button dispatching E-Stop toast and logging event.
4. `PageHeader`: Standardized title, description, and action button container.
5. `EmptyState`: Clean empty/disconnected state illustration with call-to-action button.
6. `ErrorState`: Error boundary display with retry trigger.
7. `SkeletonCard`: Content loading placeholder card.
8. `MetricCard`: Telemetry card displaying title, value, unit, and mini trend/status.
9. `Gauge`: SVG radial / progress meter for percentage metrics (battery, CPU, memory).
10. `VideoViewport`: Responsive video player container with overlay controls and status overlay.
11. `LidarCanvas`: High-DPI canvas for 2D laser scan rendering with pan/zoom.
12. `PanZoomCanvas`: Shared pan, zoom, and coordinate transform canvas base.
13. `VirtualJoystick`: Multi-touch virtual joystick returning to center upon release.
14. `ConfirmDialog`: Modal dialog supporting standard and typed text confirmation.
15. `SimulationBanner`: Non-dismissible top banner indicating simulated test mode.
16. `ThemeToggle`: Dropdown or switch for Light / Dark / System theme switching.
17. `SafeAreaContainer`: Layout wrapper respecting mobile notch and home-indicator insets.

---

## 7. Real vs. Simulated Data Architecture

- **Default Mode:** Real mode. All telemetry fields display `No data` or `Disconnected`. No artificial jitter or fake values are rendered.
- **Simulation Mode (`VITE_ENABLE_SIMULATION=true`):**
  - Confined exclusively to `src/simulation/`.
  - Completely excluded and tree-shaken from standard production builds.
  - Displays persistent high-visibility banner across the entire shell: `SIMULATED DATA — NOT CONNECTED TO ROBOT`.
  - Every simulated telemetry widget displays a purple `[SIM]` tag.
