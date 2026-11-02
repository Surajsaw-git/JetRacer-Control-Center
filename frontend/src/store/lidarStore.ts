/**
 * JetRacer Control Center — LiDAR State & Visualization Store (Phase 6)
 *
 * Manages user display preferences, manual orientation offset, persisted settings,
 * and UI view configurations.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { lidarManager } from '@/services/lidar/lidarManager'
import type {
  LidarDisplayConfig,
  LidarMetrics,
  LidarSectorReadouts,
  LidarStreamState,
} from '@/services/lidar/lidarTypes'

export interface LidarStoreState {
  streamState: LidarStreamState
  streamError: string | null
  selectedTopic: string
  throttleRateMs: number
  autoStartOnMount: boolean

  // Display configuration
  displayConfig: LidarDisplayConfig
  dangerThresholdM: number
  cautionThresholdM: number

  // Live telemetry (updated at throttled rate from manager)
  metrics: LidarMetrics
  sectorReadouts: LidarSectorReadouts

  // Actions
  setSelectedTopic: (topic: string) => void
  setThrottleRate: (rateMs: number) => void
  setAutoStartOnMount: (enabled: boolean) => void
  updateDisplayConfig: (config: Partial<LidarDisplayConfig>) => void
  setThresholds: (dangerM: number, cautionM: number) => void
  setRotationDeg: (deg: number) => void
  toggleMirror: () => void
  startStream: () => Promise<void>
  stopStream: () => void
  resetToDefaults: () => void
}

const defaultDisplayConfig: LidarDisplayConfig = {
  rotationDeg: 0,
  mirror: false,
  renderMode: 'points',
  colorMode: 'distance',
  showMaxRangeBoundary: true,
  showMinRangeDeadZone: true,
  showNoDataTicks: true,
  showGhostTrail: false,
  ghostTrailCount: 3,
  displayRangeLimitM: 12.0,
  showRangeRings: true,
  showSectorOverlays: true,
}

export const useLidarStore = create<LidarStoreState>()(
  persist(
    (set, get) => {
      // Wire manager state listener
      lidarManager.onStateChange((state, error) => {
        set({ streamState: state, streamError: error ?? null })
      })

      lidarManager.onMetrics((metrics) => {
        set({
          metrics,
          sectorReadouts: lidarManager.sectorReadouts,
        })
      })

      return {
        streamState: lidarManager.currentState,
        streamError: lidarManager.currentError,
        selectedTopic: '',
        throttleRateMs: 100,
        autoStartOnMount: false,

        displayConfig: defaultDisplayConfig,
        dangerThresholdM: 0.5,
        cautionThresholdM: 1.0,

        metrics: lidarManager.metrics,
        sectorReadouts: lidarManager.sectorReadouts,

        setSelectedTopic: (topic) => {
          set({ selectedTopic: topic })
          lidarManager.setSelectedTopic(topic)
        },

        setThrottleRate: (rateMs) => {
          set({ throttleRateMs: rateMs })
          lidarManager.setThrottleRate(rateMs)
        },

        setAutoStartOnMount: (enabled) => set({ autoStartOnMount: enabled }),

        updateDisplayConfig: (partial) => {
          set((state) => {
            const updated = { ...state.displayConfig, ...partial }
            lidarManager.updateDisplayConfig(updated)
            return { displayConfig: updated }
          })
        },

        setThresholds: (dangerM, cautionM) =>
          set({ dangerThresholdM: dangerM, cautionThresholdM: cautionM }),

        setRotationDeg: (deg) => {
          get().updateDisplayConfig({ rotationDeg: deg })
        },

        toggleMirror: () => {
          get().updateDisplayConfig({ mirror: !get().displayConfig.mirror })
        },

        startStream: async () => {
          const topic = get().selectedTopic
          if (topic) {
            lidarManager.setSelectedTopic(topic)
          }
          await lidarManager.startStream()
        },

        stopStream: () => {
          lidarManager.stopStream()
        },

        resetToDefaults: () => {
          set({
            displayConfig: defaultDisplayConfig,
            throttleRateMs: 100,
            dangerThresholdM: 0.5,
            cautionThresholdM: 1.0,
          })
          lidarManager.updateDisplayConfig(defaultDisplayConfig)
        },
      }
    },
    {
      name: 'jetracer_lidar_settings_v1',
      partialize: (state) => ({
        selectedTopic: state.selectedTopic,
        throttleRateMs: state.throttleRateMs,
        autoStartOnMount: state.autoStartOnMount,
        displayConfig: state.displayConfig,
        dangerThresholdM: state.dangerThresholdM,
        cautionThresholdM: state.cautionThresholdM,
      }),
    },
  ),
)
