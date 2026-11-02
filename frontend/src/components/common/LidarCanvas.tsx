import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Sliders,
  Eye,
  Info,
  Compass,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DecodedScan, LidarDisplayConfig } from '@/services/lidar/lidarTypes'
import { DEFAULT_LIDAR_CONFIG, RayClassification } from '@/services/lidar/lidarTypes'
import {
  polarToCartesian,
  computeBoundingBox,
  degToRad,
  radToDeg,
} from '@/services/lidar/scanGeometry'
import { cn } from '@/lib/utils'

export interface LidarCanvasProps {
  scan: DecodedScan | null
  config?: LidarDisplayConfig
  onConfigChange?: (patch: Partial<LidarDisplayConfig>) => void
  paused?: boolean
  className?: string
  height?: number | string
}

interface PointInspection {
  x: number
  y: number
  range: number
  angleRad: number
  angleDeg: number
  intensity: number
  classification: RayClassification
}

export const LidarCanvas: React.FC<LidarCanvasProps> = ({
  scan,
  config = DEFAULT_LIDAR_CONFIG,
  onConfigChange,
  paused = false,
  className,
  height = '500px',
}) => {
  const safeConfig = config || DEFAULT_LIDAR_CONFIG
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Viewport transformation: center offset (px) and zoom (pixels per meter)
  const [scale, setScale] = useState<number>(60) // default 60 px/meter (e.g. 5m fits ~300px radius)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [inspectPoint, setInspectPoint] = useState<PointInspection | null>(null)
  const [touchDistance, setTouchDistance] = useState<number | null>(null)

  // Keep a small history trail buffer for persistence if decayTrail > 0
  const scanTrailRef = useRef<DecodedScan[]>([])
  const decayCount = safeConfig.decayTrail ?? safeConfig.ghostTrailCount ?? 0

  useEffect(() => {
    if (!scan || paused) return
    if (decayCount > 0) {
      scanTrailRef.current.push(scan)
      if (scanTrailRef.current.length > decayCount + 1) {
        scanTrailRef.current.shift()
      }
    } else {
      scanTrailRef.current = []
    }
  }, [scan, paused, decayCount])

  // Reset view to default centering and auto-fit to scan or 6m range
  const handleResetView = useCallback(() => {
    setOffset({ x: 0, y: 0 })
    if (scan && scan.rangeMax > 0) {
      const targetRange = Math.min(Math.max(scan.rangeMax * 0.8, 3.0), 12.0)
      if (containerRef.current) {
        const minDim = Math.min(containerRef.current.clientWidth, containerRef.current.clientHeight)
        setScale(Math.max(20, Math.floor((minDim / 2 - 40) / targetRange)))
      } else {
        setScale(60)
      }
    } else {
      setScale(60)
    }
  }, [scan])

  // Auto-fit to current scan bounds
  const handleFitBounds = useCallback(() => {
    if (!scan || (scan.validPointsCount ?? scan.validCount ?? 0) === 0 || !containerRef.current) return
    const bbox = computeBoundingBox(scan, safeConfig)
    const spanX = Math.max(bbox.maxX - bbox.minX, 1.0)
    const spanY = Math.max(bbox.maxY - bbox.minY, 1.0)
    const maxSpan = Math.max(spanX, spanY)
    const minDim = Math.min(containerRef.current.clientWidth, containerRef.current.clientHeight)
    const targetScale = Math.min(Math.max((minDim - 80) / maxSpan, 15), 300)
    setScale(targetScale)
    const centerX = (bbox.minX + bbox.maxX) / 2
    const centerY = (bbox.minY + bbox.maxY) / 2
    // ROS +X forward (up in canvas), +Y left (left in canvas)
    setOffset({
      x: centerX * targetScale,
      y: -centerY * targetScale,
    })
  }, [scan, safeConfig])

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(prev * (1 + delta), 15), 500))
  }

  // Pointer interactions for Pan and Zoom
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      })
      return
    }

    // Hit-testing for point inspection
    if (!scan || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mouseCanvasX = e.clientX - rect.left
    const mouseCanvasY = e.clientY - rect.top

    const centerX = rect.width / 2 + offset.x
    const centerY = rect.height / 2 + offset.y

    // Convert mouse to world meters
    // Screen X = centerX - worldY * scale (since ROS +Y is left)
    // Screen Y = centerY - worldX * scale (since ROS +X is up)
    let closestDistSq = Infinity
    let foundIdx = -1

    const numPoints = scan.ranges.length
    for (let i = 0; i < numPoints; i++) {
      if (scan.classifications[i] !== RayClassification.VALID) continue
      const r = scan.ranges[i]
      const angle = scan.angleMin + i * scan.angleIncrement
      const { x, y } = polarToCartesian(r, angle, safeConfig)
      const screenX = centerX - y * scale
      const screenY = centerY - x * scale
      const dSq = (screenX - mouseCanvasX) ** 2 + (screenY - mouseCanvasY) ** 2
      if (dSq < closestDistSq && dSq < 225) {
        // 15px threshold
        closestDistSq = dSq
        foundIdx = i
      }
    }

    if (foundIdx >= 0) {
      const r = scan.ranges[foundIdx]
      const angle = scan.angleMin + foundIdx * scan.angleIncrement
      const { x, y } = polarToCartesian(r, angle, safeConfig)
      setInspectPoint({
        x,
        y,
        range: r,
        angleRad: angle,
        angleDeg: radToDeg(angle),
        intensity: scan.intensities && scan.intensities.length > foundIdx ? scan.intensities[foundIdx] : 0,
        classification: scan.classifications[foundIdx],
      })
    } else {
      setInspectPoint(null)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15
    handleZoom(zoomFactor)
  }

  // Touch interactions
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true)
      setDragStart({
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      })
      setTouchDistance(null)
    } else if (e.touches.length === 2) {
      setIsDragging(false)
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      setTouchDistance(dist)
    }
  }

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging) {
      setOffset({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      })
    } else if (e.touches.length === 2 && touchDistance !== null) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      const diff = newDist - touchDistance
      if (Math.abs(diff) > 2) {
        handleZoom(diff * 0.005)
        setTouchDistance(newDist)
      }
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
    setTouchDistance(null)
  }

  // Main rendering loop via requestAnimationFrame
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      // Background
      ctx.fillStyle = '#090d16'
      ctx.fillRect(0, 0, width, height)

      const originX = width / 2 + offset.x
      const originY = height / 2 + offset.y

      // 1. Draw Polar Grid & Range Rings
      if (safeConfig.showGrid ?? safeConfig.showRangeRings ?? true) {
        drawPolarGrid(ctx, originX, originY, width, height, scale)
      }

      // 2. Draw Proximity Zones (Visual aid only)
      if (safeConfig.showProximityZones ?? true) {
        drawProximityBands(ctx, originX, originY, scale, safeConfig)
      }

      // 3. Draw Robot Footprint Marker
      if (safeConfig.showRobotFootprint ?? true) {
        drawRobotFootprint(ctx, originX, originY, scale)
      }

      // 4. Draw Historical Decay Trail (if enabled)
      if (decayCount > 0 && scanTrailRef.current.length > 0) {
        const trailLength = scanTrailRef.current.length
        scanTrailRef.current.forEach((pastScan, idx) => {
          const alpha = ((idx + 1) / (trailLength + 1)) * 0.4
          drawScanPoints(ctx, pastScan, originX, originY, scale, safeConfig, alpha)
        })
      }

      // 5. Draw Current LaserScan Points & Beams
      if (scan && scan.ranges.length > 0) {
        drawScanPoints(ctx, scan, originX, originY, scale, safeConfig, 1.0)
      }

      // 6. Draw Coordinate Reference Frame Axes (+X forward, +Y left)
      drawCoordinateAxes(ctx, originX, originY)

      // 7. Draw Inspect Point Reticle & Badge
      if (inspectPoint) {
        drawInspectionReticle(ctx, inspectPoint, originX, originY, scale)
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animId)
    }
  }, [scan, safeConfig, scale, offset, inspectPoint, decayCount])

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full overflow-hidden rounded-xl border border-border/40 bg-zinc-950 select-none', className)}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* NON-SAFETY DISCLAIMER (Prominent permanent banner) */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-600/40 text-[10px] font-medium text-amber-300 backdrop-blur-sm shadow-md">
        <Info className="w-3 h-3 text-amber-400 shrink-0" />
        <span>Visual aid only &mdash; NOT a safety or collision-avoidance system</span>
      </div>

      {/* Live Zoom / Scale Chip */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900/80 border border-zinc-700/50 text-[11px] font-mono text-zinc-300 backdrop-blur-sm">
        <Compass className="w-3.5 h-3.5 text-blue-400" />
        <span>{(scale / 10).toFixed(1)} px/cm</span>
      </div>

      {/* Floating Canvas Controls (Reset, Zoom, Fit, Display Settings) */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-lg"
          onClick={() => handleZoom(0.2)}
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-lg"
          onClick={() => handleZoom(-0.2)}
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-lg"
          onClick={handleFitBounds}
          title="Auto-Fit Scan Bounds"
        >
          <Crosshair className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-lg"
          onClick={handleResetView}
          title="Reset Centering & Zoom"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* Display Config Dropdown */}
        {onConfigChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="secondary"
                className="h-8 w-8 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/60 shadow-lg"
                title="Visualization Settings"
              >
                <Sliders className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-3 bg-zinc-900/95 border-zinc-800 backdrop-blur-md">
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                LiDAR Display Settings
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />

              <div className="space-y-3 py-1">
                {/* Point Size */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Point Size:</span>
                    <span className="font-mono">{config.pointSize} px</span>
                  </div>
                  <Slider
                    value={[safeConfig.pointSize ?? 3]}
                    min={1}
                    max={8}
                    step={1}
                    onValueChange={([val]) => onConfigChange({ pointSize: val })}
                  />
                </div>

                {/* Color Scheme */}
                <div className="space-y-1">
                  <span className="text-xs text-zinc-300">Color Mode:</span>
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    {(['proximity', 'intensity', 'mono', 'rainbow'] as const).map((mode) => (
                      <Button
                        key={mode}
                        size="sm"
                        variant={config.colorScheme === mode ? 'default' : 'outline'}
                        className="h-7 text-xs capitalize"
                        onClick={() => onConfigChange({ colorScheme: mode })}
                      >
                        {mode}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Render Mode */}
                <div className="space-y-1">
                  <span className="text-xs text-zinc-300">Render Style:</span>
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    {(['points', 'rays', 'surface'] as const).map((style) => (
                      <Button
                        key={style}
                        size="sm"
                        variant={config.renderMode === style ? 'default' : 'outline'}
                        className="h-7 text-xs capitalize"
                        onClick={() => onConfigChange({ renderMode: style })}
                      >
                        {style}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Switches */}
                <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-grid" className="text-zinc-300 cursor-pointer">
                      Polar Range Grid
                    </Label>
                    <Switch
                      id="toggle-grid"
                      checked={config.showGrid}
                      onCheckedChange={(checked) => onConfigChange({ showGrid: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-prox" className="text-zinc-300 cursor-pointer">
                      Proximity Rings
                    </Label>
                    <Switch
                      id="toggle-prox"
                      checked={config.showProximityZones}
                      onCheckedChange={(checked) => onConfigChange({ showProximityZones: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-footprint" className="text-zinc-300 cursor-pointer">
                      Robot Footprint
                    </Label>
                    <Switch
                      id="toggle-footprint"
                      checked={config.showRobotFootprint}
                      onCheckedChange={(checked) => onConfigChange({ showRobotFootprint: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="toggle-mirror" className="text-zinc-300 cursor-pointer">
                      Mirror Scan (Inverted)
                    </Label>
                    <Switch
                      id="toggle-mirror"
                      checked={config.inverted}
                      onCheckedChange={(checked) => onConfigChange({ inverted: checked })}
                    />
                  </div>
                </div>

                {/* Trail Persistence */}
                <div className="space-y-1 pt-1 border-t border-zinc-800">
                  <div className="flex justify-between text-xs text-zinc-300">
                    <span>Decay Trail:</span>
                    <span className="font-mono">{config.decayTrail} scans</span>
                  </div>
                  <Slider
                    value={[safeConfig.decayTrail ?? safeConfig.ghostTrailCount ?? 0]}
                    min={0}
                    max={10}
                    step={1}
                    onValueChange={([val]) => onConfigChange({ decayTrail: val })}
                  />
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Point Hover / Inspection Tooltip */}
      {inspectPoint && (
        <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-lg bg-zinc-900/95 border border-zinc-700/80 text-xs text-zinc-200 shadow-xl backdrop-blur-md font-mono space-y-1">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-1 font-semibold text-blue-400">
            <Eye className="w-3.5 h-3.5" />
            <span>Point Inspection</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-0.5 text-[11px]">
            <span className="text-zinc-400">Range:</span>
            <span className="text-right text-emerald-400 font-bold">{inspectPoint.range.toFixed(3)} m</span>

            <span className="text-zinc-400">Angle:</span>
            <span className="text-right">{inspectPoint.angleDeg.toFixed(1)}° ({inspectPoint.angleRad.toFixed(2)} rad)</span>

            <span className="text-zinc-400">X (Forward):</span>
            <span className="text-right">{inspectPoint.x.toFixed(3)} m</span>

            <span className="text-zinc-400">Y (Left):</span>
            <span className="text-right">{inspectPoint.y.toFixed(3)} m</span>

            {inspectPoint.intensity > 0 && (
              <>
                <span className="text-zinc-400">Intensity:</span>
                <span className="text-right text-amber-300">{inspectPoint.intensity.toFixed(0)}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- Helper Render Functions ----------------

function drawPolarGrid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  scale: number,
) {
  const maxRadiusPx = Math.max(width, height)
  const rings = [0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0]

  ctx.lineWidth = 1
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

  for (const r of rings) {
    const rPx = r * scale
    if (rPx > maxRadiusPx) break

    // Circle ring
    ctx.beginPath()
    ctx.arc(cx, cy, rPx, 0, 2 * Math.PI)
    ctx.strokeStyle = r === 1.0 || r === 2.0 || r === 5.0 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.05)'
    ctx.stroke()

    // Range label on top (+X forward axis)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fillText(`${r}m`, cx, cy - rPx - 6)
  }

  // Radial spokes (every 30 degrees)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
  for (let deg = 0; deg < 360; deg += 30) {
    const rad = degToRad(deg)
    // ROS 0 deg is +X forward (up). 90 deg is +Y left (left).
    const lineX = cx - Math.sin(rad) * maxRadiusPx
    const lineY = cy - Math.cos(rad) * maxRadiusPx

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(lineX, lineY)
    ctx.stroke()

    // Cardinal angle indicators
    if (deg % 90 === 0) {
      const labelDist = Math.min(maxRadiusPx * 0.45, 180)
      const lx = cx - Math.sin(rad) * labelDist
      const ly = cy - Math.cos(rad) * labelDist
      let label = `${deg}°`
      if (deg === 0) label = '0° (Fwd)'
      if (deg === 90) label = '90° (Left)'
      if (deg === 180) label = '180° (Back)'
      if (deg === 270) label = '270° (Right)'

      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
      ctx.fillText(label, lx, ly)
    }
  }
}

function drawProximityBands(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  config: LidarDisplayConfig
) {
  const cautionM = config.cautionThresholdMeters ?? 1.0
  const dangerM = config.dangerThresholdMeters ?? 0.5

  // Caution ring
  ctx.beginPath()
  ctx.arc(cx, cy, cautionM * scale, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)' // Amber
  if (ctx.setLineDash) ctx.setLineDash([4, 4])
  ctx.lineWidth = 1.5
  ctx.stroke()
  if (ctx.setLineDash) ctx.setLineDash([])

  // Danger ring
  ctx.beginPath()
  ctx.arc(cx, cy, dangerM * scale, 0, 2 * Math.PI)
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)' // Red
  ctx.lineWidth = 2
  ctx.stroke()
}

function drawRobotFootprint(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Typical JetRacer footprint: length ~ 0.25m, width ~ 0.18m
  const lengthPx = 0.25 * scale
  const widthPx = 0.18 * scale

  ctx.save()
  ctx.translate(cx, cy)

  // Robot chassis rectangle (centered on base_link/laser frame)
  ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (ctx.roundRect) {
    ctx.roundRect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx, 4)
  } else {
    ctx.rect(-widthPx / 2, -lengthPx / 2, widthPx, lengthPx)
  }
  ctx.fill()
  ctx.stroke()

  // Directional triangle pointing forward (+X = up)
  ctx.fillStyle = '#60a5fa'
  ctx.beginPath()
  ctx.moveTo(0, -lengthPx / 2 - 6)
  ctx.lineTo(-widthPx / 3, -lengthPx / 2 + 6)
  ctx.lineTo(widthPx / 3, -lengthPx / 2 + 6)
  ctx.closePath()
  ctx.fill()

  // Sensor center dot
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(0, 0, 2.5, 0, 2 * Math.PI)
  ctx.fill()

  ctx.restore()
}

function drawCoordinateAxes(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const axisLen = 30
  ctx.lineWidth = 2

  // +X forward axis (Red in ROS REP-103 convention, pointing UP)
  ctx.strokeStyle = '#ef4444'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx, cy - axisLen)
  ctx.stroke()

  // +Y left axis (Green in ROS REP-103 convention, pointing LEFT)
  ctx.strokeStyle = '#22c55e'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx - axisLen, cy)
  ctx.stroke()

  // Axis labels
  ctx.font = '9px monospace'
  ctx.fillStyle = '#ef4444'
  ctx.fillText('+X', cx + 8, cy - axisLen + 4)
  ctx.fillStyle = '#22c55e'
  ctx.fillText('+Y', cx - axisLen - 6, cy - 6)
}

function drawScanPoints(
  ctx: CanvasRenderingContext2D,
  scan: DecodedScan,
  cx: number,
  cy: number,
  scale: number,
  config: LidarDisplayConfig,
  alphaMultiplier: number
) {
  const { ranges, classifications, intensities, angleMin, angleIncrement } = scan
  const count = ranges.length
  const pointSize = config.pointSize ?? 3
  const renderMode = config.renderMode ?? 'points'

  // If surface mode, draw polygon
  if (renderMode === 'surface') {
    ctx.beginPath()
    let first = true
    for (let i = 0; i < count; i++) {
      if (classifications[i] !== RayClassification.VALID) continue
      const angle = angleMin + i * angleIncrement
      const { x, y } = polarToCartesian(ranges[i], angle, config)
      const px = cx - y * scale
      const py = cy - x * scale
      if (first) {
        ctx.moveTo(px, py)
        first = false
      } else {
        ctx.lineTo(px, py)
      }
    }
    if (!first) {
      ctx.closePath()
      ctx.fillStyle = `rgba(59, 130, 246, ${0.15 * alphaMultiplier})`
      ctx.fill()
      ctx.strokeStyle = `rgba(96, 165, 250, ${0.5 * alphaMultiplier})`
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  // Draw rays if requested
  if (renderMode === 'rays') {
    ctx.lineWidth = 0.5
    for (let i = 0; i < count; i += 2) {
      if (classifications[i] !== RayClassification.VALID) continue
      const angle = angleMin + i * angleIncrement
      const { x, y } = polarToCartesian(ranges[i], angle, config)
      const px = cx - y * scale
      const py = cy - x * scale
      ctx.strokeStyle = getPointColor(ranges[i], (intensities && intensities[i]) || 0, config, alphaMultiplier * 0.3)
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(px, py)
      ctx.stroke()
    }
  }

  // Draw discrete points
  for (let i = 0; i < count; i++) {
    const classification = classifications[i]
    if (classification !== RayClassification.VALID) continue

    const r = ranges[i]
    const angle = angleMin + i * angleIncrement
    const { x, y } = polarToCartesian(r, angle, config)
    const px = cx - y * scale
    const py = cy - x * scale

    const color = getPointColor(r, (intensities && intensities[i]) || 0, config, alphaMultiplier)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(px, py, pointSize, 0, 2 * Math.PI)
    ctx.fill()
  }
}

function getPointColor(
  range: number,
  intensity: number,
  config: LidarDisplayConfig,
  alpha: number
): string {
  const scheme = config.colorScheme || (config.colorMode === 'intensity' ? 'intensity' : 'proximity')
  const dangerM = config.dangerThresholdMeters ?? 0.5
  const cautionM = config.cautionThresholdMeters ?? 1.0

  if (scheme === 'proximity') {
    if (range < dangerM) {
      return `rgba(239, 68, 68, ${alpha})` // Red
    }
    if (range < cautionM) {
      return `rgba(234, 179, 8, ${alpha})` // Amber
    }
    return `rgba(34, 197, 94, ${alpha})` // Emerald
  }

  if (scheme === 'intensity') {
    const norm = Math.min(Math.max(intensity / 255, 0), 1)
    const r = Math.round(255 * norm)
    const g = Math.round(180 * (1 - norm) + 50)
    const b = Math.round(255 * (1 - norm))
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  if (scheme === 'rainbow') {
    const hue = Math.min(Math.max((range / 6.0) * 280, 0), 280)
    return `hsla(${hue}, 90%, 55%, ${alpha})`
  }

  // Mono (Cyan)
  return `rgba(56, 189, 248, ${alpha})`
}

function drawInspectionReticle(
  ctx: CanvasRenderingContext2D,
  point: PointInspection,
  cx: number,
  cy: number,
  scale: number
) {
  const px = cx - point.y * scale
  const py = cy - point.x * scale

  // Reticle circle
  ctx.strokeStyle = '#38bdf8'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(px, py, 8, 0, 2 * Math.PI)
  ctx.stroke()

  // Connecting line from center
  if (ctx.setLineDash) ctx.setLineDash([2, 2])
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(px, py)
  ctx.stroke()
  if (ctx.setLineDash) ctx.setLineDash([])
}
