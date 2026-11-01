import { useState, useMemo } from 'react'
import {
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Eye,
  Info,
  Clock,
  Radio,
  SlidersHorizontal,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRosDiscoveryStore, type DiscoveryInterval } from '@/store/rosDiscoveryStore'
import { rosDiscoveryService } from '@/services/rosDiscoveryService'
import { subscriptionManager } from '@/services/subscriptionManager'
import { useConnectionStore } from '@/store/connectionStore'
import { toast } from 'sonner'

export interface RosTopicsTabProps {
  onSwitchToWatch?: (topic: string) => void
}

export function RosTopicsTab({ onSwitchToWatch }: RosTopicsTabProps) {
  const isConnected = useConnectionStore((state) => state.status === 'connected')
  const topics = useRosDiscoveryStore((state) => state.topics)
  const manualTopics = useRosDiscoveryStore((state) => state.manualTopics)
  const isDiscovering = useRosDiscoveryStore((state) => state.isDiscovering)
  const lastDiscoveredAt = useRosDiscoveryStore((state) => state.lastDiscoveredAt)
  const refreshInterval = useRosDiscoveryStore((state) => state.refreshInterval)
  const error = useRosDiscoveryStore((state) => state.error)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')

  // Manual fallback inputs
  const [manualName, setManualName] = useState('')
  const [manualType, setManualType] = useState('')

  // Unique message types for filtering
  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    for (const t of topics) {
      if (t.type && t.type !== 'unknown') set.add(t.type)
    }
    for (const m of manualTopics) {
      if (m.type) set.add(m.type)
    }
    return Array.from(set).sort()
  }, [topics, manualTopics])

  // Filtered topics
  const filteredTopics = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return topics.filter((t) => {
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)
      const matchesType = selectedType === 'all' || t.type === selectedType
      return matchesSearch && matchesType
    })
  }, [topics, searchQuery, selectedType])

  const handleRefresh = async () => {
    const ok = await rosDiscoveryService.discoverAll()
    if (ok) {
      toast.success('Discovered ROS topics and graph updated')
    } else {
      toast.error('Discovery failed or rosbridge not ready')
    }
  }

  const handleWatchTopic = async (topic: string, type: string) => {
    const ok = await subscriptionManager.startWatching(topic, type)
    if (ok) {
      toast.success(`Watching topic: ${topic}`)
      if (onSwitchToWatch) {
        onSwitchToWatch(topic)
      }
    } else {
      toast.error(`Could not watch ${topic}`)
    }
  }

  const handleInspectDetails = async (topicName: string) => {
    await rosDiscoveryService.fetchTopicDetails(topicName)
    toast.info(`Updated publishers/subscribers for ${topicName}`)
  }

  const handleAddManualTopic = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualName.trim() || !manualType.trim()) {
      toast.error('Please specify both topic name and message type')
      return
    }

    useRosDiscoveryStore.getState().addManualTopic(manualName, manualType)
    toast.success(`Added manual topic fallback: ${manualName}`)
    setManualName('')
    setManualType('')
  }

  return (
    <div className="space-y-6">
      {/* 1. Control Toolbar */}
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex-1 flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search topics by name or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger
                aria-label="Filter by message type"
                className="w-full sm:w-[220px] h-9 text-xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Message Types</SelectItem>
                {availableTypes.map((t) => (
                  <SelectItem key={t} value={t} className="font-mono text-xs">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={String(refreshInterval)}
              onValueChange={(val) =>
                rosDiscoveryService.setRefreshInterval(Number(val) as DiscoveryInterval)
              }
            >
              <SelectTrigger aria-label="Auto-refresh interval" className="w-[130px] h-9 text-xs">
                <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Auto-refresh" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Auto: Off</SelectItem>
                <SelectItem value="10">Every 10s</SelectItem>
                <SelectItem value="30">Every 30s</SelectItem>
                <SelectItem value="60">Every 60s</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              disabled={!isConnected || isDiscovering}
              onClick={handleRefresh}
              className="h-9 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isDiscovering ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Discovered Topics List */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Discovered ROS Topics ({filteredTopics.length})
            </CardTitle>
            <CardDescription className="text-xs">
              {lastDiscoveredAt
                ? `Last updated: ${new Date(lastDiscoveredAt).toLocaleTimeString()}`
                : 'Awaiting discovery pass'}
            </CardDescription>
          </div>
          {isDiscovering && (
            <Badge variant="outline" className="animate-pulse text-xs">
              Querying /rosapi...
            </Badge>
          )}
        </CardHeader>

        <CardContent>
          {error && (
            <div className="p-3 mb-4 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
              {error}
            </div>
          )}

          {filteredTopics.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground text-xs space-y-2">
              <Info className="h-6 w-6 mx-auto text-muted-foreground/60" />
              <p className="font-medium text-foreground">No Topics Discovered</p>
              <p>
                {isConnected
                  ? 'Click "Refresh" above to query /rosapi/topics on the connected robot.'
                  : 'Connect to robot rosbridge first to inspect topics.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filteredTopics.map((topic) => (
                <div
                  key={topic.name}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground">
                        {topic.name}
                      </span>
                      {topic.status === 'new' && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          NEW
                        </Badge>
                      )}
                      {topic.status === 'removed' && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          REMOVED
                        </Badge>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground">{topic.type}</p>

                    {(topic.publishers?.length || topic.subscribers?.length) ? (
                      <div className="text-[11px] text-muted-foreground flex gap-4 pt-1">
                        <span>Pubs: {topic.publishers?.join(', ') || 'none'}</span>
                        <span>Subs: {topic.subscribers?.join(', ') || 'none'}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInspectDetails(topic.name)}
                      className="h-8 text-xs px-2"
                    >
                      <Info className="h-3.5 w-3.5 mr-1" />
                      Details
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWatchTopic(topic.name, topic.type)}
                      className="h-8 text-xs px-2"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1 text-primary" />
                      Watch
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Manual Fallback Topic Entry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Manual Topic Fallback
          </CardTitle>
          <CardDescription className="text-xs">
            Add custom topic names if /rosapi is disabled or not running on the robot.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddManualTopic} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              placeholder="Topic Name (e.g. /custom_cmd)"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              className="h-9 text-xs font-mono"
            />
            <Input
              placeholder="Message Type (e.g. geometry_msgs/Twist)"
              value={manualType}
              onChange={(e) => setManualType(e.target.value)}
              className="h-9 text-xs font-mono"
            />
            <Button type="submit" size="sm" className="h-9 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Manual Topic
            </Button>
          </form>

          {manualTopics.length > 0 && (
            <div className="pt-2 divide-y divide-border/40">
              {manualTopics.map((m) => (
                <div key={m.name} className="py-2 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-semibold text-foreground">{m.name}</span>
                    <span className="text-muted-foreground ml-2">({m.type})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWatchTopic(m.name, m.type)}
                      className="h-7 text-xs px-2"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Watch
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => useRosDiscoveryStore.getState().removeManualTopic(m.name)}
                      className="h-7 text-xs px-2 text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
