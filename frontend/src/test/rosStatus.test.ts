import { describe, it, expect, beforeEach } from 'vitest'
import { useRosStatusStore } from '@/store/rosStatusStore'

describe('ROS Status & Clock Offset Store', () => {
  beforeEach(() => {
    useRosStatusStore.getState().reset()
  })

  it('initializes in disconnected state', () => {
    const state = useRosStatusStore.getState()
    expect(state.status).toBe('disconnected')
    expect(state.rosTime).toBeNull()
    expect(state.clockOffsetSecs).toBeNull()
  })

  it('updates status and computes clock offset when heartbeat succeeds', () => {
    const fakeNowSecs = Math.floor(Date.now() / 1000)
    // Robot clock 5 seconds ahead
    const rosTimestamp = { secs: fakeNowSecs + 5, nsecs: 0 }

    useRosStatusStore.getState().updateHeartbeat(45, rosTimestamp)

    const state = useRosStatusStore.getState()
    expect(state.status).toBe('ok')
    expect(state.latencyMs).toBe(45)
    expect(state.clockOffsetSecs).toBeGreaterThanOrEqual(3.5)
    expect(state.clockOffsetExplanation).toMatch(/ahead of browser/i)
  })

  it('transitions to degraded when latency is high', () => {
    const fakeNowSecs = Math.floor(Date.now() / 1000)
    const rosTimestamp = { secs: fakeNowSecs, nsecs: 0 }

    // Latency 800ms
    useRosStatusStore.getState().updateHeartbeat(800, rosTimestamp)
    expect(useRosStatusStore.getState().status).toBe('degraded')
  })

  it('applies hysteresis on consecutive heartbeat failures', () => {
    useRosStatusStore.getState().recordHeartbeatFailure('1st failure')
    expect(useRosStatusStore.getState().status).toBe('degraded')
    expect(useRosStatusStore.getState().consecutiveFailures).toBe(1)

    useRosStatusStore.getState().recordHeartbeatFailure('2nd failure')
    expect(useRosStatusStore.getState().status).toBe('master_unreachable')
    expect(useRosStatusStore.getState().consecutiveFailures).toBe(2)
  })

  it('requires 2 consecutive successes to recover from master_unreachable to ok', () => {
    useRosStatusStore.getState().setStatus('master_unreachable', 'Connection dropped')
    expect(useRosStatusStore.getState().status).toBe('master_unreachable')

    const fakeNowSecs = Math.floor(Date.now() / 1000)
    const rosTimestamp = { secs: fakeNowSecs, nsecs: 0 }

    // 1st recovery heartbeat
    useRosStatusStore.getState().updateHeartbeat(20, rosTimestamp)
    expect(useRosStatusStore.getState().consecutiveSuccesses).toBe(1)
    expect(useRosStatusStore.getState().status).toBe('master_unreachable')

    // 2nd recovery heartbeat
    useRosStatusStore.getState().updateHeartbeat(20, rosTimestamp)
    expect(useRosStatusStore.getState().consecutiveSuccesses).toBe(2)
    expect(useRosStatusStore.getState().status).toBe('ok')
  })
})
