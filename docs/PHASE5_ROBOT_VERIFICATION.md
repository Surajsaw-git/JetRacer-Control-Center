# JetRacer Control Center — Phase 5 Robot Verification Runbook

> **Target Platform:** NVIDIA Jetson Nano Developer Kit (B01) / Waveshare JetRacer AI Kit  
> **Target OS:** Ubuntu 18.04 LTS + ROS 1 Melodic Morenia  
> **Camera Stack:** CSI Camera (`nvarguscamerasrc` / `gscam`) + `web_video_server` (Port 8080)  
> **Status:** Written ahead of hardware testing. Mock-verified in Windows dev environment.

---

## 1. Safety Boundaries (Strictly Binding)

1. **Strictly Read-Only Operation:**
   - The Control Center subscribes to image feeds or requests HTTP MJPEG streams.
   - It **never publishes** to `/cmd_vel` or any robot control topic.
   - It **never alters** camera parameters, exposure, white balance, or `dynamic_reconfigure`.
   - **Verification:** Confirm the app published nothing (`rostopic info /cmd_vel` publisher count remains strictly unchanged).
2. **Bandwidth & CPU Preservation:**
   - Raw `sensor_msgs/Image` is **never transmitted** over rosbridge WebSocket JSON (would overwhelm the Jetson Nano CPU).
   - Only HTTP MJPEG (`web_video_server`) or `sensor_msgs/CompressedImage` (throttled $\ge 100\text{ ms}$, max 1 stream) are permitted.
   - Single ref-counted consumer manager ensures stream halts when not actively viewed.
3. **SLAM Concurrency Restriction:**
   - **SLAM must NOT be running during the first camera test.** Running GStreamer CSI encoding and web_video_server concurrently with SLAM (Gmapping/Cartographer) under 4GB RAM on the Jetson Nano can exhaust system memory. Keep SLAM stopped until standalone camera performance is benchmarked.

---

## 2. Pre-Verification Robot Checklist

Execute these checks on the Jetson Nano terminal over SSH before opening the app:

### Step 1: Run Camera Diagnostics
```bash
cd ~/jetracer-robot/scripts
bash check_camera.sh
```
Verify:
- `/dev/video0` is present.
- `nvargus-daemon` is running (`systemctl status nvargus-daemon`).
- `nvarguscamerasrc` GStreamer plugin is installed.

### Step 2: Probe CSI Sensor Capture (Optional)
```bash
bash check_camera.sh --probe
```
Confirms the hardware pipeline captures 40 frames without throwing Argus driver timeouts.

### Step 3: Install Camera Stack (If Missing)
If `web_video_server` or `image_transport_plugins` are missing:
```bash
bash install_camera_stack.sh
# Type 'INSTALL' when prompted
```

### Step 4: Launch Web Video Server
```bash
bash start_camera.sh 8080
```
Verify output confirms listening on `0.0.0.0:8080`.

---

## 3. Step-by-Step UI Verification in Control Center

1. **Navigate to Camera Page:**
   - Open JetRacer Control Center in your browser (`http://<laptop-ip>:5173` or Android app).
   - Click **Camera** in the left sidebar / bottom navigation.
2. **Inspect Topic Selection:**
   - Confirm discovered image topics appear in the dropdown (e.g. `/csi_cam_0/image_raw`).
   - If no topics are auto-discovered, enter manual topic name `/csi_cam_0/image_raw` and click Apply.
3. **Verify Transport Selection:**
   - Default: `web_video_server (HTTP Port 8080)`.
   - Fallback: `rosbridge (CompressedImage)`.
4. **Initiate Video Stream:**
   - Click **Start Stream**.
   - Verify the 16:9 letterboxed canvas displays live camera video.
   - Verify top HUD shows active FPS ($\approx 20\text{--}30\text{ fps}$), resolution, bandwidth in $\text{kB/s}$, and drop counter.
5. **Test Fullscreen:**
   - Click the Maximize icon or press `F`.
   - Verify viewport expands to fill the entire screen.
   - Move mouse: verify controls auto-hide after 3 seconds of inactivity.
   - Press `Escape` or Android back button: verify clean exit from fullscreen.
6. **Capture Client-Side Snapshot:**
   - Click **Snapshot**.
   - Verify a PNG file named `jetracer-snap-<timestamp>.png` is downloaded to your device.
7. **Verify Multi-View Ref-Counting:**
   - Open **Dashboard**: verify Camera preview card attaches seamlessly.
   - Open **Control**: verify camera slot is active while driving joystick remains read-only.
   - Stop stream or navigate away: verify stream halts and consumer count drops cleanly to 0.
