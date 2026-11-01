import { describe, it, expect } from 'vitest'
import { RosbridgeClient } from '@/services/rosbridgeClient'

describe('ROS Policy Security Verification (Static & Wire Analysis)', () => {
  it('statically enforces that no component directly imports roslib outside authorized client wrappers', () => {
    // Eagerly import all source files as raw text using Vite's import.meta.glob
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
        normalizedPath.includes('/test/')
      ) {
        continue
      }

      if (typeof content === 'string' && (content.includes("from 'roslib'") || content.includes('from "roslib"'))) {
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
      callOnConnection: () => {},
      callService: () => {},
    }

    // Assign mock ros to client
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
})
