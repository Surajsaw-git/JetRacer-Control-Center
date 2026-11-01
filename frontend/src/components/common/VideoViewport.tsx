import { useRef, useState } from 'react'
import {
  Camera,
  Maximize,
  Minimize,
  VideoOff,
  Disc,
  Settings2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CameraSource } from '@/services/cameraSource'
import { cn } from '@/lib/utils'

export type VideoState = 'no_stream' | 'loading' | 'streaming' | 'error'

export interface VideoViewportProps {
  source?: CameraSource
  state?: VideoState
  fps?: number | null
  latencyMs?: number | null
  aspectRatio?: '16/9' | '4/3'
  className?: string
}

export function VideoViewport({
  source,
  state: manualState,
  fps = null,
  latencyMs = null,
  aspectRatio = '16/9',
  className,
}: VideoViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Determine current active state
  let effectiveState: VideoState = 'no_stream'
  if (manualState) {
    effectiveState = manualState
  } else if (source && source.isConnected && source.streamUrl) {
    effectiveState = 'streaming'
  }

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      await document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className={cn(
          'relative w-full rounded-lg overflow-hidden border border-border bg-black select-none shadow-inner',
          aspectRatio === '16/9' ? 'aspect-video' : 'aspect-[4/3]',
          className,
        )}
      >
        {/* Stream Canvas / Image Element Slot (Phase 5 will render MJPEG/WebRTC here) */}
        {effectiveState === 'streaming' && source?.streamUrl ? (
          <img
            src={source.streamUrl}
            alt="Live JetRacer Robot Camera Feed"
            className="w-full h-full object-cover"
          />
        ) : effectiveState === 'loading' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">Connecting video stream...</span>
          </div>
        ) : effectiveState === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-rose-500 gap-2 p-4 text-center">
            <AlertCircle className="h-8 w-8" />
            <span className="text-sm font-medium">Failed to acquire camera stream</span>
            <span className="text-xs text-muted-foreground">Check camera driver on Jetson</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 p-4 text-center">
            <VideoOff className="h-10 w-10 text-muted-foreground/60" />
            <span className="text-sm font-semibold text-foreground">No Video Stream</span>
            <span className="text-xs text-muted-foreground max-w-xs">
              Live camera feed is not connected. Camera streaming integration arrives in Phase 5.
            </span>
          </div>
        )}

        {/* Top HUD Overlay (telemetry metrics) */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-mono font-medium px-2 py-0.5 backdrop-blur bg-black/60 border-white/10 text-white',
              )}
            >
              {effectiveState === 'streaming' ? 'LIVE' : 'STANDBY'}
            </Badge>
            <span className="text-[11px] font-mono text-white/80 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-white/10">
              {fps !== null ? `${fps} FPS` : '-- FPS'}
            </span>
            <span className="text-[11px] font-mono text-white/80 bg-black/50 px-2 py-0.5 rounded backdrop-blur border border-white/10">
              {latencyMs !== null ? `${latencyMs} ms` : '-- ms'}
            </span>
          </div>

          <div className="pointer-events-auto">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleFullscreen}
              className="h-8 w-8 rounded-full bg-black/60 text-white hover:bg-black/80 hover:text-white border border-white/10 backdrop-blur min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px]"
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Bottom HUD Controls (Snapshot, Recording, Quality Selection) */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto z-10">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled
                    className="h-8 gap-1.5 text-xs bg-black/60 text-white/80 hover:bg-black/80 border border-white/10 backdrop-blur min-h-[44px] sm:min-h-[32px]"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Snapshot</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Snapshot capture arrives in Phase 5</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled
                    className="h-8 gap-1.5 text-xs bg-black/60 text-white/80 hover:bg-black/80 border border-white/10 backdrop-blur min-h-[44px] sm:min-h-[32px]"
                  >
                    <Disc className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Record</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Video recording arrives in Phase 5</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled
                    className="h-8 gap-1.5 text-xs bg-black/60 text-white/80 hover:bg-black/80 border border-white/10 backdrop-blur min-h-[44px] sm:min-h-[32px]"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">720p / Auto</span>
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Quality and resolution tuning arrives in Phase 5</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default VideoViewport
