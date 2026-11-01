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

# 9. Search for JetRacer workspace launch files:
find ~/ -name "*.launch" 2>/dev/null
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

## 8. Operator-Reported, Unverified Topics (Handoff Reference Only)

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

