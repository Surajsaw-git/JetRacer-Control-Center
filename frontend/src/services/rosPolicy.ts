/**
 * JetRacer Control Center - ROS Capability & Security Policy
 *
 * Enforces strict read-only operation and defines allowed rosapi services,
 * blocked message types, and subscription safety boundaries.
 *
 * Citations & References:
 * - ROS 1 rosapi package documentation: http://wiki.ros.org/rosapi
 * - RobotWebTools rosbridge_suite: https://github.com/RobotWebTools/rosbridge_suite
 * - ROS 1 rosbridge v2.0 Protocol Specification:
 *   https://github.com/RobotWebTools/rosbridge_suite/blob/ros1/ROSBRIDGE_PROTOCOL.md
 */

/**
 * Verified Allow-List of read-only rosapi introspection services.
 * In Phase 4, ONLY these services may be invoked by the client.
 *
 * Each service has been verified against the official rosbridge/rosapi ROS 1 specification:
 * - ROS wiki: http://wiki.ros.org/rosapi
 * - Source repo: https://github.com/RobotWebTools/rosbridge_suite/tree/ros1/rosapi
 */
export const ALLOWED_ROSAPI_SERVICES: Record<string, string> = {
  // Returns current ROS time in secs/nsecs (http://wiki.ros.org/rosapi#get_time)
  '/rosapi/get_time': 'rosapi/GetTime',

  // Returns list of all active published topic names (http://wiki.ros.org/rosapi#topics)
  '/rosapi/topics': 'rosapi/Topics',

  // Returns message type for given topic (http://wiki.ros.org/rosapi#topic_type)
  '/rosapi/topic_type': 'rosapi/TopicType',

  // Returns batch list of topic names and their message types (rosbridge_suite/rosapi/srv/TopicsAndRawTypes.srv)
  '/rosapi/topics_and_raw_types': 'rosapi/TopicsAndRawTypes',

  // Returns list of active node names registered with master (http://wiki.ros.org/rosapi#nodes)
  '/rosapi/nodes': 'rosapi/Nodes',

  // Returns subscriptions, publications, and services for a node (http://wiki.ros.org/rosapi#node_details)
  '/rosapi/node_details': 'rosapi/NodeDetails',

  // Returns list of all active service names (http://wiki.ros.org/rosapi#services)
  '/rosapi/services': 'rosapi/Services',

  // Returns service type string for given service name (http://wiki.ros.org/rosapi#service_type)
  '/rosapi/service_type': 'rosapi/ServiceType',

  // Returns list of node names publishing to given topic (http://wiki.ros.org/rosapi#publishers)
  '/rosapi/publishers': 'rosapi/Publishers',

  // Returns list of node names subscribed to given topic (http://wiki.ros.org/rosapi#subscribers)
  '/rosapi/subscribers': 'rosapi/Subscribers',

  // Returns message type field definitions and typedefs (http://wiki.ros.org/rosapi#message_details)
  '/rosapi/message_details': 'rosapi/MessageDetails',
} as const

export type AllowedRosapiService = keyof typeof ALLOWED_ROSAPI_SERVICES

/**
 * Explicit Deny-List regex pattern for potentially destructive or state-altering services.
 * Matches any service containing set, delete, shutdown, kill, reboot, restart, launch, spawn, or param.
 */
export const DENIED_SERVICE_PATTERN =
  /(set|delete|shutdown|kill|reboot|restart|launch|spawn|param)/i

/**
 * Heavy message types that would saturate WebSocket bandwidth or mobile UI rendering.
 * Strictly blocked from live payload subscription in Phase 4.
 */
export const BLOCKED_SUBSCRIPTION_TYPES: readonly string[] = [
  'sensor_msgs/Image',
  'sensor_msgs/CompressedImage',
  'sensor_msgs/PointCloud',
  'sensor_msgs/PointCloud2',
  'nav_msgs/OccupancyGrid',
]

/**
 * Message types allowed only in restricted summary / stats mode.
 */
export const RESTRICTED_SUBSCRIPTION_TYPES: readonly string[] = [
  'sensor_msgs/LaserScan',
]

/**
 * Maximum concurrent topic subscriptions permitted in the controlled watcher.
 */
export const MAX_WATCH_SUBSCRIPTIONS = 5

/**
 * Maximum concurrent camera topic subscriptions permitted over rosbridge (Phase 5).
 */
export const MAX_CAMERA_SUBSCRIPTIONS = 1

/**
 * Minimum throttle interval (ms) enforced on camera subscriptions over rosbridge (max 10 Hz).
 */
export const MIN_CAMERA_THROTTLE_MS = 100

/**
 * Approved outbound HTTP endpoints for on-robot video streaming (web_video_server).
 */
export const ALLOWED_HTTP_VIDEO_ENDPOINTS = [
  '/stream',
  '/snapshot',
] as const

