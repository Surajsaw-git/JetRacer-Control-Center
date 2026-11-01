import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppearanceSettings, ControlPreferences, SafetyPreferences } from '@/types'

export interface ConnectionConfig {
  host: string
  backendPort: number
  rosbridgePort: number
  useSsl: boolean
}

export interface SettingsState {
  connection: ConnectionConfig
  appearance: AppearanceSettings
  control: ControlPreferences
  safety: SafetyPreferences
  updateConnection: (conn: Partial<ConnectionConfig>) => void
  updateAppearance: (app: Partial<AppearanceSettings>) => void
  updateControl: (ctrl: Partial<ControlPreferences>) => void
  updateSafety: (safe: Partial<SafetyPreferences>) => void
  resetToDefaults: () => void
}

export const defaultSettings = {
  connection: {
    host: '', // Empty by default; user enters IP in Phase 3
    backendPort: 8000,
    rosbridgePort: 9090,
    useSsl: false,
  },
  appearance: {
    theme: 'dark' as const, // Dark-first console design
    density: 'comfortable' as const,
    reduceMotion: false,
    units: 'metric' as const,
  },
  control: {
    joystickSize: 'md' as const,
    handedness: 'right' as const,
    invertX: false,
    invertY: false,
    deadmanRequired: true,
  },
  safety: {
    maxSpeedPct: 50,
    commandTimeoutMs: 500,
  },
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      updateConnection: (conn) =>
        set((state) => ({ connection: { ...state.connection, ...conn } })),
      updateAppearance: (app) => set((state) => ({ appearance: { ...state.appearance, ...app } })),
      updateControl: (ctrl) => set((state) => ({ control: { ...state.control, ...ctrl } })),
      updateSafety: (safe) => set((state) => ({ safety: { ...state.safety, ...safe } })),
      resetToDefaults: () => set(defaultSettings),
    }),
    {
      name: 'jetracer_settings',
    },
  ),
)
