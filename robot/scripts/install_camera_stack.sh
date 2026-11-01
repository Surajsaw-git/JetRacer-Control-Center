#!/usr/bin/env bash
# ==============================================================================
# JetRacer Control Center — Camera Stack Installer for ROS Melodic
#
# Installs web_video_server, image_transport_plugins, and gscam on the Jetson Nano.
#
# Usage:
#   bash robot/scripts/install_camera_stack.sh
# ==============================================================================

set -euo pipefail

echo "================================================================================"
echo "          JetRacer Control Center — Camera Stack Installer                      "
echo "================================================================================"
echo ""
echo "This script installs packages required for browser video streaming:"
echo "  1. ros-melodic-web-video-server       (HTTP MJPEG stream on port 8080)"
echo "  2. ros-melodic-image-transport-plugins (CompressedImage support)"
echo "  3. ros-melodic-gscam                  (GStreamer CSI camera ROS node)"
echo ""

# Verify ROS Melodic
if [[ ! -d /opt/ros/melodic ]]; then
  echo "[ERROR] /opt/ros/melodic not found. This script targets ROS 1 Melodic on Ubuntu 18.04."
  exit 1
fi

echo "Safety Confirmation Required:"
read -r -p "Type 'INSTALL' to proceed with apt installation: " CONFIRMATION

if [[ "$CONFIRMATION" != "INSTALL" ]]; then
  echo "Aborted by user. No packages installed."
  exit 0
fi

echo ""
echo "[INFO] Updating package indices..."
sudo apt-get update

echo "[INFO] Installing camera streaming packages..."
sudo apt-get install -y \
  ros-melodic-web-video-server \
  ros-melodic-image-transport-plugins \
  v4l-utils

# Check if ros-melodic-gscam is available in apt repo
if apt-cache show ros-melodic-gscam >/dev/null 2>&1; then
  sudo apt-get install -y ros-melodic-gscam
  echo "[OK] ros-melodic-gscam installed from apt."
else
  echo ""
  echo "[NOTE] 'ros-melodic-gscam' binary was not found in apt cache."
  echo "If gscam node fails to launch, clone and build it in your catkin workspace:"
  echo "  cd ~/catkin_ws/src"
  echo "  git clone https://github.com/ros-drivers/gscam.git"
  echo "  cd ~/catkin_ws"
  echo "  catkin_make --pkg gscam"
  echo "  source ~/catkin_ws/devel/setup.bash"
fi

echo ""
echo "================================================================================"
echo "[SUCCESS] Camera stack installation completed."
echo "You can now launch the web video server with:"
echo "  roslaunch robot/launch/jetracer_web_video.launch"
echo "================================================================================"
