import { describe, it, expect } from 'vitest'
import {
  assertOperationAllowed,
  assertServiceAllowed,
  isHeavyMessageType,
  isRestrictedMessageType,
  isServiceAllowed,
} from '@/services/rosPolicy'

describe('ROS Capability Policy (rosPolicy)', () => {
  it('allows all approved read-only rosapi services', () => {
    const expectedServices = [
      '/rosapi/get_time',
      '/rosapi/topics',
      '/rosapi/topic_type',
      '/rosapi/topics_and_raw_types',
      '/rosapi/nodes',
      '/rosapi/node_details',
      '/rosapi/services',
      '/rosapi/service_type',
      '/rosapi/publishers',
      '/rosapi/subscribers',
      '/rosapi/message_details',
    ]

    for (const srv of expectedServices) {
      expect(isServiceAllowed(srv)).toBe(true)
      expect(() => assertServiceAllowed(srv)).not.toThrow()
    }
  })

  it('strictly blocks dangerous, state-altering, parameter, or unlisted services', () => {
    const deniedServices = [
      '/rosapi/set_param',
      '/rosapi/delete_param',
      '/rosapi/get_param',
      '/rosapi/has_param',
      '/reset_odometry',
      '/shutdown',
      '/kill_node',
      '/reboot',
      '/restart',
      '/spawn_model',
      '/launch_node',
      '/gazebo/set_model_state',
      '/set_camera_info',
    ]

    for (const srv of deniedServices) {
      expect(isServiceAllowed(srv)).toBe(false)
      expect(() => assertServiceAllowed(srv)).toThrowError(/SECURITY VIOLATION/i)
    }
  })

  it('unconditionally blocks publishing and advertising', () => {
    expect(() => assertOperationAllowed('publish', '/cmd_vel')).toThrowError(
      /SECURITY VIOLATION.*Publishing to ROS topics.*prohibited/i,
    )
    expect(() => assertOperationAllowed('publish', '/mock_world/test')).toThrowError(
      /SECURITY VIOLATION.*Publishing to ROS topics.*prohibited/i,
    )
    expect(() => assertOperationAllowed('advertise', '/cmd_vel')).toThrowError(
      /SECURITY VIOLATION.*Topic advertisement.*prohibited/i,
    )
  })

  it('identifies heavy message types and blocks them from full streaming', () => {
    expect(isHeavyMessageType('sensor_msgs/Image')).toBe(true)
    expect(isHeavyMessageType('sensor_msgs/CompressedImage')).toBe(true)
    expect(isHeavyMessageType('sensor_msgs/PointCloud')).toBe(true)
    expect(isHeavyMessageType('sensor_msgs/PointCloud2')).toBe(true)
    expect(isHeavyMessageType('nav_msgs/OccupancyGrid')).toBe(true)

    // Normal telemetry types are NOT heavy
    expect(isHeavyMessageType('geometry_msgs/Twist')).toBe(false)
    expect(isHeavyMessageType('nav_msgs/Odometry')).toBe(false)
    expect(isHeavyMessageType('sensor_msgs/Imu')).toBe(false)
    expect(isHeavyMessageType('sensor_msgs/BatteryState')).toBe(false)
    expect(isHeavyMessageType('std_msgs/String')).toBe(false)
  })

  it('identifies restricted message types (LaserScan stats mode)', () => {
    expect(isRestrictedMessageType('sensor_msgs/LaserScan')).toBe(true)
    expect(isRestrictedMessageType('geometry_msgs/Twist')).toBe(false)
  })

  it('rejects invalid or empty service names defensively', () => {
    expect(isServiceAllowed('')).toBe(false)
    expect(isServiceAllowed('   ')).toBe(false)
    expect(() => assertServiceAllowed('')).toThrowError(/SECURITY VIOLATION/i)
  })
})
