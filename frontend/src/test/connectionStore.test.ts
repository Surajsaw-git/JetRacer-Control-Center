import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore, canTransition } from '@/store/connectionStore'

describe('connectionStore State Machine', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset()
  })

  it('starts in disconnected status by default', () => {
    const state = useConnectionStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.latencyMs).toBeNull()
    expect(state.errorMessage).toBeNull()
  })

  it('transitions from disconnected -> connecting', () => {
    useConnectionStore.getState().setConnecting()
    expect(useConnectionStore.getState().status).toBe('connecting')
  })

  it('transitions from connecting -> connected with latency', () => {
    useConnectionStore.getState().setConnecting()
    useConnectionStore.getState().setConnected(22)
    const state = useConnectionStore.getState()
    expect(state.status).toBe('connected')
    expect(state.latencyMs).toBe(22)
    expect(state.lastConnected).toBeDefined()
  })

  it('transitions from connected -> reconnecting', () => {
    useConnectionStore.getState().setConnected(15)
    useConnectionStore.getState().setReconnecting()
    expect(useConnectionStore.getState().status).toBe('reconnecting')
  })

  it('transitions to error with error message', () => {
    useConnectionStore.getState().setError('Connection refused by host')
    const state = useConnectionStore.getState()
    expect(state.status).toBe('error')
    expect(state.errorMessage).toBe('Connection refused by host')
    expect(state.latencyMs).toBeNull()
  })

  it('validates state transitions with canTransition helper', () => {
    expect(canTransition('disconnected', 'connecting')).toBe(true)
    expect(canTransition('connecting', 'connected')).toBe(true)
    expect(canTransition('connecting', 'error')).toBe(true)
    expect(canTransition('connected', 'reconnecting')).toBe(true)
    expect(canTransition('connected', 'disconnected')).toBe(true)
    expect(canTransition('error', 'connecting')).toBe(true)
    expect(canTransition('error', 'disconnected')).toBe(true)
    // Invalid transitions
    expect(canTransition('disconnected', 'connected')).toBe(false)
    expect(canTransition('disconnected', 'reconnecting')).toBe(false)
  })
})
