import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RosbridgeClient } from '@/services/rosbridgeClient'
import { useConnectionStore } from '@/store/connectionStore'

describe('RosbridgeClient State Machine & Lifecycle (Phase 3)', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset()
    vi.restoreAllMocks()
  })

  it('starts in disconnected state', () => {
    const client = new RosbridgeClient()
    expect(client.getStatus()).toBe('disconnected')
    expect(useConnectionStore.getState().status).toBe('disconnected')
  })

  it('rejects connection attempt with empty host', async () => {
    const client = new RosbridgeClient()
    const result = await client.connect('')
    expect(result).toBe(false)
    expect(client.getStatus()).toBe('error')
    expect(useConnectionStore.getState().status).toBe('error')
    expect(useConnectionStore.getState().errorMessage).toContain('host address is empty')
  })

  it('transitions to disconnected cleanly on manual disconnect()', () => {
    const client = new RosbridgeClient()
    client.disconnect()
    expect(client.getStatus()).toBe('disconnected')
    expect(useConnectionStore.getState().status).toBe('disconnected')
  })

  it('handles offline browser state safely', async () => {
    const originalOnLine = navigator.onLine
    try {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      const client = new RosbridgeClient()
      const result = await client.connect('192.168.1.100')
      expect(result).toBe(false)
      expect(client.getStatus()).toBe('error')
      expect(useConnectionStore.getState().errorMessage).toContain('offline')
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true })
    }
  })

  it('updates target host info in connection store when connect is called', () => {
    const client = new RosbridgeClient({ connectTimeoutMs: 50 })
    // Kick off connection (will time out or fail fast in mock environment)
    client.connect('192.168.1.75', 9090, 8000)
    expect(useConnectionStore.getState().host).toBe('192.168.1.75')
    expect(useConnectionStore.getState().rosbridgePort).toBe(9090)
    expect(useConnectionStore.getState().backendPort).toBe(8000)
    client.disconnect()
  })
})
