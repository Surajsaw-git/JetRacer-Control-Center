/**
 * JetRacer Control Center — LiDAR Subsystem Types & Interfaces (Phase 6)
 *
 * Defines raw ROS LaserScan message types, decoded typed structures, ray classification enums,
 * rendering configs, status states, and sector obstacle readouts.
 *
 * Citations:
 * - ROS 1 sensor_msgs/LaserScan: http://docs.ros.org/en/melodic/api/sensor_msgs/html/msg/LaserScan.html
 */

export type LidarStreamState =
  | 'no_topic'
  | 'waiting'
  | 'streaming'
  | 'degraded'
  | 'stalled'
  | 'stopped'
  | 'error'
  | 'link_down'

export enum RayClassification {
  VALID = 0,
  NO_RETURN = 1,
  TOO_CLOSE = 2,
  INVALID = 3,
  OUT_OF_FOV = 4,
}

export type LidarRenderMode = 'points' | 'polyline' | 'fill'
export type LidarColorMode = 'distance' | 'intensity' | 'classification' | 'monochrome' | 'proximity' | 'mono' | 'rainbow'

export interface LidarDisplayConfig {
  rotationDeg: number // Manual rotation offset (0, 90, 180, 270 + fine)
  frontAngleOffsetDeg?: number // Alias for rotationDeg
  mirror: boolean // Invert Y (left/right flip)
  inverted?: boolean // Alias for mirror
  renderMode: LidarRenderMode | 'surface' | 'rays'
  colorMode: LidarColorMode
  colorScheme?: 'proximity' | 'intensity' | 'mono' | 'rainbow'
  pointSize?: number
  dangerThresholdMeters?: number
  cautionThresholdMeters?: number
  showMaxRangeBoundary: boolean
  showMinRangeDeadZone: boolean
  showNoDataTicks: boolean
  showGhostTrail: boolean
  ghostTrailCount: number // Capped, e.g. 1 to 5
  decayTrail?: number // Alias for ghostTrailCount
  displayRangeLimitM: number // Max range slider (default = range_max)
  showRangeRings: boolean
  showGrid?: boolean // Alias for showRangeRings
  showProximityZones?: boolean
  showRobotFootprint?: boolean
  showSectorOverlays: boolean
}

export const DEFAULT_LIDAR_CONFIG: LidarDisplayConfig = {
  rotationDeg: 0,
  frontAngleOffsetDeg: 0,
  mirror: false,
  inverted: false,
  renderMode: 'points',
  colorMode: 'distance',
  colorScheme: 'proximity',
  pointSize: 3,
  dangerThresholdMeters: 0.5,
  cautionThresholdMeters: 1.0,
  showMaxRangeBoundary: true,
  showMinRangeDeadZone: true,
  showNoDataTicks: true,
  showGhostTrail: false,
  ghostTrailCount: 3,
  decayTrail: 0,
  displayRangeLimitM: 12.0,
  showRangeRings: true,
  showGrid: true,
  showProximityZones: true,
  showRobotFootprint: true,
  showSectorOverlays: true,
}

export interface RawLaserScanMessage {
  header?: {
    seq?: number
    stamp?: { secs: number; nsecs: number }
    frame_id?: string
  }
  angle_min?: number
  angle_max?: number
  angle_increment?: number
  time_increment?: number
  scan_time?: number
  range_min?: number
  range_max?: number
  ranges?: (number | string | null)[]
  intensities?: (number | string | null)[]
}

export interface DecodedLaserScan {
  header: {
    seq: number
    stamp: { secs: number; nsecs: number }
    stampSecs: number
    frame_id: string
  }
  angleMin: number
  angleMax: number
  angleIncrement: number
  timeIncrement: number
  scanTime: number
  rangeMin: number
  rangeMax: number
  ranges: Float32Array
  intensities: Float32Array | null
  classifications: Uint8Array
  count: number
  validCount: number
  validPointsCount?: number
  noReturnCount: number
  tooCloseCount: number
  invalidCount: number
  droppedOrInvalidCount?: number
  outOfFovCount: number
  minValidRange: number | null
  maxValidRange: number | null
  warnings: string[]
  receivedAtMs: number
}

export type DecodedScan = DecodedLaserScan

export interface SectorObstacleReadout {
  distanceM: number | null
  distance?: number | null // Alias for distanceM
  bearingDeg: number | null
  status: 'clear' | 'caution' | 'danger'
}

export interface LidarSectorReadouts {
  front: SectorObstacleReadout
  left: SectorObstacleReadout
  right: SectorObstacleReadout
  back: SectorObstacleReadout
  rear?: SectorObstacleReadout // Alias for back
  overallNearestM: number | null
  overallNearestBearingDeg: number | null
}

export interface LidarMetrics {
  measuredHz: number
  currentRateHz?: number
  expectedHz: number | null
  pointsPerScan: number
  validPercent: number
  validPointsRatio?: number
  bandwidthKbps: number
  scanAgeMs: number
  clockOffsetAgeMs: number | null
  droppedScans: number
  oversizedScans: number
  malformedScans: number
  renderTimeMs: number
  receivedScansCount?: number
  frameId?: string
  isFrozen?: boolean
  frameIdChanged?: boolean
}

export interface PointInspectionReadout {
  index: number
  rangeM: number
  bearingDeg: number
  xM: number
  yM: number
  intensity: number | null
  classification: RayClassification
}
