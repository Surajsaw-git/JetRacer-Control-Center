/**
 * JetRacer Control Center — Map Diagnostics & Status Panel (Phase 7A)
 *
 * Displays active topic, frame_id, metric dimensions, origin, cell coverage breakdown,
 * update rate, and reactive status alerts for resizing, jumps, or stalls.
 */

import React from 'react'
import {
  Layers,
  Activity,
  AlertTriangle,
  Camera,
  Compass,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type {
  DecodedOccupancyGrid,
  MapStreamState,
  MapSummaryMetrics,
} from '@/services/map/mapTypes'

export interface MapStatusPanelProps {
  state: MapStreamState
  metrics: MapSummaryMetrics
  map: DecodedOccupancyGrid | null
  topic: string
  getMapService?: string | null
  onFetchSnapshot?: () => void
  isFetchingSnapshot?: boolean
}

export const MapStatusPanel: React.FC<MapStatusPanelProps> = ({
  state,
  metrics,
  map,
  topic,
  getMapService,
  onFetchSnapshot,
  isFetchingSnapshot = false,
}) => {
  const getStateBadge = () => {
    switch (state) {
      case 'live':
        return <Badge className="bg-emerald-600/90 text-white font-mono">LIVE</Badge>
      case 'waiting':
        return <Badge className="bg-amber-600/90 text-white font-mono">WAITING DATA</Badge>
      case 'stale':
        return <Badge variant="destructive" className="font-mono">STALE (&gt;15s)</Badge>
      case 'degraded':
        return <Badge className="bg-amber-700/90 text-white font-mono">DEGRADED</Badge>
      case 'oversized':
        return <Badge variant="destructive" className="font-mono">OVERSIZED (&gt;250k)</Badge>
      case 'link_down':
        return <Badge variant="secondary" className="font-mono">ROS DISCONNECTED</Badge>
      case 'error':
        return <Badge variant="destructive" className="font-mono">STREAM ERROR</Badge>
      case 'stopped':
      default:
        return <Badge variant="outline" className="font-mono">OFFLINE</Badge>
    }
  }

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Header & Live Telemetry Card */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Occupancy Grid Stream
            </CardTitle>
            {getStateBadge()}
          </div>
          <CardDescription className="text-xs">
            {topic ? (
              <span className="font-mono text-zinc-300 truncate block">{topic}</span>
            ) : (
              'No map topic selected'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-zinc-300">
            <div>
              <span className="text-muted-foreground block text-[11px]">Frame ID</span>
              <span className="font-mono font-medium">{map?.header.frameId || '—'}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Update Rate</span>
              <span className="font-mono font-medium">
                {metrics.currentRateHz > 0 ? `${metrics.currentRateHz} Hz` : '0 Hz'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Last Frame Age</span>
              <span className="font-mono font-medium">
                {metrics.lastUpdateAgeMs > 0 ? `${(metrics.lastUpdateAgeMs / 1000).toFixed(1)}s` : '0s'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Received / Dropped</span>
              <span className="font-mono font-medium">
                {metrics.receivedCount} / {metrics.droppedCount}
              </span>
            </div>
          </div>

          {getMapService && (
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Snapshot Service:</span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                disabled={isFetchingSnapshot}
                onClick={onFetchSnapshot}
              >
                <Camera className="h-3.5 w-3.5" />
                {isFetchingSnapshot ? 'Fetching...' : 'Fetch Snapshot'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Map Dimensions & Geometry */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            Grid Metric Dimensions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-zinc-300">
            <div>
              <span className="text-muted-foreground block text-[11px]">Grid Cells (WxH)</span>
              <span className="font-mono font-medium">
                {map ? `${map.info.width} × ${map.info.height} (${(map.metrics.totalCells / 1000).toFixed(0)}k)` : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Resolution</span>
              <span className="font-mono font-medium">
                {map ? `${map.info.resolution * 100} cm/cell` : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Real Area (WxH)</span>
              <span className="font-mono font-medium">
                {map ? `${map.metrics.widthMeters.toFixed(1)}m × ${map.metrics.heightMeters.toFixed(1)}m` : '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Total Area</span>
              <span className="font-mono font-medium">
                {map ? `${map.metrics.areaSquareMeters.toFixed(1)} m²` : '—'}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground block text-[11px]">Origin (X, Y, Yaw)</span>
              <span className="font-mono font-medium truncate block">
                {map
                  ? `(${map.info.origin.x.toFixed(2)}m, ${map.info.origin.y.toFixed(2)}m) @ ${map.info.origin.yawDeg.toFixed(1)}°`
                  : '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Cell Coverage & Probability Breakdown */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Exploration Coverage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {map ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-medium">Free Space</span>
                <span className="font-mono">
                  {map.metrics.freePercent.toFixed(1)}% ({map.metrics.freeCells.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-rose-400 font-medium">Obstacles (Occupied)</span>
                <span className="font-mono">
                  {map.metrics.occupiedPercent.toFixed(1)}% ({map.metrics.occupiedCells.toLocaleString()})
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400 font-medium">Unknown Space</span>
                <span className="font-mono">
                  {(100 - map.metrics.knownPercent).toFixed(1)}%
                </span>
              </div>

              {/* Progress Bar of Coverage */}
              <div className="w-full h-2 rounded-full overflow-hidden bg-zinc-800 flex mt-1">
                <div
                  className="bg-emerald-500 h-full"
                  style={{ width: `${map.metrics.freePercent}%` }}
                  title="Free"
                />
                <div
                  className="bg-rose-500 h-full"
                  style={{ width: `${map.metrics.occupiedPercent}%` }}
                  title="Occupied"
                />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">No active map loaded.</p>
          )}

          {map?.warnings && map.warnings.length > 0 && (
            <div className="mt-2 p-2 rounded bg-amber-950/40 border border-amber-600/30 text-amber-300 text-[11px] space-y-1">
              <div className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                SLAM Alerts:
              </div>
              {map.warnings.map((w, i) => (
                <p key={i} className="text-amber-200/90 leading-relaxed">• {w}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
