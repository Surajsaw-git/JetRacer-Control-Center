# JetRacer Phase 4 Robot Verification Runbook

> **STATUS:** Tested against local mock rosbridge v2 only. **NOT YET TESTED ON PHYSICAL ROBOT HARDWARE.**
>
> **SCOPE:** This runbook details the field checklist for verifying Phase 4 ROS Integration (runtime ROS master status, node/topic/service discovery, controlled read-only topic watcher, and user-confirmed topic registry) on the physical NVIDIA JetRacer at college.

---

## 0. Prerequisites & Safety Boundaries

1. **Hardware Safety:**
   - E-Stop software trigger in Phase 4 is read-only / simulation. It does **NOT** command the physical motor controller.
   - Keep the physical chassis power switch within arm's reach.
   - Keep the 2.4GHz wireless gamepad powered with finger ready on **R1 emergency brake**.
2. **Strict Read-Only Enforcement:**
   - Under no circumstances will Phase 4 publish velocity commands (`/cmd_vel`) or call parameter modification services.
   - All outgoing operations outside the rosapi allow-list are unconditionally blocked and rejected before socket transmission.
3. **Network Connection:**
   - Follow `docs/FIRST_CONNECTION_RUNBOOK.md` to establish local Wi-Fi / hotspot connectivity between laptop and robot.
   - Rosbridge WebSocket must be active on port `9090`.

---

## 1. Field Verification Checklist

### Step 1: Preflight Audit & Launch Rosbridge
On the Jetson shell via SSH (`ssh <robot-username>@<robot-ip>`):
```bash
cd ~/jetracer-robot/scripts
./preflight.sh
./start_rosbridge.sh
```
Verify that the terminal output reports:
- ROS Distribution: `melodic`
- `[INFO] [...] [rosbridge_websocket]: Rosbridge WebSocket server started on port 9090`

---

### Step 2: Connect from App UI
1. On your development laptop or mobile browser, open `http://<laptop-ip>:5173` or production build.
2. Go to **Settings -> Connection**.
3. In **Robot Address**, enter `<robot-ip>` and click **Connect**.
4. Confirm:
   - Link A (rosbridge) transitions to **CONNECTED**.
   - Top Header ROS Indicator displays **ROS OK** with live latency (e.g. `12ms`).
   - Clock Offset is computed (e.g. `Synchronized (offset: -42ms)`).

---

### Step 3: Verify Discovery & Diffing
1. Navigate to **System -> Topics**.
2. Click **Refresh**.
3. Verify that the table populates with the real robot topics (e.g. camera, lidar, odom, cmd_vel, etc.).
4. Click **Details** on any topic to inspect publisher and subscriber node names.
5. Navigate to **System -> Nodes** and confirm active nodes match `rosnode list`.
6. Navigate to **System -> Services** and confirm capability policy badges correctly mark read-only services as "Allowed Read-Only" and state-altering services as "Blocked Policy".

---

### Step 4: Verify Controlled Topic Watcher
1. In **System -> Topics**, choose a telemetry topic (e.g. odometry or IMU) and click **Watch**.
2. The UI automatically switches to the **Watch** tab.
3. Observe:
   - Live measured Hz (e.g. `20.0 Hz` or `50.0 Hz`).
   - Message count incrementing steadily.
   - Sanitized payload JSON updating with no UI lag.
4. Test Heavy-Type Blocking:
   - Attempt to click **Watch** on a camera image topic (`sensor_msgs/Image`).
   - Verify that the app blocks the subscription and displays: *"Direct image streaming disabled in Topic Watcher to preserve network. Camera stream will be enabled in Phase 5 via web_video_server."*
5. Test Maximum 5 Concurrent Watches:
   - Watch 5 topics simultaneously.
   - Attempt to watch a 6th topic.
   - Verify that the app refuses with: *"Maximum limit of 5 concurrent watches reached."*

---

### Step 5: Configure & Export Topic Registry
1. Navigate to **System -> Registry**.
2. For each standard role (`cmd_vel`, `odometry`, `imu`, `laser_scan`, `occupancy_map`, etc.), open the dropdown.
3. Notice that suggestions are strictly filtered by matching ROS message types.
4. Select the matching robot topic for each role.
5. Click **Verify** on mapped roles: observe status transition from `Mapped (Unverified)` to `Verified Live` once the first incoming message is decoded.
6. Click **Export JSON** to save the verified mapping profile (`topic_registry_default_profile.json`).

---

### Step 6: Export Redacted ROS Inspection Report
1. In **System -> Status**, click **Export Inspection Report**.
2. Verify that the robot IP is masked by default (`xxx.xxx.xxx.105`).
3. Click **Copy** or **Download** to save the report file to `docs/` for git commit and reference.

---

### Step 7: Confirm No Publisher Count Increases (Strict Read-Only Verification)
To guarantee that the app is 100% read-only and never publishes or advertises on the robot:
1. In an SSH session on the Jetson, check publishers for `/cmd_vel` (or any other topic):
   ```bash
   rostopic info /cmd_vel
   ```
2. Note the `Publishers:` count and node names.
3. Keep the app open, navigate through **System -> Topics**, **Watch**, **Registry**, and **Dashboard**.
4. Run `rostopic info /cmd_vel` again on the Jetson shell.
5. **Verify:** The publisher count must remain strictly identical. No rosbridge publisher or advertisement must appear.
