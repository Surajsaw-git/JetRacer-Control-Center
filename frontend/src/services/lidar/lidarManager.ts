/**
 * JetRacer Control Center — LiDAR Manager (Ref-Counted Coordinator, Phase 6)
 *
 * Implements ref-counted consumer management across views (LiDAR page, Dashboard, Control slot),
 * stall detection, exponential backoff reconnection, scan ring buffering, and export functions.
 */

import { lidarService } from './lidarService'
import { decodeLaserScanDetailed } from './scanDecoder'
import { ScanProcessor } from './scanProcessor'
import { computeSectorReadouts } from './scanGeometry'
import { useConnectionStore } from '@/store/connectionStore'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'
import { useEventLogStore } from '@/store/eventLogStore'
import type {
  DecodedLaserScan,
  LidarDisplayConfig,
  LidarMetrics,
  LidarSectorReadouts,
  LidarStreamState,
} from './lidarTypes'

const STALL_TIMEOUT_MS = 2000
const MAX_RECONNECT_ATTEMPTS = 8
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000]
const MAX_RING_BUFFER = 50

export class LidarManager {
  private activeConsumers = new Map<string, (scan: DecodedLaserScan) => void>()
  private stateSubscribers = new Set<(state: LidarStreamState, error?: string | null) => void>()
  private metricsSubscribers = new Set<(metrics: LidarMetrics) => void>()

  public currentState: LidarStreamState = 'no_topic'
  public currentError: string | null = null
  public selectedTopic: string = ''
  public throttleRateMs: number = 100

  public displayConfig: LidarDisplayConfig = {
    rotationDeg: 0,
    mirror: false,
    renderMode: 'points',
    colorMode: 'distance',
    showMaxRangeBoundary: true,
    showMinRangeDeadZone: true,
    showNoDataTicks: true,
    showGhostTrail: false,
    ghostTrailCount: 3,
    displayRangeLimitM: 12.0,
    showRangeRings: true,
    showSectorOverlays: true,
  }

  public latestScan: DecodedLaserScan | null = null
  public scanRingBuffer: DecodedLaserScan[] = []
  public sectorReadouts: LidarSectorReadouts = {
    front: { distanceM: null, bearingDeg: null, status: 'clear' },
    left: { distanceM: null, bearingDeg: null, status: 'clear' },
    right: { distanceM: null, bearingDeg: null, status: 'clear' },
    back: { distanceM: null, bearingDeg: null, status: 'clear' },
    overallNearestM: null,
    overallNearestBearingDeg: null,
  }

  public metrics: LidarMetrics = {
    measuredHz: 0,
    expectedHz: null,
    pointsPerScan: 0,
    validPercent: 0,
    bandwidthKbps: 0,
    scanAgeMs: 0,
    clockOffsetAgeMs: null,
    droppedScans: 0,
    oversizedScans: 0,
    malformedScans: 0,
    renderTimeMs: 0,
  }

  private scanProcessor = new ScanProcessor()
  private stallCheckInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private lastScanTimestamp = 0
  private isUserStopped = false
  private connectionUnsubscribe: (() => void) | null = null

  constructor() {
    this.setupConnectionListener()
    this.setupVisibilityListener()
  }

  public setSelectedTopic(topic: string): void {
    const clean = topic.trim()
    if (this.selectedTopic === clean) return
    this.selectedTopic = clean

    if (!this.selectedTopic) {
      this.transitionTo('no_topic')
      this.stopStream()
      return
    }

    if ((this.currentState === 'streaming' || this.currentState === 'waiting') && !this.isUserStopped) {
      this.restartStream().catch(() => {})
    }
  }

  public setThrottleRate(rateMs: number): void {
    const cleanRate = Math.max(50, Math.min(1000, rateMs))
    if (this.throttleRateMs === cleanRate) return
    this.throttleRateMs = cleanRate

    if (this.currentState === 'streaming' || this.currentState === 'waiting') {
      this.restartStream()
    }
  }

  public updateDisplayConfig(config: Partial<LidarDisplayConfig>): void {
    this.displayConfig = { ...this.displayConfig, ...config }
    if (this.latestScan) {
      this.sectorReadouts = computeSectorReadouts(this.latestScan, this.displayConfig)
    }
  }

