import { describe, it, expect } from 'vitest'
import {
  decodeOccupancyGrid,
  quaternionToYaw,
  worldToMap,
  mapToWorld,
} from '@/services/map/mapDecoder'

describe('mapDecoder — OccupancyGrid Decoding & Math', () => {
  it('decodes a valid OccupancyGrid payload into typed Int8Array and metrics', () => {
    const rawMsg = {
      header: { seq: 42, stamp: { secs: 1700000000, nsecs: 500000000 }, frame_id: 'map' },
      info: {
        width: 3,
        height: 2,
        resolution: 0.1,
        origin: {
          position: { x: 1.0, y: 2.0, z: 0.0 },
          orientation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
        },
      },
      data: [0, 100, -1, 50, 20, -1],
    }

    const result = decodeOccupancyGrid(rawMsg)
    expect(result.map).not.toBeNull()
    if (!result.map) return

    expect(result.map.header.frameId).toBe('map')
    expect(result.map.info.width).toBe(3)
    expect(result.map.info.height).toBe(2)
    expect(result.map.info.resolution).toBe(0.1)
    expect(result.map.info.origin.x).toBe(1.0)
    expect(result.map.info.origin.y).toBe(2.0)
    expect(result.map.info.origin.yawRad).toBeCloseTo(0, 4)

    // Data values: 0 -> 0, 100 -> 100, -1 -> -1, 50 -> 50, 20 -> 20
    expect(result.map.data[0]).toBe(0)
    expect(result.map.data[1]).toBe(100)
    expect(result.map.data[2]).toBe(-1)
    expect(result.map.data[3]).toBe(50)
    expect(result.map.data[4]).toBe(20)
    expect(result.map.data[5]).toBe(-1)

    // Metrics
    expect(result.map.metrics.totalCells).toBe(6)
    expect(result.map.metrics.knownCells).toBe(4)
    expect(result.map.metrics.freeCells).toBe(2) // 0, 20 (< 50)
    expect(result.map.metrics.occupiedCells).toBe(2) // 100, 50 (>= 50)
    expect(result.map.metrics.knownPercent).toBeCloseTo((4 / 6) * 100, 1)
  })

  it('rejects payload with data length mismatch', () => {
    const rawMsg = {
      header: { seq: 1 },
      info: { width: 4, height: 4, resolution: 0.05 },
      data: [0, 100], // Only 2 elements, expects 16
    }

    const result = decodeOccupancyGrid(rawMsg)
    expect(result.map).toBeNull()
    expect(result.isMalformed).toBe(true)
    expect(result.error).toMatch(/Data length mismatch/)
  })

  it('enforces size guard when cell count exceeds MAX_MAP_CELLS', () => {
    const rawMsg = {
      header: { seq: 1 },
      info: { width: 1000, height: 1000, resolution: 0.05 },
      data: new Array(1000000).fill(0),
    }

    const result = decodeOccupancyGrid(rawMsg, undefined, 250_000)
    expect(result.map).toBeNull()
    expect(result.isOversized).toBe(true)
    expect(result.error).toMatch(/Map too large for direct streaming/)
  })

  it('accurately computes 2D planar yaw from quaternion', () => {
    // 0 degrees
    const q0 = quaternionToYaw(0, 0, 0, 1)
    expect(q0.yawRad).toBeCloseTo(0, 4)
    expect(q0.yawDeg).toBeCloseTo(0, 2)
    expect(q0.isTilted).toBe(false)

    // 90 degrees yaw (z = sin(pi/4), w = cos(pi/4))
    const q90 = quaternionToYaw(0, 0, Math.SQRT1_2, Math.SQRT1_2)
    expect(q90.yawRad).toBeCloseTo(Math.PI / 2, 4)
    expect(q90.yawDeg).toBeCloseTo(90, 2)
    expect(q90.isTilted).toBe(false)

    // 180 degrees yaw (z = 1, w = 0)
    const q180 = quaternionToYaw(0, 0, 1, 0)
    expect(Math.abs(q180.yawRad)).toBeCloseTo(Math.PI, 4)
    expect(Math.abs(q180.yawDeg)).toBeCloseTo(180, 2)

    // Tilt detection
    const qTilted = quaternionToYaw(0.2, 0.2, 0, 1)
    expect(qTilted.isTilted).toBe(true)
  })

  it('detects map resizing (e.g. gmapping expansion)', () => {
    const mapA = decodeOccupancyGrid({
      info: { width: 10, height: 10, resolution: 0.05 },
      data: new Array(100).fill(0),
    }).map!

    const mapB = decodeOccupancyGrid(
      {
        info: { width: 15, height: 10, resolution: 0.05 },
        data: new Array(150).fill(0),
      },
      mapA
    ).map!

    expect(mapB.isResized).toBe(true)
  })

  it('detects map origin jump during loop closure or relocalization', () => {
    const mapA = decodeOccupancyGrid({
      info: {
        width: 10,
        height: 10,
        resolution: 0.05,
        origin: { position: { x: 0, y: 0 } },
      },
      data: new Array(100).fill(0),
    }).map!

    const mapB = decodeOccupancyGrid(
      {
        info: {
          width: 10,
          height: 10,
          resolution: 0.05,
          origin: { position: { x: 1.5, y: 0.2 } }, // Jump > 0.5m
        },
        data: new Array(100).fill(0),
      },
      mapA
    ).map!

    expect(mapB.isJumped).toBe(true)
    expect(mapB.warnings[0]).toMatch(/Map origin shift detected/)
  })

  it('converts world metric coordinates to grid cell indices and vice versa', () => {
    const origin = { x: -5.0, y: -5.0, yawRad: 0, yawDeg: 0 }
    const resolution = 0.05
    const width = 200
    const height = 200

    // Coordinate (-5.0, -5.0) should be at cell (col: 0, row: 0)
    const atOrigin = worldToMap(-5.0, -5.0, origin, resolution, width, height)
    expect(atOrigin.col).toBe(0)
    expect(atOrigin.row).toBe(0)
    expect(atOrigin.index).toBe(0)
    expect(atOrigin.isInside).toBe(true)

    // Center of cell (0, 0) in world coordinates: (-5.0 + 0.025, -5.0 + 0.025)
    const worldCenter = mapToWorld(0, 0, origin, resolution)
    expect(worldCenter.xw).toBeCloseTo(-4.975, 4)
    expect(worldCenter.yw).toBeCloseTo(-4.975, 4)

    // Point outside grid
    const outside = worldToMap(-10.0, 0, origin, resolution, width, height)
    expect(outside.isInside).toBe(false)
    expect(outside.index).toBe(-1)
  })
})
