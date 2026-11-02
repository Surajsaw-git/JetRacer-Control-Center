#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — Verify JCC Helper Agent (Phase 7B)
# ==============================================================================
set -euo pipefail

TARGET_WS="${HOME}/jcc_ws"

if [ -f "/opt/ros/melodic/setup.bash" ]; then
    # shellcheck disable=SC1091
    source "/opt/ros/melodic/setup.bash"
fi

if [ -f "${TARGET_WS}/devel/setup.bash" ]; then
    # shellcheck disable=SC1091
    source "${TARGET_WS}/devel/setup.bash"
fi

echo "=========================================================="
echo "    JetRacer Control Center — Agent Verification        "
echo "=========================================================="

SERVICE_NAME="/jetracer_cc_agent/command"

echo -n "Checking service '${SERVICE_NAME}'... "
if rosservice list | grep -q "${SERVICE_NAME}"; then
    echo "ONLINE"
    echo ""
    echo "--- Agent Telemetry Probe ---"
    rosservice call "${SERVICE_NAME}" "command: 'status' args_json: '{}'"
    echo "=========================================================="
    echo "Agent check passed."
else
    echo "OFFLINE"
    echo "Agent is not currently registered on ROS Master."
    echo "Start it using: ~/jetracer-cc/robot/scripts/start_agent.sh"
    echo "=========================================================="
    exit 1
fi
