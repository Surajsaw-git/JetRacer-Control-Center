#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — Robot Helper Agent Installer (Phase 7B)
# Builds the isolated ~/jcc_ws workspace without touching ~/catkin_ws.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ROS_WS_SRC="${REPO_ROOT}/robot/ros_ws/src"
TARGET_WS="${HOME}/jcc_ws"

echo "=========================================================="
echo "    JetRacer Control Center — Agent Setup (Phase 7B)     "
echo "=========================================================="
echo "Target Workspace: ${TARGET_WS}"
echo "Source Packages:  ${ROS_WS_SRC}"
echo "=========================================================="

# 1. Source ROS Melodic environment
if [ -f "/opt/ros/melodic/setup.bash" ]; then
    echo "[1/5] Sourcing /opt/ros/melodic/setup.bash..."
    # shellcheck disable=SC1091
    source "/opt/ros/melodic/setup.bash"
else
    echo "ERROR: /opt/ros/melodic/setup.bash not found. Is ROS 1 Melodic installed?" >&2
    exit 1
fi

# 2. Prepare workspace directory
echo "[2/5] Creating isolated workspace at ${TARGET_WS}/src..."
mkdir -p "${TARGET_WS}/src"
mkdir -p "${HOME}/maps/.trash"

# 3. Synchronize package sources into workspace
echo "[3/5] Copying JCC agent packages to ${TARGET_WS}/src..."
cp -r "${ROS_WS_SRC}/jetracer_cc_msgs" "${TARGET_WS}/src/"
cp -r "${ROS_WS_SRC}/jetracer_cc_agent" "${TARGET_WS}/src/"
chmod +x "${TARGET_WS}/src/jetracer_cc_agent/scripts/jcc_agent.py"

# 4. Build workspace with catkin_make
echo "[4/5] Building workspace via catkin_make..."
cd "${TARGET_WS}"
catkin_make

# 5. Done
echo "[5/5] Build complete!"
echo "=========================================================="
echo "JCC Agent has been installed to ${TARGET_WS}."
echo "To start the agent node manually, run:"
echo "    ${SCRIPT_DIR}/start_agent.sh"
echo "=========================================================="
