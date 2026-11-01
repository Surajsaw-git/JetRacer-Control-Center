import { describe, it, expect } from 'vitest'
import { ALLOWED_SERVICES, RosbridgeClient } from '@/services/rosbridgeClient'

describe('Strict Read-Only Enforcement (Phase 3 Guard)', () => {
  it('allow-list permits strictly /rosapi/get_time only', () => {
    expect(ALLOWED_SERVICES).toEqual(['/rosapi/get_time'])
    expect(ALLOWED_SERVICES.length).toBe(1)
  })

  it('rejects publish attempts with Security Violation error', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.publish('/cmd_vel', { linear: { x: 0.5 }, angular: { z: 0.0 } })
    }).toThrowError(/SECURITY VIOLATION.*strictly read-only.*publish/i)
  })

  it('rejects advertise attempts with Security Violation error', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.advertise('/cmd_vel', 'geometry_msgs/Twist')
    }).toThrowError(/SECURITY VIOLATION.*strictly read-only.*advertise/i)
  })

  it('rejects subscribe attempts in Phase 3', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.subscribe('/scan', 'sensor_msgs/LaserScan')
    }).toThrowError(/SECURITY VIOLATION.*strictly read-only.*subscribe/i)
  })

  it('rejects unallowed service calls with Security Violation error', () => {
    const client = new RosbridgeClient()
    expect(() => {
      client.callService('/rosapi/topics', 'rosapi/Topics')
    }).toThrowError(/SECURITY VIOLATION.*strictly read-only.*call_service/i)

    expect(() => {
      client.callService('/reset_odometry', 'std_srvs/Empty')
    }).toThrowError(/SECURITY VIOLATION.*strictly read-only.*call_service/i)
  })
})
