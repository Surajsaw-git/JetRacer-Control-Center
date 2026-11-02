#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — LiDAR Diagnostics Runbook (Read-Only)
#
# Inspects serial/USB ports (/dev/ttyUSB*, /dev/ttyACM*), ROS LaserScan nodes/topics,
# publishing rate, message geometry/limits, TF frame transforms, and system load.
#
# Usage:
#   bash robot/scripts/check_lidar.sh
#   bash robot/scripts/check_lidar.sh --topic /scan
# ==============================================================================

set -uo pipefail

SCAN_TOPIC=""
if [[ "${1:-}" == "--topic" && -n "${2:-}" ]]; then
  SCAN_TOPIC="$2"
fi

TIMESTAMP=$(date -u +"%Y%m%d_%H%M%SZ")
LOG_FILE="${HOME}/jetracer_lidar_check_${TIMESTAMP}.txt"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "================================================================================"
echo "          JetRacer Control Center — LiDAR Diagnostics Runbook                   "
echo "================================================================================"
echo "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%SZ")"
echo "Hostname:  $(hostname)"
echo "Output Log: ${LOG_FILE}"
echo ""

# 1. Serial and USB Device Nodes
echo "--- 1. Serial / USB LiDAR Device Nodes ---"
SERIAL_DEVS=$(ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null || true)
if [[ -n "${SERIAL_DEVS}" ]]; then
  echo "[OK] Found serial device node(s):"
  echo "${SERIAL_DEVS}"
else
  echo "[WARNING] No /dev/ttyUSB* or /dev/ttyACM* devices found."
  echo "          Check USB connection to the LiDAR board."
fi

# Check USB vendor & product IDs
echo ""
echo "--- 2. USB Bus Inspection (lsusb) ---"
if command -v lsusb >/dev/null 2>&1; then
  lsusb | grep -E -i "cp210|ftdi|ch34|silicon|rplidar|ydlidar|serial" || echo "[NOTE] No standard USB-to-UART bridge detected."
else
  echo "[NOTE] 'lsusb' command not found."
fi

# Check user permissions (dialout group)
echo ""
echo "--- 3. Serial Port Permissions ---"
CURRENT_USER=$(whoami)
if groups "${CURRENT_USER}" | grep -q "\bdialout\b"; then
  echo "[OK] User '${CURRENT_USER}' is in the 'dialout' group."
else
  echo "[WARNING] User '${CURRENT_USER}' is NOT in 'dialout'! Access to /dev/ttyUSB* may fail with Permission Denied."
  echo "          Run: sudo usermod -a -G dialout ${CURRENT_USER} (and log out/in)."
fi

# 4. ROS Core & Master
echo ""
echo "--- 4. ROS Core Status ---"
if command -v roscore >/dev/null 2>&1; then
  if rosnode list >/dev/null 2>&1; then
    echo "[OK] ROS Master is active and responding."
  else
    echo "[ERROR] ROS Master is not responding! roscore or jetracer stack may not be running."
  fi
else
  echo "[ERROR] ROS environment is not sourced! Run 'source /opt/ros/melodic/setup.bash' first."
fi

# 5. Discover LaserScan Topics
echo ""
echo "--- 5. LaserScan ROS Topics ---"
LIDAR_TOPICS=""
if command -v rostopic >/dev/null 2>&1 && rosnode list >/dev/null 2>&1; then
  ALL_TOPICS=$(rostopic list 2>/dev/null || true)
  for t in ${ALL_TOPICS}; do
    TYPE=$(rostopic type "$t" 2>/dev/null || true)
    if [[ "$TYPE" == "sensor_msgs/LaserScan" ]]; then
      echo "  • Found LaserScan topic: $t"
      if [[ -z "${LIDAR_TOPICS}" ]]; then
        LIDAR_TOPICS="$t"
      fi
    fi
  done

  if [[ -z "${LIDAR_TOPICS}" ]]; then
    echo "[WARNING] No topic publishing type 'sensor_msgs/LaserScan' was discovered."
    echo "          Is your LiDAR driver running (e.g. 'roslaunch rplidar_ros rplidar.launch')?"
  fi
fi

# Choose target topic for deep dive
TARGET_TOPIC="${SCAN_TOPIC:-$LIDAR_TOPICS}"

