import { describe, it, expect, beforeEach } from 'vitest'
import { ScanProcessor } from '@/services/lidar/scanProcessor'
import { RayClassification, type DecodedScan } from '@/services/lidar/lidarTypes'

function createFakeScan(seq: number, stampSecs: number, ranges: number[], frameId = 'laser'): DecodedScan {
  const rArr = new Float32Array(ranges)
  const cArr = new Uint8Array(ranges.length).fill(RayClassification.VALID)
  return {
    header: { seq, stamp: { secs: stampSecs, nsecs: 0 }, stampSecs, frame_id: frameId },
    angleMin: -Math.PI,
    angleMax: Math.PI,
    angleIncrement: (2 * Math.PI) / ranges.length,
    timeIncrement: 0,
    scanTime: 0.1,
    rangeMin: 0.1,
    rangeMax: 10.0,
    ranges: rArr,
    intensities: new Float32Array(ranges.length),
    classifications: cArr,
    count: ranges.length,
    validCount: ranges.length,
    validPointsCount: ranges.length,
    noReturnCount: 0,
    tooCloseCount: 0,
    invalidCount: 0,
    droppedOrInvalidCount: 0,
    outOfFovCount: 0,
    minValidRange: Math.min(...ranges),
    maxValidRange: Math.max(...ranges),
    warnings: [],
    receivedAtMs: Date.now(),
  }
}

describe('scanProcessor — Rate, Bandwidth, Frozen Scans & Frame Detection', () => {
  let processor: ScanProcessor

  beforeEach(() => {
    processor = new ScanProcessor()
  })

  it('updates metrics and tracks received count correctly', () => {
    const scan1 = createFakeScan(1, 100, [1.0, 2.0, 3.0])
    const metrics1 = processor.processScan(scan1)

    expect(metrics1.receivedScansCount).toBe(1)
    expect(metrics1.frameId).toBe('laser')
    expect(metrics1.validPointsRatio).toBe(100)
    expect(metrics1.isFrozen).toBe(false)
  })

  it('detects frozen scans when ranges are identical for 15+ cycles', () => {
    const staticRanges = [1.25, 2.5, 3.75]

    for (let i = 1; i <= 14; i++) {
      const scan = createFakeScan(i, 100 + i, staticRanges)
      const m = processor.processScan(scan)
      expect(m.isFrozen).toBe(false)
    }

    // 15th consecutive identical scan
    const scan15 = createFakeScan(15, 115, staticRanges)
    const metrics15 = processor.processScan(scan15)
    expect(metrics15.isFrozen).toBe(true)

    // Values change on 16th scan -> frozen clears
    const scan16 = createFakeScan(16, 116, [1.25, 2.5, 4.0])
    const metrics16 = processor.processScan(scan16)
    expect(metrics16.isFrozen).toBe(false)
  })

  it('detects runtime frame_id switches', () => {
    const scan1 = createFakeScan(1, 100, [1.0], 'laser_front')
    const m1 = processor.processScan(scan1)
    expect(m1.frameIdChanged).toBe(false)

    const scan2 = createFakeScan(2, 101, [1.0], 'laser_back')
    const m2 = processor.processScan(scan2)
    expect(m2.frameIdChanged).toBe(true)
    expect(m2.frameId).toBe('laser_back')
  })

  it('resets metrics cleanly', () => {
    processor.processScan(createFakeScan(1, 100, [1.0]))
    processor.recordDropped()
    processor.recordOversized()

    processor.reset()
    const m = processor.getMetrics()
    expect(m.receivedScansCount).toBe(0)
    expect(m.droppedScans).toBe(0)
    expect(m.oversizedScans).toBe(0)
    expect(m.frameId).toBe('')
  })
})
