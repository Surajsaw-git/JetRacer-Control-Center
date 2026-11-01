/**
 * Subscription Manager
 *
 * Provides controlled, rate-throttled, read-only topic subscriptions for topic inspection.
 * Enforces safety boundaries: maximum 5 active watches, heavy-type blocking, LaserScan summary
 * reduction, defensive value sanitization (NaN/Infinity guards), and sliding-window Hz measurement.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import {
  isHeavyMessageType,
  isRestrictedMessageType,
  MAX_WATCH_SUBSCRIPTIONS,
} from '@/services/rosPolicy'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'
import type { WatchedTopicData } from '@/types'

/**
 * Defensive sanitizer for incoming ROS payloads.
 * Strips unbounded arrays, replaces NaN/Infinity with safe representations, and truncates long strings.
 */
export function sanitizeRosPayload(val: unknown, depth = 0): unknown {
  if (depth > 5) return '[Truncated: Max Depth]'
  if (val === null || val === undefined) return val

  if (typeof val === 'number') {
    if (Number.isNaN(val)) return 'NaN'
    if (!Number.isFinite(val)) return val > 0 ? '+Infinity' : '-Infinity'
    return val
  }

  if (typeof val === 'string') {
    return val.length > 128 ? `${val.slice(0, 128)}... [truncated]` : val
  }

  if (typeof val === 'boolean') return val

  if (Array.isArray(val)) {
    if (val.length > 50) {
      return `[Array of ${val.length} items (omitted for UI safety)]`
    }
    return val.map((item) => sanitizeRosPayload(item, depth + 1))
  }

  if (typeof val === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      sanitized[k] = sanitizeRosPayload(v, depth + 1)
    }
    return sanitized
  }

  return String(val)
}

/**
 * Extracts summary statistics from LaserScan payloads without keeping full ranges array.
 */
function extractLaserScanStats(raw: Record<string, unknown>): {
  sanitizedPayload: unknown
  stats: WatchedTopicData['summaryStats']
} {
  const ranges = Array.isArray(raw.ranges) ? (raw.ranges as number[]) : []
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  let sum = 0
  let validCount = 0

  for (const r of ranges) {
    if (typeof r === 'number' && Number.isFinite(r) && !Number.isNaN(r) && r > 0) {
      if (r < min) min = r
      if (r > max) max = r
      sum += r
      validCount++
    }
  }

  const rangeMean = validCount > 0 ? Number((sum / validCount).toFixed(3)) : undefined
  const rangeMin = Number.isFinite(min) ? Number(min.toFixed(3)) : undefined
  const rangeMax = Number.isFinite(max) ? Number(max.toFixed(3)) : undefined

  const stats: WatchedTopicData['summaryStats'] = {
    rangesCount: ranges.length,
    rangeMin,
    rangeMax,
    rangeMean,
    angleMin: typeof raw.angle_min === 'number' ? Number(raw.angle_min.toFixed(3)) : undefined,
    angleMax: typeof raw.angle_max === 'number' ? Number(raw.angle_max.toFixed(3)) : undefined,
  }

  // Clone raw payload but replace large numeric arrays
  const sanitized = {
    ...raw,
    ranges: `[${ranges.length} points summary: min ${rangeMin ?? 'N/A'}m, max ${rangeMax ?? 'N/A'}m, mean ${rangeMean ?? 'N/A'}m]`,
    intensities: Array.isArray(raw.intensities)
      ? `[${raw.intensities.length} intensity readings]`
      : raw.intensities,
  }

  return { sanitizedPayload: sanitizeRosPayload(sanitized), stats }
}

