# JetRacer Control Center — Phase 7 Robot Verification Runbook

> **Target Platform:** NVIDIA Jetson Nano Developer Kit (B01) / Waveshare JetRacer AI Kit  
> **Target OS:** Ubuntu 18.04 LTS + ROS 1 Melodic Morenia (Python 2.7 & Python 3 compatible)  
> **SLAM Stack:** `gmapping` / `slam_gmapping` (`nav_msgs/OccupancyGrid` on `/map`) + TF (`map` $\rightarrow$ `odom` $\rightarrow$ `base_footprint`)  
> **JCC Agent Node:** `jetracer_cc_agent` (`~/jcc_ws`) exposing `/jetracer_cc_agent/command`  
> **Tags:** `v0.8.0-phase7a` (Stage 7A Read-Only) & `v0.8.1-phase7b` (Stage 7B Robot Agent)  
> **Status:** Stage 7A and Stage 7B code complete, mock-tested and unit-tested (211 passing tests), ready for on-robot execution.

---

## 1. Safety Boundaries & Architectural Isolation

1. **Workspace Boundary:**
   - The JCC agent and custom messages live exclusively in `~/jcc_ws`.
   - **Never modify** `~/catkin_ws`, Waveshare vendor packages, or system ROS files.
2. **Path Traversal Jail:**
   - Map files on the robot are strictly confined to `~/maps/`.
   - Map names are validated using regex `^[a-zA-Z0-9_\-]+$`. Any paths containing `..`, `/`, `\`, or null bytes are rejected.
3. **Non-Destructive Deletion:**
   - Map deletion never calls `rm` or unlinks files directly.
   - Deletions move files safely to `~/maps/.trash/<map_name>_deleted_<timestamp>.pgm` and `.yaml`.
4. **No Arbitrary Shell Execution:**
   - Commands are tokenized argument lists (`subprocess.Popen(['roslaunch', ...])`).
   - `shell=True` is strictly forbidden.
5. **Operator Mutation Guard:**
   - In Settings, the **Allow Robot Actions** toggle must be explicitly enabled by the operator.
   - The UI blocks start/stop SLAM, save map, and delete map actions if this guard is off.
6. **Network & Web Guardrails:**
   - Map stream throttle floor: $\ge 1000\text{ ms}$ ($1\text{ Hz}$ max), strictly $\le 1$ active subscription.
   - TF stream throttle: $\le 50\text{ Hz}$, strictly $\le 2$ active subscriptions.

---

## 2. Jetson Robot Deployment (One-Time Setup)

SSH into the Jetson Nano to deploy the JCC Agent:

```bash
ssh sujal_suraj@<jetson-ip>
```

### Step 1: Copy `robot/` Folder to the Jetson
From your laptop/development workstation:
```bash
rsync -avz --exclude '.git' ./robot/ sujal_suraj@<jetson-ip>:~/jetracer-cc/robot/
```

### Step 2: Build Isolated Workspace (`~/jcc_ws`)
On the Jetson Nano:
```bash
cd ~/jetracer-cc/robot/scripts
chmod +x *.sh
./install_agent.sh
```

This script:
1. Creates isolated workspace `~/jcc_ws/src`.
2. Symlinks `jetracer_cc_msgs` and `jetracer_cc_agent`.
3. Ensures directories `~/maps` and `~/maps/.trash` exist.
4. Builds messages and node via `catkin_make`.
5. Verifies Python 2.7 / 3 compatibility on Tegra kernel 4.9.

### Step 3: Start the JCC Agent
```bash
cd ~/jetracer-cc/robot/scripts
./start_agent.sh
```
Verify the startup output:
```
[INFO] [jetracer_cc_agent]: JCC Robot Agent initialized successfully.
[INFO] [jetracer_cc_agent]: Service ready: /jetracer_cc_agent/command
[INFO] [jetracer_cc_agent]: Maps storage directory: /home/sujal_suraj/maps
```

### Step 4: Verify Agent Status
In another terminal on the Jetson:
```bash
cd ~/jetracer-cc/robot/scripts
./check_agent.sh
```
Expected output:
- ROS Service `/jetracer_cc_agent/command` is advertising.
- Response ping: `pong`.
- Maps directory: writable.

---

## 3. Stage 7A Verification Steps (Read-Only Mapping & Library)

Stage 7A tests live grid visualization and local device storage without modifying robot state.

1. **Connect to Robot:**
   - Open browser at `http://localhost:5173`.
   - Enter Jetson IP (`172.27.50.24` or current DHCP IP), port `9090`.
   - Confirm status badge displays `ROS OK`.

2. **Verify Mapping Page Layout:**
   - Navigate to `/mapping`.
   - Header displays `Occupancy Grid SLAM & Mapping` with phase badge `Stage 7A / 7B`.
   - Three main tabs are visible: **Live Map**, **Pose & TF**, **Map Library**.

