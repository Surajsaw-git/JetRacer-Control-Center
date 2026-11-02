import { Link } from 'react-router-dom'
import { Activity, Clock, Layers, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'
import { useConnectionStore } from '@/store/connectionStore'

export function RosStatusCard() {
  const isConnected = useConnectionStore((state) => state.status === 'connected')
  const status = useRosStatusStore((state) => state.status)
  const latencyMs = useRosStatusStore((state) => state.latencyMs)
  const clockOffsetExplanation = useRosStatusStore((state) => state.clockOffsetExplanation)

  const topicsCount = useRosDiscoveryStore((state) => state.topics.length)
  const nodesCount = useRosDiscoveryStore((state) => state.nodes.length)
  const servicesCount = useRosDiscoveryStore((state) => state.services.length)

  const mappings = useTopicRegistryStore((state) => state.mappings)
  const mappedCount = Object.values(mappings).filter((m) => m.assignedTopic !== null).length
  const verifiedCount = Object.values(mappings).filter((m) => m.verification === 'verified_live').length

  let statusBadgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'outline'
  let statusBadgeText = 'Disconnected'

  if (isConnected) {
    if (status === 'ok') {
      statusBadgeVariant = 'default'
      statusBadgeText = latencyMs !== null ? `ROS 1 Master OK (${latencyMs}ms)` : 'ROS 1 Master OK'
    } else if (status === 'degraded') {
      statusBadgeVariant = 'secondary'
      statusBadgeText = 'ROS Degraded'
    } else if (status === 'rosbridge_only') {
      statusBadgeVariant = 'secondary'
      statusBadgeText = 'Rosbridge Only (No rosapi)'
    } else if (status === 'master_unreachable') {
      statusBadgeVariant = 'destructive'
      statusBadgeText = 'Master Unreachable'
    } else {
      statusBadgeVariant = 'outline'
      statusBadgeText = 'Disconnected'
    }
  }

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            ROS 1 Master & Topic Introspection
          </CardTitle>
          <CardDescription className="text-xs">
            Live rosapi telemetry and registered data-flow pipelines
          </CardDescription>
        </div>
        <Badge variant={statusBadgeVariant} className="text-xs font-mono">
          {statusBadgeText}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          {/* Clock Synchronization */}
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <Clock className="h-3.5 w-3.5" />
              Clock Sync
            </span>
            <span className="font-mono text-xs font-medium text-foreground block truncate">
              {isConnected ? clockOffsetExplanation : 'Offline'}
            </span>
          </div>

          {/* Graph Discovery Count */}
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <Layers className="h-3.5 w-3.5" />
              Graph Discovery
            </span>
            <span className="font-mono text-xs font-medium text-foreground block">
              {isConnected
                ? `${topicsCount} topics · ${nodesCount} nodes · ${servicesCount} srvs`
                : 'Not discovered'}
            </span>
          </div>

          {/* Topic Registry Verification */}
          <div className="p-3 rounded-md bg-muted/30 border border-border/40">
            <span className="text-xs text-muted-foreground block mb-1">Topic Registry</span>
            <span className="font-mono text-xs font-medium text-foreground block">
              {mappedCount} roles mapped ({verifiedCount} verified live)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-muted-foreground">
            Strict Phase 4 read-only policy active. No topics published or altered.
          </p>
          <Button asChild variant="outline" size="sm" className="min-h-[36px] text-xs">
            <Link to="/system" className="flex items-center gap-1">
              ROS Management & Topics
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
