/**
 * JetRacer Control Center — Coordinate Transform Service (Phase 7A)
 *
 * Subscribes to ROS coordinate transform topics (/tf and /tf_static) under 'TfService' identity,
 * enforces client-side processing rate caps (max 50 Hz) to prevent main thread event loop saturation,
 * and maintains the active coordinate transform graph in TfBuffer.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import { MAX_TF_RATE_HZ } from '@/services/rosPolicy'
import { tfBuffer, type TransformStamped } from './tfBuffer'

export interface RawTfMessage {
  transforms?: TransformStamped[]
}

export class TfService {
  private activeSubscriptions = new Map<string, () => void>()
  private frameListeners = new Set<(frames: string[]) => void>()
  private knownFrames = new Set<string>()

  // Rate-limiting and drop statistics
  private lastProcessTime = 0
  private minIntervalMs = 1000 / MAX_TF_RATE_HZ
  public processedCount = 0
  public droppedCount = 0

  /**
   * Subscribes to a TF topic (/tf or /tf_static).
   */
  public async subscribeTopic(topicName: string, isStatic = false): Promise<boolean> {
    const cleanName = topicName.trim()
    if (!cleanName || this.activeSubscriptions.has(cleanName)) return true

    try {
      const unsub = await rosbridgeClient.subscribeTf(
        cleanName,
        (rawMsg) => this.handleTfMessage(rawMsg, isStatic),
        'TfService',
      )

      this.activeSubscriptions.set(cleanName, unsub)
      return true
    } catch (err) {
      console.warn(`[TfService] Failed to subscribe to "${cleanName}":`, err)
      return false
    }
  }

  public unsubscribeTopic(topicName: string): void {
    const cleanName = topicName.trim()
    const unsub = this.activeSubscriptions.get(cleanName)
    if (unsub) {
      unsub()
      this.activeSubscriptions.delete(cleanName)
    }
  }

  public unsubscribeAll(): void {
    for (const unsub of this.activeSubscriptions.values()) {
      try {
        unsub()
      } catch {
        // Safe cleanup
      }
    }
    this.activeSubscriptions.clear()
  }

  public isSubscribed(topicName: string): boolean {
    return this.activeSubscriptions.has(topicName.trim())
  }

  public getActiveCount(): number {
    return this.activeSubscriptions.size
  }

  private handleTfMessage(rawMsg: unknown, isStatic: boolean): void {
    const now = Date.now()

    // Dynamic transforms: throttle processing if arriving faster than MAX_TF_RATE_HZ
    if (!isStatic) {
      if (now - this.lastProcessTime < this.minIntervalMs) {
        this.droppedCount++
        return
      }
    }

    this.lastProcessTime = now
    this.processedCount++

    if (!rawMsg || typeof rawMsg !== 'object') return
    const msg = rawMsg as RawTfMessage
    if (!Array.isArray(msg.transforms)) return

    let discoveredNewFrame = false

    for (const tf of msg.transforms) {
      if (tf && tf.header?.frame_id && tf.child_frame_id) {
        const parent = tfBuffer.cleanFrame(tf.header.frame_id)
        const child = tfBuffer.cleanFrame(tf.child_frame_id)

        if (!this.knownFrames.has(parent)) {
          this.knownFrames.add(parent)
          discoveredNewFrame = true
        }
        if (!this.knownFrames.has(child)) {
          this.knownFrames.add(child)
          discoveredNewFrame = true
        }

        tfBuffer.setTransform(tf, isStatic)
      }
    }

    if (discoveredNewFrame) {
      this.notifyFrameListeners()
    }
  }

  public onFramesChanged(listener: (frames: string[]) => void): () => void {
    this.frameListeners.add(listener)
    listener(Array.from(this.knownFrames).sort())
    return () => {
      this.frameListeners.delete(listener)
    }
  }

  private notifyFrameListeners(): void {
    const frameList = Array.from(this.knownFrames).sort()
    for (const listener of this.frameListeners) {
      try {
        listener(frameList)
      } catch {
        // Ignore listener error
      }
    }
  }

  public getKnownFrames(): string[] {
    return Array.from(this.knownFrames).sort()
  }

  public clear(): void {
    this.unsubscribeAll()
    tfBuffer.clear()
    this.knownFrames.clear()
    this.processedCount = 0
    this.droppedCount = 0
    this.notifyFrameListeners()
  }
}

export const tfService = new TfService()
