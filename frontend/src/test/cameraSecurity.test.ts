import { describe, it, expect } from 'vitest'
import {
  assertCameraCompressedSubscriptionAllowed,
  assertOperationAllowed,
  MIN_CAMERA_THROTTLE_MS,
  MAX_CAMERA_SUBSCRIPTIONS,
} from '@/services/rosPolicy'
import { rosbridgeClient } from '@/services/rosbridgeClient'

describe('Camera ROS Security & Safety Policy (Phase 5)', () => {
  it('blocks uncompressed sensor_msgs/Image from rosbridge subscription', () => {
    expect(() => {
      assertCameraCompressedSubscriptionAllowed(
        'RosbridgeCompressedSource',
        'sensor_msgs/Image',
        100,
        0,
      )
    }).toThrowError(/Raw uncompressed "sensor_msgs\/Image" cannot be streamed over rosbridge/i)
  })

  it('rejects camera subscriptions from unauthorized callers', () => {
    expect(() => {
      assertCameraCompressedSubscriptionAllowed(
        'GenericWatcher',
        'sensor_msgs/CompressedImage',
        100,
        0,
      )
    }).toThrowError(/Unauthorized caller "GenericWatcher"/i)
  })

  it('rejects throttle rates below safety floor (<100ms)', () => {
    expect(() => {
      assertCameraCompressedSubscriptionAllowed(
        'RosbridgeCompressedSource',
        'sensor_msgs/CompressedImage',
        50, // 20 Hz exceeds safety cap
        0,
      )
    }).toThrowError(/below the minimum safety threshold/i)
  })

  it('strictly caps concurrent camera subscriptions to 1', () => {
    expect(MAX_CAMERA_SUBSCRIPTIONS).toBe(1)
    expect(MIN_CAMERA_THROTTLE_MS).toBe(100)
    expect(() => {
      assertCameraCompressedSubscriptionAllowed(
        'RosbridgeCompressedSource',
        'sensor_msgs/CompressedImage',
        100,
        1, // Already 1 active subscription
      )
    }).toThrowError(/Maximum active camera subscriptions \(1\) exceeded/i)
  })

  it('re-confirms that publishing remains strictly forbidden in Phase 5', () => {
    expect(() => {
      assertOperationAllowed('publish', '/cmd_vel')
    }).toThrowError(/The robot is strictly read-only/i)

    expect(() => {
      rosbridgeClient.publish('/camera/set_parameters', {})
    }).toThrowError(/SECURITY VIOLATION/i)
  })
})
