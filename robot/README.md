# JetRacer Robot-Side Helper Utilities

This folder contains lightweight, shell-native helper scripts and launch files designed to run directly on the Jetson Nano host to prepare and support **JetRacer Control Center** network connectivity.

> **CRITICAL SAFETY GUARANTEE:**
> - None of these scripts modify or delete existing robot drivers, configurations, or system files.
> - `preflight.sh` and `collect_ros_info.sh` are **100% read-only**.
> - `install_rosbridge.sh` is strictly additive (`apt-get install -y ros-<distro>-rosbridge-suite`) and requires typing `INSTALL` to confirm.

---

## 1. Quick Start: Copying Files to the Robot

From your laptop/workstation terminal (while connected to the same Wi-Fi router as the robot):

```bash
# Replace jetson@<robot-ip> with your robot's SSH username and IP
scp -r robot jetson@<robot-ip>:~/jetracer-robot
```

Then SSH into the robot:

```bash
ssh jetson@<robot-ip>
cd ~/jetracer-robot/scripts
chmod +x *.sh
```

---

## 2. Recommended Execution Sequence

### Step 1: Preflight Diagnostic Audit (`preflight.sh`)
Run this first. It checks Python versions, Linux kernel, available disk space, network interfaces, IP addresses, `roscore` reachability, and whether `rosbridge_suite` is already installed:

```bash
./preflight.sh
```
The report is displayed on the screen and saved to `~/jetracer_preflight_<timestamp>.txt`.

---

### Step 2: Install Rosbridge (Only if Needed) (`install_rosbridge.sh`)
If `preflight.sh` reports that `rosbridge_suite` is **NOT** installed:

```bash
./install_rosbridge.sh
```
- It automatically detects whether your ROS installation is `melodic` or `noetic`.
- It prompts you to type `INSTALL` before proceeding.
- It runs `sudo apt-get install -y ros-$ROS_DISTRO-rosbridge-suite`.

---

### Step 3: Start Rosbridge Server (`start_rosbridge.sh`)
Ensure your normal JetRacer ROS startup scripts (or `roscore`) are running first, then launch the rosbridge WebSocket bridge:

```bash
./start_rosbridge.sh
```
- Listens on port `9090` across all interfaces (`0.0.0.0`).
- Wraps `robot/launch/jetracer_rosbridge.launch`.
- Press `Ctrl+C` to terminate when done.

---

### Step 4: Collect Complete ROS Metadata for Phase 4 (`collect_ros_info.sh`)
While the robot is running its normal stack (e.g. `run_jetracer.sh` or `jetracer.launch`), run this read-only script:

```bash
./collect_ros_info.sh
```
- Queries all active topics, publication frequencies (Hz), node names, services, parameters, and the TF transform tree.
- Uses strict 3-second timeouts per topic so it never hangs.
- Saves the complete audit report to `~/jetracer_inspection_<timestamp>.txt`.
- Copy this file back to your development laptop to populate `docs/ROS_TOPICS.md` for Phase 4:
  ```bash
  # Run from your laptop:
  scp jetson@<robot-ip>:~/jetracer_inspection_*.txt docs/
  ```

---

## 3. Launch Configuration (`robot/launch/jetracer_rosbridge.launch`)

This launch file configures the WebSocket bridge:
- `port`: `9090` (WebSocket)
- `address`: `0.0.0.0` (accessible from any client device on the local network)
- `authenticate`: `false` (Phase 3 local connection testing)
- `unregister_timeout`: `10.0` seconds
