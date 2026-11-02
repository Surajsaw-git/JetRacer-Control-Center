import { useState, useEffect, useMemo } from 'react'
import {
  Play,
  Square,
  Pause,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Compass,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { LidarCanvas } from '@/components/common/LidarCanvas'
import { LidarStatusPanel } from './LidarStatusPanel'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { lidarManager } from '@/services/lidar/lidarManager'
import { useLidarStore } from '@/store/lidarStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { topicRegistry } from '@/services/topicRegistry'
import { useConnectionStore } from '@/store/connectionStore'
import type { DecodedScan, LidarMetrics, LidarSectorReadouts, LidarStreamState } from '@/services/lidar/lidarTypes'
import { DEFAULT_LIDAR_CONFIG } from '@/services/lidar/lidarTypes'

export function LidarPage() {
  const isRosConnected = useConnectionStore((s) => s.status === 'connected')
  const displayConfig = useLidarStore((s) => s.displayConfig)
  const safeDisplayConfig = displayConfig || DEFAULT_LIDAR_CONFIG
  const currentRotDeg = safeDisplayConfig.rotationDeg ?? safeDisplayConfig.frontAngleOffsetDeg ?? 0
  const updateDisplayConfig = useLidarStore((s) => s.updateDisplayConfig)
  const storedTopic = useLidarStore((s) => s.selectedTopic)
  const setStoredTopic = useLidarStore((s) => s.setSelectedTopic)

  // Reactively derived LaserScan topics from discovery store with memoization
  const discoTopics = useRosDiscoveryStore((s) => s.topics)
  const discoveredTopics = useMemo(() => {
    const laserTopics = discoTopics.filter((t) => t.type === 'sensor_msgs/LaserScan').map((t) => t.name)
    const roleLaser = topicRegistry.getTopicForRole('laser_scan')
    return Array.from(new Set([...laserTopics, ...(roleLaser ? [roleLaser] : [])])).filter(Boolean)
  }, [discoTopics])

  const [selectedTopicOverride, setSelectedTopicOverride] = useState<string>('')
  const selectedTopic = selectedTopicOverride || storedTopic || discoveredTopics[0] || ''
  const [manualTopic, setManualTopic] = useState<string>('')
  const [throttleRateMs, setThrottleRateMs] = useState<number>(100) // Default 100ms (10Hz)

  // Stream state & current scan from lidarManager
  const [streamState, setStreamState] = useState<LidarStreamState>(lidarManager.getState())
  const [currentScan, setCurrentScan] = useState<DecodedScan | null>(lidarManager.getCurrentScan())
  const [metrics, setMetrics] = useState<LidarMetrics>(lidarManager.getMetrics())
  const [sectors, setSectors] = useState<LidarSectorReadouts | null>(lidarManager.getSectors())
  const [isPaused, setIsPaused] = useState<boolean>(false)

  const refreshTopics = () => {
    // Topics are reactively bound to useRosDiscoveryStore
  }

  // Attach listener to lidarManager for real-time state & scans
  useEffect(() => {
    const unsub = lidarManager.subscribe(({ scan, state, metrics: m, sectors: s }) => {
      setStreamState(state)
      setMetrics(m)
      setSectors(s)
      if (!isPaused) {
        setCurrentScan(scan)
      }
    })

    return () => {
      unsub()
    }
  }, [isPaused])

  // CRITICAL: Unsubscribe when navigating away from the page
  useEffect(() => {
    return () => {
      lidarManager.stop('LidarPage')
    }
  }, [])

  // Page visibility watchdog: throttle/stop or restore when tab hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (lidarManager.getState() === 'streaming') {
          lidarManager.stop('LidarPage')
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const activeTopic = manualTopic.trim() || selectedTopic

  const handleStartStream = async () => {
    if (!activeTopic) return
    setStoredTopic(activeTopic)
    await lidarManager.start('LidarPage', activeTopic, throttleRateMs)
  }

  const handleStopStream = () => {
    lidarManager.stop('LidarPage')
  }

  const handleTogglePause = () => {
    setIsPaused((prev) => !prev)
  }

  const isStreaming = streamState === 'streaming' || streamState === 'waiting'

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="LiDAR Laser Scanner"
        description="Real-time 2D planar range visualization, polar geometry & obstacle proximity monitoring"
        phase="Phase 6"
      />

      {/* TOP CONTROLS BAR: Topic, Rate, Start/Stop */}
      <Card className="bg-card/70 border-border/60">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            {/* Topic Select */}
            <div className="w-full sm:w-64 space-y-1">
              <Label htmlFor="lidar-topic-select" className="text-xs text-muted-foreground">LaserScan Topic</Label>
              {discoveredTopics.length > 0 ? (
                <Select
                  value={selectedTopic}
                  onValueChange={(val) => {
                    setSelectedTopicOverride(val)
                    setManualTopic('')
                    if (isStreaming) {
                      lidarManager.start('LidarPage', val, throttleRateMs)
                    }
                  }}
                  disabled={isStreaming}
                >
                  <SelectTrigger id="lidar-topic-select" aria-label="LaserScan Topic" className="h-9 font-mono text-xs">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {discoveredTopics.map((top) => (
                      <SelectItem key={top} value={top} className="font-mono text-xs">
                        {top}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="lidar-topic-select"
                  aria-label="LaserScan Topic"
                  placeholder="/scan or /laser/scan"
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value)}
                  disabled={isStreaming}
                  className="h-9 font-mono text-xs"
                />
              )}
            </div>

            {/* Throttle Rate */}
            <div className="w-full sm:w-36 space-y-1">
              <Label htmlFor="lidar-throttle-select" className="text-xs text-muted-foreground">Throttle Rate</Label>
              <Select
                value={String(throttleRateMs)}
                onValueChange={(val) => setThrottleRateMs(Number(val))}
                disabled={isStreaming}
              >
                <SelectTrigger id="lidar-throttle-select" aria-label="Throttle Rate" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50 ms (20 Hz)</SelectItem>
                  <SelectItem value="100">100 ms (10 Hz)</SelectItem>
                  <SelectItem value="200">200 ms (5 Hz)</SelectItem>
                  <SelectItem value="500">500 ms (2 Hz)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quick Refresh Topic Button */}
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

          {/* Action Buttons: Start / Stop / Pause */}
          <div className="flex items-center gap-2">
            {!isStreaming ? (
              <Button
                className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white min-w-[130px]"
                disabled={!isRosConnected || !activeTopic}
                onClick={handleStartStream}
              >
                <Play className="w-4 h-4 fill-white" />
                Start Stream
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTogglePause}
                  className="gap-1.5 h-10 text-xs"
                >
                  <Pause className="w-3.5 h-3.5" />
                  {isPaused ? 'Resume' : 'Freeze'}
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2 min-w-[130px]"
                  onClick={handleStopStream}
                >
                  <Square className="w-4 h-4 fill-white" />
                  Stop Stream
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ROS Offline / Unconnected Banner */}
      {!isRosConnected && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 flex items-start gap-3 text-amber-300 text-xs">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm">Robot Disconnected</span>
            <p className="text-amber-300/80">
              The JetRacer ROS connection is offline. Connect to rosbridge from the top navigation
              bar or Connection page to discover and stream LiDAR data.
            </p>
          </div>
        </div>
      )}

      {/* Discovered Topic Empty State Alert */}
      {isRosConnected && discoveredTopics.length === 0 && !manualTopic && (
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-600/30 flex items-start gap-3 text-blue-300 text-xs">
          <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-sm">No LaserScan Topic Found</span>
            <p className="text-blue-200/80">
              No active publisher was found advertising <code className="bg-blue-950 px-1 py-0.5 rounded">sensor_msgs/LaserScan</code>.
              Verify that the LiDAR node (e.g. RPLIDAR, YDLIDAR, or mock server) is running on the robot.
              You can also type a topic name manually into the input field above.
            </p>
          </div>
        </div>
      )}

      {/* Main LiDAR Radar Viewport */}
      <Card className="p-2 sm:p-3 bg-zinc-950 border-zinc-800">
        <LidarCanvas
          scan={currentScan}
          config={safeDisplayConfig}
          onConfigChange={updateDisplayConfig}
          paused={isPaused}
          height="540px"
        />
      </Card>

      {/* Detailed Status & Diagnostics Panel */}
      <LidarStatusPanel
        state={streamState}
        metrics={metrics}
        scan={currentScan}
        sectors={sectors}
        config={safeDisplayConfig}
        topic={activeTopic}
      />

      {/* Hardware Mounting & Front Offset Quick Adjuster */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            Sensor Mount & Orientation Calibration
          </CardTitle>
          <CardDescription className="text-xs">
            Adjust the sensor front zero-offset angle if the LiDAR is mounted rotated on the chassis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground mr-2">Preset Offsets:</span>
            {[0, 90, 180, 270].map((deg) => (
              <Button
                key={deg}
                size="sm"
                variant={currentRotDeg === deg ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => updateDisplayConfig({ rotationDeg: deg, frontAngleOffsetDeg: deg })}
              >
                {deg}° {deg === 0 ? '(Standard)' : ''}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-4 max-w-sm">
            <Label className="text-muted-foreground whitespace-nowrap">Fine Stepper:</Label>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => {
                  const next = (currentRotDeg - 5 + 360) % 360
                  updateDisplayConfig({ rotationDeg: next, frontAngleOffsetDeg: next })
                }}
              >
                -5°
              </Button>
              <span className="font-mono text-center w-12 text-sm font-bold">
                {currentRotDeg}°
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0"
                onClick={() => {
                  const next = (currentRotDeg + 5) % 360
                  updateDisplayConfig({ rotationDeg: next, frontAngleOffsetDeg: next })
                }}
              >
                +5°
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
