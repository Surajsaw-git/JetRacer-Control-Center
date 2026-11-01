import { PageHeader } from '@/components/common/PageHeader'
import { VideoViewport } from '@/components/common/VideoViewport'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Camera, Info, Sliders, ShieldAlert } from 'lucide-react'

export function CameraPage() {
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Camera Streaming"
        description="High-definition CSI / USB camera stream and optical teleoperation viewport"
        phase="5 Integration"
      />

      {/* Main 16:9 Video Viewport */}
      <div className="w-full max-w-5xl mx-auto">
        <VideoViewport />
      </div>

      {/* Camera Configuration & Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Stream Details
            </CardTitle>
            <CardDescription className="text-xs">Active sensor profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Driver Source</span>
              <span className="font-mono font-medium">NOT YET INSPECTED</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Resolution</span>
              <span className="font-mono">1280 x 720 (Target)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Target Frame Rate</span>
              <span className="font-mono">30 FPS</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Transport Protocol</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                WebRTC / MJPEG
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Pipeline Controls
            </CardTitle>
            <CardDescription className="text-xs">Adjustable stream settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              Exposure, white balance, resolution downscaling, and compression presets will become
              configurable once the on-robot web_video_server or GStreamer pipeline is connected in
              Phase 5.
            </p>
            <div className="pt-2">
              <Badge variant="secondary" className="text-[10px]">
                Disabled in Phase 1
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Latency & Safety
            </CardTitle>
            <CardDescription className="text-xs">Teleoperation notice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              Direct driving via camera requires sub-100ms end-to-end latency. If Wi-Fi link latency
              exceeds 250ms, a warning HUD will alert the operator to slow down.
            </p>
            <div className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-foreground">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>Full screen mode recommended for driving</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default CameraPage
