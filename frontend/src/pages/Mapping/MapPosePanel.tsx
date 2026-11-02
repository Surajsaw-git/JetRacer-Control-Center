/**
 * JetRacer Control Center — Robot Pose & TF Frame Selector Panel (Phase 7A)
 *
 * Allows operators to select Map frame and Robot frame from observed coordinate frames,
 * inspects real-time 2D pose metrics, detects transform staleness, and displays
 * trail buffer statistics and odometry-only fallback status.
 */

import React from 'react'
import {
  Compass,
  Navigation,
  RotateCcw,
  AlertCircle,
  GitBranch,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PoseTrailPoint, RobotPose2D } from '@/services/map/mapTypes'

export interface MapPosePanelProps {
  pose: RobotPose2D | null
  trail: PoseTrailPoint[]
  mapFrame: string
  robotFrame: string
  knownFrames: string[]
  onFramesChange: (mapFrame: string, robotFrame: string) => void
  onClearTrail: () => void
}

export const MapPosePanel: React.FC<MapPosePanelProps> = ({
  pose,
  trail,
  mapFrame,
  robotFrame,
  knownFrames,
  onFramesChange,
  onClearTrail,
}) => {
  return (
    <div className="space-y-4 text-xs">
      {/* 1. Coordinate Frames Selection */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            TF Frame Assignment
          </CardTitle>
          <CardDescription className="text-xs">
            Coordinate frames observed dynamically from /tf and /tf_static
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="map-frame-select" className="text-[11px] text-muted-foreground">
              Map Reference Frame
            </Label>
            {knownFrames.length > 0 ? (
              <Select
                value={mapFrame}
                onValueChange={(val) => onFramesChange(val, robotFrame)}
              >
                <SelectTrigger id="map-frame-select" aria-label="Map Reference Frame" className="h-8 font-mono text-xs">
                  <SelectValue placeholder="Select map frame" />
                </SelectTrigger>
                <SelectContent>
                  {knownFrames.map((f) => (
                    <SelectItem key={f} value={f} className="font-mono text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-zinc-500 font-mono text-[11px] py-1">
                No frames discovered yet. Start map or connect to robot.
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="robot-frame-select" className="text-[11px] text-muted-foreground">
              Robot Base Frame
            </Label>
            {knownFrames.length > 0 ? (
              <Select
                value={robotFrame}
                onValueChange={(val) => onFramesChange(mapFrame, val)}
              >
                <SelectTrigger id="robot-frame-select" aria-label="Robot Base Frame" className="h-8 font-mono text-xs">
                  <SelectValue placeholder="Select robot frame" />
                </SelectTrigger>
                <SelectContent>
                  {knownFrames.map((f) => (
                    <SelectItem key={f} value={f} className="font-mono text-xs">
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="text-zinc-500 font-mono text-[11px] py-1">
                No frames discovered yet.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Live Pose Readout */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              Robot Pose (2D Planar)
            </CardTitle>
            {pose ? (
              pose.isStale ? (
                <Badge variant="destructive" className="text-[10px] font-mono">
                  STALE ({Math.round(pose.ageMs / 1000)}s)
                </Badge>
              ) : pose.source === 'odometry_fallback' ? (
                <Badge className="bg-amber-600 text-white text-[10px] font-mono">
                  ODOM FALLBACK
                </Badge>
              ) : (
                <Badge className="bg-emerald-600 text-white text-[10px] font-mono">
                  ALIGNED
                </Badge>
              )
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono">
                NO POSE
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pose ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-zinc-300">
                <div>
                  <span className="text-muted-foreground block text-[11px]">X Coordinate</span>
                  <span className="font-mono font-medium">{pose.x.toFixed(3)} m</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Y Coordinate</span>
                  <span className="font-mono font-medium">{pose.y.toFixed(3)} m</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Heading (Deg)</span>
                  <span className="font-mono font-medium">{pose.yawDeg.toFixed(1)}°</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Heading (Rad)</span>
                  <span className="font-mono font-medium">{pose.yawRad.toFixed(3)} rad</span>
                </div>
              </div>

              {pose.source === 'odometry_fallback' && (
                <div className="p-2 rounded bg-amber-950/40 border border-amber-600/30 text-amber-300 text-[11px] flex items-start gap-2 mt-2">
                  <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="leading-tight">
                    <strong>Odometry Fallback Active:</strong> Pose is relative to odometry origin, drifts over time, and is not aligned to the map coordinate origin.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-xs py-2">
              Robot pose is not resolved. Ensure both map and robot frames exist in the TF tree.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Pose Trail History Card */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              Path Trail Buffer
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={onClearTrail}
              disabled={trail.length === 0}
            >
              <RotateCcw className="h-3 w-3" />
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-zinc-300 text-xs">
            <span className="text-muted-foreground">Recorded Trail Points</span>
            <span className="font-mono font-medium">{trail.length} / 500</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
