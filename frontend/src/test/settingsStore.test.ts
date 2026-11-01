import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, defaultSettings } from '@/store/settingsStore'

describe('settingsStore Persistence & Updates', () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults()
  })

  it('initializes with default settings', () => {
    const state = useSettingsStore.getState()
    expect(state.connection.host).toBe('')
    expect(state.connection.backendPort).toBe(8000)
    expect(state.appearance.theme).toBe('dark')
    expect(state.safety.maxSpeedPct).toBe(50)
  })

  it('updates connection settings', () => {
    useSettingsStore.getState().updateConnection({
      host: '192.168.1.120',
      backendPort: 8080,
    })
    const state = useSettingsStore.getState()
    expect(state.connection.host).toBe('192.168.1.120')
    expect(state.connection.backendPort).toBe(8080)
    expect(state.connection.rosbridgePort).toBe(9090) // Preserved
  })

  it('updates appearance and control preferences', () => {
    useSettingsStore.getState().updateAppearance({ theme: 'light', units: 'imperial' })
    useSettingsStore.getState().updateControl({ joystickSize: 'lg', invertX: true })

    const state = useSettingsStore.getState()
    expect(state.appearance.theme).toBe('light')
    expect(state.appearance.units).toBe('imperial')
    expect(state.control.joystickSize).toBe('lg')
    expect(state.control.invertX).toBe(true)
  })

  it('resets to factory defaults cleanly', () => {
    useSettingsStore.getState().updateConnection({ host: '192.168.1.200' })
    useSettingsStore.getState().updateSafety({ maxSpeedPct: 90 })

    useSettingsStore.getState().resetToDefaults()

    const state = useSettingsStore.getState()
    expect(state.connection.host).toBe(defaultSettings.connection.host)
    expect(state.safety.maxSpeedPct).toBe(defaultSettings.safety.maxSpeedPct)
  })
})
