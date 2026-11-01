import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { Gauge } from '@/components/common/Gauge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Cpu,
  RotateCw,
  Power,
  RotateCcw,
  Activity,
  Layers,
} from 'lucide-react'
import { isSimulationEnabled, mockSimulatedMetrics } from '@/simulation'

export function SystemPage() {
  const [isRestartServiceOpen, setIsRestartServiceOpen] = useState(false)
  const [isRebootOpen, setIsRebootOpen] = useState(false)
  const [isShutdownOpen, setIsShutdownOpen] = useState(false)

  // Real vs Simulated metrics
  const metrics = isSimulationEnabled ? mockSimulatedMetrics : null

  const handleActionToast = (action: string) => {
    toast.info(`${action} is disabled in Phase 1`, {
      description: 'Host system management and systemd integration arrives in Phase 10.',
    })
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Robot System Management"
        description="Jetson hardware telemetry, Tegrastats/jtop resource monitoring, and service supervisor"
        phase="10 Integration"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRestartServiceOpen(true)}
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <RotateCw className="h-4 w-4 mr-1.5" />
              Restart Backend
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRebootOpen(true)}
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Reboot Jetson
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsShutdownOpen(true)}
              className="min-h-[44px] sm:min-h-[36px]"
            >
              <Power className="h-4 w-4 mr-1.5" />
              Shutdown
            </Button>
          </div>
        }
      />

      {/* 1. Hardware Resource Utilization Gauges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Hardware Load & Thermals
            </span>
            <Badge variant="outline" className="text-xs font-mono">
              {metrics ? 'Simulated Telemetry' : 'Offline / No Data'}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            CPU, GPU, RAM, storage, and thermal envelope metrics
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

      {/* 2. System Hardware and OS Profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              Jetson Hardware Specifications
            </CardTitle>
            <CardDescription className="text-xs">On-board computer configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Board Model</span>
              <span className="font-mono font-medium">NVIDIA Jetson Nano / NX (Est.)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Operating System</span>
              <span className="font-mono">Ubuntu Linux (aarch64)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">ROS Distribution</span>
              <span className="font-mono">Melodic / Noetic (NOT INSPECTED)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Python Runtime</span>
              <span className="font-mono">Python 3.8+ Compatible</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-mono">
                {metrics ? `${Math.floor(metrics.uptimeSeconds! / 60)} minutes` : '--'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* ROS Nodes Status List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Active ROS 1 Nodes
              </span>
              <Badge variant="outline" className="text-xs">
                NOT YET INSPECTED
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Live daemon node status from roscore
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-muted/20 border border-dashed border-border text-center text-muted-foreground">
              <p className="font-medium text-foreground">Nodes Unverified</p>
              <p className="mt-1">
                Node status inspection commands will be run on the real robot in Phase 4.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

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
