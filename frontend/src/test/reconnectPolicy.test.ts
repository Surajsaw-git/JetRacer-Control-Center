import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RosbridgeClient } from '@/services/rosbridgeClient'
import { useConnectionStore } from '@/store/connectionStore'

describe('Auto-Reconnect Policy & Indefinite Backoff (Bug 1)', () => {
  let client: RosbridgeClient

  beforeEach(() => {
    vi.useFakeTimers()
    useConnectionStore.getState().reset()
    client = new RosbridgeClient()
  })

  afterEach(() => {
    client.disconnect()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('keeps retrying indefinitely with backoff capped at 30 seconds instead of giving up after 5 attempts', async () => {
    let connectCallCount = 0

    // Mock internal attemptRosbridgeConnection
    // @ts-expect-error override private method for timer testing
    client.attemptRosbridgeConnection = vi.fn().mockImplementation(() => {
      connectCallCount++
      // Simulate connection failure which triggers handleUnexpectedDrop / scheduleReconnect
      // @ts-expect-error call private method
      client.handleUnexpectedDrop()
      return Promise.resolve(false)
    })

    // Initiate first connection
    // @ts-expect-error call private method
    client.host = '192.168.137.43'
    // @ts-expect-error call private method
    client.rosbridgePort = 9090
    // @ts-expect-error call private method
    client.scheduleReconnect()

    expect(useConnectionStore.getState().status).toBe('reconnecting')

    // Advance 5 minutes (300 seconds). Under old 5-attempt policy, it gave up after ~25s.
    // Under new policy, it must continue attempting with capped backoff.
    vi.advanceTimersByTime(300_000)

    // With 1s, 2s, 4s, 8s, 16s, 30s, 30s... in 300s there should be ~10-15 attempts, NOT stopped at 5!
    expect(connectCallCount).toBeGreaterThan(5)
    expect(useConnectionStore.getState().status).toBe('reconnecting')
    // Attempt counter should be well above 5
    // @ts-expect-error inspect private counter
    expect(client.reconnectAttempts).toBeGreaterThan(5)
  })

  it('reconnects automatically when rosbridge comes back up after 90 seconds of downtime', async () => {
    let isServerUp = false

    // @ts-expect-error override private method
    client.attemptRosbridgeConnection = vi.fn().mockImplementation(() => {
      if (!isServerUp) {
        // @ts-expect-error call private method
        client.handleUnexpectedDrop()
        return Promise.resolve(false)
      } else {
        // @ts-expect-error call private method
        client.transitionTo('connected')
        return Promise.resolve(true)
      }
    })

    // Start reconnecting
    // @ts-expect-error set private fields
    client.host = '192.168.137.43'
    // @ts-expect-error set private fields
    client.rosbridgePort = 9090
    // @ts-expect-error call private method
    client.scheduleReconnect()

    expect(useConnectionStore.getState().status).toBe('reconnecting')

    // 85 seconds pass: server still down
    vi.advanceTimersByTime(85_000)
    expect(useConnectionStore.getState().status).toBe('reconnecting')

    // Server recovers at 90 seconds
    isServerUp = true
    vi.advanceTimersByTime(35_000)

    // Client must have reconnected without any user intervention!
    expect(useConnectionStore.getState().status).toBe('connected')
  })

  it('allows user to "Stop trying", transitioning to disconnected and permanently cancelling retries', () => {
    // @ts-expect-error set private fields
    client.host = '192.168.137.43'
    // @ts-expect-error call private method
    client.scheduleReconnect()

    expect(useConnectionStore.getState().status).toBe('reconnecting')

    // User clicks "Stop trying"
    client.stopReconnecting()

    expect(useConnectionStore.getState().status).toBe('disconnected')

    // Advance 10 minutes: no new connection attempts should ever be scheduled
    // @ts-expect-error inspect private timer
    expect(client.reconnectTimer).toBeNull()
  })

  it('resets reconnect backoff attempts to 0 after 10 seconds of a stable connection', async () => {
    // @ts-expect-error set private attempt count
    client.reconnectAttempts = 7

    // Simulate transition to connected
    // @ts-expect-error call private method
    client.transitionTo('connected')

    // 5 seconds connected: not yet reset
    vi.advanceTimersByTime(5_000)
    // @ts-expect-error inspect private attempt count
    expect(client.reconnectAttempts).toBe(7)

    // 10 seconds connected: should reset backoff
    vi.advanceTimersByTime(6_000)
    // @ts-expect-error inspect private attempt count
    expect(client.reconnectAttempts).toBe(0)
  })

  it('limits connection attempt rate to at most 3 attempts per minute once backoff reaches 30s (no request storm)', () => {
    let attemptsInInterval = 0

    // @ts-expect-error override
    client.attemptRosbridgeConnection = vi.fn().mockImplementation(() => {
      attemptsInInterval++
      // @ts-expect-error call private method
      client.handleUnexpectedDrop()
      return Promise.resolve(false)
    })

    // @ts-expect-error set private fields
    client.host = '192.168.137.43'
    // Set already high attempts so backoff is at maximum 30s
    // @ts-expect-error set private
    client.reconnectAttempts = 6
    // @ts-expect-error call
    client.scheduleReconnect()

    attemptsInInterval = 0
    // Advance exactly 1 minute (60 seconds)
    vi.advanceTimersByTime(60_000)

    // With a 30s backoff, in 60s there can be at most 2 to 3 attempts, never a storm!
    expect(attemptsInInterval).toBeLessThanOrEqual(3)
  })
})
