import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { PanZoomCanvas } from '@/components/common/PanZoomCanvas'
import { EmptyState } from '@/components/common/EmptyState'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Map, Play, Square, Save, RotateCcw, FileText } from 'lucide-react'
import type { MapMeta } from '@/types'

export function MappingPage() {
  const [selectedMap, setSelectedMap] = useState<MapMeta | null>(null)
  const [isMetadataOpen, setIsMetadataOpen] = useState(false)

  // Empty list for Phase 1 (no saved maps until Phase 7)
  const savedMaps: MapMeta[] = []

  const handleOpenMapDetails = (mapItem: MapMeta) => {
    setSelectedMap(mapItem)
    setIsMetadataOpen(true)
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Mapping & SLAM"
        description="Synchronous Localization and Mapping (Gmapping / Cartographer) occupancy grid generation"
        phase="7 Integration"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              disabled
              title="SLAM launch arrives in Phase 7"
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <Play className="h-4 w-4 mr-1.5" />
              Start SLAM
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled
              title="Stopping SLAM arrives in Phase 7"
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <Square className="h-4 w-4 mr-1.5" />
              Stop SLAM
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Saving maps to Jetson disk arrives in Phase 7"
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Save Map
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Viewport Canvas */}
        <Card className="lg:col-span-2 p-3 sm:p-4 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Map className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Live Occupancy Grid</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              nav_msgs/OccupancyGrid (Planned)
            </Badge>
          </div>

          <div className="flex-1 w-full rounded-md overflow-hidden border border-border bg-card">
            <PanZoomCanvas
              onDraw={(ctx, width, height) => {
                // Draw coordinate grid for empty map state
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'
                ctx.lineWidth = 1
                const gridSize = 40

                for (let x = -width; x < width * 2; x += gridSize) {
                  ctx.beginPath()
                  ctx.moveTo(x, -height)
                  ctx.lineTo(x, height * 2)
                  ctx.stroke()
                }
                for (let y = -height; y < height * 2; y += gridSize) {
                  ctx.beginPath()
                  ctx.moveTo(-width, y)
                  ctx.lineTo(width * 2, y)
                  ctx.stroke()
                }
              }}
              className="h-[360px] sm:h-[480px]"
            >
              {({ resetView }) => (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
                  <div className="bg-card/90 backdrop-blur p-4 rounded-lg border border-border max-w-sm pointer-events-auto shadow-md">
                    <p className="text-sm font-medium text-foreground">No Active Mapping Session</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start a SLAM session in Phase 7 to build and inspect real-time 2D occupancy
                      grid maps.
                    </p>
                    <div className="mt-3 flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={resetView}
                        className="text-xs min-h-[44px] sm:min-h-[32px]"
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" />
                        Reset Canvas
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </PanZoomCanvas>
          </div>
        </Card>

        {/* Map Library Panel */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Saved Map Library</span>
              <Badge variant="secondary" className="text-xs font-mono">
                0 maps
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Saved .yaml and .pgm maps stored on the Jetson
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-center">
            {savedMaps.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Saved Maps"
                description="Maps saved during driving will appear here with resolution and thumbnail data."
                actionLabel="Learn about SLAM"
                actionHref="/navigation"
              />
            ) : (
              <div className="space-y-2">
                {savedMaps.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => handleOpenMapDetails(m)}
                    className="p-3 rounded-lg border border-border bg-card/60 hover:bg-accent cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <p className="font-semibold text-xs text-foreground">{m.name}</p>
                      <p className="text-[10px] text-muted-foreground">{m.createdAt}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {m.resolution}m/px
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Map Metadata Sheet UI */}
      <Sheet open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Map Metadata</SheetTitle>
            <SheetDescription>
              Technical specifications for the selected occupancy grid map.
            </SheetDescription>
          </SheetHeader>
          {selectedMap && (
            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Map Name</span>
                <span className="font-mono font-medium">{selectedMap.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Resolution</span>
                <span className="font-mono">{selectedMap.resolution} m/cell</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Dimensions</span>
                <span className="font-mono">
                  {selectedMap.width} x {selectedMap.height} px
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Created Date</span>
                <span className="font-mono">{selectedMap.createdAt}</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default MappingPage