/**
 * Default throttle interval in milliseconds for watched topic streams.
 */
export const DEFAULT_WATCH_THROTTLE_MS = 200

/**
 * Checks whether a given service name is on the approved read-only allow-list.
 */
export function isServiceAllowed(serviceName: string): boolean {
  if (!serviceName || typeof serviceName !== 'string') return false
  const cleanName = serviceName.trim()
  if (DENIED_SERVICE_PATTERN.test(cleanName)) return false
  return cleanName in ALLOWED_ROSAPI_SERVICES
}

/**
 * Asserts that a service call is permitted; throws a SecurityViolation error otherwise.
 */
export function assertServiceAllowed(serviceName: string): void {
  if (!isServiceAllowed(serviceName)) {
    throw new Error(
      `[SECURITY VIOLATION] Service call to "${serviceName}" is prohibited by the ROS Capability Policy.`,
    )
  }
}

/**
 * Asserts that a high-level ROS operation is permitted.
 * - 'publish' and 'advertise' are strictly forbidden in Phase 4.
 * - 'call_service' must target an allow-listed service.
 * - 'subscribe' is permitted for topic inspection with type restrictions.
 */
export function assertOperationAllowed(
  operation: 'publish' | 'advertise' | 'subscribe' | 'call_service',
  target?: string,
): void {
  switch (operation) {
    case 'publish':
      throw new Error(
        `[SECURITY VIOLATION] Publishing to ROS topics (target: "${target || 'unknown'}") is prohibited in Phase 4. The robot is strictly read-only.`,
      )
    case 'advertise':
      throw new Error(
        `[SECURITY VIOLATION] Topic advertisement (target: "${target || 'unknown'}") is prohibited in Phase 4. The robot is strictly read-only.`,
      )
    case 'call_service':
      if (!target) {
        throw new Error(
          '[SECURITY VIOLATION] Unspecified service call is prohibited.',
        )
      }
      assertServiceAllowed(target)
      break
    case 'subscribe':
      // Subscription permission is further guarded by message type checks in SubscriptionManager
      break
    default:
      throw new Error(
        `[SECURITY VIOLATION] Unknown or unauthorized operation: "${operation}".`,
      )
  }
}

/**
 * Checks whether a message type is classified as heavy and prohibited from full subscription.
 */
export function isHeavyMessageType(messageType: string): boolean {
  if (!messageType) return false
  return BLOCKED_SUBSCRIPTION_TYPES.includes(messageType.trim())
}

/**
 * Checks whether a message type is restricted to summary/stats decoding.
 */
export function isRestrictedMessageType(messageType: string): boolean {
  if (!messageType) return false
  return RESTRICTED_SUBSCRIPTION_TYPES.includes(messageType.trim())
}

/**
 * Validates that a camera subscription to sensor_msgs/CompressedImage satisfies all safety bounds:
 * 1. Only invoked by the specialized camera service ('RosbridgeCompressedSource')
 * 2. Throttle rate >= 100ms (maximum 10 Hz)
 * 3. Concurrent camera subscriptions over rosbridge strictly <= 1
 * 4. Raw sensor_msgs/Image is NEVER permitted over rosbridge.
 */
export function assertCameraCompressedSubscriptionAllowed(
  caller: string,
  messageType: string,
  throttleRateMs: number,
  activeCameraSubscriptions: number,
): void {
  if (messageType === 'sensor_msgs/Image') {
    throw new Error(
      '[SECURITY VIOLATION] Raw uncompressed "sensor_msgs/Image" cannot be streamed over rosbridge JSON. Use web_video_server or compressed image transport.',
    )
  }

  if (messageType !== 'sensor_msgs/CompressedImage') {
    throw new Error(
      `[SECURITY VIOLATION] Camera rosbridge transport only supports "sensor_msgs/CompressedImage", received "${messageType}".`,
    )
  }

  if (caller !== 'RosbridgeCompressedSource') {
    throw new Error(
      `[SECURITY VIOLATION] Unauthorized caller "${caller}" attempted camera subscription. Only RosbridgeCompressedSource is permitted.`,
    )
  }

  if (throttleRateMs < MIN_CAMERA_THROTTLE_MS) {
    throw new Error(
      `[SECURITY VIOLATION] Camera throttle rate ${throttleRateMs}ms is below the minimum safety threshold (${MIN_CAMERA_THROTTLE_MS}ms).`,
    )
  }

  if (activeCameraSubscriptions >= MAX_CAMERA_SUBSCRIPTIONS) {
    throw new Error(
      `[SECURITY VIOLATION] Maximum active camera subscriptions (${MAX_CAMERA_SUBSCRIPTIONS}) exceeded. Only one camera stream may run concurrently over rosbridge.`,
    )
  }
}
