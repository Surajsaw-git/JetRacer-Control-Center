import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Gamepad2,
  Camera,
  Radar,
  Map,
  Activity,
  Cpu,
  Thermometer,
  Battery,
  Wifi,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { MetricCard } from '@/components/common/MetricCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { VideoViewport } from '@/components/common/VideoViewport'
import { LidarCanvas } from '@/components/common/LidarCanvas'
import { RosStatusCard } from '@/pages/Dashboard/RosStatusCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useEventLogStore } from '@/store/eventLogStore'
import { isSimulationEnabled, mockSimulatedMetrics, generateMockLidarScan } from '@/simulation'

export function DashboardPage() {
  const connection = useConnectionStore()
  const host = useSettingsStore((state) => state.connection.host)
  const events = useEventLogStore((state) => state.events)

  const [simScan] = useState(() => (isSimulationEnabled ? generateMockLidarScan() : null))

  // Metrics: In simulation mode use mock; in real mode show null ("No data")
  const metrics = isSimulationEnabled ? mockSimulatedMetrics : null

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Robot Dashboard"
        description="Real-time operational summary, sensor states, and system health"
        phase="1 UI"
      />

      {/* 1. Connection Summary Card */}
      <Card className="border-border/80 bg-card/60 backdrop-blur">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Connection Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Direct telemetry link to Jetson on-board host
            </CardDescription>
          </div>
          <StatusBadge status={connection.status} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-md bg-muted/30 border border-border/40">
              <span className="text-xs text-muted-foreground block">Robot Host IP</span>
              <span className="font-mono font-medium text-foreground">
                {host ? host : 'Not configured'}
              </span>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border border-border/40">
              <span className="text-xs text-muted-foreground block">Link Latency</span>
              <span className="font-mono font-medium text-foreground">
                {connection.latencyMs !== null ? `${connection.latencyMs} ms` : '--'}
              </span>
            </div>
            <div className="p-3 rounded-md bg-muted/30 border border-border/40">
              <span className="text-xs text-muted-foreground block">Last Connected</span>
              <span className="font-mono text-xs text-foreground truncate block">
                {connection.lastConnected
                  ? new Date(connection.lastConnected).toLocaleTimeString()
                  : 'Never'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Connection reconnection logic arrives in Phase 3"
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reconnect
            </Button>
            <Button asChild variant="secondary" size="sm" className="min-h-[44px] sm:min-h-[36px]">
              <Link to="/settings">Configure Robot Address</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ROS 1 Master & Introspection Card */}
      <RosStatusCard />

      {/* 2. Quick Status Telemetry Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          title="Battery"
          value={metrics ? `${metrics.batteryPercent}` : null}
          unit="%"
          icon={Battery}
          statusText={metrics ? `${metrics.batteryVolts}V` : 'Offline'}
          isSimulated={isSimulationEnabled}
        />
        <MetricCard
          title="CPU Load"
          value={metrics ? `${metrics.cpuUsage}` : null}
          unit="%"
          icon={Cpu}
          statusText={metrics ? `${metrics.cpuTemp}°C` : 'Offline'}
          isSimulated={isSimulationEnabled}
        />
        <MetricCard
          title="GPU Load"
          value={metrics ? `${metrics.gpuUsage}` : null}
          unit="%"
          icon={Cpu}
          statusText={metrics ? `${metrics.gpuTemp}°C` : 'Offline'}
          isSimulated={isSimulationEnabled}
        />
        <MetricCard
          title="Memory"
          value={
            metrics ? `${Math.round((metrics.memoryUsedMb! / metrics.memoryTotalMb!) * 100)}` : null
          }
          unit="%"
          icon={Thermometer}
          statusText={metrics ? `${metrics.memoryUsedMb}MB` : 'Offline'}
          isSimulated={isSimulationEnabled}
        />
        <MetricCard
          title="Network"
          value={connection.status === 'connected' ? 'OK' : null}
          icon={Wifi}
          statusText={host ? 'Configured' : 'No Host'}
          isSimulated={isSimulationEnabled}
        />
        <MetricCard
          title="ROS Nodes"
          value={connection.status === 'connected' ? 'Active' : null}
          icon={CheckCircle2}
          statusText="NOT INSPECTED"
          isSimulated={isSimulationEnabled}
        />
      </div>

      {/* 3. Sensor Preview Splitscreen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Preview Slot */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Live Camera Feed
              </CardTitle>
              <CardDescription className="text-xs">Front-facing video feed</CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-[44px] sm:min-h-[32px] text-xs"
            >
              <Link to="/camera">Full View</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center p-4">
            <VideoViewport className="w-full h-full" />
          </CardContent>
        </Card>

        {/* LiDAR Radar Preview Slot */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                LiDAR Proximity Radar
              </CardTitle>
              <CardDescription className="text-xs">2D laser scan obstacle overview</CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-[44px] sm:min-h-[32px] text-xs"
            >
              <Link to="/lidar">Full Radar</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex-1 p-4">
            <LidarCanvas
              points={simScan?.points || []}
              maxRangeMeters={8.0}
              className="h-[240px] sm:h-[300px]"
            />
          </CardContent>
        </Card>
      </div>

      {/* 4. Quick Actions & Local Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Actions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Rapid navigation shortcuts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="default" className="w-full justify-start min-h-[44px]">
              <Link to="/control">
                <Gamepad2 className="h-4 w-4 mr-2" />
                Open Manual Drive Control
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start min-h-[44px]">
              <Link to="/mapping">
                <Map className="h-4 w-4 mr-2" />
                Explore Mapping & SLAM
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start min-h-[44px]">
              <Link to="/system">
                <Cpu className="h-4 w-4 mr-2" />
                Inspect Jetson System Health
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent UI Activity Log */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
              <CardDescription className="text-xs">
                Local console events (UI ring buffer)
              </CardDescription>
            </div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="min-h-[44px] sm:min-h-[32px] text-xs"
            >
              <Link to="/history">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No events logged in this session.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-auto pr-1">
                {events.slice(0, 4).map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start justify-between text-xs p-2 rounded bg-muted/30 border border-border/40"
                  >
                    <div>
                      <span className="font-semibold text-foreground block">{evt.title}</span>
                      {evt.detail && (
                        <span className="text-muted-foreground text-[11px] block mt-0.5">
                          {evt.detail}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default DashboardPage
