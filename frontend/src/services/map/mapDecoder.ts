/**
 * JetRacer Control Center — Defensive OccupancyGrid Decoder & Math (Phase 7A)
 *
 * Validates dimensions, enforces size limits, decodes ROS 1 nav_msgs/OccupancyGrid payloads,
 * extracts 2D yaw from quaternion orientation, computes coverage statistics,
 * and handles grid resizing and loop closure jumps.
 */

import { MAX_MAP_CELLS } from '@/services/rosPolicy'
import type {
  DecodedOccupancyGrid,
  MapMetrics,
  MapOrigin2D,
  RawOccupancyGridMessage,
} from './mapTypes'

const MAX_FRAME_ID_LEN = 128

/**
 * Extracts 2D planar yaw from a 3D unit quaternion.
 * Returns yaw in radians [-PI, PI] and degrees [-180, 180].
 */
export function quaternionToYaw(
  qx = 0,
  qy = 0,
  qz = 0,
  qw = 1,
): { yawRad: number; yawDeg: number; isTilted: boolean } {
  // Normalize quaternion if non-zero
  const norm = Math.hypot(qx, qy, qz, qw)
  const x = norm > 0.0001 ? qx / norm : 0
  const y = norm > 0.0001 ? qy / norm : 0
  const z = norm > 0.0001 ? qz / norm : 0
  const w = norm > 0.0001 ? qw / norm : 1

  // Detect non-planar tilt (pitch/roll > ~3 degrees)
  const isTilted = Math.hypot(x, y) > 0.05

  // 2D yaw: atan2(2(w*z + x*y), 1 - 2(y^2 + z^2))
  const sinyCosp = 2 * (w * z + x * y)
  const cosyCosp = 1 - 2 * (y * y + z * z)
  const yawRad = Math.atan2(sinyCosp, cosyCosp)
  const yawDeg = (yawRad * 180) / Math.PI

  return { yawRad, yawDeg, isTilted }
}

export interface DecodeMapResult {
  map: DecodedOccupancyGrid | null
  error?: string
  isOversized?: boolean
  isMalformed?: boolean
}

/**
 * Defensively decodes a raw nav_msgs/OccupancyGrid ROS message.
 */
