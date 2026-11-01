/**
 * RosbridgeCompressedSource (Fallback WebSocket Transport)
 *
 * Implements fallback camera streaming over rosbridge by subscribing to
 * "sensor_msgs/CompressedImage" topics.
 *
 * Enforces:
 * - Read-only policy check with max 1 camera sub and >=100ms throttle.
 * - Latest-frame-wins drop policy to avoid UI lag.
 * - ImageBitmap memory lifecycle management (close() on previous bitmaps).
 * - Real-time FPS, bandwidth, and clock-adjusted latency calculations.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import type {
  CameraFrameEvent,
  CameraMetrics,
  CameraQualityConfig,
  CameraStreamState,
  ICameraSource,
} from './cameraTypes'

const STALL_TIMEOUT_MS = 3000

export class RosbridgeCompressedSource implements ICameraSource {
  public readonly type = 'rosbridge_compressed'
  public state: CameraStreamState = 'idle'

  private topic: string = ''
  private config: CameraQualityConfig | null = null
  private unsubscribeFn: (() => void) | null = null

  private frameListeners = new Set<(frame: CameraFrameEvent) => void>()
  private stateListeners = new Set<(state: CameraStreamState, error?: string) => void>()
  private metricsListeners = new Set<(metrics: CameraMetrics) => void>()

  private isDecoding = false
  private activeBitmap: ImageBitmap | null = null
  private lastFrameTimestamp = 0
  private frameCountInSecond = 0
  private bytesInSecond = 0
  private currentFps = 0
  private currentBandwidthKbps = 0
  private droppedFrames = 0
  private detectedWidth = 0
  private detectedHeight = 0
  private fpsWindowStart = Date.now()

  private stallTimer: ReturnType<typeof setInterval> | null = null

  public async start(topic: string, config: CameraQualityConfig): Promise<void> {
    this.topic = topic.endsWith('/compressed') ? topic : `${topic}/compressed`
    this.config = config

    this.transitionTo('connecting')

    try {
      const throttleMs = Math.max(100, Math.round(1000 / (config.fps || 10)))
      this.unsubscribeFn = await rosbridgeClient.subscribeCameraCompressed(
        this.topic,
        (msg) => this.handleIncomingMessage(msg),
        throttleMs,
        'RosbridgeCompressedSource',
      )

      this.transitionTo('streaming')
      this.startStallDetection()
    } catch (err) {
      this.transitionTo('failed', (err as Error).message)
    }
  }

  private handleIncomingMessage(rawMsg: unknown): void {
    if (!rawMsg || typeof rawMsg !== 'object') return

    const now = Date.now()
    this.lastFrameTimestamp = now
    this.frameCountInSecond++

    const msg = rawMsg as {
      header?: { stamp?: { secs?: number; nsecs?: number } }
      format?: string
      data?: string
    }

    if (!msg.data || typeof msg.data !== 'string') return

    const byteLength = Math.round(msg.data.length * 0.75)
    this.bytesInSecond += byteLength

    // Calculate clock-adjusted latency if timestamp is present
    let latencyMs: number | null = null
    if (msg.header?.stamp?.secs !== undefined && msg.header.stamp.secs > 0) {
      const stampMs = msg.header.stamp.secs * 1000 + (msg.header.stamp.nsecs || 0) / 1000000
      const diff = now - stampMs
      if (Math.abs(diff) < 60000) {
        latencyMs = Math.max(0, Math.round(diff))
      }
    }

    // Sliding window metrics
    if (now - this.fpsWindowStart >= 1000) {
      this.currentFps = this.frameCountInSecond
      this.currentBandwidthKbps = Math.round((this.bytesInSecond * 8) / 1000)
      this.frameCountInSecond = 0
      this.bytesInSecond = 0
      this.fpsWindowStart = now

      this.notifyMetrics({
        fps: this.currentFps,
        width: this.detectedWidth || 640,
        height: this.detectedHeight || 480,
        bandwidthKbps: this.currentBandwidthKbps,
        droppedFrames: this.droppedFrames,
        latencyMs,
        lastFrameTimeMs: now,
      })
    }

    // Latest-frame-wins drop policy: If currently decoding, drop this frame
    if (this.isDecoding) {
      this.droppedFrames++
      return
    }

    this.isDecoding = true

    // Decode base64 to binary buffer
    try {
      const binaryString = atob(msg.data)
      const len = binaryString.length
      const bytes = new Uint8Array(len)
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const mimeType = msg.format?.includes('png') ? 'image/png' : 'image/jpeg'
      const blob = new Blob([bytes], { type: mimeType })

      if (typeof createImageBitmap === 'function') {
        createImageBitmap(blob)
          .then((bitmap) => {
            this.isDecoding = false
            this.detectedWidth = bitmap.width
            this.detectedHeight = bitmap.height

            // Close old bitmap before replacing
            if (this.activeBitmap) {
              this.activeBitmap.close()
            }
            this.activeBitmap = bitmap

            this.notifyFrame({
              bitmap,
              timestamp: now,
              latencyMs,
            })
          })
          .catch(() => {
            this.isDecoding = false
            this.droppedFrames++
          })
      } else {
        // Fallback for non-createImageBitmap environments (e.g. node/test)
        this.isDecoding = false
        const url = URL.createObjectURL(blob)
        this.notifyFrame({
          imageUrl: url,
          timestamp: now,
          latencyMs,
        })
      }
    } catch {
      this.isDecoding = false
      this.droppedFrames++
    }
  }

  private startStallDetection(): void {
    if (this.stallTimer) clearInterval(this.stallTimer)

    this.stallTimer = setInterval(() => {
      if (this.state !== 'streaming') return

      const now = Date.now()
      if (this.lastFrameTimestamp > 0 && now - this.lastFrameTimestamp > STALL_TIMEOUT_MS) {
        this.transitionTo('stalled', 'Stream stalled (no frames received for 3 seconds).')
      }
    }, 1000)
  }

  public stop(): void {
    if (this.unsubscribeFn) {
      try {
        this.unsubscribeFn()
      } catch {
        // Safe unsubscribe
      }
      this.unsubscribeFn = null
    }

    if (this.stallTimer) {
      clearInterval(this.stallTimer)
      this.stallTimer = null
    }

    if (this.activeBitmap) {
      this.activeBitmap.close()
      this.activeBitmap = null
    }

    this.currentFps = 0
    this.frameCountInSecond = 0
    this.bytesInSecond = 0
    this.isDecoding = false
    this.transitionTo('idle')
  }

  public updateConfig(config: Partial<CameraQualityConfig>): void {
    if (!this.config) return
    this.config = { ...this.config, ...config }
    if (this.state === 'streaming') {
      // Re-apply subscription with new throttle rate
      this.stop()
      this.start(this.topic, this.config).catch(() => {})
    }
  }

  public onFrame(listener: (frame: CameraFrameEvent) => void): () => void {
    this.frameListeners.add(listener)
    return () => this.frameListeners.delete(listener)
  }

  public onStateChange(listener: (state: CameraStreamState, error?: string) => void): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  public onMetrics(listener: (metrics: CameraMetrics) => void): () => void {
    this.metricsListeners.add(listener)
    return () => this.metricsListeners.delete(listener)
  }

  public destroy(): void {
    this.stop()
    this.frameListeners.clear()
    this.stateListeners.clear()
    this.metricsListeners.clear()
  }

  private transitionTo(newState: CameraStreamState, errorMsg?: string): void {
    this.state = newState
    for (const listener of this.stateListeners) {
      listener(newState, errorMsg)
    }
  }

  private notifyFrame(frame: CameraFrameEvent): void {
    for (const listener of this.frameListeners) {
      listener(frame)
    }
  }

  private notifyMetrics(metrics: CameraMetrics): void {
    for (const listener of this.metricsListeners) {
      listener(metrics)
    }
  }
}
