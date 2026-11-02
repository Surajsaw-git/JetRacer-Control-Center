/**
 * Camera Streaming Page (Phase 5)
 *
 * Provides:
 * - Dynamic topic discovery (sensor_msgs/Image and sensor_msgs/CompressedImage)
 * - Base topic grouping and Topic Registry role ('camera_image') awareness
 * - Dual transport selection: WebVideoServer (HTTP MJPEG) vs RosbridgeCompressed (WebSocket)
 * - Stream quality presets (Low, Medium, High, Auto, Custom)
 * - Fullscreen 16:9 canvas viewport with letterboxing, HUD overlay, and snapshots
 * - On-robot troubleshooting runbook and command diagnostic drawer
 * - Read-only safety enforcement: zero robot publishing/parameter writes
 */

import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { VideoViewport } from '@/components/common/VideoViewport'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Camera,
  Play,
  Square,
  Sliders,
  ShieldAlert,
  Server,
  Terminal,
} from 'lucide-react'
import { cameraManager } from '@/services/camera/cameraManager'
import type {
  CameraQualityPreset,
  CameraSourceType,
  CameraStreamState,
} from '@/services/camera/cameraTypes'
import { useCameraStore } from '@/store/cameraStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'
import { useConnectionStore } from '@/store/connectionStore'
import { resolveBaseTopic } from '@/services/camera/cameraUrl'

