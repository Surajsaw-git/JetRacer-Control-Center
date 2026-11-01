import { useState } from 'react'
import { Activity, Clock, RefreshCw, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { rosStatusService } from '@/services/rosStatusService'
import { useConnectionStore } from '@/store/connectionStore'
import { InspectionReportModal } from './InspectionReportModal'
import { toast } from 'sonner'

export function RosStatusTab() {
  const [isProbing, setIsProbing] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)

  const isConnected = useConnectionStore((state) => state.status === 'connected')
  const host = useConnectionStore((state) => state.host)
  const status = useRosStatusStore((state) => state.status)
  const latencyMs = useRosStatusStore((state) => state.latencyMs)
  const rosTime = useRosStatusStore((state) => state.rosTime)
  const clockOffsetSecs = useRosStatusStore((state) => state.clockOffsetSecs)
  const clockExplanation = useRosStatusStore((state) => state.clockOffsetExplanation)
  const lastHeartbeatAt = useRosStatusStore((state) => state.lastHeartbeatAt)
  const errorMessage = useRosStatusStore((state) => state.errorMessage)

  const handleManualProbe = async () => {
    setIsProbing(true)
    try {
      const res = await rosStatusService.probeStatus()
      if (res === 'ok') {
        toast.success('ROS Master status probe succeeded')
      } else {
        toast.warning(`ROS Master status: ${res}`)
      }
    } finally {
      setIsProbing(false)
    }
  }

  let statusBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'
  let StatusIcon = XCircle

  if (isConnected) {
    if (status === 'ok') {
      statusBadgeVariant = 'default'
      StatusIcon = CheckCircle2
    } else if (status === 'degraded' || status === 'rosbridge_only') {
      statusBadgeVariant = 'secondary'
      StatusIcon = AlertTriangle
    } else {
      statusBadgeVariant = 'destructive'
      StatusIcon = XCircle
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: ROS Master Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <StatusIcon className="h-4 w-4 text-primary" />
                ROS 1 Master Status
              </span>
              <Badge variant={statusBadgeVariant} className="text-xs uppercase font-mono">
                {status.replace('_', ' ')}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              rosapi node and roscore daemon verification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Target Host</span>
              <span className="font-mono font-medium">{host || 'Not connected'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">rosapi Ping Latency</span>
              <span className="font-mono font-medium">
                {latencyMs !== null ? `${latencyMs} ms` : '--'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Last Heartbeat</span>
              <span className="font-mono">
                {lastHeartbeatAt ? new Date(lastHeartbeatAt).toLocaleTimeString() : '--'}
              </span>
            </div>
            {errorMessage && (
              <p className="text-[11px] text-rose-500 bg-rose-500/10 p-2 rounded mt-2">
                {errorMessage}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Clock Synchronization */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Clock Offset & ROS Time
            </CardTitle>
            <CardDescription className="text-xs">
              Derived from /rosapi/get_time vs browser wall-clock
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">ROS Clock (Secs)</span>
              <span className="font-mono font-medium">{rosTime ? rosTime.secs : '--'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Clock Offset</span>
              <span className="font-mono font-medium">
                {clockOffsetSecs !== null ? `${clockOffsetSecs.toFixed(3)}s` : '--'}
              </span>
            </div>
            <div className="pt-1">
              <span className="text-muted-foreground block text-[11px] mb-1">Status Explanation</span>
              <p className="text-xs font-medium text-foreground bg-muted/40 p-2 rounded border border-border/50">
                {clockExplanation}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Diagnostics & Introspection Export */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Actions & Diagnostics
            </CardTitle>
            <CardDescription className="text-xs">
              Manual probes and redacted report generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!isConnected || isProbing}
              onClick={handleManualProbe}
              className="w-full text-xs min-h-[36px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isProbing ? 'animate-spin' : ''}`} />
              {isProbing ? 'Probing /rosapi/get_time...' : 'Probe ROS Master Now'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReportOpen(true)}
              className="w-full text-xs min-h-[36px]"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Export Inspection Report
            </Button>
          </CardContent>
        </Card>
      </div>

      <InspectionReportModal open={isReportOpen} onOpenChange={setIsReportOpen} />
    </div>
  )
}
