# JetRacer ROS 1 Ecosystem Specification

> # ⚠️ NOT YET INSPECTED
> **DO NOT GUESS OR ASSUME TOPIC NAMES, NODE NAMES, OR SERVICES.**
> This file must be filled and validated strictly from the real physical JetRacer robot in Phase 4.
> No ROS topics or services have been inspected or assumed yet.

---

## 1. Inspection Commands (Run on Jetson in Phase 4)

These commands are **100% read-only**. They do not modify, stop, or reconfigure any running services on the Jetson. Run or approve these commands during Phase 4 inspection:

```bash
# 1. Print all active published and subscribed topics with message types:
rostopic list -v

# 2. Print all active ROS nodes:
rosnode list

# 3. Print all active ROS services:
rosservice list

# 4. Print all parameters currently stored in the Parameter Server:
rosparam list

# 5. Measure publication rate of camera topic (replace <camera_topic> with actual name once discovered):
rostopic hz <camera_topic>

# 6. Measure publication rate of LiDAR scan topic (replace <scan_topic> with actual name once discovered):
rostopic hz <scan_topic>

# 7. Inspect topic publishers, subscribers, and message definitions:
rostopic info <topic_name>

# 8. List all installed ROS packages:
rospack list

# 10. Inspect Camera & Streaming Packages (Phase 5):
rostopic list | grep -E "image|camera|csi"
rospack find web_video_server
rospack find gscam
bash robot/scripts/check_camera.sh
```

---

## 2. Topic Registry

| Topic Name | Message Type | Direction | Subsystem / Purpose | Verified on Robot |
| :--- | :--- | :--- | :--- | :---: |
| *To be discovered* | *NOT YET INSPECTED* | *N/A* | *N/A* | ❌ No |

---

## 3. Service Registry

| Service Name | Service Type | Direction | Subsystem / Purpose | Verified on Robot |
| :--- | :--- | :--- | :--- | :---: |
| *To be discovered* | *NOT YET INSPECTED* | *N/A* | *N/A* | ❌ No |

---

## 4. Node Registry

| Node Name | Package Name | Primary Role | Verified on Robot |
| :--- | :--- | :--- | :---: |
| *To be discovered* | *NOT YET INSPECTED* | *N/A* | ❌ No |

---

## 5. TF Coordinate Frames

| Parent Frame | Child Frame | Publishing Node | Purpose | Verified on Robot |
| :--- | :--- | :--- | :--- | :---: |
| *To be discovered* | *NOT YET INSPECTED* | *N/A* | *N/A* | ❌ No |

---

## 6. Launch File Catalog

| Launch File Path | Package | Included Subsystems | Verified on Robot |
| :--- | :--- | :--- | :---: |
| *To be discovered* | *NOT YET INSPECTED* | *N/A* | ❌ No |

---

## 7. Rosbridge Server Configuration

| Parameter | Default / Target | Configured Value | Verified on Robot |
| :--- | :--- | :--- | :---: |
| Port | `9090` | *NOT YET INSPECTED* | ❌ No |
| Address | `0.0.0.0` | *NOT YET INSPECTED* | ❌ No |
| Protocol | WebSocket (`ws://`) | *NOT YET INSPECTED* | ❌ No |
| Max Message Size | Default | *NOT YET INSPECTED* | ❌ No |

---

## 9. Phase 4 ROS Capability Policy & Security Boundaries

In Phase 4, the application connects to rosbridge v2 strictly read-only. No velocity commands are published, and no parameters or state-altering services are invoked.

### 9.1 Approved Read-Only Introspection Services
Only the following rosapi services are permitted:
| Service Name | Service Type | Role / Capability |
| :--- | :--- | :--- |
| `/rosapi/get_time` | `rosapi/GetTime` | Clock offset and master latency heartbeat |
| `/rosapi/topics` | `rosapi/Topics` | Discovered topic names |
| `/rosapi/topic_type` | `rosapi/TopicType` | Individual topic message type lookup |
| `/rosapi/topics_and_raw_types` | `rosapi/TopicsAndRawTypes` | Batch topic and message type query |
| `/rosapi/nodes` | `rosapi/Nodes` | Active node list registered on master |
| `/rosapi/node_details` | `rosapi/NodeDetails` | On-demand node publications & subscriptions |
| `/rosapi/services` | `rosapi/Services` | Registered ROS services list |
| `/rosapi/service_type` | `rosapi/ServiceType` | Service type introspection |
| `/rosapi/publishers` | `rosapi/Publishers` | On-demand publishers for a topic |
| `/rosapi/subscribers` | `rosapi/Subscribers` | On-demand subscribers for a topic |
| `/rosapi/message_details` | `rosapi/MessageDetails` | Message type field definitions |

