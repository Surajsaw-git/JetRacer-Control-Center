import { describe, it, expect, beforeEach } from 'vitest'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'

describe('ROS Discovery Store & Diff Tracking', () => {
  beforeEach(() => {
    useRosDiscoveryStore.getState().clear()
  })

  it('populates initial discovered topics, nodes, and services', () => {
    const rawTopics = {
      topics: ['/mock_world/odom', '/mock_world/scan'],
      types: ['nav_msgs/Odometry', 'sensor_msgs/LaserScan'],
    }
    const rawNodes = ['/mock_world/driver', '/mock_world/lidar']
    const rawServices = ['/mock_world/status', '/rosapi/get_time']

    useRosDiscoveryStore
      .getState()
      .applyDiscoveryResults(rawTopics, rawNodes, rawServices)

    const state = useRosDiscoveryStore.getState()
    expect(state.topics.length).toBe(2)
    expect(state.nodes.length).toBe(2)
    expect(state.services.length).toBe(2)
    expect(state.topics[0].status).toBe('present')
  })

  it('accurately identifies new and removed topics across consecutive passes', () => {
    // 1st pass
    useRosDiscoveryStore.getState().applyDiscoveryResults(
      {
        topics: ['/mock_world/topicA', '/mock_world/topicB'],
        types: ['std_msgs/String', 'std_msgs/Int32'],
      },
      ['/nodeA'],
      ['/srvA'],
    )

    // 2nd pass: topicA removed, topicC added
    useRosDiscoveryStore.getState().applyDiscoveryResults(
      {
        topics: ['/mock_world/topicB', '/mock_world/topicC'],
        types: ['std_msgs/Int32', 'std_msgs/Float32'],
      },
      ['/nodeA'],
      ['/srvA'],
    )

    const state = useRosDiscoveryStore.getState()
    const topicB = state.topics.find((t) => t.name === '/mock_world/topicB')
    const topicC = state.topics.find((t) => t.name === '/mock_world/topicC')
    const topicA = state.topics.find((t) => t.name === '/mock_world/topicA')

    expect(topicB?.status).toBe('present')
    expect(topicC?.status).toBe('new')
    expect(topicA?.status).toBe('removed')
  })

  it('manages manual topics for environments with rosapi disabled', () => {
    useRosDiscoveryStore.getState().addManualTopic('/mock_world/custom_cmd', 'geometry_msgs/Twist')
    expect(useRosDiscoveryStore.getState().manualTopics.length).toBe(1)
    expect(useRosDiscoveryStore.getState().manualTopics[0].name).toBe('/mock_world/custom_cmd')

    // Avoid duplicate manual entries
    useRosDiscoveryStore.getState().addManualTopic('/mock_world/custom_cmd', 'geometry_msgs/Twist')
    expect(useRosDiscoveryStore.getState().manualTopics.length).toBe(1)

    // Remove manual topic
    useRosDiscoveryStore.getState().removeManualTopic('/mock_world/custom_cmd')
    expect(useRosDiscoveryStore.getState().manualTopics.length).toBe(0)
  })
})
