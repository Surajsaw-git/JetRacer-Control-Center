/**
 * JetRacer Control Center — High-Performance 2D Occupancy Grid Canvas (Phase 7A)
 *
 * Implements cached offscreen bitmap rendering for fast 60fps pan/zoom/pinch viewport navigation,
 * adaptive 1-2-5 metric scale bar and grid overlays, robot pose marker and heading arrow,
 * trail history, cursor inspection, "Fit to Map", "Center on Robot", and fullscreen controls.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crosshair,
  LocateFixed,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type {
  DecodedOccupancyGrid,
  MapDisplayConfig,
  PoseTrailPoint,
  RobotPose2D,
} from '@/services/map/mapTypes'
import { DEFAULT_MAP_CONFIG } from '@/services/map/mapTypes'
import { worldToMap } from '@/services/map/mapDecoder'
import { cn } from '@/lib/utils'

export interface MapCanvasProps {
  map: DecodedOccupancyGrid | null
  pose?: RobotPose2D | null
  trail?: PoseTrailPoint[]
  config?: MapDisplayConfig
  onConfigChange?: (patch: Partial<MapDisplayConfig>) => void
  className?: string
  height?: number | string
}

interface CursorInspection {
  xw: number
  yw: number
  col: number
  row: number
  val: number
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  map,
  pose = null,
  trail = [],
  config = DEFAULT_MAP_CONFIG,
  onConfigChange,
  className,
  height = '540px',
}) => {
  const safeConfig = config || DEFAULT_MAP_CONFIG
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Offscreen bitmap cache for the occupancy grid
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastRenderedMapIdRef = useRef<string>('')

  // Viewport transform: pixels per meter and pan offset (in screen pixels)
  const [scale, setScale] = useState<number>(30) // 30 px/meter (e.g. 10m room = 300px)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [cursorInspect, setCursorInspect] = useState<CursorInspection | null>(null)
  const [touchDistance, setTouchDistance] = useState<number | null>(null)

  // Follow robot watchdog
  useEffect(() => {
    if (!safeConfig.followRobot || !pose || !containerRef.current) return

    // Target screen offset so that robot's world position (x, y) is at canvas center:
    // screenX = cx + offset.x + pose.x * scale => offset.x = -pose.x * scale
    // screenY = cy + offset.y - pose.y * scale => offset.y = pose.y * scale
    setOffset({
      x: -pose.x * scale,
      y: pose.y * scale,
    })
  }, [pose, safeConfig.followRobot, scale])

  // Build / update offscreen bitmap whenever map or palette changes
  useEffect(() => {
    if (!map) {
      offscreenCanvasRef.current = null
      lastRenderedMapIdRef.current = ''
      return
    }

    const { width, height } = map.info
    const mapId = `${map.header.seq}_${width}x${height}_${safeConfig.colorPalette}`

    if (lastRenderedMapIdRef.current === mapId && offscreenCanvasRef.current) {
      return // Already cached
    }

    let offscreen = offscreenCanvasRef.current
    if (!offscreen) {
      offscreen = document.createElement('canvas')
      offscreenCanvasRef.current = offscreen
    }

    offscreen.width = width
    offscreen.height = height

    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    const imgData = ctx.createImageData ? ctx.createImageData(width, height) : null
    const buf = imgData?.data
    if (!buf || buf.length < width * height * 4) return

    const isProbMode = safeConfig.colorPalette === 'probability'

    // Write row-by-row: In ROS OccupancyGrid, row 0 is BOTTOM.
    // In Canvas image buffer, row 0 is TOP.
    // So canvas row `cy` corresponds to map row `(height - 1 - cy)`.
    for (let cy = 0; cy < height; cy++) {
      const my = height - 1 - cy
      const rowOffset = my * width

      for (let cx = 0; cx < width; cx++) {
        const cell = map.data[rowOffset + cx]
        const ptr = (cy * width + cx) * 4

        if (cell === -1) {
          // Unknown: neutral mid-gray
          buf[ptr] = 113
          buf[ptr + 1] = 113
          buf[ptr + 2] = 122
          buf[ptr + 3] = 255
        } else if (cell === 0) {
          // Free space: light off-white
          buf[ptr] = 244
          buf[ptr + 1] = 244
          buf[ptr + 2] = 245
          buf[ptr + 3] = 255
        } else if (cell === 100) {
          // Occupied obstacle: dark black/slate
          buf[ptr] = 9
          buf[ptr + 1] = 9
          buf[ptr + 2] = 11
          buf[ptr + 3] = 255
        } else {
          // Probability 1..99
          if (isProbMode) {
            // Gradient from free (white) to occupied (black)
            const shade = Math.round(255 - (cell / 100) * 240)
            buf[ptr] = shade
            buf[ptr + 1] = shade
            buf[ptr + 2] = shade
            buf[ptr + 3] = 255
          } else {
            // Standard trinary thresholding (ROS default occupied_thresh = 65)
            if (cell >= 65) {
              buf[ptr] = 9
              buf[ptr + 1] = 9
              buf[ptr + 2] = 11
            } else {
              buf[ptr] = 244
              buf[ptr + 1] = 244
              buf[ptr + 2] = 245
            }
            buf[ptr + 3] = 255
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0)
    lastRenderedMapIdRef.current = mapId
  }, [map, safeConfig.colorPalette])

  // Center on Robot button action
  const handleCenterOnRobot = useCallback(() => {
    if (!pose) return
    setOffset({
      x: -pose.x * scale,
      y: pose.y * scale,
    })
  }, [pose, scale])

  // Fit to Map bounding box
  const handleFitToMap = useCallback(() => {
    if (!map || !containerRef.current) {
      setOffset({ x: 0, y: 0 })
      setScale(30)
      return
    }

    const container = containerRef.current
    const cw = container.clientWidth
    const ch = container.clientHeight

    const mapWidthM = map.info.width * map.info.resolution
    const mapHeightM = map.info.height * map.info.resolution

    // Find scale that fits map with 20px padding
    const scaleX = (cw - 40) / Math.max(0.5, mapWidthM)
    const scaleY = (ch - 40) / Math.max(0.5, mapHeightM)
    const newScale = Math.max(5, Math.min(150, Math.min(scaleX, scaleY)))

    // Center of the map in world metric coordinates
    const mapCenterWorldX = map.info.origin.x + mapWidthM / 2
    const mapCenterWorldY = map.info.origin.y + mapHeightM / 2

    setScale(newScale)
    setOffset({
      x: -mapCenterWorldX * newScale,
      y: mapCenterWorldY * newScale,
    })
  }, [map])

  // Redraw Canvas loop
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return

      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const width = Math.floor(rect.width)
      const height = Math.floor(rect.height)

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      // Background fill
      ctx.fillStyle = '#18181b' // Zinc-900 dark background
      ctx.fillRect(0, 0, width, height)

      const cx = width / 2 + offset.x
      const cy = height / 2 + offset.y

      // 1. Draw Grid Lines (1-2-5 scale adaptive spacing)
      if (safeConfig.showGridLines) {
        drawGridLines(ctx, width, height, cx, cy, scale)
      }

      // 2. Draw Occupancy Grid Bitmap
      if (map && offscreenCanvasRef.current) {
        ctx.save()
        // World origin (0, 0) is at (cx, cy)
        // Map origin is at (map.info.origin.x, map.info.origin.y) with rotation origin.yawRad
        const mapOriginScreenX = cx + map.info.origin.x * scale
        const mapOriginScreenY = cy - map.info.origin.y * scale

        ctx.translate(mapOriginScreenX, mapOriginScreenY)
        ctx.rotate(-map.info.origin.yawRad)

        // Draw image: in world space, image extends from (0, 0) up to (width*res, height*res)
        // In screen space with Y pointing down, height extends in -Y direction:
        const mapWidthPx = map.info.width * map.info.resolution * scale
        const mapHeightPx = map.info.height * map.info.resolution * scale

        // Offscreen canvas has (0, 0) at top-left.
        // It should be drawn from Y = -mapHeightPx to 0
        ctx.drawImage(offscreenCanvasRef.current, 0, -mapHeightPx, mapWidthPx, mapHeightPx)
        ctx.restore()
      }

      // 3. Draw Path Trail
      if (trail && trail.length > 1) {
        ctx.save()
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)' // Blue-500 trail
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < trail.length; i++) {
          const pt = trail[i]
          const sx = cx + pt.x * scale
          const sy = cy - pt.y * scale
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.stroke()
        ctx.restore()
      }

      // 4. Draw Robot Marker
      if (safeConfig.showRobotPose && pose) {
        drawRobotMarker(ctx, cx, cy, pose, scale)
      }

      // 5. Draw Scale Bar (Bottom-Right)
      if (safeConfig.showScaleBar) {
        drawScaleBar(ctx, width, height, scale)
      }

      ctx.restore()
    }

    const animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [map, pose, trail, scale, offset, safeConfig])

  // Mouse interaction: Drag to pan, wheel to zoom
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      if (safeConfig.followRobot && onConfigChange) {
        onConfigChange({ followRobot: false })
      }
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
    }

    // Inspect point under cursor
    if (map && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const cx = rect.width / 2 + offset.x
      const cy = rect.height / 2 + offset.y

      // Invert screen to world:
      const xw = (mx - cx) / scale
      const yw = (cy - my) / scale

      const mapCoord = worldToMap(
        xw,
        yw,
        map.info.origin,
        map.info.resolution,
        map.info.width,
        map.info.height,
      )

      if (mapCoord.isInside && mapCoord.index >= 0) {
        setCursorInspect({
          xw,
          yw,
          col: mapCoord.col,
          row: mapCoord.row,
          val: map.data[mapCoord.index],
        })
      } else {
        setCursorInspect(null)
      }
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87
    const newScale = Math.max(5, Math.min(250, scale * zoomFactor))

    // Zoom centered on cursor
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const mouseX = e.clientX - rect.left - rect.width / 2
      const mouseY = e.clientY - rect.top - rect.height / 2

      setOffset((prev) => ({
        x: mouseX - (mouseX - prev.x) * (newScale / scale),
        y: mouseY - (mouseY - prev.y) * (newScale / scale),
      }))
    }

    setScale(newScale)
  }

  // Touch gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({ x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y })
    } else if (e.touches.length === 2) {
      setIsDragging(false)
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      setTouchDistance(dist)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      setOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      })
    } else if (e.touches.length === 2 && touchDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      )
      const factor = dist / touchDistance
      const newScale = Math.max(5, Math.min(250, scale * factor))
      setScale(newScale)
      setTouchDistance(dist)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setTouchDistance(null)
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 select-none',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : '',
        className,
      )}
      style={{ height: isFullscreen ? '100vh' : height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDragging(false)
        setCursorInspect(null)
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* TOP-LEFT OVERLAY: Inspection details & Follow badge */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none text-xs">
        {cursorInspect && (
          <div className="bg-zinc-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-zinc-700/60 font-mono text-zinc-300 shadow-md">
            <span>x: {cursorInspect.xw.toFixed(2)}m, y: {cursorInspect.yw.toFixed(2)}m</span>
            <span className="text-zinc-500 mx-1.5">|</span>
            <span>[{cursorInspect.col}, {cursorInspect.row}]</span>
            <span className="text-zinc-500 mx-1.5">|</span>
            <span className={cn(
              cursorInspect.val === 0 ? 'text-emerald-400 font-bold' :
              cursorInspect.val === 100 ? 'text-rose-400 font-bold' :
              'text-zinc-400'
            )}>
              {cursorInspect.val === -1 ? 'Unknown (-1)' :
               cursorInspect.val === 0 ? 'Free (0)' :
               cursorInspect.val === 100 ? 'Occupied (100)' :
               `Prob: ${cursorInspect.val}%`}
            </span>
          </div>
        )}

        {pose && (
          <div className="bg-zinc-900/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-zinc-700/50 font-mono text-[11px] text-zinc-300">
            <span>Robot: ({pose.x.toFixed(2)}m, {pose.y.toFixed(2)}m) θ: {pose.yawDeg.toFixed(1)}°</span>
            {pose.source === 'odometry_fallback' && (
              <span className="text-amber-400 ml-1.5">(Odom fallback)</span>
            )}
            {pose.isStale && (
              <span className="text-rose-400 ml-1.5">(Stale {Math.round(pose.ageMs / 1000)}s)</span>
            )}
          </div>
        )}
      </div>

      {/* TOP-RIGHT CONTROLS: Zoom, Fit, Center, Follow, Fullscreen */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-zinc-900/90 backdrop-blur-md p-1 rounded-lg border border-zinc-800 shadow-lg">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={() => setScale((s) => Math.min(250, s * 1.25))}
          title="Zoom In"
          aria-label="Zoom In"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={() => setScale((s) => Math.max(5, s * 0.8))}
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={handleFitToMap}
          title="Fit to Map"
          aria-label="Fit to Map"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant={safeConfig.followRobot ? 'default' : 'ghost'}
          size="icon"
          className={cn('h-8 w-8', safeConfig.followRobot ? 'bg-primary text-primary-foreground' : 'text-zinc-300 hover:text-white')}
          onClick={() => {
            if (onConfigChange) {
              onConfigChange({ followRobot: !safeConfig.followRobot })
            }
            if (!safeConfig.followRobot) {
              handleCenterOnRobot()
            }
          }}
          title={safeConfig.followRobot ? 'Following Robot' : 'Follow Robot'}
          aria-label="Follow Robot"
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={handleCenterOnRobot}
          disabled={!pose}
          title="Center on Robot"
          aria-label="Center on Robot"
        >
          <Crosshair className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          aria-label="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      {/* BOTTOM-LEFT: Palette Legend */}
      <div className="absolute bottom-3 left-3 bg-zinc-900/80 backdrop-blur-md px-2 py-1 rounded-md border border-zinc-800 text-[10px] text-zinc-400 flex items-center gap-3">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#f4f4f5]" /> Free (0)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#09090b] border border-zinc-600" /> Occupied (100)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#71717a]" /> Unknown (-1)
        </span>
      </div>
    </div>
  )
}

function drawGridLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cx: number,
  cy: number,
  scale: number,
): void {
  // Choose 1-2-5 spacing in meters so grid lines are ~40-100 pixels apart
  const targetPx = 60
  const idealStepM = targetPx / scale
  const magnitude = Math.pow(10, Math.floor(Math.log10(idealStepM)))
  const residual = idealStepM / magnitude

  let stepM: number
  if (residual < 1.5) stepM = 1 * magnitude
  else if (residual < 3.5) stepM = 2 * magnitude
  else if (residual < 7.5) stepM = 5 * magnitude
  else stepM = 10 * magnitude

  const stepPx = stepM * scale

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.lineWidth = 1

  const startX = (cx % stepPx) - stepPx
  for (let x = startX; x < width + stepPx; x += stepPx) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }

  const startY = (cy % stepPx) - stepPx
  for (let y = startY; y < height + stepPx; y += stepPx) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  // Draw Primary Coordinate Axes (X red, Y green) at (cx, cy)
  ctx.lineWidth = 1.5
  // +X Axis (East)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)' // Red
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + 40, cy)
  ctx.stroke()

  // +Y Axis (North in world, upward on screen)
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)' // Green
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy - 40)
  ctx.stroke()

  ctx.restore()
}

function drawRobotMarker(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  pose: RobotPose2D,
  scale: number,
): void {
  const sx = cx + pose.x * scale
  const sy = cy - pose.y * scale

  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(-pose.yawRad) // Negative for canvas screen rotation

  // Typical JetRacer chassis: ~0.25m long, 0.18m wide
  const lengthPx = Math.max(16, 0.25 * scale)
  const widthPx = Math.max(12, 0.18 * scale)

  const isOdomFallback = pose.source === 'odometry_fallback'

  ctx.fillStyle = isOdomFallback ? 'rgba(245, 158, 11, 0.25)' : 'rgba(59, 130, 246, 0.3)'
  ctx.strokeStyle = isOdomFallback ? '#f59e0b' : '#3b82f6'
  ctx.lineWidth = 2

  if (isOdomFallback) {
    ctx.setLineDash([4, 3])
  }

  // Chassis box
  ctx.beginPath()
  ctx.rect(-lengthPx / 2, -widthPx / 2, lengthPx, widthPx)
  ctx.fill()
  ctx.stroke()

  // Heading Triangle / Arrow on Front (+X points to right in local coordinate)
  ctx.setLineDash([])
  ctx.fillStyle = isOdomFallback ? '#f59e0b' : '#60a5fa'
  ctx.beginPath()
  ctx.moveTo(lengthPx / 2 + 6, 0)
  ctx.lineTo(lengthPx / 2 - 4, -widthPx / 3)
  ctx.lineTo(lengthPx / 2 - 4, widthPx / 3)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
): void {
  // Determine scale bar length (e.g. 1m, 2m, or 5m) so bar is ~60-120px wide
  const targetPx = 80
  const idealMeters = targetPx / scale
  const mag = Math.pow(10, Math.floor(Math.log10(idealMeters)))
  const res = idealMeters / mag

  let barMeters: number
  if (res < 1.5) barMeters = 1 * mag
  else if (res < 3.5) barMeters = 2 * mag
  else if (res < 7.5) barMeters = 5 * mag
  else barMeters = 10 * mag

  const barPx = barMeters * scale
  const bx = width - barPx - 20
  const by = height - 16

  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.lineWidth = 2

  // Scale line with end ticks
  ctx.beginPath()
  ctx.moveTo(bx, by - 4)
  ctx.lineTo(bx, by)
  ctx.lineTo(bx + barPx, by)
  ctx.lineTo(bx + barPx, by - 4)
  ctx.stroke()

  ctx.font = '10px monospace'
  ctx.textAlign = 'center'
  const label = barMeters >= 1 ? `${barMeters} m` : `${(barMeters * 100).toFixed(0)} cm`
  ctx.fillText(label, bx + barPx / 2, by - 6)
  ctx.restore()
}
