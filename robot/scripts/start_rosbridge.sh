#!/usr/bin/env bash
# JetRacer Control Center - Start Rosbridge WebSocket Server
# Safely launches rosbridge on port 9090 without disturbing existing nodes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCH_FILE="${SCRIPT_DIR}/../launch/jetracer_rosbridge.launch"

echo "=========================================================="
echo "    JetRacer Control Center - Starting Rosbridge Server   "
echo "=========================================================="

# 1. Source ROS Base Environment
if [ -z "${ROS_DISTRO:-}" ]; then
    if [ -f "/opt/ros/melodic/setup.bash" ]; then
        # shellcheck disable=SC1091
        source "/opt/ros/melodic/setup.bash"
    elif [ -f "/opt/ros/noetic/setup.bash" ]; then
        # shellcheck disable=SC1091
        source "/opt/ros/noetic/setup.bash"
    else
        echo "ERROR: ROS setup.bash not found in /opt/ros/melodic or /opt/ros/noetic."
        echo "Please source your ROS environment before running this script."
        exit 1
    fi
fi

# 2. Source User Workspace if available (common workspace names)
for WS in "${HOME}/catkin_ws" "${HOME}/jetracer_ws" "${HOME}/ros_ws"; do
    if [ -f "${WS}/devel/setup.bash" ]; then
        echo "Sourcing workspace: ${WS}/devel/setup.bash"
        # shellcheck disable=SC1090
        source "${WS}/devel/setup.bash"
        break
    fi
done

# 2b. Source JCC Agent Workspace only if present
if [ -f "${HOME}/jcc_ws/devel/setup.bash" ]; then
    echo "Sourcing JCC Agent workspace: ${HOME}/jcc_ws/devel/setup.bash"
    # shellcheck disable=SC1090
    source "${HOME}/jcc_ws/devel/setup.bash"
fi

echo "ROS Distribution: ${ROS_DISTRO}"

# 3. Check if ROS Master / roscore is active
echo "Checking ROS Master status..."
if ! timeout 3 rostopic list >/dev/null 2>&1; then
    echo "=========================================================="
    echo "ERROR: ROS Master is not responding!"
    echo ""
    echo "JetRacer Control Center will NOT blindly start roscore, because"
    echo "the JetRacer vendor startup script or robot nodes may require specific"
    echo "parameters or environment setup."
    echo ""
    echo "Please ensure your robot startup script (e.g. run_jetracer.sh or roscore)"
    echo "is running first, then re-run this script."
    echo "=========================================================="
    exit 1
fi
echo "ROS Master is running and accessible."

# 4. Check if Port 9090 is already occupied
echo "Checking if port 9090 is already in use..."
PORT_IN_USE=0
if command -v ss >/dev/null 2>&1; then
    if ss -tulpn | grep -q ":9090 "; then
        PORT_IN_USE=1
    fi
elif command -v netstat >/dev/null 2>&1; then
    if netstat -tulpn | grep -q ":9090 "; then
        PORT_IN_USE=1
    fi
elif command -v lsof >/dev/null 2>&1; then
    if lsof -i :9090 >/dev/null 2>&1; then
        PORT_IN_USE=1
    fi
fi

if [ "${PORT_IN_USE}" -eq 1 ]; then
    echo "=========================================================="
    echo "WARNING: Port 9090 is already bound by another process!"
    echo "rosbridge might already be running, or another service is using port 9090."
    echo "Check active processes using: sudo lsof -i :9090 or ss -tulpn | grep 9090"
    echo "=========================================================="
    exit 1
fi

# 5. Launch Rosbridge
echo "Starting rosbridge on port 9090 (0.0.0.0)..."
echo "Press Ctrl+C to terminate rosbridge server at any time."
echo "=========================================================="

exec roslaunch "${LAUNCH_FILE}"
