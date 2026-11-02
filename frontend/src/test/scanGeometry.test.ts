import { describe, it, expect } from 'vitest'
import {
  degToRad,
  radToDeg,
  normalizeAngle,
  polarToCartesian,
  computeBoundingBox,
  findNearestObstacleInSector,
  proposeFrontOffset,
} from '@/services/lidar/scanGeometry'
import {
  DEFAULT_LIDAR_CONFIG,
  RayClassification,
  type DecodedScan,
} from '@/services/lidar/lidarTypes'

describe('scanGeometry — Math, Coordinate Conventions & Projections', () => {
  it('converts degrees to radians and radians to degrees accurately', () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI)
    expect(degToRad(90)).toBeCloseTo(Math.PI / 2)
    expect(degToRad(0)).toBe(0)
    expect(radToDeg(Math.PI)).toBeCloseTo(180)
    expect(radToDeg(Math.PI / 2)).toBeCloseTo(90)
  })

  it('normalizes angles into [-PI, PI)', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(-Math.PI)
    expect(normalizeAngle(Math.PI / 2)).toBeCloseTo(Math.PI / 2)
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI)
    expect(normalizeAngle(2 * Math.PI)).toBeCloseTo(0)
  })

  it('converts polar coordinates to REP-103 (+X forward, +Y left)', () => {
    const config = { ...DEFAULT_LIDAR_CONFIG, frontAngleOffsetDeg: 0, inverted: false }

    // Angle 0: +X forward = 2.0, +Y left = 0.0
    const forward = polarToCartesian(2.0, 0, config)
    expect(forward.x).toBeCloseTo(2.0)
    expect(forward.y).toBeCloseTo(0.0)

    // Angle +PI/2: +X = 0, +Y left = 2.0
    const left = polarToCartesian(2.0, Math.PI / 2, config)
    expect(left.x).toBeCloseTo(0.0)
    expect(left.y).toBeCloseTo(2.0)

    // Angle -PI/2: +X = 0, +Y right = -2.0
    const right = polarToCartesian(2.0, -Math.PI / 2, config)
    expect(right.x).toBeCloseTo(0.0)
    expect(right.y).toBeCloseTo(-2.0)

    // Angle PI: +X back = -2.0, +Y = 0
    const back = polarToCartesian(2.0, Math.PI, config)
    expect(back.x).toBeCloseTo(-2.0)
    expect(back.y).toBeCloseTo(0.0)
  })

  it('respects mounting frontAngleOffsetDeg and inverted settings', () => {
    // 90 deg rotation offset
    const configRot90 = { ...DEFAULT_LIDAR_CONFIG, frontAngleOffsetDeg: 90, inverted: false }
    const rotated = polarToCartesian(2.0, 0, configRot90)
    // Sensor angle 0 rotated by 90deg offset -> now left (+Y)
    expect(rotated.x).toBeCloseTo(0.0)
    expect(rotated.y).toBeCloseTo(2.0)

    // Inverted (mirrored Y)
    const configInverted = { ...DEFAULT_LIDAR_CONFIG, frontAngleOffsetDeg: 0, inverted: true }
    const mirrored = polarToCartesian(2.0, Math.PI / 2, configInverted)
    expect(mirrored.x).toBeCloseTo(0.0)
    expect(mirrored.y).toBeCloseTo(-2.0)
  })

  it('computes accurate bounding box across valid points', () => {
    const ranges = new Float32Array([1.0, 2.0, 3.0, 4.0])
    const classifications = new Uint8Array([
      RayClassification.VALID,
      RayClassification.VALID,
      RayClassification.VALID,
      RayClassification.NO_RETURN, // Ignored in bbox
    ])

    const scan: DecodedScan = {
      header: { seq: 1, stamp: { secs: 100, nsecs: 0 }, stampSecs: 100, frame_id: 'laser' },
      angleMin: 0,
      angleMax: Math.PI,
      angleIncrement: Math.PI / 3,
      timeIncrement: 0,
      scanTime: 0.1,
      rangeMin: 0.1,
      rangeMax: 10.0,
      ranges,
      intensities: new Float32Array(4),
      classifications,
      count: 4,
      validCount: 3,
      validPointsCount: 3,
      noReturnCount: 1,
      tooCloseCount: 0,
      invalidCount: 0,
      outOfFovCount: 0,
      minValidRange: 1.0,
      maxValidRange: 3.0,
      warnings: [],
      droppedOrInvalidCount: 1,
      receivedAtMs: Date.now(),
    }

    const bbox = computeBoundingBox(scan, DEFAULT_LIDAR_CONFIG)
    expect(bbox.minX).toBeLessThan(bbox.maxX)
    expect(bbox.minY).toBeLessThan(bbox.maxY)
  })

  it('finds nearest obstacle in designated sector', () => {
    // 4 cardinal rays: 0 (fwd), PI/2 (left), PI (rear), -PI/2 (right)
    const ranges = new Float32Array([1.2, 0.8, 2.5, 3.0])
    const classifications = new Uint8Array([
      RayClassification.VALID,
      RayClassification.VALID,
      RayClassification.VALID,
      RayClassification.VALID,
    ])

    const scan: DecodedScan = {
      header: { seq: 1, stamp: { secs: 100, nsecs: 0 }, stampSecs: 100, frame_id: 'laser' },
      angleMin: 0,
      angleMax: 1.5 * Math.PI,
      angleIncrement: Math.PI / 2,
      timeIncrement: 0,
      scanTime: 0.1,
      rangeMin: 0.1,
      rangeMax: 10.0,
      ranges,
      intensities: new Float32Array(4),
      classifications,
      count: 4,
      validCount: 4,
      validPointsCount: 4,
      noReturnCount: 0,
      tooCloseCount: 0,
      invalidCount: 0,
      outOfFovCount: 0,
      minValidRange: 0.8,
      maxValidRange: 3.0,
      warnings: [],
      droppedOrInvalidCount: 0,
      receivedAtMs: Date.now(),
    }

    const frontReturn = findNearestObstacleInSector(scan, 0, Math.PI / 4, DEFAULT_LIDAR_CONFIG)
    expect(frontReturn).not.toBeNull()
    expect(frontReturn?.distance).toBeCloseTo(1.2)

    const leftReturn = findNearestObstacleInSector(scan, Math.PI / 2, Math.PI / 4, DEFAULT_LIDAR_CONFIG)
    expect(leftReturn).not.toBeNull()
    expect(leftReturn?.distance).toBeCloseTo(0.8)
  })

  it('proposes front offset correctly based on detected physical target', () => {
    // Target placed directly in front of car, but scanner measures it at index corresponding to 30 deg
    const scan: DecodedScan = {
      header: { seq: 1, stamp: { secs: 100, nsecs: 0 }, stampSecs: 100, frame_id: 'laser' },
      angleMin: 0,
      angleMax: 2 * Math.PI,
      angleIncrement: degToRad(1),
      timeIncrement: 0,
      scanTime: 0.1,
      rangeMin: 0.1,
      rangeMax: 10.0,
      ranges: new Float32Array(360).fill(5.0),
      intensities: new Float32Array(360),
      classifications: new Uint8Array(360).fill(RayClassification.VALID),
      count: 360,
      validCount: 360,
      validPointsCount: 360,
      noReturnCount: 0,
      tooCloseCount: 0,
      invalidCount: 0,
      outOfFovCount: 0,
      minValidRange: 0.5,
      maxValidRange: 5.0,
      warnings: [],
      droppedOrInvalidCount: 0,
      receivedAtMs: Date.now(),
    }

    // Place closest object at 30 deg index
    scan.ranges[30] = 0.5
    const proposed = proposeFrontOffset(scan)
    expect(proposed).toBe(30)
  })
})