3. **Start Live Map View:**
   - Ensure SLAM is running on the robot (either via manual launch `roslaunch jetracer_ros slam.launch` or via Stage 7B).
   - In topic selector, verify `/map` is discovered.
   - Click **Start Stream** (or **Start Viewing**).
   - Verify OccupancyGrid renders on canvas:
     - Free space: light gray / white.
     - Obstacles / walls: solid black.
     - Unknown space: dark charcoal (`#1e293b`).
   - Pan and zoom canvas with mouse drag / touch pinch and zoom buttons.

4. **Verify Robot Pose & Trail:**
   - Ensure TF publisher is active (`/tf`).
   - Switch to **Pose & TF** tab.
   - Verify coordinate frame tree: `map` $\rightarrow$ `odom` $\rightarrow$ `base_footprint`.
   - Verify real-time coordinates $(X, Y, \theta)$ update smoothly as the robot moves.
   - Verify canvas displays the blue robot chassis polygon and directional heading arrow.
   - Enable **Show Pose Trail** toggle; verify past trajectory breadcrumbs appear.

5. **Test Local Device Map Library:**
   - Switch to **Map Library** tab.
   - Click **Save Current View to Local Device**.
   - Enter name (e.g., `lab_hallway_v1`).
   - Confirm map card appears in "This Device" library with generated thumbnail, resolution, and dimensions.
   - Click **Export (ROS PGM + YAML)**:
     - Verify browser downloads `<name>.pgm` (NetPBM P5 binary format, inverted row-major).
     - Verify browser downloads `<name>.yaml` (standard ROS `map_server` format).
   - Test **Import Map**: upload exported files and verify grid loads correctly.

---

## 4. Stage 7B Verification Steps (Robot Actions & JCC Agent)

Stage 7B verifies robot-side process management, file operations, and chunked downloads.

1. **Enable Robot Actions in Settings:**
   - Navigate to `/settings`.
   - Under **Robot Mutation Safety**, toggle **Allow Robot Actions** to ON.
   - Confirm safety dialog warning.

2. **Start SLAM from Web UI:**
   - Navigate back to `/mapping`.
   - In top action bar, click **Start SLAM (Robot)**.
   - Observe toast notification: `SLAM mapping started on robot (PID: <pid>)`.
   - On Jetson terminal, run `ps aux | grep gmapping` to confirm SLAM process is running.
   - Within 2–3 seconds, `/map` topic starts emitting grid data. Canvas displays initial occupancy area.

3. **Drive Vehicle & Grow Map:**
   - Drive the JetRacer around the room using joystick / keyboard or RC controller.
   - Observe real-time occupancy grid expanding as laser discovers new walls and doorways.
   - Verify cell count and map dimensions increase without UI stuttering.

4. **Save Map to Robot Disk:**
   - Click **Save Map (Robot)** button.
   - Enter map name: `college_corridor_test`.
   - Observe toast: `Map college_corridor_test successfully saved to robot`.
   - Verify files on Jetson:
     ```bash
     ls -la ~/maps/
     ```
     Confirm `college_corridor_test.pgm` and `college_corridor_test.yaml` exist.

5. **Stop SLAM Node:**
   - Click **Stop SLAM (PID: <pid>)**.
   - Confirm dialog.
   - Observe toast: `SLAM mapping process stopped`.
   - Verify on Jetson: `ps aux | grep gmapping` shows process terminated cleanly with `SIGINT`.

6. **Manage Maps in "On Robot" Tab:**
   - Open **Map Library** $\rightarrow$ **On Robot** tab.
   - Click **Refresh Robot Maps**.
   - Verify `college_corridor_test` appears in the list with file size and timestamp.
   - Click **Download to Device**:
     - Client requests chunked base64 stream over `/jetracer_cc_agent/command`.
     - Progress bar tracks chunks (32 KB per chunk).
     - Browser prompts to save `.pgm` and `.yaml`.
   - Click **Delete Map**:
     - Confirm dialog.
     - Map disappears from active list.
     - Check Jetson terminal:
       ```bash
       ls -la ~/maps/.trash/
       ```
       Confirm file was moved to trash with `_deleted_<timestamp>` suffix and NOT erased from disk.

---

## 5. Troubleshooting & Diagnostics

| Symptom | Cause | Resolution |
| :--- | :--- | :--- |
| `Cannot connect to /jetracer_cc_agent/command` | Agent node not running on Jetson | Run `cd ~/jetracer-cc/robot/scripts && ./start_agent.sh`. Check `rosnode list`. |
| `Action blocked: Robot mutations disabled in Settings` | Operator mutation guard is OFF | Navigate to `/settings` and enable "Allow Robot Actions". |
| `Start SLAM error: SLAM process already running` | Previous SLAM node did not terminate | Kill lingering process via `killall -9 gmapping` on Jetson, or stop via UI. |
| `LaserScan /scan empty or stalled` | RPLIDAR node not started | Run `roslaunch jetracer_ros lidar.launch` on Jetson. Verify rate with `rostopic hz /scan`. |
| `Bare Infinity / NaN in JSON` | ROS 1 rosbridge Melodic serialization | Automatically handled by `sanitizeRosJson` WebSocket pre-parser in Control Center. |