  /**
   * Ref-counting attach: Registers an active consumer component.
   */
  public attachConsumer(
    consumerId: string,
    onScan?: (scan: DecodedLaserScan) => void,
  ): () => void {
    if (onScan) {
      this.activeConsumers.set(consumerId, onScan)
    } else {
      this.activeConsumers.set(consumerId, () => {})
    }

    return () => {
      this.detachConsumer(consumerId)
    }
  }

  public detachConsumer(consumerId: string): void {
    this.activeConsumers.delete(consumerId)

    if (this.activeConsumers.size === 0) {
      this.stopStream()
      this.transitionTo('stopped')
    }
  }

  public getConsumerCount(): number {
    return this.activeConsumers.size
  }

  /**
   * Primary stream starter (User or Ref-count triggered).
   */
  public async startStream(): Promise<void> {
    if (!this.selectedTopic) {
      this.transitionTo('no_topic', 'No LaserScan topic selected.')
      return
    }

    const connStatus = useConnectionStore.getState().status
    if (connStatus !== 'connected') {
      this.transitionTo('link_down', 'Cannot start LiDAR: Link to robot is down.')
      return
    }

    this.isUserStopped = false
    this.reconnectAttempts = 0
    this.clearTimers()
    this.transitionTo('waiting', `Subscribing to ${this.selectedTopic}...`)

    try {
      await lidarService.subscribe(
        this.selectedTopic,
        (rawMsg) => this.handleIncomingMessage(rawMsg),
        this.throttleRateMs,
      )

      this.startStallDetection()
      useEventLogStore.getState().addEvent({
        type: 'system',
        title: 'LiDAR Stream Started',
        detail: `Subscribed to ${this.selectedTopic} at ${this.throttleRateMs}ms throttle.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.transitionTo('error', `Failed to subscribe to LiDAR: ${msg}`)
      throw err
    }
  }

  /**
   * Explicit user or cleanup stream stop.
   */
  public stopStream(): void {
    this.isUserStopped = true
    this.clearTimers()
    lidarService.unsubscribe()
    this.transitionTo('stopped')
  }

  private handleIncomingMessage(rawMsg: unknown): void {
    const now = Date.now()
    this.lastScanTimestamp = now

    const { scan, isOversized, isMalformed } = decodeLaserScanDetailed(rawMsg)

    if (isOversized) {
      this.scanProcessor.oversizedScans++
      this.metrics.oversizedScans++
      return
    }

    if (isMalformed || !scan) {
      this.scanProcessor.malformedScans++
      this.metrics.malformedScans++
      return
    }

    // Process scan metrics and classifications
    const clockOffsetSecs = useRosStatusStore.getState().clockOffsetSecs
    const { metrics, isFrozen, frameIdChanged } = this.scanProcessor.processScan(
      scan,
      clockOffsetSecs,
    )
    this.metrics = metrics

    // If frame_id changed, clear persistence trail
    if (frameIdChanged) {
      this.scanRingBuffer = []
    }

    // Store in ring buffer
    this.latestScan = scan
    this.scanRingBuffer.push(scan)
    if (this.scanRingBuffer.length > MAX_RING_BUFFER) {
      this.scanRingBuffer.shift()
    }

    // Calculate sector readouts
    this.sectorReadouts = computeSectorReadouts(scan, this.displayConfig)

    // Verify in Topic Registry if verified_live criteria met
    const registry = useTopicRegistryStore.getState()
    const mapping = registry.mappings.laser_scan
    if (mapping && mapping.assignedTopic === this.selectedTopic && mapping.verification !== 'verified_live') {
      if (scan.validCount > 10) {
        registry.recordLiveMessage(this.selectedTopic)
      }
    }

    // Determine healthy vs degraded state
    if (this.currentState !== 'streaming' && this.currentState !== 'degraded') {
      this.reconnectAttempts = 0
    }

    const isRateDegraded = (metrics.receivedScansCount ?? 0) > 5 && metrics.measuredHz < 1.0
    if (isFrozen || scan.validCount === 0 || isRateDegraded) {
      this.transitionTo('degraded', scan.warnings[0] || 'LiDAR measurements degraded or rate low.')
    } else {
      this.transitionTo('streaming')
    }

    // Notify consumers
    for (const consumerFn of this.activeConsumers.values()) {
      consumerFn(scan)
    }

    // Notify metrics
    for (const sub of this.metricsSubscribers) {
      sub(this.metrics)
    }
  }

  private startStallDetection(): void {
    if (this.stallCheckInterval) clearInterval(this.stallCheckInterval)
    this.stallCheckInterval = setInterval(() => {
      if (this.currentState !== 'streaming' && this.currentState !== 'degraded') return

      const now = Date.now()
      if (now - this.lastScanTimestamp > STALL_TIMEOUT_MS) {
        this.transitionTo('stalled', 'LiDAR stream stalled (no scan received for 2 seconds).')
        this.handleStreamError('Stream stalled.')
      }
    }, 500)
  }

  private handleStreamError(errorMsg: string): void {
    if (this.isUserStopped) return
    this.clearTimers()
    lidarService.unsubscribe()

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++
      const baseDelay =
        RECONNECT_DELAYS_MS[
          Math.min(this.reconnectAttempts - 1, RECONNECT_DELAYS_MS.length - 1)
        ]
      const jitter = (Math.random() - 0.5) * 0.4 * baseDelay
      const delay = Math.round(baseDelay + jitter)

      this.transitionTo(
        'stalled',
        `Reconnecting to LiDAR (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`,
      )

      this.reconnectTimer = setTimeout(() => {
        this.transitionTo(
          'waiting',
          `Reconnecting to LiDAR (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
        )
        this.startStream().catch(() => {})
      }, delay)
    } else {
      this.transitionTo(
        'error',
        `${errorMsg} (Exceeded ${MAX_RECONNECT_ATTEMPTS} reconnection attempts). Check LiDAR power.`,
      )
    }
  }

  private async restartStream(): Promise<void> {
    this.stopStream()
    await this.startStream()
  }

  private transitionTo(state: LidarStreamState, error?: string | null): void {
    this.currentState = state
    this.currentError = error ?? null

    for (const sub of this.stateSubscribers) {
      sub(state, this.currentError)
    }
  }

  public onStateChange(listener: (state: LidarStreamState, error?: string | null) => void): () => void {
    this.stateSubscribers.add(listener)
    listener(this.currentState, this.currentError)
    return () => {
      this.stateSubscribers.delete(listener)
    }
  }

  public onMetrics(listener: (metrics: LidarMetrics) => void): () => void {
    this.metricsSubscribers.add(listener)
    listener(this.metrics)
    return () => {
      this.metricsSubscribers.delete(listener)
    }
  }

  private clearTimers(): void {
    if (this.stallCheckInterval) {
      clearInterval(this.stallCheckInterval)
      this.stallCheckInterval = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setupConnectionListener(): void {
    this.connectionUnsubscribe = useConnectionStore.subscribe((connState, prevState) => {
      if (connState.status !== 'connected' && prevState.status === 'connected') {
        this.clearTimers()
        lidarService.unsubscribe()
        this.transitionTo('link_down', 'Link to robot is down.')
      } else if (connState.status === 'connected' && prevState.status !== 'connected') {
        // Link restored: if active consumers exist, resume once
        if (this.activeConsumers.size > 0 && !this.isUserStopped && this.selectedTopic) {
          this.startStream().catch(() => {})
        }
      }
    })
  }

  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.currentState === 'streaming' || this.currentState === 'waiting') {
          // Pause/stop to save battery and Wi-Fi congestion
          this.clearTimers()
          lidarService.unsubscribe()
          this.transitionTo('stopped', 'Paused while backgrounded.')
        }
      } else {
        if (this.activeConsumers.size > 0 && !this.isUserStopped && this.selectedTopic) {
          if (useConnectionStore.getState().status === 'connected') {
            this.startStream().catch(() => {})
          }
        }
      }
    })
  }

  /**
   * Exports the current decoded scan as formatted JSON.
   */
  public exportCurrentScanJson(): string | null {
    if (!this.latestScan) return null
    const exportData = {
      header: this.latestScan.header,
      angle_min: this.latestScan.angleMin,
      angle_max: this.latestScan.angleMax,
      angle_increment: this.latestScan.angleIncrement,
      time_increment: this.latestScan.timeIncrement,
      scan_time: this.latestScan.scanTime,
      range_min: this.latestScan.rangeMin,
      range_max: this.latestScan.rangeMax,
      ranges: Array.from(this.latestScan.ranges),
      intensities: this.latestScan.intensities ? Array.from(this.latestScan.intensities) : null,
      classifications: Array.from(this.latestScan.classifications),
      metrics: this.metrics,
      exportedAt: new Date().toISOString(),
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Downloads current scan sample JSON directly to client device.
   */
  public downloadCurrentScanFile(): void {
    const json = this.exportCurrentScanJson()
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jetracer-scan-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * Downloads ring buffer of recent scans as JSON array.
   */
  public downloadRingBufferFile(maxCount = 50): void {
    const count = Math.min(maxCount, this.scanRingBuffer.length)
    if (count === 0) return
    const slice = this.scanRingBuffer.slice(-count).map((s) => ({
      header: s.header,
      angle_min: s.angleMin,
      angle_max: s.angleMax,
      angle_increment: s.angleIncrement,
      range_min: s.rangeMin,
      range_max: s.rangeMax,
      ranges: Array.from(s.ranges),
      classifications: Array.from(s.classifications),
    }))
    const json = JSON.stringify(slice, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jetracer-scans-buffer-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  public getState(): LidarStreamState {
    return this.currentState
  }

  public getError(): string | null {
    return this.currentError
  }

  public getCurrentScan(): DecodedLaserScan | null {
    return this.latestScan
  }

  public getMetrics(): LidarMetrics {
    return this.metrics
  }

  public getSectors(): LidarSectorReadouts {
    return this.sectorReadouts
  }

  public getRingBuffer(): DecodedLaserScan[] {
    return this.scanRingBuffer
  }

  public async start(consumerId: string, topic: string, throttleRateMs = 100): Promise<boolean> {
    const cleanTopic = topic.trim()
    const topicChanged = Boolean(this.selectedTopic && this.selectedTopic !== cleanTopic)
    this.selectedTopic = cleanTopic
    this.throttleRateMs = Math.max(50, Math.min(1000, throttleRateMs))
    if (!this.activeConsumers.has(consumerId)) {
      this.attachConsumer(consumerId)
    }
    if (this.currentState !== 'streaming' && this.currentState !== 'waiting') {
      await this.startStream()
    } else if (topicChanged) {
      await this.restartStream()
    }
    return true
  }

  public stop(consumerId: string): void {
    this.detachConsumer(consumerId)
  }

  public reset(): void {
    this.destroy()
  }

  public exportRingBufferJson(): void {
    this.downloadRingBufferFile()
  }

  public subscribeState(fn: (state: LidarStreamState, error?: string | null) => void): () => void {
    this.stateSubscribers.add(fn)
    return () => {
      this.stateSubscribers.delete(fn)
    }
  }

  public subscribeMetrics(fn: (metrics: LidarMetrics) => void): () => void {
    this.metricsSubscribers.add(fn)
    return () => {
      this.metricsSubscribers.delete(fn)
    }
  }

  public subscribe(
    callback: (data: {
      scan: DecodedLaserScan | null
      state: LidarStreamState
      metrics: LidarMetrics
      sectors: LidarSectorReadouts
    }) => void,
  ): () => void {
    const notify = () => {
      callback({
        scan: this.latestScan,
        state: this.currentState,
        metrics: this.metrics,
        sectors: this.sectorReadouts,
      })
    }

    const stateUnsub = this.subscribeState(() => notify())
    const metricsUnsub = this.subscribeMetrics(() => notify())
    const detach = this.attachConsumer(`_sub_${Math.random()}`, () => notify())

    return () => {
      stateUnsub()
      metricsUnsub()
      detach()
    }
  }

  public destroy(): void {
    this.clearTimers()
    lidarService.unsubscribe()
    if (this.connectionUnsubscribe) {
      this.connectionUnsubscribe()
      this.connectionUnsubscribe = null
    }
    this.activeConsumers.clear()
    this.stateSubscribers.clear()
    this.metricsSubscribers.clear()
    this.scanProcessor.reset()
    this.currentState = 'stopped'
    this.latestScan = null
  }
}

export const lidarManager = new LidarManager()
