import { describe, it, expect } from 'vitest'
import { decodeLaserScan, sanitizeRosJson } from '@/services/lidar/scanDecoder'
import { RayClassification } from '@/services/lidar/lidarTypes'

describe('scanDecoder — Parser, Ray Classification & Inf/NaN Sanitizer', () => {
  it('correctly decodes standard LaserScan message with Float32Array and classifications', () => {
    const rawMsg = {
      header: { seq: 42, stamp: { secs: 1700000000, nsecs: 500000 }, frame_id: 'laser' },
      angle_min: -1.57,
      angle_max: 1.57,
      angle_increment: 0.01,
      range_min: 0.2,
      range_max: 10.0,
      ranges: [1.5, 2.0, 3.5, 0.1, 15.0], // 0.1 is TOO_CLOSE, 15.0 is NO_RETURN
      intensities: [100, 150, 200, 0, 0],
    }

    const decoded = decodeLaserScan(rawMsg)
    expect(decoded).not.toBeNull()
    if (!decoded) return

    expect(decoded.header.seq).toBe(42)
    expect(decoded.ranges.length).toBe(5)
    expect(decoded.classifications[0]).toBe(RayClassification.VALID)
    expect(decoded.classifications[1]).toBe(RayClassification.VALID)
    expect(decoded.classifications[2]).toBe(RayClassification.VALID)
    expect(decoded.classifications[3]).toBe(RayClassification.TOO_CLOSE)
    expect(decoded.classifications[4]).toBe(RayClassification.NO_RETURN)
    expect(decoded.validPointsCount).toBe(3)
    expect(decoded.droppedOrInvalidCount).toBe(2)
  })

  it('classifies null ranges as NO_RETURN', () => {
    const rawMsg = {
      header: { seq: 1, stamp: { secs: 100, nsecs: 0 }, frame_id: 'laser' },
      angle_min: 0,
      angle_max: 1,
      angle_increment: 0.5,
      range_min: 0.2,
      range_max: 5.0,
      ranges: [null, 1.0, null],
    }

    const decoded = decodeLaserScan(rawMsg)
    expect(decoded).not.toBeNull()
    if (!decoded) return

    expect(decoded.classifications[0]).toBe(RayClassification.NO_RETURN)
    expect(decoded.classifications[1]).toBe(RayClassification.VALID)
    expect(decoded.classifications[2]).toBe(RayClassification.NO_RETURN)
    expect(decoded.validPointsCount).toBe(1)
  })

  it('handles string "Infinity", "-Infinity", and "NaN" from rosbridge', () => {
    const rawMsg = {
      header: { seq: 2, stamp: { secs: 100, nsecs: 0 }, frame_id: 'laser' },
      angle_min: 0,
      angle_max: 1,
      angle_increment: 0.25,
      range_min: 0.2,
      range_max: 10.0,
      ranges: ['Infinity', '-Infinity', 'NaN', '2.5', 'invalid_string'],
    }

    const decoded = decodeLaserScan(rawMsg)
    expect(decoded).not.toBeNull()
    if (!decoded) return

    expect(decoded.classifications[0]).toBe(RayClassification.NO_RETURN) // +Infinity
    expect(decoded.classifications[1]).toBe(RayClassification.NO_RETURN) // -Infinity
    expect(decoded.classifications[2]).toBe(RayClassification.INVALID)   // NaN
    expect(decoded.classifications[3]).toBe(RayClassification.VALID)     // 2.5 parsed as float
    expect(decoded.classifications[4]).toBe(RayClassification.INVALID)   // string
    expect(decoded.validPointsCount).toBe(1)
  })

  it('sanitizes bare unquoted Infinity, -Infinity, and NaN JSON tokens', () => {
    // ROS 1 Melodic python json.dumps(allow_nan=True) sends:
    const bareRosJson =
      '{"op":"publish","topic":"/scan","msg":{"ranges":[1.2, Infinity, -Infinity, NaN, 3.4]}}'

    // Standard JSON.parse fails on bare tokens:
    expect(() => JSON.parse(bareRosJson)).toThrow(SyntaxError)

    // With sanitizeRosJson:
    const sanitized = sanitizeRosJson(bareRosJson)
    const parsed = JSON.parse(sanitized)
    expect(parsed.msg.ranges[0]).toBe(1.2)
    expect(parsed.msg.ranges[1]).toBeNull()
    expect(parsed.msg.ranges[2]).toBeNull()
    expect(parsed.msg.ranges[3]).toBeNull()
    expect(parsed.msg.ranges[4]).toBe(3.4)
  })

  it('preserves string literals containing "Infinity" without corrupting them', () => {
    const jsonWithStrings =
      '{"op":"publish","topic":"/Infinity_room/scan","msg":{"frame_id":"Infinity_link","ranges":[1.5, Infinity]}}'

    const sanitized = sanitizeRosJson(jsonWithStrings)
    const parsed = JSON.parse(sanitized)
    expect(parsed.topic).toBe('/Infinity_room/scan')
    expect(parsed.msg.frame_id).toBe('Infinity_link')
    expect(parsed.msg.ranges[0]).toBe(1.5)
    expect(parsed.msg.ranges[1]).toBeNull()
  })

  it('drops oversized scans exceeding MAX_LIDAR_RANGES_LENGTH', () => {
    const hugeRanges = new Array(9000).fill(1.0)
    const rawMsg = {
      header: { seq: 3, stamp: { secs: 100, nsecs: 0 }, frame_id: 'laser' },
      angle_min: 0,
      angle_max: 6.28,
      angle_increment: 0.001,
      range_min: 0.1,
      range_max: 10.0,
      ranges: hugeRanges,
    }

    const decoded = decodeLaserScan(rawMsg)
    expect(decoded).toBeNull() // Rejected by safety policy
  })

  it('safely rejects malformed or null message shapes', () => {
    expect(decodeLaserScan(null)).toBeNull()
    expect(decodeLaserScan(undefined)).toBeNull()
    expect(decodeLaserScan({})).toBeNull()
    expect(decodeLaserScan({ ranges: 'not_an_array' })).toBeNull()
    expect(decodeLaserScan({ ranges: [], angle_min: 'bad' })).toBeNull()
  })
})
