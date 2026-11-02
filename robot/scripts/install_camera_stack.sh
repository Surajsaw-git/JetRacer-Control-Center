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
echo "  1. ros-melodic-web-video-server        (HTTP MJPEG stream on port 8080)"
echo "  2. ros-melodic-image-transport-plugins (CompressedImage support)"
echo "  3. ros-melodic-gscam                   (GStreamer CSI camera ROS node)"
echo "  4. v4l-utils                           (Video4Linux hardware diagnostics)"
echo ""
echo "[WARNING - SYSTEM RESOURCE LOAD]"
echo "Running GStreamer CSI capture and web_video_server alongside active 2D SLAM"
echo "(Gmapping/Cartographer) under 4GB RAM on Jetson Nano can push available memory"
echo "below 900MB. Do not run high-resolution streams while mapping."
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

CANDIDATE_PACKAGES=(
  "ros-melodic-web-video-server"
  "ros-melodic-image-transport-plugins"
  "ros-melodic-gscam"
  "v4l-utils"
)

INSTALLABLE=()
MISSING=()

echo ""
echo "[INFO] Verifying package availability via apt-cache policy..."
for pkg in "${CANDIDATE_PACKAGES[@]}"; do
  candidate=$(apt-cache policy "$pkg" 2>/dev/null | grep "Candidate:" | awk '{print $2}' || true)
  if [[ -z "$candidate" || "$candidate" == "(none)" ]]; then
    echo "  [-] $pkg: Candidate is (none) — not available in configured apt repositories."
    MISSING+=("$pkg")
  else
    echo "  [+] $pkg: Candidate available ($candidate)"
    INSTALLABLE+=("$pkg")
  fi
done

if [[ ${#INSTALLABLE[@]} -gt 0 ]]; then
  echo ""
  echo "[INFO] Installing verified candidate packages: ${INSTALLABLE[*]}..."
  sudo apt-get install -y "${INSTALLABLE[@]}"
  echo "[OK] Installed: ${INSTALLABLE[*]}"
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo ""
  echo "================================================================================"
  echo "[ATTENTION] The following packages had candidate '(none)' and were NOT installed:"
  for m in "${MISSING[@]}"; do
    echo "  - $m"
  done
  echo ""
  if [[ " ${MISSING[*]} " =~ "ros-melodic-gscam" ]]; then
    echo "Notice for 'gscam':"
    echo "The CSI camera node requires gscam. If apt binary is unavailable, build from source:"
    echo "  cd ~/catkin_ws/src"
    echo "  git clone https://github.com/ros-drivers/gscam.git"
    echo "  cd ~/catkin_ws"
    echo "  catkin_make --pkg gscam"
    echo "  source ~/catkin_ws/devel/setup.bash"
  fi
  echo "================================================================================"
fi

echo ""
echo "================================================================================"
echo "[SUCCESS] Camera stack verification completed."
echo "Launch web video server with:"
echo "  roslaunch robot/launch/jetracer_web_video.launch"
echo "================================================================================"