export class SubscriptionManager {
  private activeSubscriptions = new Map<string, () => void>()
  private messageArrivalTimestamps = new Map<string, number[]>()
  private staleWatchdogTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.startStaleWatchdog()
  }

  /**
   * Starts watching a topic on demand.
   */
  public async startWatching(topic: string, messageType: string): Promise<boolean> {
    const cleanTopic = topic.trim()
    const cleanType = messageType.trim()

    // Enforce max watches limit
    if (this.activeSubscriptions.size >= MAX_WATCH_SUBSCRIPTIONS) {
      useSubscriptionStore
        .getState()
        .setTopicError(
          cleanTopic,
          `Cannot watch topic: maximum limit of ${MAX_WATCH_SUBSCRIPTIONS} concurrent watches reached. Stop an active watch first.`,
        )
      return false
    }

    // Heavy-type blocking
    if (isHeavyMessageType(cleanType)) {
      const errorMsg = cleanType.includes('Image')
        ? 'Direct image streaming disabled in Topic Watcher to preserve network. Camera stream will be enabled in Phase 5 via web_video_server.'
        : cleanType.includes('PointCloud')
          ? 'Point cloud subscription disabled in Topic Watcher to prevent WebSocket saturation.'
          : 'Occupancy grid subscription disabled in Topic Watcher to prevent mobile UI lag.'

      useSubscriptionStore.getState().addWatch(cleanTopic, cleanType)
      useSubscriptionStore.getState().setTopicError(cleanTopic, errorMsg)
      return false
    }

    // Clean previous watch on same topic if any
    this.stopWatching(cleanTopic)

    useSubscriptionStore.getState().addWatch(cleanTopic, cleanType)
    this.messageArrivalTimestamps.set(cleanTopic, [])

    const throttleRateMs = useSubscriptionStore.getState().throttleRateMs

    try {
      const unsubscribe = await rosbridgeClient.subscribeToTopic(
        cleanTopic,
        cleanType,
        (msg: unknown) => this.handleIncomingMessage(cleanTopic, cleanType, msg),
        throttleRateMs,
      )

      this.activeSubscriptions.set(cleanTopic, unsubscribe)
      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useSubscriptionStore.getState().setTopicError(cleanTopic, `Failed to subscribe: ${msg}`)
      return false
    }
  }

  /**
   * Stops watching a topic and releases subscriptions.
   */
  public stopWatching(topic: string): void {
    const cleanTopic = topic.trim()
    const unsubscribe = this.activeSubscriptions.get(cleanTopic)
    if (unsubscribe) {
      unsubscribe()
      this.activeSubscriptions.delete(cleanTopic)
    }
    this.messageArrivalTimestamps.delete(cleanTopic)
    useSubscriptionStore.getState().removeWatch(cleanTopic)
  }

  /**
   * Disconnects all active subscriptions.
   */
  public stopAll(): void {
    for (const unsubscribe of this.activeSubscriptions.values()) {
      try {
        unsubscribe()
      } catch {
        // Safe teardown
      }
    }
    this.activeSubscriptions.clear()
    this.messageArrivalTimestamps.clear()
    useSubscriptionStore.getState().clearAll()
  }

  /**
   * Processes each incoming message with rate calculation and sanitization.
   */
  private handleIncomingMessage(topic: string, type: string, rawMessage: unknown): void {
    const now = Date.now()

    // 1. Sliding window Hz calculation (over last 10 messages)
    let timestamps = this.messageArrivalTimestamps.get(topic)
    if (!timestamps) {
      timestamps = []
      this.messageArrivalTimestamps.set(topic, timestamps)
    }
    timestamps.push(now)
    if (timestamps.length > 10) timestamps.shift()

    let calculatedHz = 0
    if (timestamps.length >= 2) {
      const deltaSecs = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000
      if (deltaSecs > 0) {
        calculatedHz = Number(((timestamps.length - 1) / deltaSecs).toFixed(1))
      }
    }

    useSubscriptionStore.getState().setTopicHz(topic, calculatedHz)

    // 2. Decode payload & extract stats
    let sanitizedPayload: unknown
    let stats: WatchedTopicData['summaryStats']

    if (
      isRestrictedMessageType(type) &&
      rawMessage &&
      typeof rawMessage === 'object' &&
      'ranges' in rawMessage
    ) {
      const extracted = extractLaserScanStats(rawMessage as Record<string, unknown>)
      sanitizedPayload = extracted.sanitizedPayload
      stats = extracted.stats
    } else {
      sanitizedPayload = sanitizeRosPayload(rawMessage)
    }

    useSubscriptionStore.getState().updateTopicMessage(topic, sanitizedPayload, stats)

    // 3. Inform TopicRegistry of verified live incoming message
    useTopicRegistryStore.getState().recordLiveMessage(topic, calculatedHz)
  }

  /**
   * Periodic watchdog checking for stale watched topics (>2.5 seconds with no messages).
   */
  private startStaleWatchdog(): void {
    if (this.staleWatchdogTimer) return

    this.staleWatchdogTimer = setInterval(() => {
      const watched = useSubscriptionStore.getState().watchedTopics
      const now = Date.now()

      for (const [topic, data] of Object.entries(watched)) {
        if (data.messageCount > 0 && now - data.lastMessageTimestamp > 2500) {
          if (!data.isStale) {
            useSubscriptionStore.getState().setTopicStale(topic, true)
            useSubscriptionStore.getState().setTopicHz(topic, 0)
            useTopicRegistryStore.getState().recordStaleTopic(topic)
          }
        }
      }
    }, 1000)
  }

  public destroy(): void {
    this.stopAll()
    if (this.staleWatchdogTimer) {
      clearInterval(this.staleWatchdogTimer)
      this.staleWatchdogTimer = null
    }
  }
}

export const subscriptionManager = new SubscriptionManager()
