/**
 * JetRacer Control Center — Live Mapping & Map Management Page (Phase 7A)
 *
 * Implements real-time 2D occupancy grid streaming, robot pose tracking via TF,
 * pan/zoom canvas viewport, and persistent device map library with PGM/YAML import & export.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Play,
  Square,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Layers,
  Navigation,
  HardDrive,
  Loader2,
  Terminal,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { MapCanvas } from '@/components/common/MapCanvas'
import { MapStatusPanel } from './MapStatusPanel'
import { MapPosePanel } from './MapPosePanel'
import { MapLibraryPanel } from './MapLibraryPanel'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { mapManager } from '@/services/map/mapManager'
import { useMapStore } from '@/store/mapStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { topicRegistry } from '@/services/topicRegistry'
import { useConnectionStore } from '@/store/connectionStore'
import { rosDiscoveryService } from '@/services/rosDiscoveryService'
import type { DecodedOccupancyGrid, MapStreamState } from '@/services/map/mapTypes'
import { toast } from 'sonner'

export function MappingPage() {
  const isRosConnected = useConnectionStore((s) => s.status === 'connected')
  const displayConfig = useMapStore((s) => s.displayConfig)
  const updateDisplayConfig = useMapStore((s) => s.updateDisplayConfig)
  const storedTopic = useMapStore((s) => s.selectedTopic)
  const setStoredTopic = useMapStore((s) => s.setSelectedTopic)
  const throttleRateMs = useMapStore((s) => s.throttleRateMs)
  const setThrottleRateMs = useMapStore((s) => s.setThrottleRate)

  const mapFrame = useMapStore((s) => s.mapFrame)
  const robotFrame = useMapStore((s) => s.robotFrame)
  const knownFrames = useMapStore((s) => s.knownFrames)
  const setFrames = useMapStore((s) => s.setFrames)
  const clearTrail = useMapStore((s) => s.clearTrail)

  // Reactively derived OccupancyGrid topics from discovery store
  const discoTopics = useRosDiscoveryStore((s) => s.topics)
  const discoServices = useRosDiscoveryStore((s) => s.services)

  const discoveredMapTopics = useMemo(() => {
    const gridTopics = discoTopics
      .filter((t) => t.type === 'nav_msgs/OccupancyGrid')
      .map((t) => t.name)
    const roleMap = topicRegistry.getTopicForRole('occupancy_map')
    return Array.from(new Set([...gridTopics, ...(roleMap ? [roleMap] : [])])).filter(Boolean)
  }, [discoTopics])

  const discoveredGetMapService = useMemo(() => {
    const srv = discoServices.find((s) => s.type === 'nav_msgs/GetMap')
    return srv ? srv.name : null
  }, [discoServices])

  const [selectedTopicOverride, setSelectedTopicOverride] = useState<string>('')
  const selectedTopic = selectedTopicOverride || storedTopic || discoveredMapTopics[0] || ''
  const [manualTopic, setManualTopic] = useState<string>('')

  // Stream state & current map from mapManager
  const [streamState, setStreamState] = useState<MapStreamState>(mapManager.getState())
  const [streamError, setStreamError] = useState<string | null>(mapManager.getError())
  const [liveMap, setLiveMap] = useState<DecodedOccupancyGrid | null>(mapManager.getCurrentMap())
  const [loadedSavedMap, setLoadedSavedMap] = useState<{ map: DecodedOccupancyGrid; name: string } | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isFetchingSnapshot, setIsFetchingSnapshot] = useState(false)

  const currentPose = useMapStore((s) => s.currentPose)
  const trail = useMapStore((s) => s.trail)
  const metrics = useMapStore((s) => s.metrics)

  const refreshTopics = () => {
    rosDiscoveryService.discoverAll().catch(() => {})
  }

  // Trigger topic discovery on mount or when ROS connection connects
  useEffect(() => {
    if (isRosConnected && discoveredMapTopics.length === 0) {
      rosDiscoveryService.discoverAll().catch(() => {})
    }
  }, [isRosConnected, discoveredMapTopics.length])

  // Attach state error listener to mapManager
  useEffect(() => {
    const unsubState = mapManager.onStateChange((state, error) => {
      setStreamState(state)
      setStreamError(error ?? null)
    })
    return unsubState
  }, [])

  // Attach listener to mapManager for real-time map frames
  useEffect(() => {
    const unsub = mapManager.subscribe(({ map, state }) => {
      setStreamState(state)
      if (map) {
        setLiveMap(map)
        // If live map arrives, switch off static saved map view
        setLoadedSavedMap(null)
      }
    })

    return () => {
      unsub()
    }
  }, [])

  // CRITICAL: Unsubscribe when navigating away from the page
  useEffect(() => {
    return () => {
      mapManager.stop('MappingPage')
    }
  }, [])

  const activeTopic = manualTopic.trim() || selectedTopic

  const handleStartViewing = async () => {
    if (!activeTopic) {
      toast.error('Please select or enter an OccupancyGrid topic first.')
      return
    }
    setIsStarting(true)
    setStoredTopic(activeTopic)
    try {
      toast.info(`Subscribing to map on ${activeTopic}...`)
      await mapManager.start('MappingPage', activeTopic, throttleRateMs)
      setLoadedSavedMap(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Map stream error: ${msg}`)
      console.error('[MappingPage] Error starting stream:', err)
    } finally {
      setIsStarting(false)
    }
  }

  const handleStopViewing = () => {
    mapManager.stop('MappingPage')
  }

  const handleFetchSnapshot = async () => {
    if (!discoveredGetMapService) {
      toast.error('No nav_msgs/GetMap service discovered on robot.')
      return
    }
    setIsFetchingSnapshot(true)
    try {
      toast.info(`Fetching map snapshot from ${discoveredGetMapService}...`)
      const ok = await mapManager.fetchSnapshot(discoveredGetMapService)
      if (ok) {
        toast.success('Map snapshot received.')
        setLoadedSavedMap(null)
      } else {
        toast.error('Failed to fetch map snapshot.')
      }
    } finally {
      setIsFetchingSnapshot(false)
    }
  }

  const handleLoadMapToViewer = (mapData: DecodedOccupancyGrid, name: string) => {
    // Stop live stream if running so static view is clean
    if (streamState === 'live' || streamState === 'waiting') {
      mapManager.stop('MappingPage')
    }
    setLoadedSavedMap({ map: mapData, name })
    toast.info(`Viewing saved map "${name}".`)
  }

  const isStreaming =
    streamState === 'live' ||
    streamState === 'waiting' ||
    streamState === 'stale' ||
    streamState === 'degraded'

  const activeDisplayMap = loadedSavedMap ? loadedSavedMap.map : liveMap

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Mapping & SLAM"
        description="Synchronous Localization and Mapping (Gmapping / Cartographer) occupancy grid generation & TF robot tracking"
        phase="Phase 7A"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Robot Agent not detected in Stage 7A. Run 'roslaunch jetracer slam.launch' manually on the robot."
              className="text-xs gap-1.5"
            >
              <Terminal className="h-3.5 w-3.5 text-zinc-500" />
              <span>Start SLAM (Agent Req.)</span>
            </Button>
          </div>
        }
      />

      {/* TOP CONTROLS BAR: Topic, Rate, Refresh, Start/Stop */}
      <Card className="bg-card/70 border-border/60">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {/* Topic Select */}
            <div className="w-full sm:w-64 space-y-1">
              <Label htmlFor="map-topic-select" className="text-xs text-muted-foreground">
                OccupancyGrid Topic
              </Label>
              {discoveredMapTopics.length > 0 ? (
                <Select
                  value={selectedTopic}
                  onValueChange={(val) => {
                    setSelectedTopicOverride(val)
                    setManualTopic('')
                    if (isStreaming) {
                      mapManager.start('MappingPage', val, throttleRateMs)
                    }
                  }}
                  disabled={isStreaming}
                >
                  <SelectTrigger id="map-topic-select" aria-label="OccupancyGrid Topic" className="h-9 font-mono text-xs">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {discoveredMapTopics.map((top) => (
                      <SelectItem key={top} value={top} className="font-mono text-xs">
                        {top}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="map-topic-select"
                  aria-label="OccupancyGrid Topic"
                  placeholder="/map or /slam/map"
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value)}
                  disabled={isStreaming}
                  className="h-9 font-mono text-xs"
                />
              )}
            </div>

            {/* Throttle Rate */}
            <div className="w-full sm:w-40 space-y-1">
              <Label htmlFor="map-throttle-select" className="text-xs text-muted-foreground">
                Throttle Rate (Min 1s)
              </Label>
              <Select
                value={String(throttleRateMs)}
                onValueChange={(val) => setThrottleRateMs(Number(val))}
                disabled={isStreaming}
              >
                <SelectTrigger id="map-throttle-select" aria-label="Throttle Rate" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1000">1000 ms (1.0 Hz)</SelectItem>
                  <SelectItem value="2000">2000 ms (0.5 Hz)</SelectItem>
                  <SelectItem value="5000">5000 ms (0.2 Hz)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Refresh Topics */}
            <div className="pt-5 hidden sm:block">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={refreshTopics}
                title="Refresh Topics"
                aria-label="Refresh Topics"
                disabled={isStreaming}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Action Buttons: Start / Stop Viewing */}
          <div className="flex items-center gap-2">
            {!isStreaming ? (
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white min-w-[140px]"
                disabled={!isRosConnected || !activeTopic || isStarting}
                onClick={handleStartViewing}
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Start Viewing
                  </>
                )}
              </Button>
            ) : (
              <>
                {streamState === 'waiting' && (
                  <span className="text-xs text-amber-400 flex items-center gap-1.5 mr-1 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Subscribing...
                  </span>
                )}
                {streamState === 'stale' && (
                  <span className="text-xs text-rose-400 flex items-center gap-1.5 mr-1 font-mono">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Stalled (&gt;15s)
                  </span>
                )}
                <Button
                  variant="destructive"
                  className="gap-2 min-w-[130px]"
                  onClick={handleStopViewing}
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop Viewing
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Robot Disconnected Alert */}
      {!isRosConnected && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 flex items-start gap-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm">Robot Disconnected</span>
            <p className="text-amber-300/80">
              The JetRacer ROS connection is offline. Connect to rosbridge from the top navigation bar to view live maps.
            </p>
          </div>
        </div>
      )}

      {/* Discovered Topic Empty State Alert */}
      {isRosConnected && discoveredMapTopics.length === 0 && !manualTopic && (
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-600/30 flex items-start gap-3 text-blue-300 text-xs">
          <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm">No Active OccupancyGrid Topic Discovered</span>
            <p className="text-blue-200/80">
              No active node is publishing <code className="bg-blue-950 px-1 py-0.5 rounded">nav_msgs/OccupancyGrid</code>.
              To generate a map, start SLAM on the Jetson Nano terminal (e.g. <code className="bg-blue-950 px-1 py-0.5 rounded">roslaunch jetracer slam.launch</code>).
              Ensure the base driver is not started twice!
            </p>
          </div>
        </div>
      )}

      {/* Stream Error Alert Banner */}
      {streamError && streamState === 'error' && (
        <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-600/40 flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm">Map Stream Error</span>
            <p className="text-rose-200/90">{streamError}</p>
          </div>
        </div>
      )}

      {/* Loaded Static Saved Map Banner */}
      {loadedSavedMap && (
        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary shrink-0" />
            <span>Viewing saved map: <strong className="font-mono text-white">{loadedSavedMap.name}</strong> (Saved map, not live)</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-zinc-400 hover:text-white"
            onClick={() => setLoadedSavedMap(null)}
          >
            Close View
          </Button>
        </div>
      )}

      {/* MAIN LAYOUT: Map Canvas Viewport (Left 2 cols) & Side Panel Tabs (Right 1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="p-2 sm:p-3 bg-zinc-950 border-zinc-800">
            <MapCanvas
              map={activeDisplayMap}
              pose={currentPose}
              trail={trail}
              config={displayConfig}
              onConfigChange={updateDisplayConfig}
              height="580px"
            />
          </Card>
        </div>

        {/* SIDE PANEL: Status, Pose & Frames, Library Tabs */}
        <div>
          <Tabs defaultValue="status" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-3">
              <TabsTrigger value="status" className="text-xs gap-1.5">
                <Layers className="h-3.5 w-3.5" />
                Status
              </TabsTrigger>
              <TabsTrigger value="pose" className="text-xs gap-1.5">
                <Navigation className="h-3.5 w-3.5" />
                Pose & TF
              </TabsTrigger>
              <TabsTrigger value="library" className="text-xs gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                Library
              </TabsTrigger>
            </TabsList>

            <TabsContent value="status" className="m-0 focus-visible:outline-none">
              <MapStatusPanel
                state={streamState}
                metrics={metrics}
                map={activeDisplayMap}
                topic={activeTopic}
                getMapService={discoveredGetMapService}
                onFetchSnapshot={handleFetchSnapshot}
                isFetchingSnapshot={isFetchingSnapshot}
              />
            </TabsContent>

            <TabsContent value="pose" className="m-0 focus-visible:outline-none">
              <MapPosePanel
                pose={currentPose}
                trail={trail}
                mapFrame={mapFrame}
                robotFrame={robotFrame}
                knownFrames={knownFrames}
                onFramesChange={setFrames}
                onClearTrail={clearTrail}
              />
            </TabsContent>

            <TabsContent value="library" className="m-0 focus-visible:outline-none">
              <MapLibraryPanel
                currentMap={activeDisplayMap}
                onLoadMapToViewer={handleLoadMapToViewer}
                activeLoadedMapName={loadedSavedMap?.name}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

export default MappingPage
