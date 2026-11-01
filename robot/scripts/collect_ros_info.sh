#!/usr/bin/env bash
# JetRacer Control Center - Comprehensive ROS Environment Inspection
# 100% Read-Only: Collects all active nodes, topics, message types, publication rates,
# services, parameters, and TF transforms into an inspection log for Phase 4.

set -u

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
OUTPUT_FILE="${HOME}/jetracer_inspection_${TIMESTAMP}.txt"

echo "=========================================================="
echo "    JetRacer Control Center - Live ROS Inspection         "
echo "=========================================================="
echo "Target output file: ${OUTPUT_FILE}"
echo "Beginning inspection. This may take 30-60 seconds..."
echo "=========================================================="

{
    echo "=========================================================="
    echo "JetRacer Live ROS Environment Inspection Report"
    echo "Timestamp: $(date)"
    echo "Host:      $(hostname)"
    echo "Kernel:    $(uname -r)"
    echo "=========================================================="
    echo ""

    # Ensure ROS is sourced
    if [ -z "${ROS_DISTRO:-}" ]; then
        if [ -f "/opt/ros/melodic/setup.bash" ]; then
            # shellcheck disable=SC1091
            source "/opt/ros/melodic/setup.bash"
        elif [ -f "/opt/ros/noetic/setup.bash" ]; then
            # shellcheck disable=SC1091
            source "/opt/ros/noetic/setup.bash"
        fi
    fi

    for WS in "${HOME}/catkin_ws" "${HOME}/jetracer_ws" "${HOME}/ros_ws"; do
        if [ -f "${WS}/devel/setup.bash" ]; then
            # shellcheck disable=SC1090
            source "${WS}/devel/setup.bash"
            break
        fi
    done

    echo "--- [1] ROS Core Master Status ---"
    if ! timeout 3 rostopic list >/dev/null 2>&1; then
        echo "ERROR: ROS Master (roscore) is not reachable! Aborting inspection."
        exit 1
    fi
    echo "ROS Master is responsive at ${ROS_MASTER_URI:-http://localhost:11311}"
    echo ""

    echo "--- [2] Active ROS Nodes ---"
    rosnode list 2>&1 || true
    echo ""

    echo "--- [3] Detailed Active Topics (Publishers & Subscribers) ---"
    rostopic list -v 2>&1 || true
    echo ""

    echo "--- [4] Topic Rates and Message Types (3-second sample each) ---"
    TOPICS=$(rostopic list 2>/dev/null || true)
    for TOPIC in ${TOPICS}; do
        echo ">> TOPIC: ${TOPIC}"
        echo -n "   Type: "
        timeout 2 rostopic type "${TOPIC}" 2>/dev/null || echo "Unknown"
        echo -n "   Hz:   "
        timeout 3 rostopic hz "${TOPIC}" 2>&1 | head -n 2 | tr '\n' ' ' || echo "No data / silent"
        echo ""
    done
    echo ""

    echo "--- [5] Active ROS Services ---"
    rosservice list 2>&1 || true
    echo ""

    echo "--- [6] Active ROS Parameters ---"
    rosparam list 2>&1 || true
    echo ""

    echo "--- [7] TF Coordinate Frame Monitor (4-second sample) ---"
    if command -v rosrun >/dev/null 2>&1; then
        timeout 4 rosrun tf tf_monitor 2>&1 || echo "tf_monitor returned no transforms or timed out."
    else
        echo "rosrun not available."
    fi
    echo ""

    echo "--- [8] Installed ROS Packages ---"
    rospack list 2>&1 || true
    echo ""

    echo "--- [9] Available Launch Files in Workspace & Home ---"
    find "${HOME}" -maxdepth 5 -name "*.launch" 2>/dev/null || true
    echo ""

    echo "=========================================================="
    echo "INSPECTION COMPLETE. Saved to: ${OUTPUT_FILE}"
    echo "=========================================================="
} 2>&1 | tee "${OUTPUT_FILE}"

echo ""
echo "Inspection finished successfully! Output saved to: ${OUTPUT_FILE}"
echo "You can copy this file to your laptop using:"
echo "  scp jetson@<robot-ip>:${OUTPUT_FILE} ./docs/"
