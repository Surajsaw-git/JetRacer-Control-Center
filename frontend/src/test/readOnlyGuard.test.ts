import { describe, it, expect } from 'vitest'
import { ALLOWED_SERVICES, RosbridgeClient } from '@/services/rosbridgeClient'

describe('Strict Read-Only Enforcement (Phase 4 Capability Policy)', () => {
  it('allow-list permits approved read-only rosapi services including /rosapi/get_time', () => {
    expect(ALLOWED_SERVICES).toContain('/rosapi/get_time')
    expect(ALLOWED_SERVICES).toContain('/rosapi/topics')
    expect(ALLOWED_SERVICES).toContain('/rosapi/nodes')
    expect(ALLOWED_SERVICES).toContain('/rosapi/services')
  })

  it('rejects publish attempts with Security Violation error', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.publish('/cmd_vel', { linear: { x: 0.5 }, angular: { z: 0.0 } })
    }).toThrowError(/SECURITY VIOLATION.*publish/i)
  })

  it('rejects advertise attempts with Security Violation error', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.advertise('/cmd_vel', 'geometry_msgs/Twist')
    }).toThrowError(/SECURITY VIOLATION.*advertise/i)
  })

  it('rejects unallowed or dangerous service calls with Security Violation error', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.callService('/rosapi/set_param', 'rosapi/SetParam')
    }).toThrowError(/SECURITY VIOLATION.*prohibited/i)

    expect(() => {
      client.callService('/reset_odometry', 'std_srvs/Empty')
    }).toThrowError(/SECURITY VIOLATION.*prohibited/i)
  })

  it('unconditionally blocks and throws in production mode with no bypass', () => {
    const client = new RosbridgeClient()
    // Verify that assertReadOnlyAllowed throws directly regardless of environment
    expect(() => {
      client.publish('/any_topic', {})
    }).toThrowError(/SECURITY VIOLATION/i)

    expect(() => {
      client.advertise('/any_topic', 'std_msgs/String')
    }).toThrowError(/SECURITY VIOLATION/i)
  })
})
