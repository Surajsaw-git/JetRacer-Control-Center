/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { lidarManager } from '@/services/lidar/lidarManager'
import { lidarService } from '@/services/lidar/lidarService'
import { useConnectionStore } from '@/store/connectionStore'

function createFakeScan(): any {
  return {
    header: { seq: 1, stamp: { secs: 100, nsecs: 0 }, frame_id: 'laser' },
    angle_min: 0,
    angle_max: Math.PI,
    angle_increment: 0.1,
    time_increment: 0,
    scan_time: 0.1,
    range_min: 0.1,
    range_max: 10.0,
    ranges: [1.0, 2.0, 3.0],
    intensities: [100, 100, 100],
  }
}

describe('lidarManager — Ref-Counting, Watchdog & Ring Buffer', () => {
  let mockSubscribe: ReturnType<typeof vi.fn>
  let capturedCallback: ((raw: any) => void) | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    capturedCallback = null
    useConnectionStore.setState({ status: 'connected' })

    mockSubscribe = vi.spyOn(lidarService, 'subscribe').mockImplementation(async (_topic, onScan) => {
      capturedCallback = onScan as any
      return true
    })
    vi.spyOn(lidarService, 'unsubscribe').mockImplementation(() => {
      capturedCallback = null
    })
  })

  afterEach(() => {
    lidarManager.reset()
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('maintains zero subscriptions before explicit start call', () => {
    expect(lidarManager.getConsumerCount()).toBe(0)
    expect(['no_topic', 'stopped']).toContain(lidarManager.getState())
    expect(mockSubscribe).not.toHaveBeenCalled()
  })

  it('ref-counts multiple consumers for a single rosbridge subscription', async () => {
    // Consumer 1: LidarPage
    const started1 = await lidarManager.start('LidarPage', '/mock_world/scan', 100)
    expect(started1).toBe(true)
    expect(lidarManager.getConsumerCount()).toBe(1)
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    // Consumer 2: DashboardCard
    const started2 = await lidarManager.start('DashboardCard', '/mock_world/scan', 100)
    expect(started2).toBe(true)
    expect(lidarManager.getConsumerCount()).toBe(2)
    // Subscription reused, not doubled
    expect(mockSubscribe).toHaveBeenCalledTimes(1)

    // Stop consumer 1
    lidarManager.stop('LidarPage')
    expect(lidarManager.getConsumerCount()).toBe(1)
    expect(lidarManager.getState()).not.toBe('stopped')

    // Stop consumer 2 -> drops to 0, tears down subscription
    lidarManager.stop('DashboardCard')
    expect(lidarManager.getConsumerCount()).toBe(0)
    expect(lidarManager.getState()).toBe('stopped')
  })

  it('transitions to stalled when watchdog timer expires without scans', async () => {
    await lidarManager.start('LidarPage', '/mock_world/scan', 100)
    expect(lidarManager.getState()).toBe('waiting')

    // Push first scan -> streaming
    if (capturedCallback) {
      capturedCallback(createFakeScan())
    }
    expect(lidarManager.getState()).toBe('streaming')

    // Advance timers by 2500ms without new scans
    vi.advanceTimersByTime(2500)
    expect(lidarManager.getState()).toBe('stalled')
  })

  it('stores scans in ring buffer up to capacity (50)', async () => {
    await lidarManager.start('LidarPage', '/mock_world/scan', 100)

    for (let i = 0; i < 60; i++) {
      if (capturedCallback) {
        capturedCallback(createFakeScan())
      }
    }

    const ring = lidarManager.getRingBuffer()
    expect(ring.length).toBe(50)
  })
})
