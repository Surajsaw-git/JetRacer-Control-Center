# JetRacer Robot State & Known Specifications

> **STATUS:** Operator-reported snapshot derived from college lab logs.
> **IMPORTANT:** None of these specifications have been verified by the current codebase on the physical robot. They serve as design hints for Phase 3 and will be systematically verified during the on-robot inspection runbook.

---

## 1. Hardware Architecture

| Subsystem | Specification / Value | Source & Verification Tag | Notes |
| :--- | :--- | :--- | :--- |
| **Compute Board** | NVIDIA Jetson Nano Developer Kit (eMMC version) | `[CONFIRMED in log]` | Tegra X1 / T210 (`t210ref`), aarch64 (not Orin) |
| **System Memory** | 4 GB LPDDR4 | `[CONFIRMED in log]` | Shared CPU/GPU memory |
| **Primary Boot Storage** | 16 GB eMMC (`mmcblk0`, 14.7 GiB) | `[CONFIRMED in log]` | Holds bootloader and recovery partition |
| **Expanded Storage** | 32 GB microSD card (`mmcblk1`, 29.7 GiB) | `[CONFIRMED in log]` | SD controller enabled via device-tree patch; ~21 GiB free space |
| **Chassis & Drive** | Waveshare JetRacer ROS AI Kit | `[CONFIRMED in log]` | Rear DC motors with wheel encoders, Ackermann front servo steering |
| **Expansion Board** | Waveshare RP2040 Expansion Board | `[CONFIRMED in log]` | Communicates via serial `/dev/ttyACM0` at 115200 baud |
| **LiDAR Sensor** | Slamtec RPLIDAR A1 | `[CONFIRMED in log]` | USB serial adapter mounted on `/dev/ttyACM1` |
| **Camera Sensor** | Sony IMX219 (CSI ribbon cable) | `[CONFIRMED in log]` | Driver loaded |
| **Wireless Gamepad** | TGZ 2.4GHz Wireless Controller | `[CONFIRMED in log]` | USB receiver connected; axes 0 & 1 for throttle/steering, L1 dead-man, R1 E-Stop |
| **Battery Pack** | 3x 18650 Li-ion cells (up to 12.6V) | `[CONFIRMED in log]` | Expansion board protection circuit |

---

## 2. Operating System & Software Stack

| Component | Value | Source & Verification Tag | Notes |
| :--- | :--- | :--- | :--- |
| **OS Distribution** | Ubuntu 18.04.6 LTS (Bionic Beaver, arm64) | `[VERIFIED 2026-11-02]` | Standard NVIDIA L4T rootfs |
| **NVIDIA JetPack** | JetPack 4.6.5 (L4T R32.7.5) | `[CONFIRMED in log]` | Built 11 June 2024 |
| **Linux Kernel** | `4.9.337-tegra` | `[VERIFIED 2026-11-02]` | NVIDIA Tegra kernel reported by `uname -r` |
| **System Python** | Python 3.6.9 & Python 2.7.17 | `[VERIFIED 2026-11-02]` | ROS Melodic `rospy` runs on Python 2.7 |
| **ROS 1 Distribution** | ROS 1 Melodic Morenia (`melodic`) | `[VERIFIED 2026-11-02]` | Responsive at `http://localhost:11311` |
| **Workspace Path** | `~/catkin_ws` | `[VERIFIED 2026-11-02]` | Source overlay workspace |
| **Vendor ROS Package** | `jetracer_ros` | `[VERIFIED 2026-11-02]` | Waveshare driver nodes, EKF odometry, teleop |
| **Rosbridge Server** | `rosbridge_websocket` (port 9090) | `[VERIFIED 2026-11-02]` | Unauthenticated, all globs `[*]` |
| **Active LiDAR Node** | `/rplidarNode` | `[VERIFIED 2026-11-02]` | Emitting `/scan` at 8.007 Hz |

---

## 3. Communication Buses & Device Nodes

- **Car Driver Serial:** `/dev/ttyACM0` (115200 baud). Handles motor PWM, encoder feedback, and servo angle.
- **LiDAR Serial:** `/dev/ttyACM1` (115200 baud). Streams 2D point cloud packets.
- **I2C Bus 1:**
  - `0x3c`: OLED display on chassis.
  - `0x40` & `0x41`: INA219 battery voltage and current monitors.

---

## 4. Existing Launch Files & Scripts (Operator Log)

- `~/run_jetracer.sh`: Shell helper starting ROS environment and joystick teleop.
- `jetracer.launch`: Primary driver launch (starts base driver, `robot_pose_ekf`, `odom_ekf.py`, static transforms).
- `lidar.launch`: Launches RPLIDAR driver on `/dev/ttyACM1`.
- `slam.launch`: Launches Gmapping 2D SLAM node.
- `jetracer_joy.launch` / `joy_only.launch`: Gamepad drivers.

---

## 5. Critical Observations for Phase 3 Architecture

1. **Continuous Velocity Teleop:**
   - The operator's existing `joy_teleop` node publishes to `/cmd_vel` continuously at 20 Hz (sending zeros when L1 dead-man is released).
   - **Phase 3 Guard:** Phase 3 sends **ZERO** velocity frames and does not touch or conflict with `/cmd_vel`.
2. **Rosbridge Suite Presence:** `[UNKNOWN]`
   - It is currently unknown whether `ros-melodic-rosbridge-suite` is installed on the Jetson Nano.
   - An interactive installation script (`robot/scripts/install_rosbridge.sh`) is provided for the operator.
3. **Local Wi-Fi Reachability & Isolation:** `[UNKNOWN]`
   - College campus Wi-Fi networks frequently enforce AP client isolation, preventing direct laptop-to-robot or phone-to-robot socket communication.
   - The runbook recommends testing via a dedicated mobile hotspot or direct Ethernet connection.

---

## 6. Live Preflight & Field Test Verification (Operator-Reported, 2026-11-02)

During the first live robot test at college, operator preflight checks confirmed:
- **OS & Kernel:** Ubuntu 18.04.6 LTS (Bionic), kernel `4.9.337-tegra`, NVIDIA L4T R32.7.5.
- **Python Environments:** Python 2.7.17 (default ROS 1 runtime) and Python 3.6.9.
- **Network Interfaces:**
  - `wlan0`: Connected to private Wi-Fi hotspot (`192.168.137.x` subnet). Power saving was active by default.
  - `eth0`: Present, link down.
- **Active Node Graph:**
  - `rosbridge_websocket` and `rosapi` nodes successfully started on port 9090.
  - Base driver and SLAM nodes active.
  - **LiDAR node:** Missing from active node list in initial session (operator needs to explicitly launch `lidar.launch` before LiDAR and SLAM topics are fully populated).
- **Resource Constraints:**
  - System memory: ~900 MB free under active SLAM and CSI camera nodes.
  - Round-trip ping latency to rosbridge was variable (50ms base, jumping to 133ms–321ms under load).
- **Link Drop Behavior:**
  - When connection severed under load, client retry loop exhausted in earlier build (`v0.6.0`); solved in `v0.6.2-field-fixes` with indefinite exponential backoff capped at 30s and honest status reporting.
