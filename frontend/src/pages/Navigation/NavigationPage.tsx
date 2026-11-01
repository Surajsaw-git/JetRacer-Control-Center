import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { PanZoomCanvas } from '@/components/common/PanZoomCanvas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Compass,
  Target,
  MapPin,
  ListOrdered,
  XCircle,
  ShieldAlert,
} from 'lucide-react'
import type { NavigationGoal } from '@/types'

export function NavigationPage() {
  const [toolMode, setToolMode] = useState<'goal' | 'pose' | 'waypoints'>('goal')

  // Empty queue for Phase 1
  const activeGoals: NavigationGoal[] = []

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Autonomous Navigation"
        description="2D waypoint sequencer, move_base path planning, and obstacle avoidance"
        phase="9 Integration"
      />

      {/* Prominent Safety Layer Notice */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 text-xs">
        <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-sm">Autonomous Mode Safety Architecture</p>
          <p className="text-muted-foreground leading-relaxed">
            Autonomous navigation commands dispatched via this interface are continuously monitored
            by the on-robot safety watchdog. In the event of Wi-Fi loss, sensor stall, or localized
            obstacle proximity, the safety supervisor will immediately override move_base and apply
            the mechanical brakes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Navigation Map Viewport */}
        <Card className="lg:col-span-2 p-3 sm:p-4 flex flex-col min-h-[440px]">
          {/* Tool Modes Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Button
                variant={toolMode === 'goal' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setToolMode('goal')}
                className="text-xs min-h-[44px] sm:min-h-[32px]"
              >
                <Target className="h-3.5 w-3.5 mr-1" />
                2D Nav Goal
              </Button>
              <Button
                variant={toolMode === 'pose' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setToolMode('pose')}
                className="text-xs min-h-[44px] sm:min-h-[32px]"
              >
                <MapPin className="h-3.5 w-3.5 mr-1" />
                2D Pose Estimate
              </Button>
              <Button
                variant={toolMode === 'waypoints' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setToolMode('waypoints')}
                className="text-xs min-h-[44px] sm:min-h-[32px]"
              >
                <ListOrdered className="h-3.5 w-3.5 mr-1" />
                Waypoints
              </Button>
            </div>

            <Button
              variant="destructive"
              size="sm"
              disabled
              title="Cancel navigation arrives in Phase 9"
              className="text-xs min-h-[44px] sm:min-h-[32px]"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Cancel Goal
            </Button>
          </div>

          {/* Interactive Map Surface */}
          <div className="flex-1 w-full rounded-md overflow-hidden border border-border bg-card mt-3">
            <PanZoomCanvas
              onDraw={(ctx, width, height) => {
                // Coordinate grid placeholder
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
                ctx.lineWidth = 1
                for (let x = -width; x < width * 2; x += 50) {
                  ctx.beginPath()
                  ctx.moveTo(x, -height)
                  ctx.lineTo(x, height * 2)
                  ctx.stroke()
                }
                for (let y = -height; y < height * 2; y += 50) {
                  ctx.beginPath()
                  ctx.moveTo(-width, y)
                  ctx.lineTo(width * 2, y)
                  ctx.stroke()
                }
              }}
              className="h-[360px] sm:h-[480px]"
            >
              <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-card/90 backdrop-blur p-4 rounded-lg border border-border max-w-sm text-center pointer-events-auto shadow-md">
                  <Compass className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-semibold">Navigation Engine Standby</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Path planning goals and costmap visualization will be activated during Phase 9
                    ROS navigation stack bring-up.
                  </p>
                </div>
              </div>
            </PanZoomCanvas>
          </div>
        </Card>

        {/* Goal Queue & Status Column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center justify-between">
                <span>Waypoint Queue</span>
                <Badge variant="outline" className="text-xs font-mono">
                  0 queued
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">Scheduled target destinations</CardDescription>
            </CardHeader>
            <CardContent>
              {activeGoals.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted/20 border border-dashed border-border text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">No Active Waypoints</p>
                  <p>Click "2D Nav Goal" on the map to sequence destination waypoints.</p>
                </div>
              ) : (
                <div className="space-y-2">{/* Waypoints will render here */}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Navigator Telemetry</CardTitle>
              <CardDescription className="text-xs">move_base planner status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Actionlib Status</span>
                <Badge variant="outline" className="text-[10px]">
                  STANDBY
                </Badge>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Distance to Goal</span>
                <span className="font-mono">-- m</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground">Estimated Time</span>
                <span className="font-mono">-- s</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Recovery Behaviors</span>
                <span className="text-muted-foreground">None</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default NavigationPage
