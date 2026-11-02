/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { lidarManager } from '@/services/lidar/lidarManager'
import { rosbridgeClient } from '@/services/rosbridgeClient'
import { useConnectionStore } from '@/store/connectionStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { RayClassification } from '@/services/lidar/lidarTypes'

describe('lidarIntegration — End-to-End Pipeline & State Dispatch', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'connected',
    })
    useRosDiscoveryStore.getState().clear()
    useRosDiscoveryStore.getState().applyDiscoveryResults(
      {
        topics: ['/mock_world/lidar_main/scan', '/mock_world/odom'],
        types: ['sensor_msgs/LaserScan', 'nav_msgs/Odometry'],
      },
      ['/mock_node'],
      ['/mock_srv']
    )
  })

  afterEach(() => {
    lidarManager.reset()
    vi.restoreAllMocks()
  })

  it('discovers laser scan topics and establishes managed stream pipeline', async () => {
    const candidates = useRosDiscoveryStore
      .getState()
      .topics.filter((t) => t.type === 'sensor_msgs/LaserScan')
    expect(candidates.length).toBe(1)
    expect(candidates[0].name).toBe('/mock_world/lidar_main/scan')

    let capturedCallback: ((msg: any) => void) | null = null
    const subscribeSpy = vi
      .spyOn(rosbridgeClient, 'subscribeLaserScan')
      .mockImplementation(async (_topic, onMessage, _throttleRateMs, _callerIdentity) => {
        capturedCallback = onMessage
        return () => {
          capturedCallback = null
        }
      })

    const started = await lidarManager.start('TestConsumer', candidates[0].name, 100)
    expect(started).toBe(true)
    expect(subscribeSpy).toHaveBeenCalledWith(
      candidates[0].name,
      expect.any(Function),
      100,
      'LidarService'
    )
    expect(lidarManager.getState()).toBe('waiting')

    // Simulate ROS message arrival
    expect(capturedCallback).not.toBeNull()
    if (capturedCallback) {
      const cb = capturedCallback as (msg: any) => void
      cb({
        header: { seq: 10, stamp: { secs: 1700000000, nsecs: 0 }, frame_id: 'laser_frame' },
        angle_min: -3.14159,
        angle_max: 3.14159,
        angle_increment: 0.01745,
        range_min: 0.15,
        range_max: 12.0,
        ranges: [1.5, 0.10, 2.8, null, 15.0],
        intensities: [100, 200, 150, 0, 0],
      })
    }

    // State transitions to streaming and metrics populate
    expect(lidarManager.getState()).toBe('streaming')
    const scan = lidarManager.getCurrentScan()
    expect(scan).not.toBeNull()
    if (!scan) return

    expect(scan.header.frame_id).toBe('laser_frame')
    expect(scan.ranges.length).toBe(5)
    expect(scan.classifications[1]).toBe(RayClassification.TOO_CLOSE) // 0.4 < 0.5 caution/too close
    expect(scan.classifications[3]).toBe(RayClassification.NO_RETURN)  // null

    const metrics = lidarManager.getMetrics()
    expect(metrics.receivedScansCount).toBe(1)
    expect(metrics.frameId).toBe('laser_frame')

    // Clean teardown
    lidarManager.stop('TestConsumer')
    expect(lidarManager.getState()).toBe('stopped')
    expect(lidarManager.getConsumerCount()).toBe(0)
  })
})
