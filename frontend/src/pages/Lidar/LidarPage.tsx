import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { LidarCanvas } from '@/components/common/LidarCanvas'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Radar, ShieldCheck, Eye, Layers } from 'lucide-react'
import { isSimulationEnabled, generateMockLidarScan } from '@/simulation'

export function LidarPage() {
  const [mockScan] = useState(() => (isSimulationEnabled ? generateMockLidarScan() : null))

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="LiDAR Laser Scanner"
        description="2D planar range visualization, polar obstacle mapping, and proximity monitoring"
        phase="6 Integration"
      />

      {/* Main LiDAR Radar Canvas */}
      <Card className="p-2 sm:p-4">
        <LidarCanvas
          points={mockScan?.points || []}
          maxRangeMeters={8.0}
          className="h-[420px] sm:h-[560px]"
        />
      </Card>

      {/* LiDAR Subsystem Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              Sensor Specifications
            </CardTitle>
            <CardDescription className="text-xs">Laser scanner hardware profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Topic Name</span>
              <span className="font-mono font-medium">NOT YET INSPECTED</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Message Type</span>
              <span className="font-mono">sensor_msgs/LaserScan</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Scan Range</span>
              <span className="font-mono">0.15m – 12.0m (Est.)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Hardware Model</span>
              <span className="font-mono">RPLIDAR A1 / A2 (Planned)</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              Color Legend & Zones
            </CardTitle>
            <CardDescription className="text-xs">Proximity hazard bands</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-3 rounded-full bg-rose-500 flex-shrink-0" />
              <span className="font-medium text-foreground">&lt; 0.5m:</span>
              <span className="text-muted-foreground">Critical Collision Zone</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-3 rounded-full bg-amber-500 flex-shrink-0" />
              <span className="font-medium text-foreground">0.5m – 1.5m:</span>
              <span className="text-muted-foreground">Caution / Proximity Alert</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-3 w-3 rounded-full bg-cyan-500 flex-shrink-0" />
              <span className="font-medium text-foreground">&gt; 1.5m:</span>
              <span className="text-muted-foreground">Clear Operating Zone</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Interaction Guide
            </CardTitle>
            <CardDescription className="text-xs">Pan and zoom instructions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              • <strong>Mouse:</strong> Click and drag to pan; scroll wheel to zoom in or out.
            </p>
            <p>
              • <strong>Touch / Mobile:</strong> Drag with single finger to pan the radar; use the
              reset button at the bottom-right to re-center.
            </p>
            <div className="pt-2 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                <Layers className="h-3 w-3 mr-1" />
                Hardware-accelerated 2D Canvas
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default LidarPage
