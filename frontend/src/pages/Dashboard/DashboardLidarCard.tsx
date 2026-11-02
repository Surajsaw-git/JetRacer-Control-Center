import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Radar, Play, Square, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LidarCanvas } from '@/components/common/LidarCanvas'
import { lidarManager } from '@/services/lidar/lidarManager'
import { useLidarStore } from '@/store/lidarStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { useConnectionStore } from '@/store/connectionStore'
import type { DecodedScan, LidarStreamState } from '@/services/lidar/lidarTypes'

export const DashboardLidarCard: React.FC = () => {
  const isRosConnected = useConnectionStore((s) => s.status === 'connected')
  const displayConfig = useLidarStore((s) => s.displayConfig)
  const storedTopic = useLidarStore((s) => s.selectedTopic)

  const [streamState, setStreamState] = useState<LidarStreamState>(lidarManager.getState())
  const [currentScan, setCurrentScan] = useState<DecodedScan | null>(lidarManager.getCurrentScan())
  const [isStreaming, setIsStreaming] = useState<boolean>(false)

  const discoveredLaserTopic = useRosDiscoveryStore((s) => {
    const found = s.topics.find((t) => t.type === 'sensor_msgs/LaserScan')
    return found ? found.name : ''
  })

  const activeTopic = storedTopic || discoveredLaserTopic

  useEffect(() => {
    const unsub = lidarManager.subscribe(({ scan, state }) => {
      setStreamState(state)
      setCurrentScan(scan)
    })
    return () => {
      unsub()
      // Crucial: halt preview on unmount
      lidarManager.stop('DashboardCard')
    }
  }, [])

  const handleTogglePreview = async () => {
    if (isStreaming) {
      lidarManager.stop('DashboardCard')
      setIsStreaming(false)
    } else {
      if (!activeTopic) return
      const started = await lidarManager.start('DashboardCard', activeTopic, 100)
      if (started) {
        setIsStreaming(true)
      }
    }
  }

  const getStateBadge = () => {
    switch (streamState) {
      case 'streaming':
        return <Badge className="bg-emerald-600/90 text-white font-mono text-[10px]">LIVE</Badge>
      case 'waiting':
        return <Badge className="bg-amber-600/90 text-white font-mono text-[10px]">WAITING</Badge>
      case 'stalled':
        return <Badge variant="destructive" className="font-mono text-[10px]">STALLED</Badge>
      default:
        return <Badge variant="outline" className="font-mono text-[10px]">OFFLINE</Badge>
    }
  }

  return (
    <Card className="flex flex-col border-border/60">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              LiDAR Proximity Radar
            </CardTitle>
            {getStateBadge()}
          </div>
          <CardDescription className="text-xs">
            {activeTopic ? `Topic: ${activeTopic}` : '2D planar obstacle scan'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {isRosConnected && (
            <Button
              variant="outline"
              size="sm"
              disabled={!isStreaming && !activeTopic}
              onClick={handleTogglePreview}
              className="text-xs h-7 gap-1"
            >
              {isStreaming ? (
                <>
                  <Square className="w-3 h-3 fill-destructive text-destructive" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-primary text-primary" />
                  Preview
                </>
              )}
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="min-h-[32px] text-xs gap-1"
          >
            <Link to="/lidar">
              Full View
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-3">
        <LidarCanvas
          scan={currentScan}
          config={displayConfig}
          height="280px"
          className="border-zinc-800"
        />
      </CardContent>
    </Card>
  )
}
