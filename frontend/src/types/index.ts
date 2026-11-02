/**
 * Provisional UI contracts. They are NOT verified against the real ROS message types;
 * they will be reconciled in Phase 4.
 */

export type ConnectionStatus =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

export type BackendLinkStatus = 'connected' | 'unreachable' | 'checking' | 'disabled'

export interface RosTimestamp {
  secs: number
  nsecs: number
}

export interface ConnectionState {
  status: ConnectionStatus
  host: string
  backendPort: number
  rosbridgePort: number
  useSsl: boolean
  latencyMs: number | null
  lastConnected: string | null
  errorMessage: string | null
  rosTime?: RosTimestamp | null
  reconnectAttempt?: number
  maxReconnectAttempts?: number | null
  linkBStatus?: BackendLinkStatus
  linkBLatencyMs?: number | null
  linkBVersion?: string | null
  connectionStep?: string | null
}

export interface SystemMetrics {
  cpuUsage: number | null
  cpuTemp: number | null
  gpuUsage: number | null
  gpuTemp: number | null
  memoryUsedMb: number | null
  memoryTotalMb: number | null
  diskUsedGb: number | null
  diskTotalGb: number | null
  batteryVolts: number | null
  batteryPercent: number | null
  uptimeSeconds: number | null
}

export interface LidarPoint {
  range: number // meters
  angle: number // radians (0 to 2*PI)
  intensity?: number
}

export interface LidarScanData {
  points: LidarPoint[]
  minRange: number
  maxRange: number
  timestamp: number
}

export type DriveMode = 'manual' | 'assisted' | 'autonomous'

export interface ControlState {
  linear: number // -1.0 to 1.0 (reverse to forward)
  angular: number // -1.0 to 1.0 (left to right)
  maxSpeedPct: number // 10 to 100%
  mode: DriveMode
  deadmanActive: boolean
  timestamp: number
}

/**
 * Phase 4: ROS Introspection, Discovery & Registry Types
 */
export type RosMasterStatus =
  | 'disconnected'
  | 'unknown'
  | 'rosbridge_only'
  | 'ok'
  | 'degraded'
  | 'master_unreachable'

export interface RosTopicInfo {
  name: string
  type: string
  publishers?: string[]
  subscribers?: string[]
  status?: 'present' | 'new' | 'removed'
}

export interface RosNodeInfo {
  name: string
  publications?: string[]
  subscriptions?: string[]
  services?: string[]
  status?: 'present' | 'new' | 'removed'
}

export interface RosServiceInfo {
  name: string
  type?: string
  status?: 'present' | 'new' | 'removed'
}

export interface WatchedTopicData {
  topic: string
  type: string
  hz: number
  lastMessageTimestamp: number
  isStale: boolean
  messageCount: number
  lastDecodedPayload: unknown
  summaryStats?: {
    rangesCount?: number
    rangeMin?: number
    rangeMax?: number
    rangeMean?: number
    angleMin?: number
    angleMax?: number
    intensityCount?: number
  }
  error?: string | null
}

export type TopicRole =
  | 'cmd_vel'
  | 'odometry'
  | 'imu'
  | 'laser_scan'
  | 'occupancy_map'
  | 'camera_image'
  | 'joystick'
  | 'tf'
  | 'tf_static'
  | 'battery'

export type TopicRoleVerification =
  | 'unmapped'
  | 'mapped_unverified'
  | 'verified_live'
  | 'stale'
  | 'missing'

export interface TopicMapping {
  role: TopicRole
  expectedTypes: string[]
  assignedTopic: string | null
  detectedType: string | null
  verification: TopicRoleVerification
  lastSeenAt?: number | null
  hz?: number | null
  notes?: string
}

export interface TopicRegistryProfile {
  version: '1.0.0'
  profileName: string
  robotHost: string
  updatedAt: string
  mappings: Record<TopicRole, TopicMapping>
}

export interface MapMeta {
  id: string
  name: string
  createdAt: string
  sizeBytes: number
  resolution: number // meters per pixel
  width: number
  height: number
  thumbnailUrl?: string
}

export type GoalStatus = 'pending' | 'active' | 'reached' | 'cancelled'

export interface NavigationGoal {
  id: string
  x: number
  y: number
  theta: number
  label: string
  status: GoalStatus
}

export type UiEventType = 'navigation' | 'safety' | 'settings' | 'system' | 'general'

export interface UiEvent {
  id: string
  timestamp: string
  type: UiEventType
  title: string
  detail?: string
  metadata?: Record<string, unknown>
}

export type AppTheme = 'light' | 'dark' | 'system'
export type Density = 'comfortable' | 'compact'
export type UnitSystem = 'metric' | 'imperial'
export type JoystickSize = 'sm' | 'md' | 'lg'
export type Handedness = 'right' | 'left'

export interface AppearanceSettings {
  theme: AppTheme
  density: Density
  reduceMotion: boolean
  units: UnitSystem
}

export interface ControlPreferences {
  joystickSize: JoystickSize
  handedness: Handedness
  invertX: boolean
  invertY: boolean
  deadmanRequired: boolean
}

export interface SafetyPreferences {
  maxSpeedPct: number
  commandTimeoutMs: number
  allowRobotMutations?: boolean
}

export interface NavItem {
  title: string
  href: string
  iconName: string
  phase: number
}
