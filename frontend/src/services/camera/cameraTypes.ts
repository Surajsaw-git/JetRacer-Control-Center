/**
 * Camera Subsystem Types & Interfaces (Phase 5)
 *
 * Defines source abstractions, stream metrics, quality presets, and frame events
 * for both web_video_server (HTTP MJPEG) and rosbridge (sensor_msgs/CompressedImage).
 */

export type CameraSourceType = 'web_video_server' | 'rosbridge_compressed' | 'none'

export type CameraQualityPreset = 'low' | 'medium' | 'high' | 'auto' | 'custom'

export interface CameraQualityConfig {
  preset: CameraQualityPreset
  width?: number
  height?: number
  fps: number
  quality: number // 1 to 100 JPEG quality
}

export const QUALITY_PRESETS: Record<
  'low' | 'medium' | 'high',
  { scale: number; width?: number; height?: number; fps: number; quality: number }
> = {
  low: { scale: 0.25, width: 160, height: 120, fps: 10, quality: 50 },
  medium: { scale: 0.5, width: 320, height: 240, fps: 15, quality: 70 },
  high: { scale: 1.0, fps: 20, quality: 85 }, // Native frame size (never requests upscale beyond measured native)
}

export type CameraStreamState =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'stalled'
  | 'reconnecting'
  | 'failed'
  | 'no_source'

export interface CameraMetrics {
  fps: number
  width: number
  height: number
  bandwidthKbps: number
  droppedFrames: number
  latencyMs: number | null
  lastFrameTimeMs: number
}

export interface CameraFrameEvent {
  bitmap?: ImageBitmap
  imageUrl?: string
  imageElement?: HTMLImageElement
  timestamp: number
  latencyMs?: number | null
}

export interface ICameraSource {
  readonly type: CameraSourceType
  readonly state: CameraStreamState
  start(topic: string, config: CameraQualityConfig): Promise<void>
  stop(): void
  updateConfig(config: Partial<CameraQualityConfig>): void
  onFrame(listener: (frame: CameraFrameEvent) => void): () => void
  onStateChange(listener: (state: CameraStreamState, error?: string) => void): () => void
  onMetrics(listener: (metrics: CameraMetrics) => void): () => void
  destroy(): void
}
