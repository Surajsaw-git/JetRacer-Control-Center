import { Eye, EyeOff, Radio, Clock, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { subscriptionManager } from '@/services/subscriptionManager'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { toast } from 'sonner'

export function RosWatchTab() {
  const watchedTopics = useSubscriptionStore((state) => state.watchedTopics)
  const throttleRateMs = useSubscriptionStore((state) => state.throttleRateMs)
  const maxWatches = useSubscriptionStore((state) => state.maxWatches)
  const discoveredTopics = useRosDiscoveryStore((state) => state.topics)

  const activeWatchesList = Object.values(watchedTopics)
  const activeCount = activeWatchesList.length

  const handleStopWatch = (topic: string) => {
    subscriptionManager.stopWatching(topic)
    toast.info(`Stopped watching ${topic}`)
  }

  const handleStopAll = () => {
    subscriptionManager.stopAll()
    toast.info('Stopped all active topic subscriptions')
  }

  const handleQuickWatch = async (topicName: string) => {
    const found = discoveredTopics.find((t) => t.name === topicName)
    if (!found) return
    const ok = await subscriptionManager.startWatching(found.name, found.type)
    if (ok) {
      toast.success(`Watching ${found.name}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs font-mono py-1">
              Active Watches: {activeCount} / {maxWatches}
            </Badge>

            <div className="flex items-center gap-2 text-xs">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Throttle:</span>
              <Select
                value={String(throttleRateMs)}
                onValueChange={(val) =>
                  useSubscriptionStore.getState().setThrottleRateMs(Number(val))
                }
              >
                <SelectTrigger aria-label="Throttle rate" className="w-28 h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 ms (10 Hz)</SelectItem>
                  <SelectItem value="200">200 ms (5 Hz)</SelectItem>
                  <SelectItem value="500">500 ms (2 Hz)</SelectItem>
                  <SelectItem value="1000">1000 ms (1 Hz)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Watch Selector */}
            {discoveredTopics.length > 0 && activeCount < maxWatches && (
              <Select onValueChange={handleQuickWatch}>
                <SelectTrigger aria-label="Quick watch topic" className="w-48 h-8 text-xs font-mono">
                  <SelectValue placeholder="Quick Watch Topic..." />
                </SelectTrigger>
                <SelectContent>
                  {discoveredTopics
                    .filter((t) => !watchedTopics[t.name])
                    .map((t) => (
                      <SelectItem key={t.name} value={t.name} className="font-mono text-xs">
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {activeCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopAll}
                className="h-8 text-xs text-rose-500 hover:text-rose-600"
              >
                <EyeOff className="h-3.5 w-3.5 mr-1" />
                Stop All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 2. Watched Topics Panels */}
      {activeCount === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-xs space-y-2">
            <Eye className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="font-semibold text-foreground text-sm">No Topics Currently Watched</p>
            <p>
              In the "Topics" tab, click "Watch" on any discovered topic (or select from Quick Watch)
              to inspect live telemetry safely with rate throttling and defensive decoding.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {activeWatchesList.map((watch) => (
            <Card key={watch.topic} className="border-border/80 bg-card/60">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 font-mono">
                    <Radio className="h-4 w-4 text-primary" />
                    {watch.topic}
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">{watch.type}</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Badge
                    variant={watch.isStale ? 'secondary' : 'default'}
                    className="text-xs font-mono"
                  >
                    {watch.isStale ? 'STALE (>2.5s)' : `${watch.hz} Hz`}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStopWatch(watch.topic)}
                    className="h-7 text-xs text-muted-foreground hover:text-rose-500"
                  >
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                    Stop
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {watch.error && (
                  <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                    <span>{watch.error}</span>
                  </div>
                )}

                {/* LaserScan Summary reduction card */}
                {watch.summaryStats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/40 rounded border border-border/50 text-xs font-mono">
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Points Count</span>
                      <span className="font-semibold">{watch.summaryStats.rangesCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Min Range</span>
                      <span className="font-semibold">{watch.summaryStats.rangeMin ?? 'N/A'} m</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Max Range</span>
                      <span className="font-semibold">{watch.summaryStats.rangeMax ?? 'N/A'} m</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px]">Mean Range</span>
                      <span className="font-semibold">{watch.summaryStats.rangeMean ?? 'N/A'} m</span>
                    </div>
                  </div>
                )}

                {/* Live Decoded Payload Display */}
                <div>
                  <span className="text-[11px] text-muted-foreground font-mono block mb-1">
                    Last Message (Count: {watch.messageCount})
                  </span>
                  <pre className="max-h-60 overflow-auto p-3 rounded bg-muted/30 border border-border/40 font-mono text-xs whitespace-pre-wrap select-text">
                    {watch.lastDecodedPayload !== null
                      ? JSON.stringify(watch.lastDecodedPayload, null, 2)
                      : 'Waiting for first message...'}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
