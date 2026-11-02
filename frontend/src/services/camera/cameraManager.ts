/**
 * Camera Manager (Singleton Coordinator)
 *
 * Implements:
 * - Consumer ref-counting: Multiple views (Camera Page, Dashboard Card, Control Slot)
 *   share a single underlying stream. When ref count reaches 0, the stream is halted.
 * - Source abstraction: Switches between WebVideoServerSource and RosbridgeCompressedSource.
 * - Auto-quality adaptation: Dynamically scales quality based on frame rate and dropped frames.
 * - Client-side snapshot capture with timestamped downloads.
 */

import { useConnectionStore } from '@/store/connectionStore'
import {
  type CameraFrameEvent,
  type CameraMetrics,
  type CameraQualityConfig,
  type CameraQualityPreset,
  type CameraSourceType,
  type CameraStreamState,
  type ICameraSource,
  QUALITY_PRESETS,
} from './cameraTypes'
import { WebVideoServerSource } from './WebVideoServerSource'
import { RosbridgeCompressedSource } from './rosbridgeCompressedSource'

export class CameraManager {
  private activeSource: ICameraSource | null = null
  private sourceCleanupFns: (() => void)[] = []

  private activeConsumers = new Map<string, (frame: CameraFrameEvent) => void>()
  private stateSubscribers = new Set<
    (state: CameraStreamState, error?: string | null) => void
  >()
  private metricsSubscribers = new Set<(metrics: CameraMetrics) => void>()

  public currentState: CameraStreamState = 'idle'
  public currentError: string | null = null
  public currentMetrics: CameraMetrics = {
    fps: 0,
    width: 0,
    height: 0,
    bandwidthKbps: 0,
    droppedFrames: 0,
    latencyMs: null,
    lastFrameTimeMs: 0,
  }

  public selectedTopic: string = ''
  public sourceType: CameraSourceType = 'web_video_server'
  public webVideoPort: number = 8080
  public qualityConfig: CameraQualityConfig = {
    preset: 'medium',
    ...QUALITY_PRESETS.medium,
  }

  // Auto-quality controller state
  private autoDwellSeconds = 0
  private autoIntervalTimer: ReturnType<typeof setInterval> | null = null

  // Last received frame cache for snapshot capture
  public lastFrameEvent: CameraFrameEvent | null = null

  constructor() {
    this.startAutoQualityController()
  }

  public setSourceType(type: CameraSourceType): void {
    if (this.sourceType === type) return
    this.sourceType = type

    if (this.currentState === 'streaming' || this.currentState === 'connecting') {
      this.restartStream()
    }
  }

  public setSelectedTopic(topic: string): void {
    this.selectedTopic = topic
    if (this.currentState === 'streaming' || this.currentState === 'connecting') {
      this.restartStream()
    }
  }

  public setQualityPreset(preset: CameraQualityPreset, customConfig?: Partial<CameraQualityConfig>): void {
    if (preset === 'auto') {
      this.qualityConfig = {
        preset: 'auto',
        ...QUALITY_PRESETS.medium,
      }
    } else if (preset === 'custom' && customConfig) {
      // Never request more than measured native resolution or 20 fps
      const maxW = this.currentMetrics.width > 0 ? this.currentMetrics.width : 640
      const maxH = this.currentMetrics.height > 0 ? this.currentMetrics.height : 480
      const maxFps = this.currentMetrics.fps > 0 ? Math.min(20, Math.ceil(this.currentMetrics.fps)) : 20
      this.qualityConfig = {
        preset: 'custom',
        width: Math.min(customConfig.width ?? maxW, maxW),
        height: Math.min(customConfig.height ?? maxH, maxH),
        fps: Math.min(customConfig.fps ?? maxFps, maxFps),
        quality: customConfig.quality ?? 70,
      }
    } else if (preset in QUALITY_PRESETS) {
      const p = QUALITY_PRESETS[preset as 'low' | 'medium' | 'high']
      // For high (native scale 1.0): do not specify width/height so web_video_server provides native resolution without upscaling
      const w = p.scale === 1.0 ? undefined : (this.currentMetrics.width > 0 ? Math.round(this.currentMetrics.width * p.scale) : p.width)
      const h = p.scale === 1.0 ? undefined : (this.currentMetrics.height > 0 ? Math.round(this.currentMetrics.height * p.scale) : p.height)
      this.qualityConfig = {
        preset,
        width: w,
        height: h,
        fps: p.fps,
        quality: p.quality,
      }
    }

    if (this.activeSource) {
      this.activeSource.updateConfig(this.qualityConfig)
    }
  }

