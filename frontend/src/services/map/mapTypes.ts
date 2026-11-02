/**
 * JetRacer Control Center — OccupancyGrid & Map Geometry Types (Phase 7A)
 *
 * Strongly-typed definitions for ROS 1 nav_msgs/OccupancyGrid, TFMessage transforms,
 * 2D map geometry, rendering configurations, and persistent IndexedDB map records.
 */

export interface RawRosTimestamp {
  secs?: number
  nsecs?: number
}

export interface RawRosHeader {
  seq?: number
  stamp?: RawRosTimestamp
  frame_id?: string
}

export interface RawRosPoint {
  x?: number
  y?: number
  z?: number
}

export interface RawRosQuaternion {
  x?: number
  y?: number
  z?: number
  w?: number
}

export interface RawRosPose {
  position?: RawRosPoint
  orientation?: RawRosQuaternion
}

export interface RawMapMetaData {
  map_load_time?: RawRosTimestamp
  resolution?: number
  width?: number
  height?: number
  origin?: RawRosPose
}

export interface RawOccupancyGridMessage {
  header?: RawRosHeader
  info?: RawMapMetaData
  data?: number[] | Int8Array | Uint8Array
}

export interface MapOrigin2D {
  x: number
  y: number
  yawRad: number
  yawDeg: number
}

export interface MapMetrics {
  totalCells: number
  knownCells: number
  freeCells: number
  occupiedCells: number
  knownPercent: number
  freePercent: number
  occupiedPercent: number
  widthMeters: number
  heightMeters: number
  areaSquareMeters: number
}

export interface DecodedOccupancyGrid {
  header: {
    seq: number
    timestampMs: number
    frameId: string
  }
  info: {
    width: number
    height: number
    resolution: number
    origin: MapOrigin2D
    originQuat: { x: number; y: number; z: number; w: number }
  }
  data: Int8Array
  metrics: MapMetrics
  warnings: string[]
  isResized?: boolean
  isJumped?: boolean
}

export type MapStreamState =
  | 'no_topic'
  | 'waiting'
  | 'live'
  | 'stale'
  | 'degraded'
  | 'oversized'
  | 'error'
  | 'link_down'
  | 'stopped'

export interface MapDisplayConfig {
  colorPalette: 'standard' | 'probability'
  showGridLines: boolean
  showScaleBar: boolean
  showRobotPose: boolean
  showLidarOverlay: boolean
  followRobot: boolean
}

export const DEFAULT_MAP_CONFIG: MapDisplayConfig = {
  colorPalette: 'standard',
  showGridLines: true,
  showScaleBar: true,
  showRobotPose: true,
  showLidarOverlay: false,
  followRobot: false,
}

export interface RobotPose2D {
  x: number
  y: number
  yawRad: number
  yawDeg: number
  frameId: string
  referenceFrame: string
  timestampMs: number
  ageMs: number
  isStale: boolean
  source: 'tf' | 'odometry_fallback'
}

export interface PoseTrailPoint {
  x: number
  y: number
  timestampMs: number
}

export interface SavedMapRecord {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  width: number
  height: number
  resolution: number
  origin: MapOrigin2D
  frameId: string
  data: Int8Array
  thumbnailDataUrl: string
  notes?: string
  source: 'device_snapshot' | 'robot_import'
  metrics: MapMetrics
}

export interface MapSummaryMetrics {
  currentRateHz: number
  receivedCount: number
  droppedCount: number
  oversizedCount: number
  malformedCount: number
  bandwidthKbps: number
  renderTimeMs: number
  lastUpdateAgeMs: number
}
