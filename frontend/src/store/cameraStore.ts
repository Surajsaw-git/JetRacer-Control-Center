/**
 * Camera Store (Zustand + LocalStorage Persistence)
 *
 * Stores user preferences for camera source, quality presets, HUD visibility,
 * and port settings.
 *
 * IMPORTANT SAFETY RULE: autoStart defaults strictly to false.
 * Streams are never initiated without explicit user intent.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CameraQualityPreset, CameraSourceType } from '@/services/camera/cameraTypes'
import { cameraManager } from '@/services/camera/cameraManager'

export interface CameraState {
  selectedTopic: string
  sourceType: CameraSourceType
  webVideoPort: number
  qualityPreset: CameraQualityPreset
  customWidth: number
  customHeight: number
  customFps: number
  customQuality: number
  showHud: boolean
  autoStart: boolean

  setSelectedTopic: (topic: string) => void
  setSourceType: (type: CameraSourceType) => void
  setWebVideoPort: (port: number) => void
  setQualityPreset: (preset: CameraQualityPreset) => void
  setCustomConfig: (config: {
    width?: number
    height?: number
    fps?: number
    quality?: number
  }) => void
  setShowHud: (show: boolean) => void
  toggleShowHud: () => void
  setAutoStart: (auto: boolean) => void
  resetToDefaults: () => void
}

const defaultCameraState = {
  selectedTopic: '',
  sourceType: 'web_video_server' as CameraSourceType,
  webVideoPort: 8080,
  qualityPreset: 'medium' as CameraQualityPreset,
  customWidth: 640,
  customHeight: 480,
  customFps: 20,
  customQuality: 70,
  showHud: true,
  autoStart: false, // NEVER true by default
}

export const useCameraStore = create<CameraState>()(
  persist(
    (set, get) => ({
      ...defaultCameraState,

      setSelectedTopic: (topic: string) => {
        set({ selectedTopic: topic })
        cameraManager.setSelectedTopic(topic)
      },

      setSourceType: (sourceType: CameraSourceType) => {
        set({ sourceType })
        cameraManager.setSourceType(sourceType)
      },

      setWebVideoPort: (webVideoPort: number) => {
        set({ webVideoPort })
        cameraManager.webVideoPort = webVideoPort
      },

      setQualityPreset: (qualityPreset: CameraQualityPreset) => {
        set({ qualityPreset })
        const state = get()
        if (qualityPreset === 'custom') {
          cameraManager.setQualityPreset('custom', {
            width: state.customWidth,
            height: state.customHeight,
            fps: state.customFps,
            quality: state.customQuality,
          })
        } else {
          cameraManager.setQualityPreset(qualityPreset)
        }
      },

      setCustomConfig: (config) => {
        set((prev) => ({
          customWidth: config.width ?? prev.customWidth,
          customHeight: config.height ?? prev.customHeight,
          customFps: config.fps ?? prev.customFps,
          customQuality: config.quality ?? prev.customQuality,
        }))
        const state = get()
        if (state.qualityPreset === 'custom') {
          cameraManager.setQualityPreset('custom', {
            width: state.customWidth,
            height: state.customHeight,
            fps: state.customFps,
            quality: state.customQuality,
          })
        }
      },

      setShowHud: (showHud: boolean) => set({ showHud }),
      toggleShowHud: () => set((prev) => ({ showHud: !prev.showHud })),
      setAutoStart: (autoStart: boolean) => set({ autoStart }),

      resetToDefaults: () => set(defaultCameraState),
    }),
    {
      name: 'jetracer-camera-settings',
    },
  ),
)
