/**
 * ROS Discovery Service
 *
 * Introspects active ROS topics, nodes, and services through the approved rosapi
 * allow-list. Features concurrency limits (max 4 concurrent requests), diffing,
 * auto-refresh with visibility pause, and manual topic fallback.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import { useRosDiscoveryStore, type DiscoveryInterval } from '@/store/rosDiscoveryStore'
import { useConnectionStore } from '@/store/connectionStore'

/**
 * Lightweight concurrency limiter for ROS service requests.
 */
class ConcurrencyLimiter {
  private activeCount = 0
  private queue: (() => void)[] = []

  constructor(private readonly maxConcurrent: number = 4) {}

  public async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    this.activeCount++
    try {
      return await fn()
    } finally {
      this.activeCount--
      if (this.queue.length > 0) {
        const next = this.queue.shift()
        if (next) next()
      }
    }
  }
}

export class RosDiscoveryService {
  private limiter = new ConcurrencyLimiter(4)
  private refreshTimer: ReturnType<typeof setInterval> | null = null
  private isRunningDiscovery = false

  constructor() {
    this.setupListeners()
  }

  /**
   * Primary entry point: execute a full discovery pass across topics, nodes, and services.
   */
  public async discoverAll(): Promise<boolean> {
    if (this.isRunningDiscovery) {
      return false
    }

    const connStatus = useConnectionStore.getState().status
    if (connStatus !== 'connected') {
      useRosDiscoveryStore.getState().setError('Not connected to robot rosbridge.')
      return false
    }

    this.isRunningDiscovery = true
    useRosDiscoveryStore.getState().setDiscovering(true)

    try {
      // Execute 3 core introspection queries within concurrency limit
      const [topicsResult, nodesResult, servicesResult] = await Promise.all([
        this.limiter.run(() => this.fetchTopics()),
        this.limiter.run(() => this.fetchNodes()),
        this.limiter.run(() => this.fetchServices()),
      ])

      useRosDiscoveryStore
        .getState()
        .applyDiscoveryResults(topicsResult, nodesResult, servicesResult)

      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useRosDiscoveryStore.getState().setError(`Discovery failed: ${msg}`)
      return false
    } finally {
      this.isRunningDiscovery = false
      useRosDiscoveryStore.getState().setDiscovering(false)
    }
  }

  /**
   * Fetches topics and types using /rosapi/topics_and_raw_types, falling back to /rosapi/topics.
   */
  private async fetchTopics(): Promise<{ topics: string[]; types: string[] }> {
    try {
      const res = await rosbridgeClient.callService<{
        topics: string[]
        types: string[]
      }>('/rosapi/topics_and_raw_types', 'rosapi/TopicsAndRawTypes', {})

      if (res && Array.isArray(res.topics)) {
        return {
          topics: res.topics,
          types: Array.isArray(res.types) ? res.types : [],
        }
      }
    } catch {
      // Fallback to /rosapi/topics if topics_and_raw_types is unsupported on older rosbridge
      const simple = await rosbridgeClient.callService<{ topics: string[] }>(
        '/rosapi/topics',
        'rosapi/Topics',
        {},
      )

      const topics = simple?.topics || []
      // Concurrently query types with concurrency limiter
      const types = await Promise.all(
        topics.map((t) =>
          this.limiter
            .run(() =>
              rosbridgeClient.callService<{ type: string }>(
                '/rosapi/topic_type',
                'rosapi/TopicType',
                { topic: t },
              ),
            )
            .then((res) => res?.type || 'unknown')
            .catch(() => 'unknown'),
        ),
      )

      return { topics, types }
    }

    return { topics: [], types: [] }
  }

  /**
   * Fetches active nodes via /rosapi/nodes.
   */
  private async fetchNodes(): Promise<string[]> {
    const res = await rosbridgeClient.callService<{ nodes: string[] }>(
      '/rosapi/nodes',
      'rosapi/Nodes',
      {},
    )
    return Array.isArray(res?.nodes) ? res.nodes : []
  }

  /**
   * Fetches registered services via /rosapi/services.
   */
  private async fetchServices(): Promise<string[]> {
    const res = await rosbridgeClient.callService<{ services: string[] }>(
      '/rosapi/services',
      'rosapi/Services',
      {},
    )
    return Array.isArray(res?.services) ? res.services : []
  }

  /**
   * On-demand lookup of publishers and subscribers for a specific topic.
   */
  public async fetchTopicDetails(topicName: string): Promise<void> {
    try {
      const [pubRes, subRes] = await Promise.all([
        this.limiter.run(() =>
          rosbridgeClient.callService<{ publishers: string[] }>(
            '/rosapi/publishers',
            'rosapi/Publishers',
            { topic: topicName },
          ),
        ),
        this.limiter.run(() =>
          rosbridgeClient.callService<{ subscribers: string[] }>(
            '/rosapi/subscribers',
            'rosapi/Subscribers',
            { topic: topicName },
          ),
        ),
      ])

      useRosDiscoveryStore
        .getState()
        .updateTopicDetails(
          topicName,
          pubRes?.publishers || [],
          subRes?.subscribers || [],
        )
    } catch {
      // Non-fatal on-demand detail failure
    }
  }

  /**
   * On-demand lookup of publications, subscriptions, and services for a specific node.
   */
  public async fetchNodeDetails(nodeName: string): Promise<void> {
    try {
      const res = await this.limiter.run(() =>
        rosbridgeClient.callService<{
          subscribing: string[]
          publishing: string[]
          services: string[]
        }>('/rosapi/node_details', 'rosapi/NodeDetails', { node: nodeName }),
      )

      useRosDiscoveryStore
        .getState()
        .updateNodeDetails(
          nodeName,
          res?.publishing || [],
          res?.subscribing || [],
          res?.services || [],
        )
    } catch {
      // Non-fatal on-demand detail failure
    }
  }

  /**
   * Sets auto-refresh interval with visibility pausing.
   */
  public setRefreshInterval(seconds: DiscoveryInterval): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }

    useRosDiscoveryStore.getState().setRefreshInterval(seconds)

    if (seconds > 0) {
      this.refreshTimer = setInterval(() => {
        if (
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible' &&
          useConnectionStore.getState().status === 'connected'
        ) {
          this.discoverAll().catch(() => {})
        }
      }, seconds * 1000)
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return

    // Trigger initial discovery on connection
    useConnectionStore.subscribe((state, prevState) => {
      if (state.status === 'connected' && prevState.status !== 'connected') {
        this.discoverAll().catch(() => {})
      } else if (state.status === 'disconnected') {
        if (this.refreshTimer) {
          clearInterval(this.refreshTimer)
          this.refreshTimer = null
        }
      }
    })
  }

  public destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer)
      this.refreshTimer = null
    }
  }
}

export const rosDiscoveryService = new RosDiscoveryService()
