#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — Start Web Video Server Helper
#
# Sources ROS environment and launches web_video_server on port 8080.
#
# Usage:
#   bash robot/scripts/start_camera.sh [PORT]
# ==============================================================================

set -euo pipefail

PORT="${1:-8080}"

echo "================================================================================"
echo "          JetRacer Control Center — Starting Web Video Server                   "
echo "================================================================================"

if [[ -f /opt/ros/melodic/setup.bash ]]; then
  # shellcheck source=/dev/null
  source /opt/ros/melodic/setup.bash
fi

# Source catkin workspace if exists
if [[ -f "$HOME/catkin_ws/devel/setup.bash" ]]; then
  # shellcheck source=/dev/null
  source "$HOME/catkin_ws/devel/setup.bash"
fi

if ! rostopic list >/dev/null 2>&1; then
  echo "[WARNING] ROS master is not currently responding. Ensure roscore is running."
fi

ROBOT_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo "ROBOT_IP")"

echo "[INFO] Launching web_video_server on port ${PORT}..."
echo "[INFO] Stream URL pattern: http://${ROBOT_IP}:${PORT}/stream?topic=<YOUR_TOPIC>"
echo "[INFO] Snapshot pattern:   http://${ROBOT_IP}:${PORT}/snapshot?topic=<YOUR_TOPIC>"
echo ""

roslaunch robot/launch/jetracer_web_video.launch port:="${PORT}"
