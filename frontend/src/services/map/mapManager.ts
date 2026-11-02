/**
 * JetRacer Control Center — Map Coordinator & Ref-Counted Manager (Phase 7A)
 *
 * Implements ref-counted consumer management across views (Mapping page, Dashboard preview, Navigation),
 * coordinates map topic streaming and one-time GetMap snapshots, integrates TF transform tracking,
 * and maintains reactive stream health metrics and state transitions.
 */

import { mapService } from './mapService'
import { tfService } from './tfService'
import { poseService } from './poseService'
import { decodeOccupancyGrid } from './mapDecoder'
import { useConnectionStore } from '@/store/connectionStore'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'
import { useEventLogStore } from '@/store/eventLogStore'
import type {
  DecodedOccupancyGrid,
  MapDisplayConfig,
  MapStreamState,
  MapSummaryMetrics,
  PoseTrailPoint,
  RobotPose2D,
} from './mapTypes'
import { DEFAULT_MAP_CONFIG } from './mapTypes'

const STALL_TIMEOUT_MS = 15000 // Maps typically publish at 0.5 - 1 Hz, 15s indicates stall

export class MapManager {
  private activeConsumers = new Map<string, (map: DecodedOccupancyGrid | null) => void>()
  private stateSubscribers = new Set<(state: MapStreamState, error?: string | null) => void>()
  private metricsSubscribers = new Set<(metrics: MapSummaryMetrics) => void>()

  public currentState: MapStreamState = 'no_topic'
  public currentError: string | null = null
  public selectedTopic: string = ''
  public throttleRateMs: number = 1000

  public displayConfig: MapDisplayConfig = { ...DEFAULT_MAP_CONFIG }
  public latestMap: DecodedOccupancyGrid | null = null

  public metrics: MapSummaryMetrics = {
    currentRateHz: 0,
    receivedCount: 0,
    droppedCount: 0,
    oversizedCount: 0,
    malformedCount: 0,
    bandwidthKbps: 0,
    renderTimeMs: 0,
    lastUpdateAgeMs: 0,
  }

  private stallCheckInterval: ReturnType<typeof setInterval> | null = null
  private lastMapTimestamp = 0
  private lastMessageTimestamps: number[] = []
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

