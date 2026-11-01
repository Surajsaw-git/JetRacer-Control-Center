#!/usr/bin/env bash
# JetRacer Control Center - Purely Additive Rosbridge Installer
# Only run this if robot/scripts/preflight.sh reports rosbridge_suite is MISSING.

set -euo pipefail

echo "=========================================================="
echo "    JetRacer Control Center - Install Rosbridge Suite     "
echo "=========================================================="
echo ""

# Detect ROS Distro
if [ -z "${ROS_DISTRO:-}" ]; then
    if [ -d "/opt/ros/melodic" ]; then
        ROS_DISTRO="melodic"
    elif [ -d "/opt/ros/noetic" ]; then
        ROS_DISTRO="noetic"
    else
        echo "ERROR: Unable to detect ROS_DISTRO. Neither /opt/ros/melodic nor /opt/ros/noetic found."
        echo "Please source your ROS environment before running this script."
        exit 1
    fi
fi

echo "Target ROS Distro detected: ${ROS_DISTRO}"
echo "Target Package to install:  ros-${ROS_DISTRO}-rosbridge-suite"
echo ""
echo "SAFETY GUARANTEE:"
echo "This installer only runs standard Ubuntu apt package management."
echo "It is purely ADDITIVE. It will NOT remove, modify, or reconfigure"
echo "any existing JetRacer vendor packages, Python packages, or launch files."
echo ""
echo "Type 'INSTALL' in capital letters to proceed with installation:"
read -r -p "> " USER_CONFIRMATION

if [ "${USER_CONFIRMATION}" != "INSTALL" ]; then
    echo "Installation aborted by operator. No changes were made."
    exit 0
fi

echo ""
echo "Updating apt package index..."
sudo apt-get update

echo ""
echo "Installing ros-${ROS_DISTRO}-rosbridge-suite..."
sudo apt-get install -y "ros-${ROS_DISTRO}-rosbridge-suite"

echo ""
echo "Verifying installation..."
# Source the ROS environment
# shellcheck disable=SC1090
source "/opt/ros/${ROS_DISTRO}/setup.bash"

if roslaunch rosbridge_server rosbridge_websocket.launch --help >/dev/null 2>&1; then
    echo "=========================================================="
    echo "SUCCESS: rosbridge_suite installed and verified!"
    echo "You can now run robot/scripts/start_rosbridge.sh to start it."
    echo "=========================================================="
else
    echo "WARNING: rosbridge_server launch check did not return expected output."
    echo "Please check 'dpkg -l | grep rosbridge' and ensure ROS environment is sourced."
    exit 1
fi
