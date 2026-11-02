/**
 * JetRacer Control Center — LiDAR Transport Service (Phase 6)
 *
 * Interacts directly with rosbridgeClient under strict 'LidarService' caller identity.
 * Handles rate control and topic subscription lifecycle for sensor_msgs/LaserScan.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'

export class LidarService {
  private activeTopic: string = ''
  private throttleRateMs: number = 100
  private unsubscribeFn: (() => void) | null = null
  private isSubscribing: boolean = false

  public async subscribe(
    topic: string,
    onMessage: (message: unknown) => void,
    throttleRateMs: number = 100,
  ): Promise<boolean> {
    if (this.isSubscribing) return false
    this.isSubscribing = true

    this.unsubscribe()

    this.activeTopic = topic
    this.throttleRateMs = Math.max(50, throttleRateMs)

    try {
      this.unsubscribeFn = await rosbridgeClient.subscribeLaserScan(
        this.activeTopic,
        onMessage,
        this.throttleRateMs,
        'LidarService',
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
}

export const lidarService = new LidarService()
