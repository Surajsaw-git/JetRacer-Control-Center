/**
 * JetRacer Control Center — LaserScan Defensive Decoder & JSON Sanitizer (Phase 6)
 *
 * Implements defensive message decoding, strict type validation, ray classification,
 * and robust handling of non-standard JSON edge cases produced by ROS 1 rosbridge.
 *
 * Citations & References:
 * - ROS 1 rosbridge_library/protocol.py (Python json.dumps allow_nan=True):
 *   Standard Python json.dumps emits bare `Infinity`, `-Infinity`, and `NaN` tokens when serializing
 *   non-finite floats (e.g. no-return or error rays). Because RFC 8259 forbids these in standard JSON,
 *   we provide a tokenizer-aware pre-parser that safely translates bare tokens outside quotes to `null`.
 * - ROS 1 sensor_msgs/LaserScan specification:
 *   http://docs.ros.org/en/melodic/api/sensor_msgs/html/msg/LaserScan.html
 */

import {
  RayClassification,
  type DecodedLaserScan,
  type RawLaserScanMessage,
} from './lidarTypes'

const MAX_FRAME_ID_LEN = 128
const DEFAULT_MAX_RANGES = 8192

/**
 * Tokenizer-aware JSON pre-parser for ROS 1 rosbridge_suite edge cases.
 *
 * Safely converts bare `NaN`, `Infinity`, and `-Infinity` outside string literals to `null`.
 * Never corrupts or alters characters within double-quoted JSON strings (such as frame_id).
 */
export function sanitizeRosJson(raw: string): string {
  if (!raw.includes('Infinity') && !raw.includes('NaN')) {
    return raw
  }

  let result = ''
  let inString = false
  let isEscaped = false
  let i = 0
  const len = raw.length

  while (i < len) {
    const ch = raw[i]

    if (inString) {
      result += ch
      if (isEscaped) {
        isEscaped = false
      } else if (ch === '\\') {
        isEscaped = true
      } else if (ch === '"') {
        inString = false
      }
      i++
      continue
    }

    if (ch === '"') {
      inString = true
      result += ch
      i++
      continue
    }

    if (raw.startsWith('-Infinity', i)) {
      result += 'null'
      i += 9
      continue
    }
    if (raw.startsWith('Infinity', i)) {
      result += 'null'
      i += 8
      continue
    }
    if (raw.startsWith('NaN', i)) {
      result += 'null'
      i += 3
      continue
    }

    result += ch
    i++
  }

  return result
}

/**
 * Parses an individual range ray value that may arrive as a number, a string ("Infinity", "NaN"),
 * or null, returning a normalized float or special sentinel.
 */
function parseRayValue(val: unknown): { num: number; isNullOrInf: boolean; isNanOrInvalid: boolean } {
  if (val === null || val === undefined) {
    return { num: Number.POSITIVE_INFINITY, isNullOrInf: true, isNanOrInvalid: false }
  }

  if (typeof val === 'number') {
    if (Number.isNaN(val)) {
      return { num: Number.NaN, isNullOrInf: false, isNanOrInvalid: true }
    }
    if (!Number.isFinite(val)) {
      return { num: val, isNullOrInf: true, isNanOrInvalid: false }
    }
    return { num: val, isNullOrInf: false, isNanOrInvalid: false }
  }

  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase()
    if (lower === 'infinity' || lower === '+infinity' || lower === '-infinity' || lower === 'inf' || lower === '-inf') {
      return { num: Number.POSITIVE_INFINITY, isNullOrInf: true, isNanOrInvalid: false }
    }
    if (lower === 'nan') {
      return { num: Number.NaN, isNullOrInf: false, isNanOrInvalid: true }
    }
    const parsed = Number(val)
    if (Number.isNaN(parsed)) {
      return { num: Number.NaN, isNullOrInf: false, isNanOrInvalid: true }
    }
    if (!Number.isFinite(parsed)) {
      return { num: parsed, isNullOrInf: true, isNanOrInvalid: false }
    }
    return { num: parsed, isNullOrInf: false, isNanOrInvalid: false }
  }

  return { num: Number.NaN, isNullOrInf: false, isNanOrInvalid: true }
}

export interface DecodeResult {
  scan: DecodedLaserScan | null
  error?: string
  isOversized?: boolean
  isMalformed?: boolean
}

/**
 * Defensively decodes a raw sensor_msgs/LaserScan message into a strongly-typed,
 * memory-efficient DecodedLaserScan structure using Float32Array and Uint8Array buffers.
 */
