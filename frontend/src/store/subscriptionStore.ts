import { create } from 'zustand'
import type { WatchedTopicData } from '@/types'

export interface SubscriptionState {
  watchedTopics: Record<string, WatchedTopicData>
  maxWatches: number
  throttleRateMs: number

  // Actions
  addWatch: (topic: string, type: string) => void
  removeWatch: (topic: string) => void
  updateTopicMessage: (
    topic: string,
    payload: unknown,
    summaryStats?: WatchedTopicData['summaryStats'],
  ) => void
  setTopicHz: (topic: string, hz: number) => void
  setTopicStale: (topic: string, isStale: boolean) => void
  setTopicError: (topic: string, error: string | null) => void
  setThrottleRateMs: (rateMs: number) => void
  clearAll: () => void
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  watchedTopics: {},
  maxWatches: 5,
  throttleRateMs: 200,

  addWatch: (topic, type) => {
    set((state) => {
      if (state.watchedTopics[topic]) return state
      return {
        watchedTopics: {
          ...state.watchedTopics,
          [topic]: {
            topic,
            type,
            hz: 0,
            lastMessageTimestamp: 0,
            isStale: false,
            messageCount: 0,
            lastDecodedPayload: null,
            error: null,
          },
        },
      }
    })
  },

  removeWatch: (topic) => {
    set((state) => {
      const next = { ...state.watchedTopics }
      delete next[topic]
      return { watchedTopics: next }
    })
  },

  updateTopicMessage: (topic, payload, summaryStats) => {
    set((state) => {
      const current = state.watchedTopics[topic]
      if (!current) return state

      const now = Date.now()
      return {
        watchedTopics: {
          ...state.watchedTopics,
          [topic]: {
            ...current,
            messageCount: current.messageCount + 1,
            lastMessageTimestamp: now,
            isStale: false,
            lastDecodedPayload: payload,
            summaryStats: summaryStats || current.summaryStats,
            error: null,
          },
        },
      }
    })
  },

  setTopicHz: (topic, hz) => {
    set((state) => {
      const current = state.watchedTopics[topic]
      if (!current) return state
      return {
        watchedTopics: {
          ...state.watchedTopics,
          [topic]: { ...current, hz },
        },
      }
    })
  },

  setTopicStale: (topic, isStale) => {
    set((state) => {
      const current = state.watchedTopics[topic]
      if (!current) return state
      return {
        watchedTopics: {
          ...state.watchedTopics,
          [topic]: { ...current, isStale },
        },
      }
    })
  },

  setTopicError: (topic, error) => {
    set((state) => {
      const current = state.watchedTopics[topic]
      if (!current) return state
      return {
        watchedTopics: {
          ...state.watchedTopics,
          [topic]: { ...current, error },
        },
      }
    })
  },

  setThrottleRateMs: (rateMs) => set({ throttleRateMs: rateMs }),

  clearAll: () => set({ watchedTopics: {} }),
}))