if [[ -n "${TARGET_TOPIC}" ]]; then
  echo ""
  echo "================================================================================"
  echo "--- 6. Deep Inspection: ${TARGET_TOPIC} ---"
  echo "================================================================================"

  # Publisher info
  echo "Publishers & Subscribers:"
  rostopic info "${TARGET_TOPIC}" 2>/dev/null || true

  # Publish rate (Hz) over 3 seconds
  echo ""
  echo "Sampling publish rate (rostopic hz for 3 seconds):"
  timeout 3s rostopic hz "${TARGET_TOPIC}" 2>&1 || true

  # Message header and limits (suppressing arrays)
  echo ""
  echo "Message header and range bounds (--noarr):"
  rostopic echo -n 1 --noarr "${TARGET_TOPIC}" 2>/dev/null || true

  # Range values analysis using python
  echo ""
  echo "Analyzing range values (valid vs inf vs nan):"
  PY_CMD="python"
  command -v python >/dev/null 2>&1 || PY_CMD="python3"
  if command -v "$PY_CMD" >/dev/null 2>&1; then
    "$PY_CMD" - << 'PY_EOF' 2>/dev/null || echo "[NOTE] Python inspection skipped."
import rospy
from sensor_msgs.msg import LaserScan
import math
import sys

def callback(msg):
    total = len(msg.ranges)
    valids = [r for r in msg.ranges if not math.isnan(r) and not math.isinf(r) and r >= msg.range_min and r <= msg.range_max]
    nans = [r for r in msg.ranges if math.isnan(r)]
    infs = [r for r in msg.ranges if math.isinf(r)]
    below_min = [r for r in msg.ranges if not math.isnan(r) and not math.isinf(r) and r < msg.range_min]
    above_max = [r for r in msg.ranges if not math.isnan(r) and not math.isinf(r) and r > msg.range_max]
    
    print("  Frame ID:        {}".format(msg.header.frame_id))
    print("  Rays count:      {}".format(total))
    print("  Valid count:     {} ({:.1f}%)".format(len(valids), (len(valids)/total*100) if total else 0))
    print("  Inf count:       {}".format(len(infs)))
    print("  NaN count:       {}".format(len(nans)))
    print("  Below min:       {}".format(len(below_min)))
    print("  Above max:       {}".format(len(above_max)))
    if valids:
        print("  Min valid range: {:.3f} m".format(min(valids)))
        print("  Max valid range: {:.3f} m".format(max(valids)))
    rospy.signal_shutdown("sample_done")

try:
    rospy.init_node('lidar_checker_probe', anonymous=True, disable_signals=True)
    target = "${TARGET_TOPIC}"
    sub = rospy.Subscriber(target, LaserScan, callback)
    rospy.sleep(2.0)
except Exception as e:
    print("  [NOTE] LaserScan subscriber probe failed: {}".format(e))
PY_EOF
  else
    echo "[NOTE] Neither python nor python3 found; probe skipped."
  fi

  # TF Frame inspection
  echo ""
  echo "--- 7. TF Frame Transforms ---"
  FRAME_ID=$(rostopic echo -n 1 "${TARGET_TOPIC}/header/frame_id" 2>/dev/null | tr -d '"' | tr -d ' ' || true)
  if [[ -n "${FRAME_ID}" ]]; then
    echo "Scan Frame ID: ${FRAME_ID}"
    if command -v rosrun >/dev/null 2>&1; then
      echo "Checking transform between 'base_link' (or 'base_footprint') and '${FRAME_ID}':"
      timeout 2s rosrun tf tf_echo base_link "${FRAME_ID}" 2>/dev/null || \
      timeout 2s rosrun tf tf_echo base_footprint "${FRAME_ID}" 2>/dev/null || \
      echo "[NOTE] No direct TF transform found to base_link / base_footprint. Ensure robot state publisher is active."
    fi
  fi
fi

# 8. Jetson System Load & Temperatures
echo ""
echo "--- 8. Jetson Nano CPU Load & Thermal Profile ---"
echo "Uptime & Load Average: $(uptime)"
for zone in /sys/devices/virtual/thermal/thermal_zone*/temp; do
  if [[ -f "$zone" ]]; then
    ZONE_NAME=$(basename "$(dirname "$zone")")
    TEMP_MC=$(cat "$zone" 2>/dev/null || true)
    if [[ -n "$TEMP_MC" && "$TEMP_MC" -gt 0 ]]; then
      TEMP_C=$((TEMP_MC / 1000))
      echo "  • ${ZONE_NAME}: ${TEMP_C}°C"
    fi
  fi
done

echo ""
echo "================================================================================"
echo "[DONE] LiDAR verification check completed. Log saved to: ${LOG_FILE}"
echo "================================================================================"