### 9.2 Blocked Operations & Services
- **Publishing:** Prohibited across all topics (including `/cmd_vel`).
- **Advertising:** Prohibited across all topics.
- **Parameter Modification:** `/rosapi/set_param`, `/rosapi/delete_param`, `/rosapi/get_param` are strictly blocked.
- **State Alteration:** Any service matching `/(set|delete|shutdown|kill|reboot|restart|launch|spawn)/i` is rejected before transmission.

### 9.3 Topic Registry Roles & Type Contracts
Downstream UI phases consume user-confirmed topic mappings rather than hard-coded topic strings:
| Application Role | Expected ROS Types | Consumer Subsystem |
| :--- | :--- | :--- |
| `cmd_vel` | `geometry_msgs/Twist` | Virtual Joystick & Gamepad (Phase 8) |
| `odometry` | `nav_msgs/Odometry` | Odometry telemetry & speed gauges (Phase 8) |
| `imu` | `sensor_msgs/Imu` | IMU orientation & acceleration (Phase 8) |
| `laser_scan` | `sensor_msgs/LaserScan` | 2D LiDAR radar canvas (Phase 6) |
| `occupancy_map` | `nav_msgs/OccupancyGrid` | SLAM mapping viewport (Phase 7) |
| `camera_image` | `sensor_msgs/Image`, `sensor_msgs/CompressedImage` | CSI camera feed (Phase 5 via web_video_server) |
| `joystick` | `sensor_msgs/Joy` | Hardware gamepad telemetry |
| `tf` | `tf2_msgs/TFMessage` | Dynamic frame transforms |
| `tf_static` | `tf2_msgs/TFMessage` | Fixed chassis transforms |
| `battery` | `sensor_msgs/BatteryState` | Power monitor & voltage gauge |


> ⚠️ **UNVERIFIED NOTICE:** The topics below are referenced in vendor launch files (`jetracer.launch`, `run_jetracer.sh`, `joy_teleop.py`) from operator handoff notes (`docs/ROBOT_STATE.md`). They have **NOT** been inspected on the physical robot and must NOT be used for automated assumptions or commands until Phase 4 live verification.

| Topic Name | Expected Type | Direction | Operator Reported Notes | Verified on Robot |
| :--- | :--- | :--- | :--- | :---: |
| `/cmd_vel` | `geometry_msgs/Twist` | Bidirectional / Jetson In | Motor & steering velocity commands. **CAUTION:** `joy_teleop.py` reported to publish zero-twist continuously at 20 Hz when joystick is connected! | ❌ No |
| `/imu` | `sensor_msgs/Imu` | Robot Out | Chassis IMU angular velocity and linear acceleration. | ❌ No |
| `/odom` | `nav_msgs/Odometry` | Robot Out | Primary wheel odometry. | ❌ No |
| `/odom_combined` | `geometry_msgs/PoseWithCovarianceStamped` | Robot Out | Filtered odometry (robot_pose_ekf). | ❌ No |
| `/odom_raw` | `nav_msgs/Odometry` | Robot Out | Raw uncalibrated wheel odometry. | ❌ No |
| `/tf` | `tf2_msgs/TFMessage` | Robot Out | Coordinate transformation tree (`odom` -> `base_footprint` -> `base_link` -> `laser_frame`). | ❌ No |
| `/joy` | `sensor_msgs/Joy` | Controller In | Input state from TGZ wireless 2.4GHz controller. | ❌ No |
| `/scan` | `sensor_msgs/LaserScan` | Robot Out | 2D LiDAR range scan from RPLIDAR A1. | ❌ No |

---

## 6. Observed on Robot (Operator-Reported, 2026-11-02)

During the first live robot test at college on 2026-11-02, the operator inspected the running ROS 1 Melodic environment. The following nodes and rosapi services were confirmed operational:

- **Active Rosbridge & Introspection Nodes:**
  - `/rosbridge_websocket` (`rosbridge_server/rosbridge_websocket`) on port 9090
  - `/rosapi` (`rosapi/rosapi_node`) serving `/rosapi/get_time`, `/rosapi/topics`, `/rosapi/nodes`, `/rosapi/services`
- **Active Core Topics:**
  - `/rosout`, `/rosout_agg` (`rosgraph_msgs/Log`)
  - `/tf` (`tf2_msgs/TFMessage`)
- **Node Graph Status:**
  - Base driver and SLAM nodes were loaded.
  - LiDAR node was **not active** in default boot runbook (operator must run `roslaunch jetracer_ros lidar.launch` to start RPLIDAR driver publishing to `/scan`).
  - CSI camera node printing `cannot launch node of type [gscam/gscam]` when `csi_camera.launch` was run (resolved via helper scripts and fallback pipeline in Phase 5).