export function decodeLaserScanDetailed(
  rawMsg: unknown,
  maxRanges: number = DEFAULT_MAX_RANGES,
): DecodeResult {
  if (!rawMsg || typeof rawMsg !== 'object') {
    return { scan: null, error: 'Malformed LaserScan: payload is not an object', isMalformed: true }
  }

  const msg = rawMsg as RawLaserScanMessage

  if (!Array.isArray(msg.ranges) || msg.ranges.length === 0) {
    return { scan: null, error: 'Malformed LaserScan: "ranges" is missing or empty', isMalformed: true }
  }

  if (typeof msg.angle_min !== 'undefined' && typeof msg.angle_min !== 'number') {
    return { scan: null, error: 'Malformed LaserScan: "angle_min" is not a number', isMalformed: true }
  }

  const count = msg.ranges.length
  if (count > maxRanges) {
    return {
      scan: null,
      error: `Oversized LaserScan dropped: ${count} points exceeds safety cap of ${maxRanges}`,
      isOversized: true,
    }
  }

  // Validate geometry parameters with sane fallbacks
  const angleMin = typeof msg.angle_min === 'number' && Number.isFinite(msg.angle_min) ? msg.angle_min : -Math.PI
  const angleMax = typeof msg.angle_max === 'number' && Number.isFinite(msg.angle_max) ? msg.angle_max : Math.PI
  const angleIncrement =
    typeof msg.angle_increment === 'number' && Number.isFinite(msg.angle_increment) && msg.angle_increment > 0
      ? msg.angle_increment
      : count > 1
        ? (angleMax - angleMin) / (count - 1)
        : 0.01

  const timeIncrement =
    typeof msg.time_increment === 'number' && Number.isFinite(msg.time_increment) ? msg.time_increment : 0
  const scanTime = typeof msg.scan_time === 'number' && Number.isFinite(msg.scan_time) ? msg.scan_time : 0.1

  const rangeMin =
    typeof msg.range_min === 'number' && Number.isFinite(msg.range_min) && msg.range_min >= 0 ? msg.range_min : 0.05
  const rangeMax =
    typeof msg.range_max === 'number' && Number.isFinite(msg.range_max) && msg.range_max > rangeMin
      ? msg.range_max
      : 12.0

  const warnings: string[] = []

  // Check parameter sanity
  if (msg.angle_increment !== undefined && msg.angle_increment <= 0) {
    warnings.push('angle_increment is <= 0 or non-finite; auto-corrected.')
  }
  if (msg.range_min !== undefined && msg.range_max !== undefined && msg.range_min >= msg.range_max) {
    warnings.push(`range_min (${msg.range_min}m) >= range_max (${msg.range_max}m); sensor configuration inverted.`)
  }

  const expectedRays = angleIncrement > 0 ? Math.round((angleMax - angleMin) / angleIncrement) + 1 : count
  if (Math.abs(expectedRays - count) > 2) {
    warnings.push(`Ray count (${count}) diverges from angular span expectation (${expectedRays}).`)
  }

  // Extract header
  const seq = typeof msg.header?.seq === 'number' ? msg.header.seq : 0
  const secs = typeof msg.header?.stamp?.secs === 'number' ? msg.header.stamp.secs : Math.floor(Date.now() / 1000)
  const nsecs = typeof msg.header?.stamp?.nsecs === 'number' ? msg.header.stamp.nsecs : 0
  const rawFrameId = typeof msg.header?.frame_id === 'string' ? msg.header.frame_id : 'laser_sensor'
  const frame_id = rawFrameId.slice(0, MAX_FRAME_ID_LEN)

  // Allocate typed arrays
  const ranges = new Float32Array(count)
  const classifications = new Uint8Array(count)
  let intensities: Float32Array | null = null

  if (Array.isArray(msg.intensities) && msg.intensities.length === count) {
    intensities = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      const val = Number(msg.intensities[i])
      intensities[i] = Number.isFinite(val) ? val : 0
    }
  } else if (Array.isArray(msg.intensities) && msg.intensities.length > 0 && msg.intensities.length !== count) {
    warnings.push(`Intensities length (${msg.intensities.length}) does not match ranges length (${count}); intensities ignored.`)
  }

  let validCount = 0
  let noReturnCount = 0
  let tooCloseCount = 0
  let invalidCount = 0
  const outOfFovCount = 0
  let minValidRange: number | null = null
  let maxValidRange: number | null = null

  for (let i = 0; i < count; i++) {
    const rawVal = msg.ranges[i]
    const { num, isNullOrInf, isNanOrInvalid } = parseRayValue(rawVal)

    if (isNanOrInvalid) {
      ranges[i] = Number.NaN
      classifications[i] = RayClassification.INVALID
      invalidCount++
    } else if (isNullOrInf) {
      ranges[i] = Number.POSITIVE_INFINITY
      classifications[i] = RayClassification.NO_RETURN
      noReturnCount++
    } else if (num < rangeMin) {
      ranges[i] = num
      classifications[i] = RayClassification.TOO_CLOSE
      tooCloseCount++
    } else if (num > rangeMax) {
      ranges[i] = num
      classifications[i] = RayClassification.NO_RETURN
      noReturnCount++
    } else {
      ranges[i] = num
      classifications[i] = RayClassification.VALID
      validCount++

      if (minValidRange === null || num < minValidRange) {
        minValidRange = num
      }
      if (maxValidRange === null || num > maxValidRange) {
        maxValidRange = num
      }
    }
  }

  // Scan-level diagnostic checks
  if (count > 0 && validCount === 0) {
    warnings.push(
      'All measurements are invalid: the sensor may be powered but not measuring; check its motor/power switch (suggestion from operator-reported history).',
    )
  }

  const decoded: DecodedLaserScan = {
    header: {
      seq,
      stamp: { secs, nsecs },
      stampSecs: secs + nsecs * 1e-9,
      frame_id,
    },
    angleMin,
    angleMax,
    angleIncrement,
    timeIncrement,
    scanTime,
    rangeMin,
    rangeMax,
    ranges,
    intensities,
    classifications,
    count,
    validCount,
    noReturnCount,
    tooCloseCount,
    invalidCount,
    outOfFovCount,
    minValidRange,
    maxValidRange,
    validPointsCount: validCount,
    droppedOrInvalidCount: noReturnCount + tooCloseCount + invalidCount + outOfFovCount,
    warnings,
    receivedAtMs: Date.now(),
  }

  return { scan: decoded }
}

/**
 * Convenience helper returning decoded scan directly (or null on failure).
 */
export function decodeLaserScan(
  rawMsg: unknown,
  maxRanges: number = DEFAULT_MAX_RANGES,
): (DecodedLaserScan & DecodeResult) | null {
  const result = decodeLaserScanDetailed(rawMsg, maxRanges)
  if (!result.scan) return null
  return Object.assign(result.scan, result)
}
