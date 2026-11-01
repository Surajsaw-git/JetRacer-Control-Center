/**
 * Video Viewport Component (Phase 5 Evolved)
 *
 * Canvas-based video renderer with 16:9 letterbox preservation,
 * ref-counted cameraManager integration, toggleable HUD overlay,
 * Fullscreen API + CSS pseudo-fullscreen fallback, Android back-button popstate,
 * Screen Wake Lock API, 3-second auto-hide controls, and client-side snapshot capture.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Maximize,
  Minimize,
  VideoOff,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cameraManager } from '@/services/camera/cameraManager'
import type {
  CameraFrameEvent,
  CameraMetrics,
  CameraStreamState,
} from '@/services/camera/cameraTypes'
import { useCameraStore } from '@/store/cameraStore'
import { cn } from '@/lib/utils'

export type VideoState =
  | 'idle'
  | 'no_stream'
  | 'loading'
  | 'connecting'
  | 'streaming'
  | 'stalled'
  | 'reconnecting'
  | 'error'
  | 'failed'
  | 'no_source'

export interface VideoViewportProps {
  consumerId?: string
  state?: VideoState
  fps?: number | null
  latencyMs?: number | null
  aspectRatio?: '16/9' | '4/3'
  className?: string
  onSnapshotTaken?: () => void
  showControls?: boolean
}

export function VideoViewport({
  consumerId = 'viewport',
  state: manualState,
  fps: manualFps = null,
  latencyMs: manualLatency = null,
  aspectRatio = '16/9',
  className,
  onSnapshotTaken,
  showControls = true,
}: VideoViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [streamState, setStreamState] = useState<CameraStreamState>(cameraManager.currentState)
  const [streamError, setStreamError] = useState<string | null>(cameraManager.currentError)
  const [metrics, setMetrics] = useState<CameraMetrics>(cameraManager.currentMetrics)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [isSnapshotting, setIsSnapshotting] = useState(false)

  const showHud = useCameraStore((s) => s.showHud)
  const toggleShowHud = useCameraStore((s) => s.toggleShowHud)
  const qualityPreset = useCameraStore((s) => s.qualityPreset)
  const sourceType = useCameraStore((s) => s.sourceType)

  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Map stream state to effective state
  const effectiveState: VideoState = manualState || streamState

  // Render incoming frame to canvas with letterbox aspect ratio preservation
  const renderFrameToCanvas = useCallback((frame: CameraFrameEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const sourceWidth = frame.bitmap?.width || frame.imageElement?.naturalWidth || 640
    const sourceHeight = frame.bitmap?.height || frame.imageElement?.naturalHeight || 480

    // Set internal canvas resolution to match source for pixel-perfect rendering
    if (canvas.width !== sourceWidth || canvas.height !== sourceHeight) {
      canvas.width = sourceWidth
      canvas.height = sourceHeight
    }

    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (frame.bitmap) {
      ctx.drawImage(frame.bitmap, 0, 0, canvas.width, canvas.height)
    } else if (frame.imageElement && frame.imageElement.complete) {
      ctx.drawImage(frame.imageElement, 0, 0, canvas.width, canvas.height)
    }
  }, [])

  // Ref-counted attachment to cameraManager
  useEffect(() => {
    const detach = cameraManager.attachConsumer(consumerId, (frame) => {
      requestAnimationFrame(() => renderFrameToCanvas(frame))
    })

    const unsubState = cameraManager.subscribeState((state, error) => {
      setStreamState(state)
      setStreamError(error || null)
    })

    const unsubMetrics = cameraManager.subscribeMetrics((m) => {
      setMetrics(m)
    })

    return () => {
      detach()
      unsubState()
      unsubMetrics()
    }
  }, [consumerId, renderFrameToCanvas])

  // Screen Wake Lock API management
  useEffect(() => {
    let released = false

    async function requestWakeLock() {
      if ('wakeLock' in navigator && isFullscreen && effectiveState === 'streaming') {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen')
          wakeLockRef.current.addEventListener('release', () => {
            if (!released) wakeLockRef.current = null
          })
        } catch {
          // Wake lock request failed or unsupported
        }
      }
    }

    if (isFullscreen && effectiveState === 'streaming') {
      requestWakeLock()
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }

    return () => {
      released = true
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {})
        wakeLockRef.current = null
      }
    }
  }, [isFullscreen, effectiveState])

  // Auto-hide controls timer (3 seconds of inactivity)
  const resetHideControlsTimer = useCallback(() => {
    setControlsVisible(true)
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current)
    }
    hideControlsTimerRef.current = setTimeout(() => {
      if (isFullscreen) {
        setControlsVisible(false)
      }
    }, 3000)
  }, [isFullscreen])

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        // Safe exit
      }
    }
    setIsFullscreen(false)
    setControlsVisible(true)
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current)
    }
  }, [])

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current
    if (!el) return

    // Push dummy state so mobile back button exits fullscreen
    window.history.pushState({ fullscreen: true }, '')

    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen()
      } catch {
        // Fallback to CSS pseudo-fullscreen
      }
    }
    setIsFullscreen(true)
    resetHideControlsTimer()
  }, [resetHideControlsTimer])

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen()
    } else {
      enterFullscreen()
    }
  }, [isFullscreen, exitFullscreen, enterFullscreen])

  // Android back-button popstate handling & Escape key handling
  useEffect(() => {
    const handlePopState = () => {
      if (isFullscreen) {
        exitFullscreen()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        exitFullscreen()
      } else if (e.key === 'f' || e.key === 'F') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          toggleFullscreen()
        }
      } else if (e.key === 'h' || e.key === 'H') {
        const target = e.target as HTMLElement
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          toggleShowHud()
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen, toggleShowHud, exitFullscreen, toggleFullscreen])

  const handleSnapshot = async () => {
    setIsSnapshotting(true)
    try {
      await cameraManager.captureSnapshot(canvasRef.current)
      onSnapshotTaken?.()
    } finally {
      setIsSnapshotting(false)
    }
  }

  const displayFps = manualFps !== null ? manualFps : metrics.fps
  const displayLatency = manualLatency !== null ? manualLatency : metrics.latencyMs

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        onMouseMove={resetHideControlsTimer}
        onTouchStart={resetHideControlsTimer}
        onDoubleClick={toggleFullscreen}
        className={cn(
          'relative w-full rounded-lg overflow-hidden border border-border bg-black select-none shadow-inner group',
          isFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen'
            : aspectRatio === '16/9'
              ? 'aspect-video'
              : 'aspect-[4/3]',
          className,
        )}
      >
        {/* HTML5 Canvas Stream Renderer */}
        <canvas
          ref={canvasRef}
          className={cn(
            'w-full h-full object-contain',
            effectiveState !== 'streaming' && 'hidden',
          )}
        />

        {/* State Overlays */}
        {effectiveState === 'connecting' || effectiveState === 'loading' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 bg-black/80 backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Connecting camera stream...</span>
          </div>
        ) : effectiveState === 'reconnecting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-amber-500 gap-2 bg-black/80 backdrop-blur-sm">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="text-sm font-medium">Reconnecting camera stream...</span>
            <span className="text-xs text-muted-foreground">Exponential backoff active</span>
          </div>
        ) : effectiveState === 'stalled' ? (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <Badge variant="destructive" className="bg-amber-600/90 text-white font-mono text-xs px-3 py-1 animate-pulse">
              Stream Stalled (waiting for frames...)
            </Badge>
          </div>
        ) : effectiveState === 'error' || effectiveState === 'failed' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 gap-2 p-4 text-center bg-black/90">
            <AlertCircle className="h-8 w-8" />
            <span className="text-sm font-semibold">Camera Stream Offline</span>
            <span className="text-xs text-muted-foreground max-w-md">
              {streamError || 'Failed to acquire video stream from robot.'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cameraManager.startStream()}
              className="mt-2 text-xs border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Retry Connection
            </Button>
          </div>
        ) : effectiveState === 'no_source' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
            <VideoOff className="h-10 w-10 text-muted-foreground/60" />
            <span className="text-sm font-semibold text-foreground">No Camera Topic Selected</span>
            <span className="text-xs text-muted-foreground max-w-xs">
              Select a discovered or manual camera topic to view live feed.
            </span>
          </div>
        ) : effectiveState === 'idle' || effectiveState === 'no_stream' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
            <VideoOff className="h-10 w-10 text-muted-foreground/60" />
            <span className="text-sm font-semibold text-foreground">Stream Inactive</span>
            <span className="text-xs text-muted-foreground max-w-xs">
              Camera stream is in standby. Press Start Stream to begin receiving video.
            </span>
            {showControls && (
              <Button
                variant="default"
                size="sm"
                onClick={() => cameraManager.startStream()}
                className="mt-2 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                Start Stream
              </Button>
            )}
          </div>
        ) : null}

        {/* Top HUD Overlay (telemetry metrics) */}
        {showHud && (
          <div
            className={cn(
              'absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10 transition-opacity duration-300',
              controlsVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-mono font-medium px-2 py-0.5 backdrop-blur bg-black/60 border-white/10 text-white',
                  effectiveState === 'streaming'
                    ? 'border-emerald-500/50 text-emerald-400'
                    : 'text-muted-foreground',
                )}
              >
                {effectiveState === 'streaming' ? 'LIVE' : effectiveState.toUpperCase()}
              </Badge>

              <Badge
                variant="outline"
                className="text-[10px] font-mono px-1.5 py-0.5 backdrop-blur bg-black/60 border-white/10 text-white/90"
              >
                {sourceType === 'web_video_server' ? 'HTTP MJPEG' : 'ROSBRIDGE'}
              </Badge>

              <span className="text-[10px] sm:text-[11px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10">
                {displayFps} FPS
              </span>

              {metrics.width > 0 && (
                <span className="text-[10px] sm:text-[11px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10 hidden sm:inline">
                  {metrics.width}x{metrics.height}
                </span>
              )}

              {metrics.bandwidthKbps > 0 && (
                <span className="text-[10px] sm:text-[11px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10 hidden md:inline">
                  {metrics.bandwidthKbps} kB/s
                </span>
              )}

              {metrics.droppedFrames > 0 && (
                <span className="text-[10px] sm:text-[11px] font-mono text-amber-400 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-amber-500/30">
                  Drops: {metrics.droppedFrames}
                </span>
              )}

              {displayLatency !== null && (
                <span className="text-[10px] sm:text-[11px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10">
                  {displayLatency} ms
                </span>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleShowHud}
                className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white border border-white/10 backdrop-blur"
                title="Toggle HUD Overlay (H)"
                aria-label="Toggle HUD Overlay"
              >
                {showHud ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white border border-white/10 backdrop-blur"
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Bottom Floating Controls (Snapshot, Fullscreen, Quality Indicator) */}
        {showControls && (
          <div
            className={cn(
              'absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-10 transition-opacity duration-300',
              controlsVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={effectiveState !== 'streaming' || isSnapshotting}
                    onClick={handleSnapshot}
                    className="h-8 gap-1.5 text-xs bg-black/60 text-white/90 hover:bg-black/80 border border-white/10 backdrop-blur"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Snapshot</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download client-side PNG snapshot</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-mono bg-black/60 text-white/80 border-white/10 backdrop-blur"
              >
                Preset: {qualityPreset.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default VideoViewport
