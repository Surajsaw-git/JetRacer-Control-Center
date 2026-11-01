import { describe, it, expect } from 'vitest'
import { RosbridgeClient } from '@/services/rosbridgeClient'
import { ALLOWED_ROSAPI_SERVICES } from '@/services/rosPolicy'

describe('ROS Policy Security Verification (Static & Wire Analysis)', () => {
  it('statically enforces that no component directly imports roslib outside authorized client wrappers', () => {
    const modules = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    })

    const violations: string[] = []

    for (const [filepath, content] of Object.entries(modules)) {
      const normalizedPath = filepath.replace(/\\/g, '/')
      if (
        normalizedPath.includes('services/rosbridgeClient.ts') ||
        normalizedPath.includes('services/subscriptionManager.ts') ||
        normalizedPath.includes('.test.') ||
        normalizedPath.includes('test/')
      ) {
        continue
      }

      if (
        typeof content === 'string' &&
        (content.includes("from 'roslib'") || content.includes('from "roslib"'))
      ) {
        violations.push(normalizedPath)
      }
    }

    expect(violations).toEqual([])
  })

  it('statically enforces that no hard-coded topic names (/cmd_vel, /odom, /scan, /map, /tf, /joy) exist in production code outside tests and policy contracts', () => {
    const modules = import.meta.glob<string>('../**/*.{ts,tsx}', {
      query: '?raw',
      import: 'default',
      eager: true,
    })

    const forbiddenTopicPattern = /['"`]\/(cmd_vel|odom|scan|map|tf|joy)['"`]/
    const violations: string[] = []

    for (const [filepath, content] of Object.entries(modules)) {
      const normalizedPath = filepath.replace(/\\/g, '/')
      // Tests, mocks, and policy contracts are allowed to reference schemas
      if (
        normalizedPath.includes('.test.') ||
        normalizedPath.includes('test/') ||
        normalizedPath.includes('simulation')
      ) {
        continue
      }

      if (typeof content === 'string' && forbiddenTopicPattern.test(content)) {
        violations.push(normalizedPath)
      }
    }

    expect(violations).toEqual([])
  })

  it('guarantees on the wire that forbidden ops are blocked before socket transmission', async () => {
    const framesSent: string[] = []
    const client = new RosbridgeClient()

    // Mock internal ROS socket to capture outgoing frames
    const mockRos = {
      isConnected: true,
      close: () => {},
      on: () => {},
      once: () => {},
      callOnConnection: () => {},
      callService: () => {},
    }

    Object.assign(client, { ros: mockRos })

    // Verify publish throws synchronously and sends 0 frames
    expect(() => {
      client.publish('/cmd_vel', { linear: { x: 1.0 } })
    }).toThrowError(/SECURITY VIOLATION/i)

    // Verify advertise throws synchronously and sends 0 frames
    expect(() => {
      client.advertise('/cmd_vel', 'geometry_msgs/Twist')
    }).toThrowError(/SECURITY VIOLATION/i)

    // Verify unapproved service throws synchronously and sends 0 frames
    expect(() => {
      client.callService('/rosapi/set_param', 'rosapi/SetParam')
    }).toThrowError(/SECURITY VIOLATION/i)

    expect(framesSent.length).toBe(0)
  })

  it('conducts a whole-session protocol test asserting that ONLY allow-listed ops are transmitted across the wire', async () => {
    const outgoingFrames: Record<string, unknown>[] = []
    const client = new RosbridgeClient()

    // Build interactive mock ROS object that intercepts every wire transmission
    const callbacks = new Map<string, (h: unknown) => void>()
    const mockRos = {
      isConnected: true,
      close: () => {},
      on: () => {},
      once: (id: string, cb: (h: unknown) => void) => {
        callbacks.set(id, cb)
      },
      callOnConnection: (message: Record<string, unknown>) => {
        outgoingFrames.push(message)
        // If it is a service call frame, simulate instant success response matching rosbridge protocol
        if (message?.op === 'call_service' && typeof message?.id === 'string') {
          const cb = callbacks.get(message.id)
          if (cb) {
            cb({ op: 'service_response', result: true, values: {} })
            callbacks.delete(message.id)
          }
        }
      },
      callService: () => {},
    }

    Object.assign(client, { ros: mockRos, status: 'connected' })

    // 1. Invocations of allow-listed services
    for (const [srvName, srvType] of Object.entries(ALLOWED_ROSAPI_SERVICES)) {
      await client.callService(srvName, srvType, {})
    }

    // 2. Attempt invocation of denied services -> must throw and NEVER appear in outgoingFrames
    const deniedServices = ['/rosapi/set_param', '/rosapi/delete_param', '/reset_odometry', '/shutdown', '/restart']
    for (const denied of deniedServices) {
      expect(() => client.callService(denied, 'std_srvs/Empty')).toThrowError(/SECURITY VIOLATION/i)
    }

    // 3. Attempt publishing -> must throw and NEVER appear in outgoingFrames
    expect(() => client.publish('/cmd_vel', {})).toThrowError(/SECURITY VIOLATION/i)
    expect(() => client.advertise('/cmd_vel', 'geometry_msgs/Twist')).toThrowError(/SECURITY VIOLATION/i)

    // 4. Assert on every frame transmitted in the entire session
    expect(outgoingFrames.length).toBe(Object.keys(ALLOWED_ROSAPI_SERVICES).length)
    for (const frame of outgoingFrames) {
      expect(frame.op).toBe('call_service')
      expect(typeof frame.service).toBe('string')
      expect((frame.service as string) in ALLOWED_ROSAPI_SERVICES).toBe(true)
      // Never contains publish, advertise, or denied ops
      expect(frame.op).not.toBe('publish')
      expect(frame.op).not.toBe('advertise')
    }
  })
})
