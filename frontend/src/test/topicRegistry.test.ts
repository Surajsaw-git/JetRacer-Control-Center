import { describe, it, expect, beforeEach } from 'vitest'
import { topicRegistry } from '@/services/topicRegistry'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'

describe('Topic Registry Service & Profile Management', () => {
  beforeEach(() => {
    useTopicRegistryStore.getState().resetRegistry()
  })

  it('suggests topics strictly by matching expected message types', () => {
    const discovered = [
      { name: '/mock_world/motor_cmd', type: 'geometry_msgs/Twist' },
      { name: '/mock_world/raw_odom', type: 'nav_msgs/Odometry' },
      { name: '/mock_world/cam', type: 'sensor_msgs/Image' },
      { name: '/mock_world/unrelated', type: 'std_msgs/String' },
    ]

    const cmdSuggestions = topicRegistry.suggestTopicsForRole('cmd_vel', discovered)
    expect(cmdSuggestions).toEqual([
      { name: '/mock_world/motor_cmd', type: 'geometry_msgs/Twist' },
    ])

    const odomSuggestions = topicRegistry.suggestTopicsForRole('odometry', discovered)
    expect(odomSuggestions).toEqual([
      { name: '/mock_world/raw_odom', type: 'nav_msgs/Odometry' },
    ])

    const imuSuggestions = topicRegistry.suggestTopicsForRole('imu', discovered)
    expect(imuSuggestions).toEqual([])
  })

  it('transitions verification state only when live message arrives', () => {
    useTopicRegistryStore
      .getState()
      .assignTopicToRole('odometry', '/mock_world/odom', 'nav_msgs/Odometry')

    expect(topicRegistry.getRoleVerification('odometry')).toBe('mapped_unverified')
    expect(topicRegistry.isRoleVerified('odometry')).toBe(false)

    // Receive live message
    useTopicRegistryStore.getState().recordLiveMessage('/mock_world/odom', 20.0)

    expect(topicRegistry.getRoleVerification('odometry')).toBe('verified_live')
    expect(topicRegistry.isRoleVerified('odometry')).toBe(true)

    // Receive stale event
    useTopicRegistryStore.getState().recordStaleTopic('/mock_world/odom')
    expect(topicRegistry.getRoleVerification('odometry')).toBe('stale')
  })

  it('exports and imports profile with schema validation', () => {
    useTopicRegistryStore
      .getState()
      .assignTopicToRole('laser_scan', '/mock_world/scan', 'sensor_msgs/LaserScan')

    const exported = useTopicRegistryStore.getState().exportProfile('192.168.1.100')
    expect(exported.version).toBe('1.0.0')
    expect(exported.robotHost).toBe('192.168.1.100')
    expect(exported.mappings.laser_scan.assignedTopic).toBe('/mock_world/scan')

    // Reset
    useTopicRegistryStore.getState().resetRegistry()
    expect(topicRegistry.getTopicForRole('laser_scan')).toBeNull()

    // Import
    const importOk = useTopicRegistryStore.getState().importProfile(exported)
    expect(importOk).toBe(true)
    expect(topicRegistry.getTopicForRole('laser_scan')).toBe('/mock_world/scan')
  })

  it('marks topics as missing when not found in discovered list', () => {
    useTopicRegistryStore
      .getState()
      .assignTopicToRole('imu', '/mock_world/imu_data', 'sensor_msgs/Imu')

    useTopicRegistryStore.getState().syncWithDiscoveredTopics([
      { name: '/mock_world/odom', type: 'nav_msgs/Odometry' },
    ])

    expect(topicRegistry.getRoleVerification('imu')).toBe('missing')
  })
})
