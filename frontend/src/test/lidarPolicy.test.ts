/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import {
  assertLidarSubscriptionAllowed,
  MAX_LIDAR_SUBSCRIPTIONS,
  MIN_LIDAR_THROTTLE_MS,
  MAX_LIDAR_RANGES_LENGTH,
} from '@/services/rosPolicy'

describe('rosPolicy — LiDAR Safety Policy Gates', () => {
  it('allows subscription when parameters satisfy policy constraints', () => {
    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'sensor_msgs/LaserScan', 100, 0)
    ).not.toThrow()

    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'sensor_msgs/LaserScan', 50, 0)
    ).not.toThrow()
  })

  it('rejects subscription if message type is not sensor_msgs/LaserScan', () => {
    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'sensor_msgs/PointCloud2', 100, 0)
    ).toThrow(/requires "sensor_msgs\/LaserScan"/)

    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'nav_msgs/OccupancyGrid', 100, 0)
    ).toThrow(/SECURITY VIOLATION/)
  })

  it('rejects subscription if active subscriptions would exceed MAX_LIDAR_SUBSCRIPTIONS (1)', () => {
    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'sensor_msgs/LaserScan', 100, 1)
    ).toThrow(/Maximum active LiDAR subscriptions/)
  })

  it('rejects subscription if throttle rate is faster than MIN_LIDAR_THROTTLE_MS (50ms / 20Hz)', () => {
    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'sensor_msgs/LaserScan', 20, 0)
    ).toThrow(/is below the minimum safety threshold/)

    expect(() =>
      assertLidarSubscriptionAllowed('LidarService', 'sensor_msgs/LaserScan', 0, 0)
    ).toThrow(/is below the minimum safety threshold/)
  })

  it('rejects caller identity not matching authorized services', () => {
    expect(() =>
      assertLidarSubscriptionAllowed('UnauthorizedComponent' as any, 'sensor_msgs/LaserScan', 100, 0)
    ).toThrow(/Unauthorized caller/)
  })

  it('exports valid safety constants', () => {
    expect(MAX_LIDAR_SUBSCRIPTIONS).toBe(1)
    expect(MIN_LIDAR_THROTTLE_MS).toBe(50)
    expect(MAX_LIDAR_RANGES_LENGTH).toBe(8192)
  })
})
