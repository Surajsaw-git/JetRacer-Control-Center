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
 */
export const ALLOWED_ROSAPI_SERVICES: Record<string, string> = {
  '/rosapi/get_time': 'rosapi/GetTime',
  '/rosapi/topics': 'rosapi/Topics',
  '/rosapi/topic_type': 'rosapi/TopicType',
  '/rosapi/topics_and_raw_types': 'rosapi/TopicsAndRawTypes',
  '/rosapi/nodes': 'rosapi/Nodes',
  '/rosapi/node_details': 'rosapi/NodeDetails',
  '/rosapi/services': 'rosapi/Services',
  '/rosapi/service_type': 'rosapi/ServiceType',
  '/rosapi/publishers': 'rosapi/Publishers',
  '/rosapi/subscribers': 'rosapi/Subscribers',
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
