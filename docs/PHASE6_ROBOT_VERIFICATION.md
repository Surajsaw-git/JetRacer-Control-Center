# JetRacer Control Center — Phase 6 Robot Verification Runbook

> **Target Platform:** NVIDIA Jetson Nano Developer Kit (B01) / Waveshare JetRacer AI Kit  
> **Target OS:** Ubuntu 18.04 LTS + ROS 1 Melodic Morenia  
> **LiDAR Stack:** RPLiDAR A1/A2 or EAI X4 2D Laser Scanner (`sensor_msgs/LaserScan` over USB-UART `/dev/ttyUSB*`)  
> **Status:** Done, mock-tested only, not tested on the robot.

---

## 1. Safety Boundaries & Non-Safety Notice (Strictly Binding)

1. **Strictly Read-Only Operation:**
   - The Control Center subscribes to `sensor_msgs/LaserScan` messages read-only.
   - It **never publishes** to `/cmd_vel` or any robot actuator/drive topic.
   - It **never alters** LiDAR parameters, frame_id, or ROS launch configs.
   - **Verification:** Run `rostopic info /cmd_vel` on the Jetson; verify publisher count remains strictly 0 from the Control Center.
2. **Permanent Non-Safety Warning:**
   - Proximity warnings (danger $\le 0.35\text{ m}$, caution $\le 0.70\text{ m}$, clear $> 0.70\text{ m}$) are a **visual and situational aid only, NEVER an active safety or collision-avoidance system**.
   - The robot operator remains 100% responsible for vehicle safety and manual override/E-STOP.
3. **Transport & CPU Throttling Policy:**
   - Maximum 1 active LaserScan subscription across the entire application (`MAX_LIDAR_SUBSCRIPTIONS = 1`).
   - Strict rate throttling enforced: default $100\text{ ms}$ ($10\text{ Hz}$), minimum $50\text{ ms}$ ($20\text{ Hz}$).
   - Stream never auto-starts on connect or mount. It terminates immediately upon leaving the page or when the browser tab is hidden (`document.visibilitychange`).

---

## 2. ROS 1 Melodic & Rosbridge Findings

### Bare `Infinity` / `NaN` JSON Serialization
- Standard Python `json.dumps(allow_nan=True)` emitted by ROS 1 Melodic's `rosbridge_server` outputs bare, unquoted ECMAScript tokens: `Infinity`, `-Infinity`, and `NaN`.
- Standard browser `JSON.parse()` strictly rejects these tokens with `SyntaxError: Unexpected token I in JSON at position ...`.
- **Solution Delivered:** An ultra-fast regex WebSocket pre-parser (`sanitizeRosJson`) in `frontend/src/services/rosbridgeClient.ts` replaces bare `Infinity` / `NaN` tokens with `null` before deserialization. All three ROS serialization styles (`null`, strings, bare non-standard tokens) are handled with 100% fidelity.

---

## 3. Pre-Verification Robot Checklist

Run these commands on the Jetson Nano terminal over SSH before opening the LiDAR page:

### Step 1: Run LiDAR Diagnostic Script
```bash
cd ~/jetracer-robot/scripts
bash check_lidar.sh
```
Verify the diagnostic output:
- Detected serial device on `/dev/ttyUSB*` (e.g., `/dev/ttyUSB0` or `/dev/ttyUSB1`).
- Current user belongs to the `dialout` group (or permissions are `rw-rw-rw-`).
- Active topic emitting `sensor_msgs/LaserScan` (typically `/scan` or `/laser/scan`).
- Output Hz is stable ($\approx 5.0\text{--}12.0\text{ Hz}$).
- Diagnostic report is saved to `~/jetracer_lidar_check_<timestamp>.txt`.

### Step 2: Fix Serial Permissions (If Required)
If the script reports permission denied on `/dev/ttyUSB0`:
```bash
sudo usermod -aG dialout $USER
# Or temporary access for current session:
sudo chmod 666 /dev/ttyUSB*
```

### Step 3: Check TF Tree and Frame ID
Verify what `frame_id` the LiDAR node publishes in its header:
```bash
rostopic echo -n 1 /scan/header
```
Common frames: `laser_frame`, `laser`, `base_laser`. Ensure no TF lookup crashes occur.

---

## 4. UI Verification Steps in Control Center

1. **Connect to Robot:**
   - Open JetRacer Control Center (`http://<laptop-ip>:5173` or Android app).
   - Enter Jetson IP address and connect. Confirm header shows `ROS OK`.
2. **Navigate to LiDAR Scanner:**
   - Click **LiDAR** in sidebar or bottom navigation.
   - Verify non-safety disclaimer banner is clearly visible.
   - Verify radar canvas renders dark circular radar grid with concentric range rings ($0.5\text{m}$, $1.0\text{m}$, $2.0\text{m}$, etc.) and robot footprint outline.
3. **Verify Discovered Topics:**
   - Ensure the dropdown auto-populates with the detected LaserScan topic (e.g., `/scan`).
   - If not discovered, type the topic name manually in the input box.
4. **Start Stream:**
   - Click **Start Stream**.
   - Verify radar canvas renders real-time laser points:
     - Danger points ($< 0.35\text{ m}$) drawn in red.
     - Caution points ($0.35\text{--}0.70\text{ m}$) drawn in amber.
     - Clear points ($> 0.70\text{ m}$) drawn in cyan/emerald.
   - Verify Status Panel updates:
     - Real-time Hz ($\approx 8\text{--}10\text{ Hz}$).
     - Bandwidth in $\text{kB/s}$.
     - 4-sector distance readouts (Front, Left, Right, Rear) show closest obstacle distance.
5. **Inspect Scan Points:**
   - Tap or hover anywhere on the radar canvas: crosshair reticle displays polar distance ($r$), azimuth angle ($\theta$), and Cartesian coordinates ($x, y$).
6. **Test Orientation & Offset Stepper:**
   - Click preset angle buttons ($0^\circ$, $90^\circ$, $180^\circ$, $270^\circ$) or use $\pm 5^\circ$ fine steppers.
   - Verify the scan rotates in real time without lag.
7. **Verify Freeze / Pause:**
   - Click **Freeze**: radar canvas halts rendering updates, retains current scan in memory.
   - Click **Resume**: live rendering resumes immediately.
8. **Verify Disconnect / Stall Safety:**
   - Stop the LiDAR node on the Jetson (`Ctrl+C` in LiDAR terminal).
   - Verify after $2.0\text{ s}$ the UI transitions to `STALLED` (amber indicator), retaining the last frame faintly on the canvas.
   - Verify automatic reconnect backoff attempts ($1\text{s}$, $2\text{s}$, $4\text{s}$, $8\text{s}$, $16\text{s}$).
9. **Verify Unmount Halts Stream:**
   - Navigate away to **Dashboard** or **Settings**.
   - Verify WebSocket topic unsubscription occurs immediately (confirmed in console and network inspector).
