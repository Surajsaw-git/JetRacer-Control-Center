import { describe, it, expect, beforeEach } from 'vitest'
import { calculateClockOffset, useRosStatusStore } from '@/store/rosStatusStore'
import type { RosTimestamp } from '@/types'

describe('Latency & Clock Offset Midpoint Calculations (Bug 4)', () => {
  beforeEach(() => {
    useRosStatusStore.getState().reset()
  })

  it('calculates clock offset using the midpoint of the round-trip time: t_robot - (t_send + rtt/2)', () => {
    const tSendMs = 1700000000000 // 1700000000.000s
    const rttMs = 200 // 0.200s (response received at 1700000000.200s, midpoint is 1700000000.100s)
    const rosTime: RosTimestamp = {
      secs: 1700000000,
      nsecs: 400000000, // 1700000000.400s
    }

    const { offsetSecs } = calculateClockOffset(rosTime, tSendMs, rttMs)

    // True offset: 1700000000.400 - 1700000000.100 = +0.300s (+300ms)
    expect(offsetSecs).toBeCloseTo(0.3, 3)
  })

  it('does NOT declare clocks "Synchronized" when offset exceeds 250ms', () => {
    const tSendMs = 1700000000000
    const rttMs = 100 // midpoint 1700000000.050s
    const rosTime: RosTimestamp = {
      secs: 1700000000,
      nsecs: 445000000, // 395ms offset
    }

    const { offsetSecs, explanation } = calculateClockOffset(rosTime, tSendMs, rttMs)
    expect(Math.abs(offsetSecs)).toBeGreaterThan(0.25)

    // Must NOT say Synchronized when offset is 395ms!
    expect(explanation).not.toMatch(/^Synchronized/i)
    expect(explanation).toMatch(/Small difference/i)
  })

  it('classifies offset <= 250ms as Synchronized and offset > 2s as High offset Warning', () => {
    const tSendMs = 1700000000000
    const rttMs = 50

    // <= 250ms
    const syncd = calculateClockOffset({ secs: 1700000000, nsecs: 100000000 }, tSendMs, rttMs)
    expect(syncd.explanation).toMatch(/Synchronized/i)

    // > 2000ms
    const high = calculateClockOffset({ secs: 1700000003, nsecs: 0 }, tSendMs, rttMs)
    expect(high.explanation).toMatch(/High clock offset/i)
  })

  it('computes a rolling median of latency over recent samples', () => {
    const store = useRosStatusStore.getState()

    // Push 5 samples: [120, 133, 321, 140, 125] -> sorted: [120, 125, 133, 140, 321] -> median: 133
    store.updateHeartbeat(120, null)
    store.updateHeartbeat(133, null)
    store.updateHeartbeat(321, null)
    store.updateHeartbeat(140, null)
    store.updateHeartbeat(125, null)

    const state = useRosStatusStore.getState()
    expect(state.latencyMs).toBe(125) // latest
    expect(state.latencyMedianMs).toBe(133) // median
  })

  it('surfaces a high-latency guidance hint when median latency exceeds 250ms', () => {
    const store = useRosStatusStore.getState()
    store.updateHeartbeat(290, null)
    store.updateHeartbeat(321, null)
    store.updateHeartbeat(280, null)

    const state = useRosStatusStore.getState()
    expect(state.highLatencyWarning).toBeTruthy()
    expect(state.highLatencyWarning).toMatch(/power_save|SLAM/i)
  })
})
