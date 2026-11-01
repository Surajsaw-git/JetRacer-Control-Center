import { useState, useCallback } from 'react'
import { RotateCcw, Play, Pause, Sliders } from 'lucide-react'
import { PanZoomCanvas, type TransformState } from './PanZoomCanvas'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { LidarPoint } from '@/types'
import { cn } from '@/lib/utils'

export interface LidarCanvasProps {
  points?: LidarPoint[]
  maxRangeMeters?: number
  className?: string
}

export function LidarCanvas({ points = [], maxRangeMeters = 8.0, className }: LidarCanvasProps) {
  // Local UI visualization settings
  const [pointSize, setPointSize] = useState<number>(3)
  const [rangeLimit, setRangeLimit] = useState<number>(maxRangeMeters)
  const [colorByDistance, setColorByDistance] = useState<boolean>(true)
  const [isPaused, setIsPaused] = useState<boolean>(false)

  // Pixels per meter scale baseline (at scale 1.0)
  const pixelsPerMeter = 35

  const drawLidar = useCallback(
    (ctx: CanvasRenderingContext2D, _width: number, _height: number, _transform: TransformState) => {
      // 1. Draw polar concentric range rings
      const rings = [0.5, 1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0].filter((r) => r <= rangeLimit)

      ctx.lineWidth = 1
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '10px monospace'

      for (const r of rings) {
        const radiusPx = r * pixelsPerMeter
        ctx.beginPath()
        ctx.arc(0, 0, radiusPx, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.stroke()

        // Range ring label on positive Y axis
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.fillText(`${r}m`, 0, -radiusPx)
      }

      // 2. Draw 30-degree radial angle lines and labels
      const maxRadiusPx = rangeLimit * pixelsPerMeter
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'

      for (let deg = 0; deg < 360; deg += 30) {
        const rad = (deg * Math.PI) / 180
        const x = Math.sin(rad) * maxRadiusPx
        const y = -Math.cos(rad) * maxRadiusPx

        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(x, y)
        ctx.stroke()

        if (deg % 90 === 0 && deg !== 0) {
          ctx.fillText(`${deg}°`, x * 1.06, y * 1.06)
        }
      }

      // 3. Draw Robot Centered Marker (JetRacer forward heading indicated by green triangle)
      ctx.save()
      ctx.fillStyle = '#22c55e' // Emerald robot center
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, -12) // Forward apex
      ctx.lineTo(8, 8)
      ctx.lineTo(-8, 8)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // Small orientation nose dot
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(0, -6, 2, 0, 2 * Math.PI)
      ctx.fill()
      ctx.restore()

      // 4. Render Laser Scan Point Cloud (if data is provided)
      if (points.length > 0 && !isPaused) {
        for (const pt of points) {
          if (pt.range > rangeLimit || pt.range <= 0.05) continue

          // Standard ROS coordinate frame: Angle 0 is forward (+X / screen -Y), counter-clockwise
          const x = pt.range * pixelsPerMeter * Math.sin(pt.angle)
          const y = -pt.range * pixelsPerMeter * Math.cos(pt.angle)

          ctx.beginPath()
          ctx.arc(x, y, pointSize, 0, 2 * Math.PI)

          if (colorByDistance) {
            // Gradient from red (< 0.5m) to yellow (1.5m) to cyan (> 3m)
            const norm = Math.min(pt.range / 3.0, 1.0)
            if (norm < 0.3) {
              ctx.fillStyle = '#f43f5e' // Red obstacle danger
            } else if (norm < 0.7) {
              ctx.fillStyle = '#f59e0b' // Amber proximity
            } else {
              ctx.fillStyle = '#06b6d4' // Cyan clear range
            }
          } else {
            ctx.fillStyle = '#10b981' // Solid emerald points
          }

          ctx.fill()
        }
      }
    },
    [points, rangeLimit, pointSize, colorByDistance, isPaused],
  )

  return (
    <div
      className={cn('relative w-full h-[360px] sm:h-[480px] rounded-lg overflow-hidden', className)}
    >
      <PanZoomCanvas onDraw={drawLidar} initialScale={1.0} minScale={0.3} maxScale={4.0}>
        {({ resetView }) => (
          <>
            {/* Top Info Overlay */}
            <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
              <span className="text-xs font-mono bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/10 text-white/90">
                Range: {rangeLimit.toFixed(1)}m
              </span>
              <span className="text-xs font-mono bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/10 text-white/90">
                Points: {points.length}
              </span>
              {points.length === 0 && (
                <span className="text-xs text-muted-foreground bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/10 italic">
                  Empty grid — No live LiDAR data
                </span>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 z-10 pointer-events-auto bg-card/80 backdrop-blur p-1.5 rounded-lg border border-border shadow-md">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsPaused((prev) => !prev)}
                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]"
                aria-label={isPaused ? 'Resume Scan Rendering' : 'Pause Scan Rendering'}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? (
                  <Play className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={resetView}
                className="h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]"
                aria-label="Reset View"
                title="Reset View"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              {/* Visualization Settings Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]"
                    aria-label="LiDAR Display Settings"
                  >
                    <Sliders className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-4 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="point-size">Point Size ({pointSize}px)</Label>
                    </div>
                    <Slider
                      id="point-size"
                      min={1}
                      max={6}
                      step={1}
                      value={[pointSize]}
                      onValueChange={(val) => setPointSize(val[0])}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <Label htmlFor="range-limit">Max Range ({rangeLimit}m)</Label>
                    </div>
                    <Slider
                      id="range-limit"
                      min={1}
                      max={12}
                      step={0.5}
                      value={[rangeLimit]}
                      onValueChange={(val) => setRangeLimit(val[0])}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border">
                    <Label htmlFor="color-dist" className="text-xs cursor-pointer">
                      Color by Distance
                    </Label>
                    <Switch
                      id="color-dist"
                      checked={colorByDistance}
                      onCheckedChange={setColorByDistance}
                    />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </PanZoomCanvas>
    </div>
  )
}

export default LidarCanvas
