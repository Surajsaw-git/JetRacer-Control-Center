#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — Camera Diagnostics Runbook (Read-Only)
#
# Inspects CSI / USB camera hardware, GStreamer plugins, ROS camera nodes/topics,
# and web_video_server status on the Jetson Nano (JetRacer).
#
# Usage:
#   bash robot/scripts/check_camera.sh
#   bash robot/scripts/check_camera.sh --probe   # (Runs 2s test capture)
# ==============================================================================

set -uo pipefail

PROBE_MODE=false
if [[ "${1:-}" == "--probe" ]]; then
  PROBE_MODE=true
fi

echo "================================================================================"
echo "          JetRacer Control Center — Camera Diagnostics Runbook                  "
echo "================================================================================"
echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%SZ")"
echo "Hostname:  $(hostname)"
echo ""

# 1. Video Device Nodes
echo "--- 1. Linux V4L2 Device Nodes (/dev/video*) ---"
if ls -l /dev/video* 2>/dev/null; then
  echo "[OK] Found video devices."
else
  echo "[WARNING] No /dev/video* devices found. Check CSI ribbon cable or USB connection."
fi
echo ""

# 2. Jetson Argus / Tegra Sensor Detection
echo "--- 2. NVIDIA Argus / Tegra Sensor Status ---"
if command -v v4l2-ctl >/dev/null 2>&1; then
  v4l2-ctl --list-devices 2>/dev/null || echo "[NOTE] v4l2-ctl failed to query devices."
else
  echo "[NOTE] v4l2-utils not installed (run 'sudo apt install v4l-utils' for detailed info)."
fi

# Check Tegra camera daemon
if pgrep -f nvargus-daemon >/dev/null 2>&1; then
  echo "[OK] nvargus-daemon is running."
else
  echo "[WARNING] nvargus-daemon is NOT running! Restart it with: sudo systemctl restart nvargus-daemon"
fi
echo ""

# 3. GStreamer Plugins (nvarguscamerasrc & gscam)
echo "--- 3. GStreamer Plugins Inspection ---"
if command -v gst-inspect-1.0 >/dev/null 2>&1; then
  if gst-inspect-1.0 nvarguscamerasrc >/dev/null 2>&1; then
    echo "[OK] GStreamer plugin 'nvarguscamerasrc' is installed."
  else
    echo "[CRITICAL] 'nvarguscamerasrc' plugin missing! Tegra multimedia API missing."
  fi

  if gst-inspect-1.0 nvvidconv >/dev/null 2>&1; then
    echo "[OK] GStreamer plugin 'nvvidconv' is installed."
  else
    echo "[WARNING] 'nvvidconv' plugin missing."
  fi
else
  echo "[WARNING] gst-inspect-1.0 not found in PATH."
fi
echo ""

# 4. ROS Camera Stack Packages
echo "--- 4. ROS 1 Camera Packages Inspection ---"
if [[ -f /opt/ros/melodic/setup.bash ]]; then
  # shellcheck source=/dev/null
  source /opt/ros/melodic/setup.bash
fi

check_rospack() {
  local pkg="$1"
  if rospack find "$pkg" >/dev/null 2>&1; then
    echo "[OK] ROS package '$pkg' is installed at: $(rospack find "$pkg")"
  else
    echo "[MISSING] ROS package '$pkg' is NOT installed!"
  fi
}

check_rospack "web_video_server"
check_rospack "image_transport"
check_rospack "compressed_image_transport"
check_rospack "gscam"
echo ""

# 5. Active ROS Nodes & Topics
echo "--- 5. Active ROS Camera Nodes & Topics ---"
if rostopic list >/dev/null 2>&1; then
  echo "Discovered Image Topics:"
  rostopic list | grep -E "image|camera|csi" || echo "  (None currently active)"

  echo ""
  echo "Discovered Camera Nodes:"
  rosnode list 2>/dev/null | grep -E "cam|video|gscam" || echo "  (None currently active)"
else
  echo "[NOTE] ROS master is not currently reachable or roscore is not running."
fi
echo ""

# 6. HTTP Web Video Server Port (8080)
echo "--- 6. HTTP Video Stream Port Check (Port 8080) ---"
if ss -tuln 2>/dev/null | grep -q ":8080 "; then
  echo "[OK] A service is listening on port 8080 (web_video_server active)."
elif netstat -tuln 2>/dev/null | grep -q ":8080 "; then
  echo "[OK] A service is listening on port 8080 (web_video_server active)."
else
  echo "[INFO] Nothing is listening on port 8080. Start web_video_server using:"
  echo "       roslaunch robot/launch/jetracer_web_video.launch"
fi
echo ""

# 7. Optional Probe Test Pipeline
if [[ "$PROBE_MODE" == "true" ]]; then
  echo "--- 7. Hardware Capture Probe Test (2 seconds) ---"
  echo "Testing CSI camera capture with nvarguscamerasrc (headless fakesink)..."
  if gst-launch-1.0 nvarguscamerasrc num-buffers=40 ! 'video/x-raw(memory:NVMM),width=640,height=480,framerate=20/1' ! fakesink 2>/dev/null; then
    echo "[PASS] Successfully captured frames from CSI camera without errors."
  else
    echo "[FAIL] GStreamer CSI capture failed! Camera may be disconnected, unpowered, or in use."
  fi
  echo ""
fi

echo "================================================================================"
echo "Diagnostics complete. For installation steps, see robot/scripts/install_camera_stack.sh"
echo "================================================================================"
