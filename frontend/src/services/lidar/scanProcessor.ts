/**
 * JetRacer Control Center — LaserScan Stream Processor & Anomaly Detector (Phase 6)
 *
 * Computes real-time streaming metrics, sliding-window rate (Hz), bandwidth,
 * frozen-scan detection, and frame_id change monitoring.
 */

import type { DecodedLaserScan, LidarMetrics } from './lidarTypes'

export class ScanProcessor {
  private lastScan: DecodedLaserScan | null = null
  private recentScanTimes: number[] = []
  private recentPayloadBytes: number[] = []

  private consecutiveIdenticalScans = 0
  private lastFrameId: string | null = null

  public droppedScans = 0
  public oversizedScans = 0
  public malformedScans = 0
  public receivedScansCount = 0

  public recordDropped(): void {
    this.droppedScans++
  }

  public recordOversized(): void {
    this.oversizedScans++
  }

  public getMetrics(): LidarMetrics {
    return {
      measuredHz: 0,
      currentRateHz: 0,
      expectedHz: null,
      pointsPerScan: 0,
      validPercent: 0,
      validPointsRatio: 0,
      bandwidthKbps: 0,
      scanAgeMs: 0,
      clockOffsetAgeMs: null,
      droppedScans: this.droppedScans,
      oversizedScans: this.oversizedScans,
      malformedScans: this.malformedScans,
      renderTimeMs: 0,
      receivedScansCount: this.receivedScansCount,
      frameId: this.lastFrameId || '',
      isFrozen: false,
      frameIdChanged: false,
    }
  }

  public processScan(
    scan: DecodedLaserScan,
    clockOffsetSecs: number | null = null,
    renderTimeMs = 0,
  ): LidarMetrics & { metrics: LidarMetrics; isFrozen: boolean; frameIdChanged: boolean } {
    this.receivedScansCount++
    if (!scan.warnings) {
      scan.warnings = []
    }
    const now = Date.now()
    this.recentScanTimes.push(now)
    // Approximate JSON message size based on point count (approx 12 bytes per ray in JSON)
    const count = scan.count ?? scan.ranges?.length ?? 0
    const estimatedBytes = count * 12 + 128
    this.recentPayloadBytes.push(estimatedBytes)

    // Keep sliding window of 2 seconds
    while (this.recentScanTimes.length > 0 && now - this.recentScanTimes[0] > 2000) {
      this.recentScanTimes.shift()
      this.recentPayloadBytes.shift()
    }

    const windowDurationSec =
      this.recentScanTimes.length > 1
        ? (now - this.recentScanTimes[0]) / 1000
        : 1.0

    const measuredHz =
      this.recentScanTimes.length > 1
        ? Math.round((this.recentScanTimes.length - 1) / windowDurationSec * 10) / 10
        : 0

    const totalBytes = this.recentPayloadBytes.reduce((acc, b) => acc + b, 0)
    const bandwidthKbps = Math.round((totalBytes * 8) / (windowDurationSec * 1000))

    const expectedHz =
      scan.scanTime > 0 && scan.scanTime < 2.0
        ? Math.round((1.0 / scan.scanTime) * 10) / 10
        : null

    const validCount = scan.validCount ?? scan.validPointsCount ?? 0
    const validPercent =
      count > 0 ? Math.round((validCount / count) * 1000) / 10 : 0

    const scanAgeMs = Math.max(0, now - (scan.receivedAtMs ?? now))

    let clockOffsetAgeMs: number | null = null
    if (clockOffsetSecs !== null && Number.isFinite(clockOffsetSecs) && Math.abs(clockOffsetSecs) < 300) {
      const robotNowSec = now / 1000 + clockOffsetSecs
      const latencySec = robotNowSec - (scan.header?.stampSecs ?? (scan.header?.stamp?.secs ?? 0))
      clockOffsetAgeMs = Math.round(latencySec * 1000)
    }

    // Check for frame_id changes
    let frameIdChanged = false
    if (this.lastFrameId !== null && this.lastFrameId !== scan.header?.frame_id) {
      frameIdChanged = true
      scan.warnings.push(
        `frame_id changed from "${this.lastFrameId}" to "${scan.header?.frame_id}"; resetting display trails.`,
      )
    }
    this.lastFrameId = scan.header?.frame_id || ''

    // Check for frozen scan (identical ranges across scans with advancing stamps)
    let isFrozen = false
    const lastCount = this.lastScan ? (this.lastScan.count ?? this.lastScan.ranges?.length ?? 0) : 0
    if (this.lastScan && lastCount === count && count > 0) {
      let identical = true
      const step = Math.max(1, Math.floor(count / 20)) // Sample 20 points
      for (let i = 0; i < count; i += step) {
        if (scan.ranges[i] !== this.lastScan.ranges[i]) {
          identical = false
          break
        }
      }

      if (identical) {
        this.consecutiveIdenticalScans++
        if (this.consecutiveIdenticalScans >= 14) {
          isFrozen = true
          scan.warnings.push(
            'Frozen scan detected: measurement values are unchanged across consecutive scans despite advancing timestamps.',
          )
        }
      } else {
        this.consecutiveIdenticalScans = 0
      }
    } else {
      this.consecutiveIdenticalScans = 0
    }

    this.lastScan = scan

    const metrics: LidarMetrics = {
      measuredHz,
      currentRateHz: measuredHz,
      expectedHz,
      pointsPerScan: scan.count,
      validPercent,
      validPointsRatio: validPercent,
      bandwidthKbps,
      scanAgeMs,
      clockOffsetAgeMs,
      droppedScans: this.droppedScans,
      oversizedScans: this.oversizedScans,
      malformedScans: this.malformedScans,
      renderTimeMs,
      receivedScansCount: this.receivedScansCount,
      frameId: scan.header?.frame_id || '',
      isFrozen,
      frameIdChanged,
    }

    return {
      ...metrics,
      metrics,
      isFrozen,
      frameIdChanged,
    }
  }

  public reset(): void {
    this.lastScan = null
    this.recentScanTimes = []
    this.recentPayloadBytes = []
    this.consecutiveIdenticalScans = 0
    this.lastFrameId = null
    this.droppedScans = 0
    this.oversizedScans = 0
    this.malformedScans = 0
    this.receivedScansCount = 0
  }
}