    if ((this.currentState === 'live' || this.currentState === 'waiting') && !this.isUserStopped) {
      this.restartStream().catch(() => {})
    }
  }

  public setThrottleRate(rateMs: number): void {
    const clean = Math.max(1000, rateMs)
    if (this.throttleRateMs === clean) return
    this.throttleRateMs = clean

    if (this.currentState === 'live' || this.currentState === 'waiting') {
      this.restartStream().catch(() => {})
    }
  }

  public updateDisplayConfig(config: Partial<MapDisplayConfig>): void {
    this.displayConfig = { ...this.displayConfig, ...config }
  }

  public attachConsumer(
    consumerId: string,
    onMap?: (map: DecodedOccupancyGrid | null) => void,
  ): () => void {
    if (onMap) {
      this.activeConsumers.set(consumerId, onMap)
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
   * Starts map streaming and TF tracking.
   */
  public async startStream(): Promise<void> {
    if (!this.selectedTopic) {
      this.transitionTo('no_topic', 'No OccupancyGrid topic selected.')
      return
    }

    const connStatus = useConnectionStore.getState().status
    if (connStatus !== 'connected') {
      this.transitionTo('link_down', 'Cannot start Map: Link to robot is down.')
      return
    }

    this.isUserStopped = false
    this.clearTimers()
    this.transitionTo('waiting', `Subscribing to ${this.selectedTopic}...`)

    try {
      // 1. Subscribe to map topic
      await mapService.subscribe(
        this.selectedTopic,
        (rawMsg) => this.handleIncomingMessage(rawMsg),
        this.throttleRateMs,
      )

      // 2. Subscribe to TF topics if available
      tfService.subscribeTopic('/tf', false).catch(() => {})
      tfService.subscribeTopic('/tf_static', true).catch(() => {})

      // 3. Start pose polling
      poseService.startPolling(100)

      this.startStallDetection()

      useEventLogStore.getState().addEvent({
        type: 'system',
        title: 'Map Stream Started',
        detail: `Subscribed to ${this.selectedTopic} at ${this.throttleRateMs}ms throttle.`,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.transitionTo('error', `Failed to subscribe to Map: ${msg}`)
      throw err
    }
  }

  public stopStream(): void {
    this.isUserStopped = true
    this.clearTimers()
    mapService.unsubscribe()
    tfService.unsubscribeAll()
    poseService.stopPolling()
    this.transitionTo('stopped')
  }

  private async restartStream(): Promise<void> {
    this.stopStream()
    await this.startStream()
  }

  /**
   * Fetches a one-time snapshot from a nav_msgs/GetMap service.
   */
  public async fetchSnapshot(serviceName: string): Promise<boolean> {
    const connStatus = useConnectionStore.getState().status
    if (connStatus !== 'connected') {
      this.transitionTo('link_down', 'Cannot fetch snapshot: Link to robot is down.')
      return false
    }

    this.transitionTo('waiting', `Querying ${serviceName}...`)
    try {
      const rawMap = await mapService.fetchSnapshot(serviceName)
      this.handleIncomingMessage(rawMap)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.transitionTo('error', `GetMap snapshot failed: ${msg}`)
      return false
    }
  }

  private handleIncomingMessage(rawMsg: unknown): void {
    const now = Date.now()
    this.lastMapTimestamp = now

    // Measure Hz over rolling window of last 5 messages
    this.lastMessageTimestamps.push(now)
    if (this.lastMessageTimestamps.length > 5) {
      this.lastMessageTimestamps.shift()
    }
    if (this.lastMessageTimestamps.length > 1) {
      const dtSec = (now - this.lastMessageTimestamps[0]) / 1000
      this.metrics.currentRateHz = dtSec > 0 ? Number(((this.lastMessageTimestamps.length - 1) / dtSec).toFixed(2)) : 0
    }

    const { map, isOversized, isMalformed, error } = decodeOccupancyGrid(
      rawMsg,
      this.latestMap,
    )

    if (isOversized) {
      this.metrics.oversizedCount++
      this.transitionTo('oversized', error || 'Map exceeds safety limit.')
      return
    }

    if (isMalformed || !map) {
      this.metrics.malformedCount++
      this.transitionTo('degraded', error || 'Malformed map data received.')
      return
    }

    this.metrics.receivedCount++
    this.metrics.lastUpdateAgeMs = 0
    this.latestMap = map

    // Verify in Topic Registry if verified_live criteria met
    const registry = useTopicRegistryStore.getState()
    const mapping = registry.mappings.occupancy_map
    if (mapping && mapping.assignedTopic === this.selectedTopic && mapping.verification !== 'verified_live') {
      if (map.metrics.knownCells > 100) {
        registry.recordLiveMessage(this.selectedTopic)
      }
    }

    this.transitionTo('live')

    // Notify consumers
    for (const consumerFn of this.activeConsumers.values()) {
      try {
        consumerFn(map)
      } catch {
        // Safe consumer execution
      }
    }

    this.notifyMetrics()
  }

  private startStallDetection(): void {
    if (this.stallCheckInterval) clearInterval(this.stallCheckInterval)
    this.stallCheckInterval = setInterval(() => {
      if (this.currentState !== 'live') return

      const now = Date.now()
      this.metrics.lastUpdateAgeMs = now - this.lastMapTimestamp
      if (now - this.lastMapTimestamp > STALL_TIMEOUT_MS) {
        this.transitionTo('stale', 'Map updates stalled (>15s since last grid frame).')
      }
      this.notifyMetrics()
    }, 1000)
  }

  private transitionTo(state: MapStreamState, error?: string | null): void {
    this.currentState = state
    this.currentError = error ?? null

    for (const sub of this.stateSubscribers) {
      try {
        sub(state, this.currentError)
      } catch {
        // Safe subscriber execution
      }
    }
  }

  public onStateChange(listener: (state: MapStreamState, error?: string | null) => void): () => void {
    this.stateSubscribers.add(listener)
    listener(this.currentState, this.currentError)
    return () => {
      this.stateSubscribers.delete(listener)
    }
  }

  public onMetrics(listener: (metrics: MapSummaryMetrics) => void): () => void {
    this.metricsSubscribers.add(listener)
    listener(this.metrics)
    return () => {
      this.metricsSubscribers.delete(listener)
    }
  }

  private notifyMetrics(): void {
    for (const sub of this.metricsSubscribers) {
      try {
        sub(this.metrics)
      } catch {
        // Safe subscriber execution
      }
    }
  }

  private clearTimers(): void {
    if (this.stallCheckInterval) {
      clearInterval(this.stallCheckInterval)
      this.stallCheckInterval = null
    }
  }

  private setupConnectionListener(): void {
    this.connectionUnsubscribe = useConnectionStore.subscribe((connState, prevState) => {
      if (connState.status !== 'connected' && prevState.status === 'connected') {
        this.clearTimers()
        mapService.unsubscribe()
        tfService.unsubscribeAll()
        poseService.stopPolling()
        this.transitionTo('link_down', 'Link to robot is down.')
      } else if (connState.status === 'connected' && prevState.status !== 'connected') {
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
        if (this.currentState === 'live' || this.currentState === 'waiting') {
          this.clearTimers()
          mapService.unsubscribe()
          tfService.unsubscribeAll()
          poseService.stopPolling()
          this.transitionTo('stopped', 'Paused while tab is hidden.')
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

  public async start(consumerId: string, topic: string, throttleRateMs = 1000): Promise<boolean> {
    const cleanTopic = topic.trim()
    const topicChanged = Boolean(this.selectedTopic && this.selectedTopic !== cleanTopic)
    this.selectedTopic = cleanTopic
    this.throttleRateMs = Math.max(1000, throttleRateMs)

    if (!this.activeConsumers.has(consumerId)) {
      this.attachConsumer(consumerId)
    }

    if (this.currentState !== 'live' && this.currentState !== 'waiting') {
      await this.startStream()
    } else if (topicChanged) {
      await this.restartStream()
    }
    return true
  }

  public stop(consumerId: string): void {
    this.detachConsumer(consumerId)
  }

  public getState(): MapStreamState {
    return this.currentState
  }

  public getError(): string | null {
    return this.currentError
  }

  public getCurrentMap(): DecodedOccupancyGrid | null {
    return this.latestMap
  }

  public getMetrics(): MapSummaryMetrics {
    return this.metrics
  }

  public getPose(): RobotPose2D | null {
    return poseService.getCurrentPose()
  }

  public getTrail(): PoseTrailPoint[] {
    return poseService.getTrail()
  }

  public subscribe(
    callback: (data: {
      map: DecodedOccupancyGrid | null
      state: MapStreamState
      metrics: MapSummaryMetrics
      pose: RobotPose2D | null
      trail: PoseTrailPoint[]
    }) => void,
  ): () => void {
    const notify = () => {
      callback({
        map: this.latestMap,
        state: this.currentState,
        metrics: this.metrics,
        pose: poseService.getCurrentPose(),
        trail: poseService.getTrail(),
      })
    }

    const stateUnsub = this.onStateChange(() => notify())
    const metricsUnsub = this.onMetrics(() => notify())
    const poseUnsub = poseService.subscribe(() => notify())
    const detach = this.attachConsumer(`_map_sub_${Math.random()}`, () => notify())

    return () => {
      stateUnsub()
      metricsUnsub()
      poseUnsub()
      detach()
    }
  }

  public destroy(): void {
    this.clearTimers()
    mapService.unsubscribe()
    tfService.unsubscribeAll()
    poseService.stopPolling()
    if (this.connectionUnsubscribe) {
      this.connectionUnsubscribe()
      this.connectionUnsubscribe = null
    }
    this.activeConsumers.clear()
    this.stateSubscribers.clear()
    this.metricsSubscribers.clear()
    this.currentState = 'stopped'
    this.latestMap = null
  }
}

export const mapManager = new MapManager()
