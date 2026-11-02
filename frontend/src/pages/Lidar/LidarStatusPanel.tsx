import React from 'react'
import {
  Activity,
  AlertTriangle,
  Download,
  Layers,
  Radio,
  Sliders,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  DecodedScan,
  LidarDisplayConfig,
  LidarMetrics,
  LidarStreamState,
  LidarSectorReadouts,
} from '@/services/lidar/lidarTypes'
import { lidarManager } from '@/services/lidar/lidarManager'
import { radToDeg } from '@/services/lidar/scanGeometry'

export interface LidarStatusPanelProps {
  state: LidarStreamState
  metrics: LidarMetrics
  scan: DecodedScan | null
  sectors: LidarSectorReadouts | null
  config: LidarDisplayConfig
  topic: string | null
}

export const LidarStatusPanel: React.FC<LidarStatusPanelProps> = ({
  state,
  metrics,
  scan,
  sectors,
  config,
  topic,
}) => {
  const handleExportCurrentScan = () => {
    lidarManager.exportCurrentScanJson()
  }

  const handleExportRingBuffer = () => {
    lidarManager.exportRingBufferJson()
  }

  const getStateBadge = () => {
    switch (state) {
      case 'streaming':
        return <Badge className="bg-emerald-600/90 text-white font-mono">STREAMING</Badge>
      case 'waiting':
        return <Badge className="bg-amber-600/90 text-white font-mono">WAITING DATA</Badge>
      case 'stalled':
        return <Badge variant="destructive" className="font-mono">STALLED (&gt;2s)</Badge>
      case 'degraded':
        return <Badge className="bg-amber-700/90 text-white font-mono">DEGRADED</Badge>
      case 'link_down':
        return <Badge variant="secondary" className="font-mono">ROS DISCONNECTED</Badge>
      case 'error':
        return <Badge variant="destructive" className="font-mono">STREAM ERROR</Badge>
      case 'stopped':
      default:
        return <Badge variant="outline" className="font-mono">OFFLINE</Badge>
    }
  }

  const getDistanceColor = (dist: number | null) => {
    if (dist === null) return 'text-zinc-500'
    const dangerM = config.dangerThresholdMeters ?? 0.5
    const cautionM = config.cautionThresholdMeters ?? 1.0
    if (dist < dangerM) return 'text-rose-500 font-bold'
    if (dist < cautionM) return 'text-amber-400 font-semibold'
    return 'text-emerald-400'
  }

  const rateHz = metrics.currentRateHz ?? metrics.measuredHz ?? 0
  const validRatio = metrics.validPointsRatio ?? metrics.validPercent ?? 0
  const rotDeg = config.frontAngleOffsetDeg ?? config.rotationDeg ?? 0
  const isMirrored = config.inverted ?? config.mirror ?? false

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Subsystem & Stream Status */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Subsystem Status
            </CardTitle>
            {getStateBadge()}
          </div>
          <CardDescription className="text-xs">
            {topic ? (
              <span className="font-mono text-zinc-300 truncate block">{topic}</span>
            ) : (
              'No topic selected'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Frame ID:</span>
            <span className="font-mono font-medium text-foreground">
              {metrics.frameId || 'None'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Scan Rate:</span>
            <span className="font-mono font-medium text-foreground">
              {rateHz > 0 ? `${rateHz.toFixed(1)} Hz` : '0 Hz'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Bandwidth:</span>
            <span className="font-mono text-foreground">
              {metrics.bandwidthKbps > 0 ? `${metrics.bandwidthKbps.toFixed(1)} KB/s` : '0 KB/s'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Valid Points:</span>
            <span className="font-mono text-foreground">
              {scan ? `${scan.validPointsCount ?? scan.validCount} / ${scan.ranges.length} (${validRatio.toFixed(0)}%)` : '—'}
            </span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Dropped / Oversized:</span>
            <span className="font-mono text-foreground">
              {metrics.droppedScans} / {metrics.oversizedScans}
            </span>
          </div>

          {metrics.isFrozen && (
            <div className="p-2 rounded bg-amber-950/60 border border-amber-600/40 text-[11px] text-amber-300 flex items-center gap-2 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Frozen scan detected: laser scan values static across 15+ cycles</span>
            </div>
          )}

          {metrics.frameIdChanged && (
            <div className="p-2 rounded bg-amber-950/60 border border-amber-600/40 text-[11px] text-amber-300 flex items-center gap-2 mt-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span>Frame ID switched at runtime! Check TF tree or driver configuration</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Hardware Geometry & Scan Limits */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sliders className="h-4 w-4 text-primary" />
            Sensor Profile & Limits
          </CardTitle>
          <CardDescription className="text-xs">Extracted from sensor_msgs/LaserScan</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Range Min / Max:</span>
            <span className="font-mono font-medium text-foreground">
              {scan ? `${scan.rangeMin.toFixed(2)}m – ${scan.rangeMax.toFixed(2)}m` : '—'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Angle Range:</span>
            <span className="font-mono text-foreground">
              {scan
                ? `${radToDeg(scan.angleMin).toFixed(0)}° to ${radToDeg(scan.angleMax).toFixed(0)}°`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Angle Resolution:</span>
            <span className="font-mono text-foreground">
              {scan ? `${radToDeg(scan.angleIncrement).toFixed(2)}°/step` : '—'}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">Total Rays:</span>
            <span className="font-mono text-foreground">{scan ? scan.ranges.length : '—'}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Front Orientation:</span>
            <span className="font-mono text-foreground">
              {rotDeg}° offset {isMirrored ? '(Inverted)' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. 4-Sector Obstacle Proximity & Diagnostics */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Proximity Sectors
            </CardTitle>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
              Nearest Return
            </span>
          </div>
          <CardDescription className="text-xs">
            Visual aid only. Front: ±45°, Sides: 90°, Rear: 180°
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2 text-center">
            {(() => {
              const fDist = sectors?.front?.distanceM ?? sectors?.front?.distance ?? null
              const lDist = sectors?.left?.distanceM ?? sectors?.left?.distance ?? null
              const rDist = sectors?.right?.distanceM ?? sectors?.right?.distance ?? null
              const bDist = sectors?.back?.distanceM ?? sectors?.back?.distance ?? sectors?.rear?.distanceM ?? sectors?.rear?.distance ?? null
              return (
                <>
                  <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-medium">FRONT (0°)</div>
                    <div className={`font-mono text-base ${getDistanceColor(fDist)}`}>
                      {fDist !== null ? `${fDist.toFixed(2)} m` : 'Clear / ∞'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-medium">LEFT (+90°)</div>
                    <div className={`font-mono text-base ${getDistanceColor(lDist)}`}>
                      {lDist !== null ? `${lDist.toFixed(2)} m` : 'Clear / ∞'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-medium">RIGHT (-90°)</div>
                    <div className={`font-mono text-base ${getDistanceColor(rDist)}`}>
                      {rDist !== null ? `${rDist.toFixed(2)} m` : 'Clear / ∞'}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-zinc-900/60 border border-zinc-800">
                    <div className="text-[10px] text-zinc-400 font-medium">REAR (180°)</div>
                    <div className={`font-mono text-base ${getDistanceColor(bDist)}`}>
                      {bDist !== null ? `${bDist.toFixed(2)} m` : 'Clear / ∞'}
                    </div>
                  </div>
                </>
              )
            })()}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!scan}
              onClick={handleExportCurrentScan}
              className="text-xs h-7 gap-1.5 w-1/2"
            >
              <Download className="w-3.5 h-3.5" />
              Save Scan JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={metrics.receivedScansCount === 0}
              onClick={handleExportRingBuffer}
              className="text-xs h-7 gap-1.5 w-1/2"
            >
              <Layers className="w-3.5 h-3.5" />
              Export Ring Buffer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
