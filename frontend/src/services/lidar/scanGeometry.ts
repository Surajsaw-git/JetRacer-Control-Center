/**
 * JetRacer Control Center — LiDAR Geometry & Coordinate Transformation (Phase 6)
 *
 * Implements pure mathematical projections from polar coordinates to Cartesian space,
 * display rotation and mirroring, cached trigonometric lookup tables, and sector
 * obstacle proximity calculations.
 *
 * ROS Coordinate Standard:
 * - Counter-clockwise positive angle progression.
 * - +X axis points directly forward.
 * - +Y axis points to the vehicle's left.
 * - Canvas screen Y is inverted (-Y is up in Cartesian, +Y is down in Canvas).
 */

import {
  RayClassification,
  type DecodedLaserScan,
  type LidarDisplayConfig,
  type LidarSectorReadouts,
  type SectorObstacleReadout,
} from './lidarTypes'

interface TrigTable {
  cos: Float32Array
  sin: Float32Array
}

const trigCache = new Map<string, TrigTable>()

/**
 * Returns or generates cached Float32Array lookup tables for cos/sin.
 */
export function getOrCreateTrigTable(
  angleMin: number,
  angleIncrement: number,
  count: number,
): TrigTable {
  const key = `${angleMin.toFixed(6)}_${angleIncrement.toFixed(6)}_${count}`
  let table = trigCache.get(key)
  if (!table) {
    const cosArr = new Float32Array(count)
    const sinArr = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const angle = angleMin + i * angleIncrement
      cosArr[i] = Math.cos(angle)
      sinArr[i] = Math.sin(angle)
    }
    table = { cos: cosArr, sin: sinArr }
    // Bound cache size
    if (trigCache.size > 20) {
      const firstKey = trigCache.keys().next().value
      if (firstKey) trigCache.delete(firstKey)
    }
    trigCache.set(key, table)
  }
  return table
}

