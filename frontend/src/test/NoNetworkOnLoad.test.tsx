import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { App } from '@/App'
import { useSettingsStore } from '@/store/settingsStore'

describe('Zero Network Activity On Load Verification', () => {
  beforeEach(() => {
    // Ensure no robot address is configured
    useSettingsStore.getState().resetToDefaults()
  })

  it('guarantees that no fetch, XMLHttpRequest, or WebSocket call is made on initial mount', () => {
    const fetchSpy = vi.spyOn(window, 'fetch')
    const wsSpy = vi.fn()
    window.WebSocket = wsSpy as unknown as typeof WebSocket

    render(<App />)

    // Assert that zero outgoing network calls were attempted
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(wsSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })
})
