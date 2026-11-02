import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mapManager } from '@/services/map/mapManager'
import { rosbridgeClient } from '@/services/rosbridgeClient'
import { useConnectionStore } from '@/store/connectionStore'

describe('mapManager — Ref-Counted Coordinator (Phase 7A)', () => {
  beforeEach(() => {
    useConnectionStore.setState({
      status: 'connected',
    })
  })

  afterEach(() => {
    mapManager.destroy()
    vi.restoreAllMocks()
  })

  it('initializes in stopped / no_topic state', () => {
    expect(['stopped', 'no_topic']).toContain(mapManager.getState())
    expect(mapManager.getConsumerCount()).toBe(0)
  })

  it('attaches consumers and ref-counts properly', () => {
    const detachA = mapManager.attachConsumer('viewA')
    expect(mapManager.getConsumerCount()).toBe(1)

    const detachB = mapManager.attachConsumer('viewB')
    expect(mapManager.getConsumerCount()).toBe(2)

    detachA()
    expect(mapManager.getConsumerCount()).toBe(1)

    detachB()
    expect(mapManager.getConsumerCount()).toBe(0)
    expect(mapManager.getState()).toBe('stopped')
  })

  it('starts stream and transitions to waiting, then streaming upon message arrival', async () => {
    let capturedCallback: ((msg: unknown) => void) | null = null
    vi.spyOn(rosbridgeClient, 'subscribeTf').mockImplementation(async () => () => {})
    vi.spyOn(rosbridgeClient, 'subscribeOccupancyGrid').mockImplementation(
      async (_topic, onMessage) => {
        capturedCallback = onMessage
        return () => {
          capturedCallback = null
        }
      }
    )

    const started = await mapManager.start('TestPage', '/mock_map', 1000)
    expect(started).toBe(true)
    expect(mapManager.getState()).toBe('waiting')
    expect(mapManager.selectedTopic).toBe('/mock_map')

    // Simulate incoming ROS OccupancyGrid message
    expect(capturedCallback).not.toBeNull()
    if (capturedCallback) {
      const cb = capturedCallback as (msg: unknown) => void
      cb({
        header: { seq: 1, stamp: { secs: 1700000000, nsecs: 0 }, frame_id: 'map' },
        info: {
          width: 2,
          height: 2,
          resolution: 0.05,
          origin: { position: { x: 0, y: 0 } },
        },
        data: [0, 0, 100, -1],
      })
    }

    expect(mapManager.getState()).toBe('live')
    const current = mapManager.getCurrentMap()
    expect(current).not.toBeNull()
    expect(current?.info.width).toBe(2)
    expect(current?.metrics.totalCells).toBe(4)

    // Stop consumer
    mapManager.stop('TestPage')
    expect(mapManager.getState()).toBe('stopped')
  })
})
