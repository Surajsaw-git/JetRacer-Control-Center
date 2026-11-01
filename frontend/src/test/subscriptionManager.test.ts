import { describe, it, expect, beforeEach } from 'vitest'
import {
  SubscriptionManager,
  sanitizeRosPayload,
} from '@/services/subscriptionManager'
import { useSubscriptionStore } from '@/store/subscriptionStore'

describe('Subscription Manager & Safe Decoding', () => {
  beforeEach(() => {
    useSubscriptionStore.getState().clearAll()
  })

  it('sanitizes NaN and Infinity safely without throwing or mutating DOM', () => {
    const rawPayload = {
      linear_velocity: Number.NaN,
      angular_velocity: Number.POSITIVE_INFINITY,
      acceleration: Number.NEGATIVE_INFINITY,
      normal_value: 42.5,
    }

    const sanitized = sanitizeRosPayload(rawPayload) as Record<string, unknown>
    expect(sanitized.linear_velocity).toBe('NaN')
    expect(sanitized.angular_velocity).toBe('+Infinity')
    expect(sanitized.acceleration).toBe('-Infinity')
    expect(sanitized.normal_value).toBe(42.5)
  })

  it('truncates large strings and deeply nested arrays safely', () => {
    const longString = 'a'.repeat(200)
    const largeArray = new Array(100).fill(1)

    const sanitized = sanitizeRosPayload({
      str: longString,
      arr: largeArray,
    }) as { str: string; arr: string }

    expect(sanitized.str).toMatch(/\[truncated\]/)
    expect(sanitized.arr).toMatch(/omitted for UI safety/i)
  })

  it('blocks heavy image and point cloud subscriptions immediately', async () => {
    const manager = new SubscriptionManager()

    const imageSuccess = await manager.startWatching(
      '/mock_world/camera',
      'sensor_msgs/Image',
    )
    expect(imageSuccess).toBe(false)
    const imageWatch = useSubscriptionStore.getState().watchedTopics['/mock_world/camera']
    expect(imageWatch.error).toMatch(/Direct image streaming disabled/i)

    const pointCloudSuccess = await manager.startWatching(
      '/mock_world/points',
      'sensor_msgs/PointCloud2',
    )
    expect(pointCloudSuccess).toBe(false)
    const pcWatch = useSubscriptionStore.getState().watchedTopics['/mock_world/points']
    expect(pcWatch.error).toMatch(/Point cloud subscription disabled/i)

    manager.destroy()
  })

  it('enforces maximum concurrent watches cap of 5', async () => {
    const manager = new SubscriptionManager()

    // Add 5 watches
    for (let i = 1; i <= 5; i++) {
      useSubscriptionStore.getState().addWatch(`/topic_${i}`, 'std_msgs/Float32')
    }

    // Attempting a 6th watch must be rejected
    const result = await manager.startWatching('/topic_6', 'std_msgs/Float32')
    expect(result).toBe(false)

    manager.destroy()
  })
})
