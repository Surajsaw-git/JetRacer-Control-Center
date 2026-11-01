import { create } from 'zustand'
import type { RosMasterStatus, RosTimestamp } from '@/types'

export interface RosStatusState {
  status: RosMasterStatus
  rosTime: RosTimestamp | null
  clockOffsetSecs: number | null
  clockOffsetExplanation: string
  latencyMs: number | null
  lastHeartbeatAt: number | null
  consecutiveSuccesses: number
  consecutiveFailures: number
  errorMessage: string | null

  // Actions
  updateHeartbeat: (latencyMs: number, rosTime: RosTimestamp | null) => void
  recordHeartbeatFailure: (reason?: string) => void
  setStatus: (status: RosMasterStatus, error?: string | null) => void
  reset: () => void
}

function calculateClockOffset(rosTime: RosTimestamp): {
  offsetSecs: number
  explanation: string
} {
  const robotSecs = rosTime.secs + rosTime.nsecs * 1e-9
  const browserSecs = Date.now() / 1000
  const offset = robotSecs - browserSecs

  let explanation: string
  if (Math.abs(offset) < 1.0) {
    explanation = `Synchronized (offset: ${Math.round(offset * 1000)}ms)`
  } else if (offset > 0) {
    explanation = `Robot clock is ahead of browser by ${offset.toFixed(1)}s (check robot chrony/NTP)`
  } else {
    explanation = `Robot clock is behind browser by ${Math.abs(offset).toFixed(1)}s (check robot chrony/NTP)`
  }

  return { offsetSecs: offset, explanation }
}

export const useRosStatusStore = create<RosStatusState>((set) => ({
  status: 'disconnected',
  rosTime: null,
  clockOffsetSecs: null,
  clockOffsetExplanation: 'Awaiting connection to compute clock offset.',
  latencyMs: null,
  lastHeartbeatAt: null,
  consecutiveSuccesses: 0,
  consecutiveFailures: 0,
  errorMessage: null,

  updateHeartbeat: (latencyMs: number, rosTime: RosTimestamp | null) => {
    set((state) => {
      let offsetSecs = state.clockOffsetSecs
      let explanation = state.clockOffsetExplanation

      if (rosTime) {
        const calculated = calculateClockOffset(rosTime)
        offsetSecs = calculated.offsetSecs
        explanation = calculated.explanation
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
        nextStatus = latencyMs > 600 ? 'degraded' : 'ok'
      }

      return {
        status: nextStatus,
        rosTime: rosTime ?? state.rosTime,
        clockOffsetSecs: offsetSecs,
        clockOffsetExplanation: explanation,
        latencyMs,
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
      lastHeartbeatAt: null,
      consecutiveSuccesses: 0,
      consecutiveFailures: 0,
      errorMessage: null,
    })
  },
}))
