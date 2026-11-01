/**
 * WebVideoServerSource (HTTP MJPEG Streamer)
 *
 * Primary camera transport connecting to ROS web_video_server on port 8080.
 * Streams multipart/x-mixed-replace MJPEG natively using HTMLImageElement / ImageBitmap,
 * with stall detection (3000ms), exponential backoff reconnection, and real-time metrics.
 */

import type {
  CameraFrameEvent,
  CameraMetrics,
  CameraQualityConfig,
  CameraStreamState,
  ICameraSource,
} from './cameraTypes'
import { buildWebVideoUrl, checkMixedContent } from './cameraUrl'

const STALL_TIMEOUT_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 8
const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000]

export class WebVideoServerSource implements ICameraSource {
  public readonly type = 'web_video_server'
  public state: CameraStreamState = 'idle'

  private host: string = ''
  private port: number = 8080
  private topic: string = ''
  private config: CameraQualityConfig | null = null

  private imgElement: HTMLImageElement | null = null
  private frameListeners = new Set<(frame: CameraFrameEvent) => void>()
  private stateListeners = new Set<(state: CameraStreamState, error?: string) => void>()
  private metricsListeners = new Set<(metrics: CameraMetrics) => void>()

  private stallCheckInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0

  private lastFrameTimestamp = 0
  private frameCountInSecond = 0
  private currentFps = 0
  private fpsWindowStart = Date.now()
  private droppedFrames = 0
  private estimatedBandwidthKbps = 0

  constructor(host: string, port: number = 8080) {
    this.host = host
    this.port = port
  }

  public async start(topic: string, config: CameraQualityConfig): Promise<void> {
    this.topic = topic
    this.config = config
    this.reconnectAttempts = 0

    const { isMixedContent, warning } = checkMixedContent(this.host)
    if (isMixedContent) {
      this.transitionTo('failed', warning)
      return
    }

    this.connect()
  }

  private connect(): void {
    if (!this.topic || !this.config) return

    this.cleanupImage()
    this.transitionTo(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    let streamUrl: string
    try {
      streamUrl = buildWebVideoUrl(this.host, this.port, 'stream', this.topic, this.config)
    } catch (err) {
      this.transitionTo('failed', (err as Error).message)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    this.imgElement = img

    let isFirstLoad = true

    img.onload = () => {
      const now = Date.now()
      this.lastFrameTimestamp = now
      this.frameCountInSecond++

      if (isFirstLoad) {
        isFirstLoad = false
        this.reconnectAttempts = 0
        this.transitionTo('streaming')
      }

      // Calculate sliding FPS & bandwidth estimate
      if (now - this.fpsWindowStart >= 1000) {
        this.currentFps = this.frameCountInSecond
        this.frameCountInSecond = 0
        this.fpsWindowStart = now

        // Estimate bandwidth based on resolution and FPS
        const width = img.naturalWidth || this.config?.width || 640
        const height = img.naturalHeight || this.config?.height || 480
        const approxFrameSizeBytes = (width * height * (this.config?.quality ?? 70)) / 400
        this.estimatedBandwidthKbps = Math.round((approxFrameSizeBytes * 8 * this.currentFps) / 1000)

        this.notifyMetrics({
          fps: this.currentFps,
          width,
          height,
          bandwidthKbps: this.estimatedBandwidthKbps,
          droppedFrames: this.droppedFrames,
          latencyMs: null,
          lastFrameTimeMs: now,
        })
      }

      this.notifyFrame({
        imageElement: img,
        imageUrl: streamUrl,
        timestamp: now,
      })
    }

    img.onerror = () => {
      this.handleStreamError('Failed to load video stream from web_video_server.')
    }

    // Begin stall detection
    this.startStallDetection()

    // Kick off streaming
    img.src = streamUrl
  }

  private handleStreamError(errorMsg: string): void {
    this.cleanupImage()

    if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++
      const baseDelay =
        RECONNECT_DELAYS_MS[
          Math.min(this.reconnectAttempts - 1, RECONNECT_DELAYS_MS.length - 1)
        ]
      const jitter = Math.floor(Math.random() * 500)
      const delay = baseDelay + jitter

      this.transitionTo('reconnecting', `Connection dropped. Retrying (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms...`)
      this.reconnectTimer = setTimeout(() => this.connect(), delay)
    } else {
      this.transitionTo('failed', `${errorMsg} (Exceeded ${MAX_RECONNECT_ATTEMPTS} attempts)`)
    }
  }

  private startStallDetection(): void {
    if (this.stallCheckInterval) clearInterval(this.stallCheckInterval)

    this.stallCheckInterval = setInterval(() => {
      if (this.state !== 'streaming') return

      const now = Date.now()
      if (now - this.lastFrameTimestamp > STALL_TIMEOUT_MS) {
        this.droppedFrames++
        this.transitionTo('stalled', 'Stream stalled (no frames received for 3 seconds).')
        this.handleStreamError('Stream stalled.')
      }
    }, 1000)
  }

  public stop(): void {
    this.cleanup()
    this.transitionTo('idle')
  }

  public updateConfig(config: Partial<CameraQualityConfig>): void {
    if (!this.config) return
    this.config = { ...this.config, ...config }
    if (this.state === 'streaming' || this.state === 'connecting') {
      this.connect()
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

  private cleanupImage(): void {
    if (this.imgElement) {
      this.imgElement.onload = null
      this.imgElement.onerror = null
      this.imgElement.src = ''
      this.imgElement = null
    }
  }

  private cleanup(): void {
    this.cleanupImage()
    if (this.stallCheckInterval) {
      clearInterval(this.stallCheckInterval)
      this.stallCheckInterval = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.currentFps = 0
    this.frameCountInSecond = 0
  }
}