export function decodeOccupancyGrid(
  raw: unknown,
  previousMap?: DecodedOccupancyGrid | null,
  maxCells: number = MAX_MAP_CELLS,
): DecodeMapResult {
  if (!raw || typeof raw !== 'object') {
    return {
      map: null,
      error: 'Malformed OccupancyGrid: message is not an object.',
      isMalformed: true,
    }
  }

  const msg = raw as RawOccupancyGridMessage

  if (!msg.info || typeof msg.info !== 'object') {
    return {
      map: null,
      error: 'Malformed OccupancyGrid: missing or invalid "info" metadata.',
      isMalformed: true,
    }
  }

  const width = Math.floor(Number(msg.info.width))
  const height = Math.floor(Number(msg.info.height))
  const resolution = Number(msg.info.resolution)

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    return {
      map: null,
      error: `Invalid map dimensions: width=${msg.info.width}, height=${msg.info.height}.`,
      isMalformed: true,
    }
  }

  if (!Number.isFinite(resolution) || resolution <= 0) {
    return {
      map: null,
      error: `Invalid map resolution: ${msg.info.resolution} m/cell.`,
      isMalformed: true,
    }
  }

  const totalCells = width * height
  if (totalCells > maxCells) {
    return {
      map: null,
      error: `Map too large for direct streaming (${width}x${height} = ${totalCells.toLocaleString()} cells > ${maxCells.toLocaleString()} limit). Use GetMap snapshot or robot agent.`,
      isOversized: true,
    }
  }

  if (!msg.data) {
    return {
      map: null,
      error: 'Malformed OccupancyGrid: missing "data" array.',
      isMalformed: true,
    }
  }

  const rawData = msg.data
  const dataLen = typeof rawData === 'object' && 'length' in rawData ? (rawData as { length: number }).length : 0

  if (dataLen !== totalCells) {
    return {
      map: null,
      error: `Data length mismatch: expected ${totalCells} cells (${width}x${height}), received ${dataLen}.`,
      isMalformed: true,
    }
  }

  // Parse Header
  const seq = typeof msg.header?.seq === 'number' ? msg.header.seq : 0
  const secs = typeof msg.header?.stamp?.secs === 'number' ? msg.header.stamp.secs : Math.floor(Date.now() / 1000)
  const nsecs = typeof msg.header?.stamp?.nsecs === 'number' ? msg.header.stamp.nsecs : 0
  const timestampMs = secs * 1000 + Math.floor(nsecs / 1_000_000)
  const rawFrameId = typeof msg.header?.frame_id === 'string' ? msg.header.frame_id : 'map'
  const frameId = rawFrameId.slice(0, MAX_FRAME_ID_LEN)

  // Parse Origin Pose
  const ox = Number(msg.info.origin?.position?.x ?? 0)
  const oy = Number(msg.info.origin?.position?.y ?? 0)
  const qx = Number(msg.info.origin?.orientation?.x ?? 0)
  const qy = Number(msg.info.origin?.orientation?.y ?? 0)
  const qz = Number(msg.info.origin?.orientation?.z ?? 0)
  const qw = Number(msg.info.origin?.orientation?.w ?? 1)

  const { yawRad, yawDeg, isTilted } = quaternionToYaw(qx, qy, qz, qw)
  const origin: MapOrigin2D = {
    x: Number.isFinite(ox) ? ox : 0,
    y: Number.isFinite(oy) ? oy : 0,
    yawRad: Number.isFinite(yawRad) ? yawRad : 0,
    yawDeg: Number.isFinite(yawDeg) ? yawDeg : 0,
  }

  const warnings: string[] = []
  if (isTilted) {
    warnings.push('Map origin has non-zero roll/pitch tilt relative to XY ground plane.')
  }

  // Copy into typed Int8Array while computing coverage metrics
  const data = new Int8Array(totalCells)
  let knownCells = 0
  let freeCells = 0
  let occupiedCells = 0

  for (let i = 0; i < totalCells; i++) {
    const rawVal = Number(rawData[i])
    let val: number
    if (!Number.isFinite(rawVal) || rawVal < 0) {
      val = -1 // Unknown
    } else if (rawVal === 0) {
      val = 0 // Free
      freeCells++
      knownCells++
    } else if (rawVal >= 100) {
      val = 100 // Fully occupied
      occupiedCells++
      knownCells++
    } else {
      val = Math.round(rawVal) // Intermediate probability 1..99
      if (val >= 50) {
        occupiedCells++
      } else {
        freeCells++
      }
      knownCells++
    }
    data[i] = val
  }

  const widthMeters = width * resolution
  const heightMeters = height * resolution
  const areaSquareMeters = widthMeters * heightMeters

  const metrics: MapMetrics = {
    totalCells,
    knownCells,
    freeCells,
    occupiedCells,
    knownPercent: totalCells > 0 ? (knownCells / totalCells) * 100 : 0,
    freePercent: totalCells > 0 ? (freeCells / totalCells) * 100 : 0,
    occupiedPercent: totalCells > 0 ? (occupiedCells / totalCells) * 100 : 0,
    widthMeters,
    heightMeters,
    areaSquareMeters,
  }

  // Detect Resizing (gmapping expansion) & Loop Closure Jumps
  let isResized = false
  let isJumped = false

  if (previousMap) {
    if (previousMap.info.width !== width || previousMap.info.height !== height) {
      isResized = true
    }

    const dx = Math.abs(origin.x - previousMap.info.origin.x)
    const dy = Math.abs(origin.y - previousMap.info.origin.y)
    const dyaw = Math.abs(origin.yawDeg - previousMap.info.origin.yawDeg)

    // Jumps greater than 0.5m or 5 deg indicate loop closure or SLAM relocalization
    if (dx > 0.5 || dy > 0.5 || dyaw > 5.0) {
      isJumped = true
      warnings.push(`Map origin shift detected (dx=${dx.toFixed(2)}m, dy=${dy.toFixed(2)}m, dyaw=${dyaw.toFixed(1)}°).`)
    }
  }

  return {
    map: {
      header: { seq, timestampMs, frameId },
      info: {
        width,
        height,
        resolution,
        origin,
        originQuat: { x: qx, y: qy, z: qz, w: qw },
      },
      data,
      metrics,
      warnings,
      isResized,
      isJumped,
    },
  }
}

/**
 * Transforms real-world metric coordinates (meters in map frame) to discrete grid cell coordinates.
 */
export function worldToMap(
  xw: number,
  yw: number,
  origin: MapOrigin2D,
  resolution: number,
  width: number,
  height: number,
): { col: number; row: number; index: number; isInside: boolean } {
  // Translate relative to origin
  const dx = xw - origin.x
  const dy = yw - origin.y

  // Rotate by -yawRad
  const cos = Math.cos(-origin.yawRad)
  const sin = Math.sin(-origin.yawRad)
  const xLocal = cos * dx - sin * dy
  const yLocal = sin * dx + cos * dy

  const col = Math.floor(xLocal / resolution)
  const row = Math.floor(yLocal / resolution)

  const isInside = col >= 0 && col < width && row >= 0 && row < height
  const index = isInside ? row * width + col : -1

  return { col, row, index, isInside }
}

/**
 * Transforms discrete grid cell coordinates (col, row) to real-world metric coordinates (meters in map frame).
 * Points to the center of the cell.
 */
export function mapToWorld(
  col: number,
  row: number,
  origin: MapOrigin2D,
  resolution: number,
): { xw: number; yw: number } {
  const xLocal = (col + 0.5) * resolution
  const yLocal = (row + 0.5) * resolution

  const cos = Math.cos(origin.yawRad)
  const sin = Math.sin(origin.yawRad)
  const xw = origin.x + (cos * xLocal - sin * yLocal)
  const yw = origin.y + (sin * xLocal + cos * yLocal)

  return { xw, yw }
}
