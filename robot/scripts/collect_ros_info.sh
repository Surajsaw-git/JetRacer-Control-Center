#!/usr/bin/env bash
# JetRacer Control Center - Comprehensive ROS Environment Inspection
# 100% Read-Only: Collects all active nodes, topics, message types, publication rates,
# services, parameters, and TF transforms into an inspection log for Phase 4 / Phase 7.

set -u

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
OUTPUT_FILE="${HOME}/jetracer_inspection_${TIMESTAMP}.txt"

# Guarantee clean line flushing and final termination banner on any exit
cleanup() {
    local exit_code=$?
    echo "" >> "${OUTPUT_FILE}" 2>/dev/null || true
    echo "==========================================================" >> "${OUTPUT_FILE}" 2>/dev/null || true
    echo "END OF REPORT (Exit code: ${exit_code})" >> "${OUTPUT_FILE}" 2>/dev/null || true
    echo "==========================================================" >> "${OUTPUT_FILE}" 2>/dev/null || true
    echo ""
    echo "Inspection completed. Output flushed to: ${OUTPUT_FILE}"
}
trap cleanup EXIT INT TERM

log() {
    echo "$@" | tee -a "${OUTPUT_FILE}"
}

echo "==========================================================" | tee "${OUTPUT_FILE}"
echo "    JetRacer Control Center - Live ROS Inspection         " | tee -a "${OUTPUT_FILE}"
echo "==========================================================" | tee -a "${OUTPUT_FILE}"
echo "Target output file: ${OUTPUT_FILE}" | tee -a "${OUTPUT_FILE}"
echo "Beginning inspection (Strictly read-only, runtime capped at ~35-45s)..." | tee -a "${OUTPUT_FILE}"
echo "==========================================================" | tee -a "${OUTPUT_FILE}"
echo "" | tee -a "${OUTPUT_FILE}"

log "=========================================================="
log "JetRacer Live ROS Environment Inspection Report"
log "Timestamp: $(date -u +"%Y-%m-%d %H:%M:%SZ")"
log "Host:      $(hostname)"
log "Kernel:    $(uname -r)"
log "=========================================================="
log ""

# Ensure ROS environment is sourced
if [ -z "${ROS_DISTRO:-}" ]; then
    if [ -f "/opt/ros/melodic/setup.bash" ]; then
        # shellcheck disable=SC1091
        source "/opt/ros/melodic/setup.bash"
    elif [ -f "/opt/ros/noetic/setup.bash" ]; then
        # shellcheck disable=SC1091
        source "/opt/ros/noetic/setup.bash"
    fi
fi

for WS in "${HOME}/catkin_ws" "${HOME}/jetracer_ws" "${HOME}/ros_ws" "${HOME}/jcc_ws"; do
    if [ -f "${WS}/devel/setup.bash" ]; then
        # shellcheck disable=SC1090
        source "${WS}/devel/setup.bash"
        break
    fi
done

log "--- [1] ROS Core Master Status ---"
if ! timeout 3 rostopic list >/dev/null 2>&1; then
    log "ERROR: ROS Master (roscore) is not reachable! Aborting inspection."
    exit 1
fi
log "ROS Master is responsive at ${ROS_MASTER_URI:-http://localhost:11311}"
log ""

log "--- [2] Active ROS Nodes ---"
rosnode list 2>&1 | tee -a "${OUTPUT_FILE}" || true
log ""

log "--- [3] Detailed Active Topics (Publishers & Subscribers) ---"
ROSTOPIC_LIST_V=$(rostopic list -v 2>&1 || true)
echo "${ROSTOPIC_LIST_V}" >> "${OUTPUT_FILE}"
echo "${ROSTOPIC_LIST_V}"
log ""

# Pre-parse topic types and publisher status from rostopic list -v
declare -A TOPIC_TYPES
declare -A TOPIC_PUB_COUNTS

