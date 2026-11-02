import { describe, it, expect } from 'vitest'
import {
  encodeOccupancyGridToPgm,
  generateMapYaml,
  parsePgmBuffer,
  parseMapYaml,
  importMapFromPgmAndYaml,
} from '@/services/map/mapExport'

describe('mapExport — ROS map_server PGM / YAML Serializer & Parser', () => {
  it('encodes OccupancyGrid to NetPBM P5 binary PGM with inverted row order and correct pixel mapping', () => {
    // 2x2 grid in ROS bottom-up order:
    // row 1 (top):    [unknown (-1), occupied (100)]
    // row 0 (bottom): [free (0),    free (0)]
    const data = new Int8Array([
      0, 0,       // row 0
      -1, 100,    // row 1
    ])

    const pgmBytes = encodeOccupancyGridToPgm(data, 2, 2)
    const fullStr = new TextDecoder().decode(pgmBytes)

    // Valid NetPBM P5 header
    expect(fullStr).toContain('P5\n')
    expect(fullStr).toContain('2 2\n255\n')

    // Parse with parsePgmBuffer to verify structure
    const parsed = parsePgmBuffer(pgmBytes)
    expect(parsed.width).toBe(2)
    expect(parsed.height).toBe(2)
    expect(parsed.maxVal).toBe(255)
    expect(parsed.data.length).toBe(4)

    // PGM row 0 (top of image, ROS row 1):
    // cell (-1) -> 205, cell (100) -> 0
    expect(parsed.data[0]).toBe(205)
    expect(parsed.data[1]).toBe(0)

    // PGM row 1 (bottom of image, ROS row 0):
    // cell (0) -> 254, cell (0) -> 254
    expect(parsed.data[2]).toBe(254)
    expect(parsed.data[3]).toBe(254)
  })

  it('generates standard ROS 1 map_server YAML metadata string matching specification', () => {
    const yaml = generateMapYaml('office_map.pgm', 0.05, {
      x: -10.0,
      y: -5.0,
      yawRad: 0.0,
      yawDeg: 0.0,
    })

    expect(yaml).toContain('image: office_map.pgm')
    expect(yaml).toContain('resolution: 0.050000')
    expect(yaml).toContain('origin: [-10, -5, 0]')
    expect(yaml).toContain('negate: 0')
    expect(yaml).toContain('occupied_thresh: 0.650')
    expect(yaml).toContain('free_thresh: 0.196')
    expect(yaml).toContain('mode: trinary')
  })

  it('parses valid YAML string extracted from map metadata', () => {
    const yamlContent = `
image: test_room.pgm
resolution: 0.025
origin: [-2.5, -3.0, 1.570796]
negate: 0
occupied_thresh: 0.70
free_thresh: 0.20
`
    const parsed = parseMapYaml(yamlContent)
    expect(parsed.image).toBe('test_room.pgm')
    expect(parsed.resolution).toBe(0.025)
    expect(parsed.origin.x).toBe(-2.5)
    expect(parsed.origin.y).toBe(-3.0)
    expect(parsed.origin.yawRad).toBeCloseTo(1.570796, 4)
  })

  it('round-trips OccupancyGrid through PGM export and PGM/YAML import cleanly', () => {
    const originalGrid = new Int8Array([
      0, 100,
      0, -1,
    ])

    const pgmBytes = encodeOccupancyGridToPgm(originalGrid, 2, 2)
    const yamlText = generateMapYaml('roundtrip.pgm', 0.05, {
      x: 0,
      y: 0,
      yawRad: 0,
      yawDeg: 0,
    })

    const importRes = importMapFromPgmAndYaml(pgmBytes, yamlText)
    expect(importRes.success).toBe(true)
    expect(importRes.map).toBeDefined()
    if (!importRes.map) return

    expect(importRes.map.info.width).toBe(2)
    expect(importRes.map.info.height).toBe(2)
    expect(importRes.map.info.resolution).toBe(0.05)

    // Data verification after inverted write & inverted read:
    // row 0: (0, 100), row 1: (0, -1)
    expect(importRes.map.data[0]).toBe(0)
    expect(importRes.map.data[1]).toBe(100)
    expect(importRes.map.data[2]).toBe(0)
    expect(importRes.map.data[3]).toBe(-1)
  })

  it('gracefully throws on corrupted or truncated PGM buffer', () => {
    const corruptBuffer = new TextEncoder().encode('P5\n10 10\n255\ntoo_short')
    expect(() => parsePgmBuffer(corruptBuffer)).toThrow(/Truncated/)
  })
})
