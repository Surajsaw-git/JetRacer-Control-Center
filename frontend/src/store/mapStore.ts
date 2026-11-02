/**
 * JetRacer Control Center — Map State & Preferences Store (Phase 7A)
 *
 * Persists user frame preferences (mapFrame, robotFrame), visualization configuration,
 * and tracks live stream state and metrics from MapManager and PoseService.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mapManager } from '@/services/map/mapManager'
import { tfService } from '@/services/map/tfService'
import { poseService } from '@/services/map/poseService'
import type {
  MapDisplayConfig,
  MapStreamState,
  MapSummaryMetrics,
  PoseTrailPoint,
  RobotPose2D,
} from '@/services/map/mapTypes'
import { DEFAULT_MAP_CONFIG } from '@/services/map/mapTypes'

export interface MapStoreState {
  streamState: MapStreamState
  streamError: string | null
  selectedTopic: string
  throttleRateMs: number

  // Selected frames for robot pose lookup
  mapFrame: string
  robotFrame: string
  odomFrame: string
  knownFrames: string[]

  displayConfig: MapDisplayConfig
  metrics: MapSummaryMetrics
  currentPose: RobotPose2D | null
  trail: PoseTrailPoint[]

  // Actions
  setSelectedTopic: (topic: string) => void
  setThrottleRate: (rateMs: number) => void
  setFrames: (mapFrame: string, robotFrame: string, odomFrame?: string) => void
  updateDisplayConfig: (config: Partial<MapDisplayConfig>) => void
  startStream: () => Promise<void>
  stopStream: () => void
  fetchSnapshot: (serviceName: string) => Promise<boolean>
  clearTrail: () => void
}

export const useMapStore = create<MapStoreState>()(
  persist(
    (set, get) => ({
      streamState: mapManager.getState(),
      streamError: mapManager.getError(),
      selectedTopic: '',
      throttleRateMs: 1000,

      mapFrame: 'map',
      robotFrame: 'base_footprint',
      odomFrame: 'odom',
      knownFrames: [],

      displayConfig: { ...DEFAULT_MAP_CONFIG },
      metrics: mapManager.getMetrics(),
      currentPose: null,
      trail: [],

      setSelectedTopic: (topic) => {
        set({ selectedTopic: topic })
        mapManager.setSelectedTopic(topic)
      },

      setThrottleRate: (rateMs) => {
        set({ throttleRateMs: rateMs })
        mapManager.setThrottleRate(rateMs)
      },

      setFrames: (mapFrame, robotFrame, odomFrame = 'odom') => {
        set({ mapFrame, robotFrame, odomFrame })
        poseService.setFrames(mapFrame, robotFrame, odomFrame)
      },

      updateDisplayConfig: (config) => {
        set((state) => {
          const updated = { ...state.displayConfig, ...config }
          mapManager.updateDisplayConfig(updated)
          return { displayConfig: updated }
        })
      },

      startStream: async () => {
        const topic = get().selectedTopic
        if (topic) {
          mapManager.setSelectedTopic(topic)
        }
        await mapManager.startStream()
      },

      stopStream: () => {
        mapManager.stopStream()
      },

      fetchSnapshot: async (serviceName) => {
        return mapManager.fetchSnapshot(serviceName)
      },

      clearTrail: () => {
        poseService.clearTrail()
        set({ trail: [] })
      },
    }),
    {
      name: 'jetracer_map_settings_v1',
      partialize: (state) => ({
        selectedTopic: state.selectedTopic,
        throttleRateMs: state.throttleRateMs,
        mapFrame: state.mapFrame,
        robotFrame: state.robotFrame,
        odomFrame: state.odomFrame,
        displayConfig: state.displayConfig,
      }),
    },
  ),
)

// Wire listeners safely outside the creator function so initial state is never clobbered
mapManager.onStateChange((state, error) => {
  useMapStore.setState({ streamState: state, streamError: error ?? null })
})

mapManager.onMetrics((metrics) => {
  useMapStore.setState({ metrics })
})

tfService.onFramesChanged((knownFrames) => {
  useMapStore.setState({ knownFrames })
})

poseService.subscribe((currentPose, trail) => {
  useMapStore.setState({ currentPose, trail })
})
