import { create } from 'zustand'
import type { RosMasterStatus, RosTimestamp } from '@/types'

export interface RosStatusState {
  status: RosMasterStatus
  rosTime: RosTimestamp | null
  clockOffsetSecs: number | null
  clockOffsetExplanation: string
  latencyMs: number | null
  latencyMedianMs: number | null
  latencySamples: number[]
  highLatencyWarning: string | null
  lastHeartbeatAt: number | null
  consecutiveSuccesses: number
  consecutiveFailures: number
  errorMessage: string | null

  // Actions
  updateHeartbeat: (latencyMs: number, rosTime: RosTimestamp | null, sendTimeMs?: number) => void
  recordHeartbeatFailure: (reason?: string) => void
  setStatus: (status: RosMasterStatus, error?: string | null) => void
  reset: () => void
}

/**
 * Computes clock offset between robot and browser.
 * Uses the midpoint of the request round trip (t_send + rtt/2) to eliminate half-RTT skew.
 *
 * Thresholds:
 * - |offset| <= 250ms: "Synchronized"
 * - 250ms < |offset| <= 2000ms: "Small difference" (acceptable for teleoperation)
 * - |offset| > 2000ms: "Warning: High clock offset" (check robot chrony/NTP)
 */
export function calculateClockOffset(
  rosTime: RosTimestamp,
  sendTimeMs?: number,
  rttMs?: number,
): {
  offsetSecs: number
  explanation: string
} {
  const robotSecs = rosTime.secs + rosTime.nsecs * 1e-9

  // Midpoint calculation: if sendTimeMs and rttMs are available, use midpoint of round trip
  let browserSecs: number
  if (sendTimeMs !== undefined && rttMs !== undefined) {
    browserSecs = (sendTimeMs + rttMs / 2) / 1000
  } else {
    browserSecs = Date.now() / 1000
  }

  const offset = robotSecs - browserSecs
  const absOffsetMs = Math.abs(offset * 1000)

  let explanation: string
  if (absOffsetMs <= 250) {
    explanation = `Synchronized (offset: ${Math.round(offset * 1000)}ms)`
  } else if (absOffsetMs <= 2000) {
    explanation = `Small difference (offset: ${Math.round(offset * 1000)}ms; acceptable for teleoperation)`
  } else if (offset > 0) {
    explanation = `Warning: High clock offset of +${offset.toFixed(1)}s (robot is ahead of browser; check robot chrony/NTP)`
  } else {
    explanation = `Warning: High clock offset of ${offset.toFixed(1)}s (robot is behind browser; check robot chrony/NTP)`
  }

  return { offsetSecs: offset, explanation }
}

export const useRosStatusStore = create<RosStatusState>((set) => ({
  status: 'disconnected',
  rosTime: null,
  clockOffsetSecs: null,
  clockOffsetExplanation: 'Awaiting connection to compute clock offset.',
  latencyMs: null,
  latencyMedianMs: null,
  latencySamples: [],
  highLatencyWarning: null,
  lastHeartbeatAt: null,
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,
  errorMessage: null,

  updateHeartbeat: (latencyMs: number, rosTime: RosTimestamp | null, sendTimeMs?: number) => {
    set((state) => {
      let offsetSecs = state.clockOffsetSecs
      let explanation = state.clockOffsetExplanation

      if (rosTime) {
        const calculated = calculateClockOffset(rosTime, sendTimeMs, latencyMs)
        offsetSecs = calculated.offsetSecs
        explanation = calculated.explanation
      }

      // Rolling window of up to 10 latency samples
      const nextSamples = [...state.latencySamples.slice(-9), latencyMs]
      const sorted = [...nextSamples].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]

      let highLatencyWarning: string | null = null
      if (median > 250) {
        highLatencyWarning =
          'The robot or Wi-Fi is busy; try stopping SLAM/camera nodes or disabling Wi-Fi power saving on the robot (iw dev wlan0 get power_save).'
      }

      const nextSuccesses = state.consecutiveSuccesses + 1
      // Flapping protection: require at least 2 consecutive successes to transition from degraded/error back to ok
      let nextStatus: RosMasterStatus = state.status
      if (
        state.status === 'disconnected' ||
        state.status === 'unknown' ||
        state.status === 'ok' ||
        nextSuccesses >= 2
      ) {
        nextStatus = median > 600 ? 'degraded' : 'ok'
      }

      return {
        status: nextStatus,
        rosTime: rosTime ?? state.rosTime,
        clockOffsetSecs: offsetSecs,
        clockOffsetExplanation: explanation,
        latencyMs,
        latencyMedianMs: median,
        latencySamples: nextSamples,
        highLatencyWarning,
        lastHeartbeatAt: Date.now(),
        consecutiveSuccesses: nextSuccesses,
        consecutiveFailures: 0,
        errorMessage: null,
      }
    })
  },

  recordHeartbeatFailure: (reason?: string) => {
    set((state) => {
      const nextFailures = state.consecutiveFailures + 1
      let nextStatus: RosMasterStatus = state.status

      if (nextFailures === 1) {
        nextStatus = 'degraded'
      } else if (nextFailures >= 2) {
        nextStatus = 'master_unreachable'
      }

      return {
        status: nextStatus,
        consecutiveSuccesses: 0,
        consecutiveFailures: nextFailures,
        errorMessage: reason || 'Heartbeat probe failed.',
      }
    })
  },

  setStatus: (status: RosMasterStatus, error?: string | null) => {
    set({
      status,
      errorMessage: error ?? null,
      clockOffsetExplanation:
        status === 'disconnected'
          ? 'Link to robot is down; the ROS master state is unknown'
          : status === 'ok'
            ? 'Awaiting connection to compute clock offset.'
            : error || 'ROS master status updated.',
      consecutiveSuccesses: status === 'ok' ? 2 : 0,
      consecutiveFailures: status === 'ok' ? 0 : 1,
    })
  },

  reset: () => {
    set({
      status: 'disconnected',
      rosTime: null,
      clockOffsetSecs: null,
      clockOffsetExplanation: 'Disconnected.',
      latencyMs: null,
      latencyMedianMs: null,
      latencySamples: [],
      highLatencyWarning: null,
      lastHeartbeatAt: null,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      errorMessage: null,
    })
  },
}))