export function CameraPage() {
  const connectionStatus = useConnectionStore((s) => s.status)
  const discoveredTopics = useRosDiscoveryStore((s) => s.topics)
  const registryMapping = useTopicRegistryStore((s) => s.mappings.camera_image)

  // Camera Store State
  const selectedTopic = useCameraStore((s) => s.selectedTopic)
  const setSelectedTopic = useCameraStore((s) => s.setSelectedTopic)
  const sourceType = useCameraStore((s) => s.sourceType)
  const setSourceType = useCameraStore((s) => s.setSourceType)
  const webVideoPort = useCameraStore((s) => s.webVideoPort)
  const setWebVideoPort = useCameraStore((s) => s.setWebVideoPort)
  const qualityPreset = useCameraStore((s) => s.qualityPreset)
  const setQualityPreset = useCameraStore((s) => s.setQualityPreset)
  const autoStart = useCameraStore((s) => s.autoStart)
  const setAutoStart = useCameraStore((s) => s.setAutoStart)

  const [manualTopicInput, setManualTopicInput] = useState('')
  const [streamState, setStreamState] = useState<CameraStreamState>(cameraManager.currentState)

  // Listen to live cameraManager stream state
  useEffect(() => {
    const unsub = cameraManager.subscribeState((state) => {
      setStreamState(state)
    })
    return unsub
  }, [])

  // Filter discovered image topics
  const imageTopics = useMemo(() => {
    return discoveredTopics.filter(
      (t) =>
        t.type === 'sensor_msgs/Image' ||
        t.type === 'sensor_msgs/CompressedImage' ||
        t.name.includes('/image') ||
        t.name.includes('/camera'),
    )
  }, [discoveredTopics])

  // Group image topics by base name
  const groupedBaseTopics = useMemo(() => {
    const set = new Set<string>()
    for (const t of imageTopics) {
      const base = resolveBaseTopic(t.name)
      if (base) set.add(base)
    }
    return Array.from(set)
  }, [imageTopics])

  // Auto-select topic if unselected: honor registry mapped topic or first discovered
  useEffect(() => {
    if (!selectedTopic) {
      if (registryMapping?.assignedTopic) {
        setSelectedTopic(registryMapping.assignedTopic)
      } else if (groupedBaseTopics.length > 0) {
        setSelectedTopic(groupedBaseTopics[0])
      }
    }
  }, [selectedTopic, registryMapping, groupedBaseTopics, setSelectedTopic])

  // Optional auto-start (only if user explicitly turned autoStart toggle ON)
  useEffect(() => {
    if (autoStart && connectionStatus === 'connected' && selectedTopic && streamState === 'idle') {
      cameraManager.startStream(selectedTopic)
    }
  }, [autoStart, connectionStatus, selectedTopic, streamState])

  const handleStartStop = () => {
    if (streamState === 'streaming' || streamState === 'connecting' || streamState === 'reconnecting') {
      cameraManager.stopStream()
    } else {
      cameraManager.startStream(selectedTopic)
    }
  }

  const handleManualTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualTopicInput.trim()) return
    const formatted = manualTopicInput.trim().startsWith('/')
      ? manualTopicInput.trim()
      : `/${manualTopicInput.trim()}`
    setSelectedTopic(formatted)
    setManualTopicInput('')
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Camera Streaming"
        description="High-definition CSI / USB camera stream with multi-transport failover and quality adaptation"
        phase="5 Integration"
      />

      {/* Main 16:9 Video Viewport */}
      <div className="w-full max-w-5xl mx-auto">
        <VideoViewport consumerId="camera_page" />
      </div>

      {/* Top Stream Control Bar */}
      <Card className="max-w-5xl mx-auto">
        <CardContent className="pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Topic Selector */}
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" />
              Camera Topic
              {registryMapping?.assignedTopic === selectedTopic && (
                <Badge variant="secondary" className="text-[10px] font-mono py-0 h-4 ml-1">
                  Registry Mapped
                </Badge>
              )}
            </Label>

            {groupedBaseTopics.length > 0 ? (
              <Select value={selectedTopic} onValueChange={(val) => setSelectedTopic(val)}>
                <SelectTrigger className="w-full text-xs font-mono h-9" aria-label="Select Camera Topic">
                  <SelectValue placeholder="Choose camera topic..." />
                </SelectTrigger>
                <SelectContent>
                  {groupedBaseTopics.map((base) => (
                    <SelectItem key={base} value={base} className="text-xs font-mono">
                      {base}
                    </SelectItem>
                  ))}
                  {selectedTopic && !groupedBaseTopics.includes(selectedTopic) && (
                    <SelectItem value={selectedTopic} className="text-xs font-mono">
                      {selectedTopic} (Custom)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <form onSubmit={handleManualTopicSubmit} className="flex gap-2">
                <Input
                  value={manualTopicInput || selectedTopic}
                  onChange={(e) => setManualTopicInput(e.target.value)}
                  placeholder="/csi_cam_0/image_raw"
                  className="text-xs font-mono h-9"
                  aria-label="Manual Camera Topic Input"
                />
                <Button type="submit" variant="outline" size="sm" className="h-9 text-xs">
                  Apply
                </Button>
              </form>
            )}
          </div>

          {/* Transport Selector */}
          <div className="w-full md:w-56 space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-primary" />
              Transport Source
            </Label>
            <Select
              value={sourceType}
              onValueChange={(val) => setSourceType(val as CameraSourceType)}
            >
              <SelectTrigger className="w-full text-xs h-9" aria-label="Select Transport Source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="web_video_server" className="text-xs">
                  web_video_server (HTTP Port {webVideoPort})
                </SelectItem>
                <SelectItem value="rosbridge_compressed" className="text-xs">
                  rosbridge (CompressedImage)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality Preset */}
          <div className="w-full md:w-44 space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Quality Preset
            </Label>
            <Select
              value={qualityPreset}
              onValueChange={(val) => setQualityPreset(val as CameraQualityPreset)}
            >
              <SelectTrigger className="w-full text-xs h-9" aria-label="Select Quality Preset">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low" className="text-xs">
                  Low (25% scale, 10fps)
                </SelectItem>
                <SelectItem value="medium" className="text-xs">
                  Medium (50% scale, 15fps)
                </SelectItem>
                <SelectItem value="high" className="text-xs">
                  High (Native scale, 20fps)
                </SelectItem>
                <SelectItem value="auto" className="text-xs">
                  Auto (Dynamic Adapt)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Start/Stop Button */}
          <div className="flex items-end pt-1 md:pt-0">
            <Button
              type="button"
              variant={
                streamState === 'streaming' ||
                streamState === 'connecting' ||
                streamState === 'reconnecting'
                  ? 'destructive'
                  : 'default'
              }
              onClick={handleStartStop}
              disabled={!selectedTopic && streamState === 'idle'}
              className="h-9 w-full md:w-32 text-xs font-semibold gap-1.5"
            >
              {streamState === 'streaming' ||
              streamState === 'connecting' ||
              streamState === 'reconnecting' ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Stop Stream
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Start Stream
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Camera Configuration & Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {/* Stream Telemetry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              Stream Details
            </CardTitle>
            <CardDescription className="text-xs">Active sensor profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Active Topic</span>
              <span className="font-mono font-medium truncate max-w-[160px]" title={selectedTopic}>
                {selectedTopic || 'None'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Stream Status</span>
              <Badge
                variant={
                  streamState === 'streaming'
                    ? 'default'
                    : streamState === 'stalled'
                      ? 'destructive'
                      : 'secondary'
                }
                className="text-[10px] font-mono"
              >
                {streamState.toUpperCase()}
              </Badge>
            </div>
            <div className="flex justify-between py-1 border-b border-border/40">
              <span className="text-muted-foreground">Transport</span>
              <span className="font-mono">
                {sourceType === 'web_video_server' ? 'HTTP MJPEG' : 'WebSocket / Base64'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Quality Profile</span>
              <span className="font-mono font-semibold uppercase">{qualityPreset}</span>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Preferences */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Stream Settings
            </CardTitle>
            <CardDescription className="text-xs">Connection preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-medium text-foreground">Auto-Start Stream</span>
                <p className="text-[11px] text-muted-foreground">
                  Starts video automatically on connection
                </p>
              </div>
              <Switch
                checked={autoStart}
                onCheckedChange={setAutoStart}
                aria-label="Toggle Auto-Start Camera Stream"
              />
            </div>

            <div className="space-y-1 pt-1 border-t border-border/40">
              <Label className="text-xs text-muted-foreground">web_video_server HTTP Port</Label>
              <Input
                type="number"
                min={1}
                max={65535}
                value={webVideoPort}
                onChange={(e) => setWebVideoPort(parseInt(e.target.value, 10) || 8080)}
                className="h-8 text-xs font-mono"
                aria-label="web_video_server Port"
              />
            </div>
          </CardContent>
        </Card>

        {/* Safety & Teleoperation Warning */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Safety & Teleoperation
            </CardTitle>
            <CardDescription className="text-xs">Latency awareness notice</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              Phase 5 camera streaming is strictly <strong className="text-foreground">read-only</strong>.
              Driving controls remain locked until Phase 9.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 text-[11px] text-amber-600 dark:text-amber-400">
              When teleoperation is enabled in later phases, direct driving requires sub-100ms
              latency. Press <kbd className="px-1 py-0.5 bg-black/40 rounded border font-mono">F</kbd> for fullscreen view.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Robot-Side Camera Runbook / Diagnostic Drawer */}
      <Card className="max-w-5xl mx-auto border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Robot-Side Setup & Diagnostics (Runbook)
          </CardTitle>
          <CardDescription className="text-xs">
            Verify the JetRacer CSI camera driver and web_video_server on the robot
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            If the video stream does not start or fails to load, execute these commands on the Jetson
            terminal:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[11px]">
            <div className="bg-muted/50 p-2.5 rounded border border-border/60 space-y-1">
              <span className="text-primary font-semibold block">// 1. Check Camera Pipeline:</span>
              <code>bash robot/scripts/check_camera.sh</code>
            </div>

            <div className="bg-muted/50 p-2.5 rounded border border-border/60 space-y-1">
              <span className="text-primary font-semibold block">// 2. Install Missing Camera Stack:</span>
              <code>bash robot/scripts/install_camera_stack.sh</code>
            </div>

            <div className="bg-muted/50 p-2.5 rounded border border-border/60 space-y-1">
              <span className="text-primary font-semibold block">// 3. Launch Video Stream Server:</span>
              <code>roslaunch robot/launch/jetracer_web_video.launch</code>
            </div>

            <div className="bg-muted/50 p-2.5 rounded border border-border/60 space-y-1">
              <span className="text-primary font-semibold block">// 4. Full Camera Helper:</span>
              <code>bash robot/scripts/start_camera.sh</code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CameraPage
