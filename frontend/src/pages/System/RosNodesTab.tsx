import { useState } from 'react'
import { Layers, Info, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { rosDiscoveryService } from '@/services/rosDiscoveryService'
import { useConnectionStore } from '@/store/connectionStore'
import { toast } from 'sonner'

export function RosNodesTab() {
  const isConnected = useConnectionStore((state) => state.status === 'connected')
  const nodes = useRosDiscoveryStore((state) => state.nodes)
  const isDiscovering = useRosDiscoveryStore((state) => state.isDiscovering)

  const [search, setSearch] = useState('')
  const [inspectingNode, setInspectingNode] = useState<string | null>(null)

  const filteredNodes = nodes.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase().trim()),
  )

  const handleInspectNode = async (nodeName: string) => {
    setInspectingNode(nodeName)
    try {
      await rosDiscoveryService.fetchNodeDetails(nodeName)
      toast.info(`Fetched node details for ${nodeName}`)
    } finally {
      setInspectingNode(null)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Active ROS 1 Nodes ({filteredNodes.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Live daemon node processes registered on roscore
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Search node name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-48 text-xs font-mono"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!isConnected || isDiscovering}
              onClick={() => rosDiscoveryService.discoverAll()}
              className="h-9 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isDiscovering ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {filteredNodes.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground text-xs space-y-2">
              <CheckCircle2 className="h-6 w-6 mx-auto text-muted-foreground/60" />
              <p className="font-medium text-foreground">No Nodes Discovered</p>
              <p>Connect to the robot rosbridge and perform discovery to view active nodes.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredNodes.map((node) => (
                <div key={node.name} className="py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {node.name}
                      </span>
                      {node.status === 'new' && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          NEW
                        </Badge>
                      )}
                      {node.status === 'removed' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          REMOVED
                        </Badge>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={inspectingNode === node.name}
                      onClick={() => handleInspectNode(node.name)}
                      className="h-8 text-xs px-2"
                    >
                      <Info className="h-3.5 w-3.5 mr-1" />
                      {inspectingNode === node.name ? 'Inspecting...' : 'Details'}
                    </Button>
                  </div>

                  {/* Publications / Subscriptions details if fetched */}
                  {(node.publications || node.subscriptions || node.services) && (
                    <div className="p-3 bg-muted/30 rounded border border-border/50 text-[11px] font-mono space-y-1.5">
                      {node.publications && node.publications.length > 0 && (
                        <div>
                          <span className="text-muted-foreground font-sans font-medium">
                            Publishes:{' '}
                          </span>
                          <span className="text-foreground">{node.publications.join(', ')}</span>
                        </div>
                      )}
                      {node.subscriptions && node.subscriptions.length > 0 && (
                        <div>
                          <span className="text-muted-foreground font-sans font-medium">
                            Subscribes:{' '}
                          </span>
                          <span className="text-foreground">{node.subscriptions.join(', ')}</span>
                        </div>
                      )}
                      {node.services && node.services.length > 0 && (
                        <div>
                          <span className="text-muted-foreground font-sans font-medium">
                            Services:{' '}
                          </span>
                          <span className="text-foreground">{node.services.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
