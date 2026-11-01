#!/usr/bin/env bash
# JetRacer Control Center - Robot Preflight Inspection Script
# 100% Read-Only: Safe to execute at any time. Does not alter system state.

set -u

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
OUTPUT_FILE="${HOME}/jetracer_preflight_${TIMESTAMP}.txt"

echo "=========================================================="
echo "    JetRacer Control Center - Robot Preflight Audit       "
echo "=========================================================="
echo "Timestamp: $(date)"
echo "Host:      $(hostname)"
echo "Output:    ${OUTPUT_FILE}"
echo "=========================================================="

{
    echo "=========================================================="
    echo "JetRacer Robot Preflight Diagnostic Report"
    echo "Generated: $(date)"
    echo "Hostname:  $(hostname)"
    echo "=========================================================="
    echo ""

    echo "--- [1] OS and Linux Kernel ---"
    uname -a 2>&1 || true
    if [ -f /etc/os-release ]; then
        cat /etc/os-release
    fi
    if [ -f /etc/nv_tegra_release ]; then
        echo "NVIDIA Tegra Release:"
        cat /etc/nv_tegra_release
    fi
    echo ""

    echo "--- [2] Hardware and Resource Usage ---"
    echo "CPU architecture:"
    uname -m 2>&1 || true
    echo "CPU Cores: $(nproc 2>/dev/null || echo 'Unknown')"
    echo "Memory (RAM):"
    free -m 2>&1 || true
    echo "Disk Space (Root):"
    df -h / 2>&1 || true
    echo ""

    echo "--- [3] Network Interfaces and IP Addresses ---"
    ip -4 addr show 2>/dev/null || ifconfig 2>/dev/null || ip addr show 2>/dev/null || true
    echo ""
    echo "Default Gateway / Route:"
    ip route show 2>/dev/null || route -n 2>/dev/null || true
    echo ""

    echo "--- [4] Python Runtimes ---"
    echo "python:  $(python --version 2>&1 || echo 'Not installed')"
    echo "python2: $(python2 --version 2>&1 || echo 'Not installed')"
    echo "python3: $(python3 --version 2>&1 || echo 'Not installed')"
    echo "which python3: $(which python3 2>&1 || echo 'Not found')"
    echo ""

    echo "--- [5] ROS 1 Environment Detection ---"
    if [ -z "${ROS_DISTRO:-}" ]; then
        echo "ROS_DISTRO is not currently exported in this shell."
        # Check standard /opt/ros installations
        if [ -d "/opt/ros/melodic" ]; then
            echo "Found /opt/ros/melodic! Sourcing /opt/ros/melodic/setup.bash for this probe..."
            # shellcheck disable=SC1091
            source /opt/ros/melodic/setup.bash 2>/dev/null || true
        elif [ -d "/opt/ros/noetic" ]; then
            echo "Found /opt/ros/noetic! Sourcing /opt/ros/noetic/setup.bash for this probe..."
            # shellcheck disable=SC1091
            source /opt/ros/noetic/setup.bash 2>/dev/null || true
        fi
    fi

    echo "ROS_DISTRO:       ${ROS_DISTRO:-Not detected}"
    echo "ROS_ROOT:         ${ROS_ROOT:-Not set}"
    echo "ROS_MASTER_URI:   ${ROS_MASTER_URI:-Not set}"
    echo "ROS_PACKAGE_PATH: ${ROS_PACKAGE_PATH:-Not set}"
    echo ""

    echo "--- [6] Roscore and ROS Master Reachability ---"
    ROSCORE_ACTIVE="NO"
    if command -v rostopic >/dev/null 2>&1; then
        if timeout 3 rostopic list >/dev/null 2>&1; then
            ROSCORE_ACTIVE="YES"
            echo "ROS Master is ACTIVE and responding."
        else
            echo "ROS Master is NOT responding or roscore is not running."
        fi
    else
        echo "ROS tools (rostopic) not found in PATH."
    fi
    echo ""

    if [ "${ROSCORE_ACTIVE}" = "YES" ]; then
        echo "--- [7] Active ROS Nodes ---"
        timeout 5 rosnode list 2>&1 || echo "Timed out querying nodes."
        echo ""

        echo "--- [8] Active ROS Topics ---"
        timeout 5 rostopic list 2>&1 || echo "Timed out querying topics."
        echo ""

        echo "--- [9] Active ROS Services (First 20) ---"
        timeout 5 rosservice list 2>&1 | head -n 20 || echo "Timed out querying services."
        echo ""
    fi

    echo "--- [10] Rosbridge Suite Installation Status ---"
    ROSBRIDGE_INSTALLED="NO"
    if command -v rospack >/dev/null 2>&1; then
        if rospack find rosbridge_server >/dev/null 2>&1; then
            ROSBRIDGE_INSTALLED="YES"
            echo "rosbridge_server is INSTALLED at: $(rospack find rosbridge_server)"
        fi
    fi

    if [ "${ROSBRIDGE_INSTALLED}" = "NO" ]; then
        # Secondary check via dpkg
        if dpkg -l | grep -q "rosbridge-suite"; then
            ROSBRIDGE_INSTALLED="YES"
            echo "rosbridge-suite found via dpkg."
        else
            echo "rosbridge_suite is NOT installed."
        fi
    fi
    echo ""

    echo "--- [11] Active Network Listening Ports (Port 9090 & 8000 Probe) ---"
    if command -v ss >/dev/null 2>&1; then
        ss -tulpn 2>&1 | grep -E "(:9090|:8000|:11311)" || echo "No listener on 9090, 8000, or 11311."
    elif command -v netstat >/dev/null 2>&1; then
        netstat -tulpn 2>&1 | grep -E "(:9090|:8000|:11311)" || echo "No listener on 9090, 8000, or 11311."
    else
        echo "Neither ss nor netstat available."
    fi
    echo ""

    echo "=========================================================="
    echo "                   SUMMARY OF AUDIT                       "
    echo "=========================================================="
    echo "ROS Distro:          ${ROS_DISTRO:-None detected}"
    echo "Roscore Active:      ${ROSCORE_ACTIVE}"
    echo "Rosbridge Installed: ${ROSBRIDGE_INSTALLED}"
    echo "Report file:         ${OUTPUT_FILE}"
    echo "=========================================================="
} 2>&1 | tee "${OUTPUT_FILE}"

echo ""
echo "Preflight check finished! Full report saved to: ${OUTPUT_FILE}"
