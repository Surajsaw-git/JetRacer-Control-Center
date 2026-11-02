import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Gauge } from '@/components/common/Gauge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  RotateCw,
  Power,
  RotateCcw,
  Activity,
  Radio,
  Layers,
  Server,
  Eye,
  BookmarkCheck,
} from 'lucide-react'
import { isSimulationEnabled, mockSimulatedMetrics } from '@/simulation'
import { RosStatusTab } from './RosStatusTab'
import { RosTopicsTab } from './RosTopicsTab'
import { RosNodesTab } from './RosNodesTab'
import { RosServicesTab } from './RosServicesTab'
import { RosWatchTab } from './RosWatchTab'
import { RosRegistryTab } from './RosRegistryTab'

export function SystemPage() {
  const [activeTab, setActiveTab] = useState('status')
  const [isRestartServiceOpen, setIsRestartServiceOpen] = useState(false)
  const [isRebootOpen, setIsRebootOpen] = useState(false)
  const [isShutdownOpen, setIsShutdownOpen] = useState(false)

  // Real vs Simulated metrics
  const metrics = isSimulationEnabled ? mockSimulatedMetrics : null

  const handleActionToast = (action: string) => {
    toast.info(`${action} is disabled in Phase 4`, {
      description: 'Host system management and systemd integration arrives in Phase 10.',
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="ROS 1 & System Management"
        description="ROS master introspection, topic discovery, watch telemetry, registry mapping, and host monitor"
        phase="4 ROS Integration"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              aria-disabled="true"
              title="Not available until Phase 10; the app sends no commands to the robot"
              className="min-h-[44px] sm:min-h-[36px] opacity-50 cursor-not-allowed"
            >
              <RotateCw className="h-4 w-4 mr-1.5" />
              Restart Backend
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              aria-disabled="true"
              title="Not available until Phase 10; the app sends no commands to the robot"
              className="min-h-[44px] sm:min-h-[36px] opacity-50 cursor-not-allowed"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reboot Jetson
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={true}
              aria-disabled="true"
              title="Not available until Phase 10; the app sends no commands to the robot"
              className="min-h-[44px] sm:min-h-[36px] opacity-50 cursor-not-allowed"
            >
              <Power className="h-4 w-4 mr-1.5" />
              Shutdown
            </Button>
          </div>
        }
      />

      {/* Main ROS 1 Introspection Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="status" className="text-xs py-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Status
          </TabsTrigger>
          <TabsTrigger value="topics" className="text-xs py-2 flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            Topics
          </TabsTrigger>
          <TabsTrigger value="nodes" className="text-xs py-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Nodes
          </TabsTrigger>
          <TabsTrigger value="services" className="text-xs py-2 flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" />
            Services
          </TabsTrigger>
          <TabsTrigger value="watch" className="text-xs py-2 flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Watch
          </TabsTrigger>
          <TabsTrigger value="registry" className="text-xs py-2 flex items-center gap-1.5">
            <BookmarkCheck className="h-3.5 w-3.5" />
            Registry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
          <RosStatusTab />
        </TabsContent>

        <TabsContent value="topics" className="space-y-6">
          <RosTopicsTab onSwitchToWatch={() => setActiveTab('watch')} />
        </TabsContent>

        <TabsContent value="nodes" className="space-y-6">
          <RosNodesTab />
        </TabsContent>

        <TabsContent value="services" className="space-y-6">
          <RosServicesTab />
        </TabsContent>

        <TabsContent value="watch" className="space-y-6">
          <RosWatchTab />
        </TabsContent>

        <TabsContent value="registry" className="space-y-6">
          <RosRegistryTab />
        </TabsContent>
      </Tabs>

      {/* Hardware Resource Utilization Gauges (Phase 10 Foundation) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Jetson Hardware Load & Thermals
            </span>
            <Badge variant="outline" className="text-xs font-mono">
              {metrics ? 'Simulated Telemetry' : 'Offline / No Data'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            CPU, GPU, RAM, storage, and thermal envelope metrics (FastAPI / jtop)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 justify-items-center py-2">
            <Gauge label="CPU Utilization" value={metrics?.cpuUsage ?? null} unit="%" />
            <Gauge label="GPU Utilization" value={metrics?.gpuUsage ?? null} unit="%" />
            <Gauge
              label="CPU Temperature"
              value={metrics?.cpuTemp ?? null}
              unit="°C"
              max={100}
              warningThreshold={65}
              dangerThreshold={80}
            />
            <Gauge
              label="Memory Usage"
              value={
                metrics ? Math.round((metrics.memoryUsedMb! / metrics.memoryTotalMb!) * 100) : null
              }
              unit="%"
            />
            <Gauge
              label="Disk Space"
              value={
                metrics ? Math.round((metrics.diskUsedGb! / metrics.diskTotalGb!) * 100) : null
              }
              unit="%"
            />
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialogs for System Actions */}
      <ConfirmDialog
        open={isRestartServiceOpen}
        onOpenChange={setIsRestartServiceOpen}
        title="Restart JetRacer Backend Service?"
        description="This will restart the FastAPI backend and disconnect all active web and mobile clients."
        confirmText="Restart Service"
        onConfirm={() => handleActionToast('Restart Service')}
      />

      <ConfirmDialog
        open={isRebootOpen}
        onOpenChange={setIsRebootOpen}
        title="Reboot NVIDIA Jetson Host?"
        description="The robot will completely reboot. Motor power will be cut and all active navigation missions aborted."
        variant="destructive"
        confirmText="Reboot Host"
        onConfirm={() => handleActionToast('Reboot Jetson')}
      />

      <ConfirmDialog
        open={isShutdownOpen}
        onOpenChange={setIsShutdownOpen}
        title="SHUTDOWN Physical Robot?"
        description="This will safely halt all disk I/O and shut down the Jetson. You will need to physically toggle the power switch to turn it back on."
        variant="destructive"
        requiredTypedText="SHUTDOWN"
        confirmText="Shutdown Robot"
        onConfirm={() => handleActionToast('Shutdown')}
      />
    </div>
  )
}

export default SystemPage
