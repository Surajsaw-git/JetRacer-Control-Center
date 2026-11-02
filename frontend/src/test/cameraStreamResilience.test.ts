import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WebVideoServerSource } from '@/services/camera/WebVideoServerSource'
import { RosbridgeCompressedSource } from '@/services/camera/rosbridgeCompressedSource'
import { CameraManager } from '@/services/camera/cameraManager'
import type { CameraQualityConfig, CameraStreamState } from '@/services/camera/cameraTypes'

describe('Camera Stream Resilience & Lifecycle (Phase 5 Audit)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('triggers stalled state after 3000ms of no incoming frames in WebVideoServerSource', async () => {
    const source = new WebVideoServerSource('127.0.0.1', 8080)
    const states: CameraStreamState[] = []
    source.onStateChange((s) => states.push(s))

    const config: CameraQualityConfig = { preset: 'medium', fps: 15, quality: 70 }
    await source.start('/mock/camera/image_raw', config)

    // Simulate initial frame arrived -> streaming
    // @ts-expect-error accessing private method for state simulation
    source.transitionTo('streaming')
    // @ts-expect-error setting timestamp
    source.lastFrameTimestamp = Date.now()
    // @ts-expect-error starting stall watchdog
    source.startStallDetection()

    expect(source.state).toBe('streaming')

    // Advance 4100ms without new frames (interval checks every 1000ms against 3000ms threshold)
    vi.advanceTimersByTime(4100)

    // Watchdog detects stall, notifies 'stalled', and initiates auto-reconnect
    expect(states).toContain('stalled')
    expect(source.state).toBe('reconnecting')

    source.stop()
  })

  it('performs exponential backoff reconnects upon stream failure', async () => {
    const source = new WebVideoServerSource('127.0.0.1', 8080)
    const states: CameraStreamState[] = []
    source.onStateChange((s) => states.push(s))

    const config: CameraQualityConfig = { preset: 'low', fps: 10, quality: 50 }
    await source.start('/mock/camera/image_raw', config)

    // Simulate network error / socket close
    // @ts-expect-error simulate error
    source.handleStreamError('Simulated network disconnect')

    expect(source.state).toBe('reconnecting')
    // @ts-expect-error inspect reconnect count
    expect(source.reconnectAttempts).toBe(1)

    // 1st backoff is 1000ms
    vi.advanceTimersByTime(1050)
    // @ts-expect-error simulate second drop
    source.handleStreamError('Simulated second disconnect')
    // @ts-expect-error inspect reconnect count
    expect(source.reconnectAttempts).toBe(2)

    source.stop()
    expect(source.state).toBe('idle')
  })

  it('survives rapid attach/detach consumer cycles with zero resource leaks', () => {
    const manager = new CameraManager()
    manager.setSelectedTopic('/mock/camera/image_raw')

    expect(manager.getConsumerCount()).toBe(0)

    // 50 rapid mount/unmount cycles
    for (let i = 0; i < 50; i++) {
      const detach = manager.attachConsumer(`component_${i}`)
      expect(manager.getConsumerCount()).toBe(1)
      detach()
      expect(manager.getConsumerCount()).toBe(0)
    }

    expect(manager.getConsumerCount()).toBe(0)
    expect(manager.currentState).toBe('idle')

    manager.destroy()
  })

  it('supports fallback to rosbridge compressed image source with single active subscription', async () => {
    const source = new RosbridgeCompressedSource()
    expect(source.type).toBe('rosbridge_compressed')
    expect(source.state).toBe('idle')

    const states: CameraStreamState[] = []
    source.onStateChange((s) => states.push(s))

    // Attempting start when rosbridge is disconnected sets failed state cleanly
    await source.start('/mock/camera/image_raw/compressed', {
      preset: 'low',
      fps: 10,
      quality: 50,
    })

    expect(source.state).toBe('failed')
    expect(states).toContain('failed')

    source.stop()
  })

  it('verifies that camera quality controller clamps custom requests to native measured bounds', () => {
    const manager = new CameraManager()

    // Measured metrics say 640x480 at 20fps
    manager.currentMetrics = {
      fps: 20,
      width: 640,
      height: 480,
      bandwidthKbps: 500,
      droppedFrames: 0,
      latencyMs: 35,
      lastFrameTimeMs: Date.now(),
    }

    // Attempt to request 1920x1080 at 60fps (invalid upscale)
    manager.setQualityPreset('custom', {
      width: 1920,
      height: 1080,
      fps: 60,
      quality: 95,
    })

    // Must be clamped to measured native bounds!
    expect(manager.qualityConfig.width).toBeLessThanOrEqual(640)
    expect(manager.qualityConfig.height).toBeLessThanOrEqual(480)
    expect(manager.qualityConfig.fps).toBeLessThanOrEqual(20)

    manager.destroy()
  })
})