export interface ProjectedPoint {
  x: number // meters (+x forward)
  y: number // meters (+y left)
  range: number // meters
  angleRad: number // radians (in sensor frame)
  effectiveBearingDeg: number // bearing relative to forward-up after user rotation/mirror
  classification: RayClassification
  intensity: number | null
  index: number
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function normalizeAngle(angleRad: number): number {
  return normalizeAngleRad(angleRad)
}

/**
 * Normalizes an angle into [-PI, +PI].
 */
export function normalizeAngleRad(angleRad: number): number {
  let a = angleRad % (2 * Math.PI)
  if (a >= Math.PI) a -= 2 * Math.PI
  if (a < -Math.PI) a += 2 * Math.PI
  return a
}

/**
 * Converts polar (range, angle) to 2D Cartesian (+X forward, +Y left) with display rotation & mirror.
 */
export function polarToCartesian(
  range: number,
  angleRad: number,
  config: { rotationDeg?: number; frontAngleOffsetDeg?: number; mirror?: boolean; inverted?: boolean } = {},
): { x: number; y: number } {
  const rotDeg =
    config?.frontAngleOffsetDeg !== undefined && config?.frontAngleOffsetDeg !== 0
      ? config.frontAngleOffsetDeg
      : (config?.rotationDeg ?? 0)
  const isMirrored = Boolean(
    config?.inverted !== undefined ? config.inverted : (config?.mirror ?? false)
  )
  const sensorX = range * Math.cos(angleRad)
  const sensorY = range * Math.sin(angleRad)
  return transformPoint(sensorX, sensorY, rotDeg, isMirrored)
}

/**
 * Computes axis-aligned bounding box across valid points in Cartesian meters.
 */
export function computeBoundingBox(
  scan: DecodedLaserScan,
  config: { rotationDeg?: number; frontAngleOffsetDeg?: number; mirror?: boolean; inverted?: boolean } = {},
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  const rotDeg =
    config?.frontAngleOffsetDeg !== undefined && config?.frontAngleOffsetDeg !== 0
      ? config.frontAngleOffsetDeg
      : (config?.rotationDeg ?? 0)
  const isMirrored = Boolean(
    config?.inverted !== undefined ? config.inverted : (config?.mirror ?? false)
  )
  const count = scan.count ?? scan.ranges?.length ?? 0
  const { ranges, classifications, angleMin, angleIncrement } = scan

  for (let i = 0; i < count; i++) {
    if (classifications[i] !== RayClassification.VALID) continue
    const r = ranges[i]
    const angle = angleMin + i * angleIncrement
    const { x, y } = polarToCartesian(r, angle, { rotationDeg: rotDeg, mirror: isMirrored })
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }

  if (!Number.isFinite(minX)) {
    return { minX: -1, maxX: 1, minY: -1, maxY: 1 }
  }

  return { minX, maxX, minY, maxY }
}

/**
 * Finds nearest obstacle in a specified sector cone.
 */
export function findNearestObstacleInSector(
  scan: DecodedLaserScan,
  targetAngleRad: number,
  sectorHalfWidthRad: number,
  config: { rotationDeg?: number; frontAngleOffsetDeg?: number; mirror?: boolean; inverted?: boolean } = {},
): { distance: number; bearingDeg: number } | null {
  const rotDeg =
    config?.frontAngleOffsetDeg !== undefined && config?.frontAngleOffsetDeg !== 0
      ? config.frontAngleOffsetDeg
      : (config?.rotationDeg ?? 0)
  const isMirrored = Boolean(
    config?.inverted !== undefined ? config.inverted : (config?.mirror ?? false)
  )
  const count = scan.count ?? scan.ranges?.length ?? 0
  const { ranges, classifications, angleMin, angleIncrement } = scan

  let minDistance = Infinity
  let minBearingDeg = 0

  for (let i = 0; i < count; i++) {
    if (classifications[i] !== RayClassification.VALID) continue
    const r = ranges[i]
    const angle = angleMin + i * angleIncrement
    const { x, y } = polarToCartesian(r, angle, { rotationDeg: rotDeg, mirror: isMirrored })
    const bearingRad = normalizeAngleRad(Math.atan2(y, x))
    const diff = Math.abs(normalizeAngleRad(bearingRad - targetAngleRad))

    if (diff <= sectorHalfWidthRad && r < minDistance) {
      minDistance = r
      minBearingDeg = radToDeg(bearingRad)
    }
  }

  if (!Number.isFinite(minDistance)) return null
  return { distance: minDistance, bearingDeg: minBearingDeg }
}

/**
 * Helper to suggest mounting rotation offset from known obstacle in front.
 */
export function proposeFrontOffset(scan: DecodedLaserScan): number {
  let minRange = Infinity
  let minIndex = -1
  const count = scan.count ?? scan.ranges?.length ?? 0

  for (let i = 0; i < count; i++) {
    if (scan.classifications[i] === RayClassification.VALID && scan.ranges[i] < minRange) {
      minRange = scan.ranges[i]
      minIndex = i
    }
  }

  if (minIndex < 0) return 0
  const angle = scan.angleMin + minIndex * scan.angleIncrement
  return Math.round(radToDeg(angle))
}

/**
 * Normalizes an angle into [-180, +180] degrees.
 */
export function normalizeAngleDeg(angleDeg: number): number {
  let a = angleDeg % 360
  if (a > 180) a -= 360
  if (a < -180) a += 360
  return a
}

/**
 * Applies display rotation and mirror transformation to a 2D point.
 */
export function transformPoint(
  x: number,
  y: number,
  rotationDeg: number,
  mirror: boolean,
): { x: number; y: number } {
  const rotRad = (rotationDeg * Math.PI) / 180
  const cosR = Math.cos(rotRad)
  const sinR = Math.sin(rotRad)

  // Apply rotation
  const rx = x * cosR - y * sinR
  let ry = x * sinR + y * cosR

  // Apply optional horizontal mirror (flip across X axis)
  if (mirror) {
    ry = -ry
  }

  return { x: rx, y: ry }
}

/**
 * Projects a decoded scan into 2D Cartesian coordinates in the vehicle display frame.
 */
export function projectScanPoints(
  scan: DecodedLaserScan,
  config: Pick<LidarDisplayConfig, 'rotationDeg' | 'mirror' | 'displayRangeLimitM'>,
): ProjectedPoint[] {
  const { count, ranges, classifications, intensities, angleMin, angleIncrement } = scan
  const { rotationDeg, mirror, displayRangeLimitM } = config
  const trig = getOrCreateTrigTable(angleMin, angleIncrement, count)

  const points: ProjectedPoint[] = []

  for (let i = 0; i < count; i++) {
    const classification = classifications[i]
    if (classification !== RayClassification.VALID) {
      continue
    }

    const r = ranges[i]
    if (displayRangeLimitM > 0 && r > displayRangeLimitM) {
      continue
    }

    const sensorX = r * trig.cos[i]
    const sensorY = r * trig.sin[i]

    const { x, y } = transformPoint(sensorX, sensorY, rotationDeg, mirror)
    const effectiveAngle = normalizeAngleRad(Math.atan2(y, x))
    const effectiveBearingDeg = (effectiveAngle * 180) / Math.PI

    points.push({
      x,
      y,
      range: r,
      angleRad: angleMin + i * angleIncrement,
      effectiveBearingDeg,
      classification,
      intensity: intensities ? intensities[i] : null,
      index: i,
    })
  }

  return points
}

/**
 * Computes sector-by-sector nearest obstacle readouts relative to vehicle orientation.
 *
 * Sectors:
 * - Front: [-45 deg, +45 deg]
 * - Left:  [+45 deg, +135 deg]
 * - Back:  [+135 deg, +180 deg] U [-180 deg, -135 deg]
 * - Right: [-135 deg, -45 deg]
 */
export function computeSectorReadouts(
  scan: DecodedLaserScan,
  config: Pick<LidarDisplayConfig, 'rotationDeg' | 'mirror' | 'displayRangeLimitM'>,
  dangerThresholdM = 0.5,
  cautionThresholdM = 1.0,
): LidarSectorReadouts {
  const points = projectScanPoints(scan, config)

  let frontMin: { dist: number; bearing: number } | null = null
  let leftMin: { dist: number; bearing: number } | null = null
  let rightMin: { dist: number; bearing: number } | null = null
  let backMin: { dist: number; bearing: number } | null = null
  let overallMin: { dist: number; bearing: number } | null = null

  for (const pt of points) {
    const d = pt.range
    const b = pt.effectiveBearingDeg

    if (overallMin === null || d < overallMin.dist) {
      overallMin = { dist: d, bearing: b }
    }

    if (b >= -45 && b <= 45) {
      if (frontMin === null || d < frontMin.dist) {
        frontMin = { dist: d, bearing: b }
      }
    } else if (b > 45 && b <= 135) {
      if (leftMin === null || d < leftMin.dist) {
        leftMin = { dist: d, bearing: b }
      }
    } else if (b < -45 && b >= -135) {
      if (rightMin === null || d < rightMin.dist) {
        rightMin = { dist: d, bearing: b }
      }
    } else {
      if (backMin === null || d < backMin.dist) {
        backMin = { dist: d, bearing: b }
      }
    }
  }

  const categorize = (min: { dist: number; bearing: number } | null): SectorObstacleReadout => {
    if (!min) {
      return { distanceM: null, bearingDeg: null, status: 'clear' }
    }
    const status = min.dist <= dangerThresholdM ? 'danger' : min.dist <= cautionThresholdM ? 'caution' : 'clear'
    return {
      distanceM: Math.round(min.dist * 100) / 100,
      bearingDeg: Math.round(min.bearing),
      status,
    }
  }

  return {
    front: categorize(frontMin),
    left: categorize(leftMin),
    right: categorize(rightMin),
    back: categorize(backMin),
    overallNearestM: overallMin ? Math.round(overallMin.dist * 100) / 100 : null,
    overallNearestBearingDeg: overallMin ? Math.round(overallMin.bearing) : null,
  }
}

/**
 * Calibration helper: Proposes a display rotation offset given an obstacle placed in front of the robot.
 * Finds the nearest dense obstacle cluster and returns the correction angle needed to align it with +X.
 */
export function proposeFrontOffsetAlignment(scan: DecodedLaserScan): {
  proposedOffsetDeg: number
  measuredBearingDeg: number
  nearestM: number
  confidence: number
} | null {
  if (scan.validCount < 5) return null

  // Find nearest valid ray
  let nearestDist = Number.POSITIVE_INFINITY
  let nearestIdx = -1

  for (let i = 0; i < scan.count; i++) {
    if (scan.classifications[i] === RayClassification.VALID) {
      const r = scan.ranges[i]
      if (r < nearestDist) {
        nearestDist = r
        nearestIdx = i
      }
    }
  }

  if (nearestIdx === -1 || !Number.isFinite(nearestDist)) return null

  // Average cluster around nearest point within +/- 5 indices
  let sumAngle = 0
  let clusterPoints = 0
  const startIdx = Math.max(0, nearestIdx - 5)
  const endIdx = Math.min(scan.count - 1, nearestIdx + 5)

  for (let i = startIdx; i <= endIdx; i++) {
    if (scan.classifications[i] === RayClassification.VALID) {
      const r = scan.ranges[i]
      if (Math.abs(r - nearestDist) < 0.15) {
        const a = scan.angleMin + i * scan.angleIncrement
        sumAngle += a
        clusterPoints++
      }
    }
  }

  if (clusterPoints === 0) return null

  const measuredBearingRad = sumAngle / clusterPoints
  const measuredBearingDeg = (measuredBearingRad * 180) / Math.PI

  // Target is +X (bearing 0 deg), so proposed rotation offset is -measuredBearing
  let proposed = -measuredBearingDeg
  proposed = normalizeAngleDeg(Math.round(proposed))

  return {
    proposedOffsetDeg: proposed,
    measuredBearingDeg: Math.round(measuredBearingDeg),
    nearestM: Math.round(nearestDist * 100) / 100,
    confidence: Math.min(1.0, clusterPoints / 10),
  }
}
