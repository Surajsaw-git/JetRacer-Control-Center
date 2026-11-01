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
