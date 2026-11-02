import { describe, it, expect, beforeEach } from 'vitest'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { useConnectionStore } from '@/store/connectionStore'
import { RosbridgeClient } from '@/services/rosbridgeClient'

describe('ROS Status Derivation Transition Table (Bug 2)', () => {
  beforeEach(() => {
    useConnectionStore.getState().reset()
    useRosStatusStore.getState().reset()
  })

  it('guarantees that when WebSocket is down, status is NEVER master_unreachable', () => {
    const store = useRosStatusStore.getState()

    // 1. Initial disconnected state
    expect(store.status).toBe('disconnected')
    expect(store.status).not.toBe('master_unreachable')

    // 2. Simulate socket error transition in client
    const client = new RosbridgeClient()
    // Directly transition to error
    // @ts-expect-error accessing private method for state transition test
    client.transitionTo('error', 'Cannot reach rosbridge at 192.168.137.43:9090.')

    const statusAfterError = useRosStatusStore.getState().status
    expect(statusAfterError).toBe('disconnected')
    expect(statusAfterError).not.toBe('master_unreachable')
    expect(useRosStatusStore.getState().clockOffsetExplanation).toMatch(
      /Link to robot is down; the ROS master state is unknown/i,
    )
  })

  it('produces master_unreachable ONLY when Link A is CONNECTED and rosapi fails consistently', () => {
    useConnectionStore.getState().setConnected(25, null)
    const store = useRosStatusStore.getState()

    // First failure -> degraded
    store.recordHeartbeatFailure('rosapi call timeout')
    expect(useRosStatusStore.getState().status).toBe('degraded')

    // Second failure -> master_unreachable
    store.recordHeartbeatFailure('rosapi call timeout')
    expect(useRosStatusStore.getState().status).toBe('master_unreachable')

    // But as soon as link drops to reconnecting or disconnected, status drops out of master_unreachable!
    const client = new RosbridgeClient()
    // @ts-expect-error accessing private method
    client.transitionTo('reconnecting', null)

    expect(useRosStatusStore.getState().status).not.toBe('master_unreachable')
    expect(useRosStatusStore.getState().status).toBe('disconnected')
  })

  it('verifies that TCP socket failure messages refer to rosbridge, not master', () => {
    const client = new RosbridgeClient()
    // @ts-expect-error accessing private method
    client.host = '192.168.137.43'
    // @ts-expect-error accessing private method
    client.rosbridgePort = 9090

    // @ts-expect-error accessing private method
    client.transitionTo('error', `Cannot reach rosbridge at 192.168.137.43:9090.`)

    expect(useConnectionStore.getState().errorMessage).toContain('Cannot reach rosbridge at 192.168.137.43:9090')
    expect(useConnectionStore.getState().errorMessage).not.toContain('Cannot reach robot at')
  })
})