  /**
   * Ref-counting attach: Registers an active consumer component.
   * If ref-count increases from 0, the stream becomes active if a topic is set.
   */
  public attachConsumer(
    consumerId: string,
    onFrame?: (frame: CameraFrameEvent) => void,
  ): () => void {
    if (onFrame) {
      this.activeConsumers.set(consumerId, onFrame)
    } else {
      this.activeConsumers.set(consumerId, () => {})
    }

    return () => {
      this.detachConsumer(consumerId)
    }
  }

  /**
   * Ref-counting detach: Unregisters a consumer component.
   * If consumers drop to 0, halts active camera streaming to conserve resources.
   */
  public detachConsumer(consumerId: string): void {
    this.activeConsumers.delete(consumerId)

    if (this.activeConsumers.size === 0 && this.currentState !== 'idle') {
      this.stopStream()
    }
  }

  public getConsumerCount(): number {
    return this.activeConsumers.size
  }

  public async startStream(topicOverride?: string): Promise<void> {
    const topic = topicOverride || this.selectedTopic
    if (!topic) {
      this.transitionTo('no_source', 'No camera topic selected.')
      return
    }
    this.selectedTopic = topic

    const connectionStore = useConnectionStore.getState()
    const robotHost = connectionStore.host || '127.0.0.1'

    this.teardownActiveSource()

    if (this.sourceType === 'web_video_server') {
      this.activeSource = new WebVideoServerSource(robotHost, this.webVideoPort)
    } else if (this.sourceType === 'rosbridge_compressed') {
      this.activeSource = new RosbridgeCompressedSource()
    } else {
      this.transitionTo('no_source')
      return
    }

    // Attach listeners
    this.sourceCleanupFns.push(
      this.activeSource.onFrame((frame) => {
        this.lastFrameEvent = frame
        for (const consumer of this.activeConsumers.values()) {
          consumer(frame)
        }
      }),
      this.activeSource.onStateChange((state, error) => {
        this.transitionTo(state, error)
      }),
      this.activeSource.onMetrics((metrics) => {
        this.currentMetrics = metrics
        for (const sub of this.metricsSubscribers) {
          sub(metrics)
        }
      }),
    )

    try {
      await this.activeSource.start(this.selectedTopic, this.qualityConfig)
    } catch (err) {
      this.transitionTo('failed', (err as Error).message)
    }
  }

  public stopStream(): void {
    this.teardownActiveSource()
    this.lastFrameEvent = null
    this.currentMetrics = {
      fps: 0,
      width: 0,
      height: 0,
      bandwidthKbps: 0,
      droppedFrames: 0,
      latencyMs: null,
      lastFrameTimeMs: 0,
    }
    this.transitionTo('idle')
  }

  private async restartStream(): Promise<void> {
    if (!this.selectedTopic) return
    await this.startStream(this.selectedTopic)
  }

  private teardownActiveSource(): void {
    for (const cleanup of this.sourceCleanupFns) {
      cleanup()
    }
    this.sourceCleanupFns = []

    if (this.activeSource) {
      this.activeSource.destroy()
      this.activeSource = null
    }
  }

  public subscribeState(
    cb: (state: CameraStreamState, error?: string | null) => void,
  ): () => void {
    this.stateSubscribers.add(cb)
    cb(this.currentState, this.currentError)
    return () => this.stateSubscribers.delete(cb)
  }

