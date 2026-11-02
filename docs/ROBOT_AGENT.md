# JetRacer Control Center — Robot Helper Agent (JCC Agent)

## Overview

The **JCC Agent** (`jetracer_cc_agent`) is an isolated, lightweight ROS 1 node designed to run on the physical JetRacer vehicle. It provides an audited, bounded control surface for operations that require modifying robot-side processes or files (such as launching SLAM mapping, saving occupancy grids to disk via `map_saver`, listing saved maps, and chunked file transfer).

In accordance with system safety principles, the JCC Agent operates as an opt-in component deployed in an independent catkin workspace (`~/jcc_ws`) without modifying existing vendor packages in `~/catkin_ws`.

---

## Security Model & Invariants

1. **Strict Process Execution (No Shell Execution)**
   - The agent strictly executes tokenized argument lists via Python's `subprocess.Popen(..., shell=False)`.
   - String concatenation of shell commands (`shell=True`) is prohibited throughout the codebase.

2. **Filesystem Jail & Path Traversal Prevention**
   - Maps are confined strictly to `~/maps/` (`maps_dir`).
   - All map identifiers are validated against the strict whitelist regex `^[a-zA-Z0-9_\-]+$`.
   - Any attempt to include slashes (`/`), backslashes (`\`), parent references (`..`), or null bytes is rejected before any filesystem call.
   - Real-path resolution (`os.path.realpath`) verifies that destination files remain inside the resolved jail boundary.

3. **Non-Destructive Deletion Policy**
   - The agent never invokes permanent removal (`rm`, `os.remove`, `shutil.rmtree`) for map records.
   - Deleted maps are moved into `~/maps/.trash/<name>_deleted_<timestamp>.yaml` and `.pgm` for operator auditability and recovery.

4. **Frontend Opt-In Guard (Settings Toggle)**
   - By default, `allowRobotMutations` is `false` in `Settings -> Safety`.
   - The web client rejects calls to `startMapping`, `stopMapping`, `saveMapOnRobot`, and `deleteMapOnRobot` unless the operator explicitly enables "Allow Robot Actions" in Settings. Read-only actions (`getStatus`, `listRobotMaps`, `downloadMapFromRobot`) remain accessible.

5. **Runtime Compatibility**
   - Fully compatible with Python 2.7 (ROS 1 Melodic on NVIDIA Jetson Linux for Tegra 4.9 kernel) and Python 3.
   - Standard library only (`os`, `sys`, `subprocess`, `signal`, `json`, `time`, `shutil`, `re`, `glob`, `base64`) alongside `rospy` and `jetracer_cc_msgs`.

---

## Service Definition

The node advertises a single command service:
- **Service Name**: `/jetracer_cc_agent/command`
- **Service Type**: `jetracer_cc_msgs/AgentCommand`

### `jetracer_cc_msgs/srv/AgentCommand.srv`
```srv
string command
string args_json
---
bool success
string message
string payload_json
```

---

## Supported Commands

| Command | Arguments (`args_json`) | Description |
| :--- | :--- | :--- |
| `status` | `{}` | Returns agent version, uptime, mapping status (`is_mapping`, `mapping_pid`), maps directory, map count, and trash count. |
| `start_mapping` | `{"pkg": "jetracer", "launch": "slam.launch"}` | Spawns SLAM mapping process in a detached process group (`os.setsid`). |
| `stop_mapping` | `{}` | Sends `SIGINT` to the SLAM process group (allowing clean node shutdown), falling back to `SIGTERM` if needed. |
| `save_map` | `{"name": "room_1"}` | Invokes `rosrun map_server map_saver -f ~/maps/room_1`. Outputs `room_1.yaml` and `room_1.pgm`. |
| `list_maps` | `{}` | Lists all saved `.yaml` maps in `~/maps` with file sizes, modified timestamps, and PGM availability. |
| `delete_map` | `{"name": "room_1"}` | Safely moves `room_1.yaml` and `room_1.pgm` to `~/maps/.trash/`. |
| `get_map_chunk` | `{"name": "room_1", "ext": "pgm", "chunk_index": 0}` | Returns a 48 KB base64-encoded chunk of the requested map file for browser transfer. |

---

## Deployment & Verification on Robot

### 1. Build and Install Workspace
On the JetRacer terminal:
```bash
cd ~/jetracer-cc/robot/scripts
./install_agent.sh
```
This sets up `~/jcc_ws`, installs message definitions, builds `jetracer_cc_msgs` and `jetracer_cc_agent`, and prepares `~/maps/.trash`.

### 2. Start the Agent Node
```bash
cd ~/jetracer-cc/robot/scripts
./start_agent.sh
```

### 3. Verify Health
In a second terminal:
```bash
cd ~/jetracer-cc/robot/scripts
./check_agent.sh
```
Example output:
```
==========================================================
    JetRacer Control Center — Agent Verification
==========================================================
Checking service '/jetracer_cc_agent/command'... ONLINE

--- Agent Telemetry Probe ---
success: True
message: "Agent is operational."
payload_json: "{\"version\": \"0.8.1-phase7b\", \"uptime_secs\": 14, \"is_mapping\": false, \"mapping_pid\": null, \"maps_dir\": \"/home/sujal_suraj/maps\", \"map_count\": 0, \"trash_count\": 0}"
==========================================================
Agent check passed.
```