CURRENT_SECTION=""
while IFS= read -r line; do
    if [[ "${line}" =~ "Published topics:" ]]; then
        CURRENT_SECTION="pub"
        continue
    elif [[ "${line}" =~ "Subscribed topics:" ]]; then
        CURRENT_SECTION="sub"
        continue
    fi

    # Parse lines like: " * /scan [sensor_msgs/LaserScan] 1 publisher"
    if [[ "${line}" =~ ^[[:space:]]*\*[[:space:]]+([^[:space:]]+)[[:space:]]+\[([^]]+)\][[:space:]]+([0-9]+)[[:space:]]+publisher ]]; then
        T_NAME="${BASH_REMATCH[1]}"
        T_TYPE="${BASH_REMATCH[2]}"
        T_COUNT="${BASH_REMATCH[3]}"
        TOPIC_TYPES["${T_NAME}"]="${T_TYPE}"
        if [[ "${CURRENT_SECTION}" == "pub" ]]; then
            TOPIC_PUB_COUNTS["${T_NAME}"]="${T_COUNT}"
        fi
    fi
done <<< "${ROSTOPIC_LIST_V}"

log "--- [4] Topic Rates and Message Types ---"
ALL_TOPICS=$(rostopic list 2>/dev/null || true)

TOTAL_TOPICS_COUNT=0
PUB_TOPICS_COUNT=0
NO_PUB_COUNT=0
RATE_MEASURED_COUNT=0
SAMPLED_RATE_LIMIT=18 # Cap rate measurements to prevent exceeding 45s runtime

for TOPIC in ${ALL_TOPICS}; do
    TOTAL_TOPICS_COUNT=$((TOTAL_TOPICS_COUNT + 1))
    TYPE="${TOPIC_TYPES[${TOPIC}]:-}"

    # Fallback lookup if not parsed from list -v
    if [ -z "${TYPE}" ]; then
        TYPE=$(timeout 1 rostopic type "${TOPIC}" 2>/dev/null || echo "Unknown")
    fi

    PUB_COUNT="${TOPIC_PUB_COUNTS[${TOPIC}]:-0}"

    log ">> TOPIC: ${TOPIC}"
    log "   Type:       ${TYPE}"
    log "   Publishers: ${PUB_COUNT}"

    if [ "${PUB_COUNT}" -eq 0 ]; then
        NO_PUB_COUNT=$((NO_PUB_COUNT + 1))
        log "   Hz:         No active publisher"
    else
        PUB_TOPICS_COUNT=$((PUB_TOPICS_COUNT + 1))

        # Skip heavy video or pointcloud topics to avoid bandwidth/CPU spikes
        if [[ "${TYPE}" =~ (Image|CompressedImage|PointCloud) ]]; then
            log "   Hz:         [SKIPPED] High-bandwidth image/pointcloud stream"
        elif [ "${RATE_MEASURED_COUNT}" -lt "${SAMPLED_RATE_LIMIT}" ]; then
            RATE_MEASURED_COUNT=$((RATE_MEASURED_COUNT + 1))
            HZ_OUTPUT=$(timeout 2 rostopic hz "${TOPIC}" 2>&1 | head -n 2 | tr '\n' ' ' || echo "No data / silent")
            log "   Hz:         ${HZ_OUTPUT}"
        else
            log "   Hz:         [SKIPPED] Sample cap reached (${SAMPLED_RATE_LIMIT} topics sampled)"
        fi
    fi
    log ""
done

log "--- [5] Active ROS Services ---"
rosservice list 2>&1 | tee -a "${OUTPUT_FILE}" || true
log ""

log "--- [6] Active ROS Parameters ---"
rosparam list 2>&1 | tee -a "${OUTPUT_FILE}" || true
log ""

log "--- [7] TF Coordinate Frame Monitor (2-second sample) ---"
if command -v rosrun >/dev/null 2>&1; then
    timeout 2 rosrun tf tf_monitor 2>&1 | tee -a "${OUTPUT_FILE}" || log "tf_monitor returned no transforms or timed out."
else
    log "rosrun not available."
fi
log ""

log "--- [8] Installed ROS Packages ---"
rospack list 2>&1 | tee -a "${OUTPUT_FILE}" || true
log ""

log "--- [9] Available Launch Files in Workspace & Home ---"
find "${HOME}" -maxdepth 5 -name "*.launch" 2>/dev/null | tee -a "${OUTPUT_FILE}" || true
log ""

log "=========================================================="
log "--- [10] Summary Statistics ---"
log "Total Active Topics:       ${TOTAL_TOPICS_COUNT}"
log "Topics With Publishers:    ${PUB_TOPICS_COUNT}"
log "Topics With No Publisher:  ${NO_PUB_COUNT}"
log "Topics Sampled for Rate:   ${RATE_MEASURED_COUNT}"
log "Inspection Log Location:   ${OUTPUT_FILE}"
log "=========================================================="
