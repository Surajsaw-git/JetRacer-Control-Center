/**
 * JetRacer Control Center — Map Transport Service (Phase 7A)
 *
 * Interacts directly with rosbridgeClient under strict 'MapService' caller identity.
 * Handles rate control and topic subscription lifecycle for nav_msgs/OccupancyGrid,
 * and executes read-only snapshot queries via nav_msgs/GetMap.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import { MIN_MAP_THROTTLE_MS } from '@/services/rosPolicy'
import type { RawOccupancyGridMessage } from './mapTypes'

export class MapService {
  private activeTopic: string = ''
  private throttleRateMs: number = 1000
  private unsubscribeFn: (() => void) | null = null
  private isSubscribing: boolean = false

  public async subscribe(
    topic: string,
    onMessage: (message: unknown) => void,
    throttleRateMs: number = 1000,
  ): Promise<boolean> {
    if (this.isSubscribing) return false
    this.isSubscribing = true

    this.unsubscribe()

    this.activeTopic = topic
    this.throttleRateMs = Math.max(MIN_MAP_THROTTLE_MS, throttleRateMs)

    try {
      this.unsubscribeFn = await rosbridgeClient.subscribeOccupancyGrid(
        this.activeTopic,
        onMessage,
        this.throttleRateMs,
        'MapService',
      )
      this.isSubscribing = false
      return true
    } catch (err) {
      this.isSubscribing = false
      this.unsubscribeFn = null
      throw err
    }
  }

  public unsubscribe(): void {
    if (this.unsubscribeFn) {
      try {
        this.unsubscribeFn()
      } catch {
        // Safe cleanup
      }
      this.unsubscribeFn = null
    }
    this.activeTopic = ''
  }

  public isSubscribed(): boolean {
    return this.unsubscribeFn !== null
  }

  public getActiveTopic(): string {
    return this.activeTopic
  }

  public getThrottleRate(): number {
    return this.throttleRateMs
  }

  /**
   * Fetches a one-time map snapshot via nav_msgs/GetMap service.
   */
  public async fetchSnapshot(serviceName: string): Promise<RawOccupancyGridMessage> {
    const res = await rosbridgeClient.callGetMapService<{ map?: RawOccupancyGridMessage } | RawOccupancyGridMessage>(
      serviceName,
      'MapService',
      8000,
    )
    if (res && 'map' in res && res.map) {
      return res.map
    }
    return res as RawOccupancyGridMessage
  }
}

export const mapService = new MapService()