  public subscribeMetrics(cb: (metrics: CameraMetrics) => void): () => void {
    this.metricsSubscribers.add(cb)
    cb(this.currentMetrics)
    return () => this.metricsSubscribers.delete(cb)
  }

  private transitionTo(newState: CameraStreamState, error?: string | null): void {
    this.currentState = newState
    this.currentError = error ?? null
    for (const sub of this.stateSubscribers) {
      sub(newState, this.currentError)
    }
  }

  /**
   * Captures the current frame from active stream or canvas and downloads as a PNG.
   */
  public async captureSnapshot(canvasElement?: HTMLCanvasElement | null): Promise<Blob | null> {
    let blob: Blob | null = null

    if (canvasElement) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvasElement.toBlob(resolve, 'image/png'),
      )
    } else if (this.lastFrameEvent?.bitmap) {
      const offscreen = document.createElement('canvas')
      offscreen.width = this.lastFrameEvent.bitmap.width
      offscreen.height = this.lastFrameEvent.bitmap.height
      const ctx = offscreen.getContext('2d')
      if (ctx) {
        ctx.drawImage(this.lastFrameEvent.bitmap, 0, 0)
        blob = await new Promise<Blob | null>((resolve) => offscreen.toBlob(resolve, 'image/png'))
      }
    }

    if (blob) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '-')
        .replace(/\..+/, '')
      const fileName = `jetracer-snap-${timestamp}.png`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }

    return blob
  }

  /**
   * Auto-quality controller with hysteresis and dwell time.
   */
  private startAutoQualityController(): void {
    if (this.autoIntervalTimer) clearInterval(this.autoIntervalTimer)

    this.autoIntervalTimer = setInterval(() => {
      if (this.qualityConfig.preset !== 'auto' || this.currentState !== 'streaming') {
        this.autoDwellSeconds = 0
        return
      }

      const { fps, droppedFrames } = this.currentMetrics
      const targetFps = this.qualityConfig.fps || 20

      // If dropped frames occur or frame rate drops under half target -> step down immediately
      if (droppedFrames > 3 || (fps > 0 && fps < targetFps * 0.5)) {
        this.autoDwellSeconds = 0
        if (this.qualityConfig.quality > QUALITY_PRESETS.medium.quality) {
          this.applyAutoStep('medium')
        } else if (this.qualityConfig.quality > QUALITY_PRESETS.low.quality) {
          this.applyAutoStep('low')
        }
      } else if (fps >= targetFps * 0.85 && droppedFrames === 0) {
        // Increment stable dwell time (every 2s interval)
        this.autoDwellSeconds += 2
        // Require 10 seconds of flawless streaming before stepping up
        if (this.autoDwellSeconds >= 10) {
          this.autoDwellSeconds = 0
          if (this.qualityConfig.quality < QUALITY_PRESETS.medium.quality) {
            this.applyAutoStep('medium')
          } else if (this.qualityConfig.quality < QUALITY_PRESETS.high.quality) {
            this.applyAutoStep('high')
          }
        }
      }
    }, 2000)
  }

  private applyAutoStep(level: 'low' | 'medium' | 'high'): void {
    const p = QUALITY_PRESETS[level]
    const w = p.scale === 1.0 ? undefined : (this.currentMetrics.width > 0 ? Math.round(this.currentMetrics.width * p.scale) : p.width)
    const h = p.scale === 1.0 ? undefined : (this.currentMetrics.height > 0 ? Math.round(this.currentMetrics.height * p.scale) : p.height)
    this.qualityConfig = {
      preset: 'auto',
      width: w,
      height: h,
      fps: p.fps,
      quality: p.quality,
    }
    if (this.activeSource) {
      this.activeSource.updateConfig(this.qualityConfig)
    }
  }

  public destroy(): void {
    if (this.autoIntervalTimer) {
      clearInterval(this.autoIntervalTimer)
      this.autoIntervalTimer = null
    }
    this.stopStream()
    this.activeConsumers.clear()
    this.stateSubscribers.clear()
    this.metricsSubscribers.clear()
  }
}

export const cameraManager = new CameraManager()
