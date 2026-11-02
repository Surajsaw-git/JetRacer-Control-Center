#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — Start JCC Helper Agent (Phase 7B)
# ==============================================================================
set -euo pipefail

TARGET_WS="${HOME}/jcc_ws"

# 1. Source ROS core
if [ -f "/opt/ros/melodic/setup.bash" ]; then
    # shellcheck disable=SC1091
    source "/opt/ros/melodic/setup.bash"
else
    echo "ERROR: /opt/ros/melodic/setup.bash not found." >&2
    exit 1
fi

# 2. Source JCC workspace
if [ -f "${TARGET_WS}/devel/setup.bash" ]; then
    # shellcheck disable=SC1091
    source "${TARGET_WS}/devel/setup.bash"
else
    echo "ERROR: ${TARGET_WS}/devel/setup.bash not found. Run ./install_agent.sh first." >&2
    exit 1
fi

# 3. Check ROS Master
if ! rostopic list >/dev/null 2>&1; then
    echo "WARNING: ROS Master does not appear to be running on localhost:11311." >&2
    echo "Please start roscore or your base robot launch file first." >&2
fi

echo "=========================================================="
echo "    Starting JetRacer Control Center Agent (Phase 7B)    "
echo "=========================================================="
echo "Node: /jetracer_cc_agent"
echo "Service: /jetracer_cc_agent/command"
echo "Maps Directory: ${HOME}/maps"
echo "=========================================================="

exec rosrun jetracer_cc_agent jcc_agent.py
