import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RosNodeInfo, RosServiceInfo, RosTopicInfo } from '@/types'

export type DiscoveryInterval = 0 | 10 | 30 | 60

export interface RosDiscoveryState {
  topics: RosTopicInfo[]
  nodes: RosNodeInfo[]
  services: RosServiceInfo[]
  manualTopics: { name: string; type: string }[]
  isDiscovering: boolean
  lastDiscoveredAt: number | null
  error: string | null
  refreshInterval: DiscoveryInterval
  searchQuery: string
  typeFilter: string

  // State diff tracking sets
  previousTopicNames: string[]
  previousNodeNames: string[]
  previousServiceNames: string[]

  // Actions
  setDiscovering: (val: boolean) => void
  setError: (err: string | null) => void
  applyDiscoveryResults: (
    rawTopics: { topics: string[]; types: string[] },
    rawNodes: string[],
    rawServices: string[],
  ) => void
  updateTopicDetails: (topicName: string, publishers: string[], subscribers: string[]) => void
  updateNodeDetails: (
    nodeName: string,
    publications: string[],
    subscriptions: string[],
    services: string[],
  ) => void
  addManualTopic: (name: string, type: string) => void
  removeManualTopic: (name: string) => void
  setRefreshInterval: (interval: DiscoveryInterval) => void
  setSearchQuery: (q: string) => void
  setTypeFilter: (filter: string) => void
  clear: () => void
}

export const useRosDiscoveryStore = create<RosDiscoveryState>()(
  persist(
    (set, get) => ({
      topics: [],
      nodes: [],
      services: [],
      manualTopics: [],
      isDiscovering: false,
      lastDiscoveredAt: null,
      error: null,
      refreshInterval: 0, // default manual / off
      searchQuery: '',
      typeFilter: '',
      previousTopicNames: [],
      previousNodeNames: [],
      previousServiceNames: [],

      setDiscovering: (val) => set({ isDiscovering: val }),
      setError: (err) => set({ error: err }),

      applyDiscoveryResults: (rawTopics, rawNodes, rawServices) => {
        const state = get()

        // Diff Topics
        const prevTopicSet = new Set(state.previousTopicNames)
        const currentTopicSet = new Set(rawTopics.topics)
        const topicList: RosTopicInfo[] = rawTopics.topics.map((name, i) => {
          const type = rawTopics.types[i] || 'unknown'
          const isNew = prevTopicSet.size > 0 && !prevTopicSet.has(name)
          const existing = state.topics.find((t) => t.name === name)
          return {
            name,
            type,
            publishers: existing?.publishers,
            subscribers: existing?.subscribers,
            status: isNew ? 'new' : 'present',
          }
        })

        // Include removed topics with 'removed' status for visual diffing
        if (prevTopicSet.size > 0) {
          for (const prev of state.previousTopicNames) {
            if (!currentTopicSet.has(prev)) {
              const existing = state.topics.find((t) => t.name === prev)
              topicList.push({
                name: prev,
                type: existing?.type || 'unknown',
                status: 'removed',
              })
            }
          }
        }

        // Diff Nodes
        const prevNodeSet = new Set(state.previousNodeNames)
        const currentNodeSet = new Set(rawNodes)
        const nodeList: RosNodeInfo[] = rawNodes.map((name) => {
          const isNew = prevNodeSet.size > 0 && !prevNodeSet.has(name)
          const existing = state.nodes.find((n) => n.name === name)
          return {
            name,
            publications: existing?.publications,
            subscriptions: existing?.subscriptions,
            services: existing?.services,
            status: isNew ? 'new' : 'present',
          }
        })

        if (prevNodeSet.size > 0) {
          for (const prev of state.previousNodeNames) {
            if (!currentNodeSet.has(prev)) {
              nodeList.push({
                name: prev,
                status: 'removed',
              })
            }
          }
        }

        // Diff Services
        const prevServiceSet = new Set(state.previousServiceNames)
        const currentServiceSet = new Set(rawServices)
        const serviceList: RosServiceInfo[] = rawServices.map((name) => {
          const isNew = prevServiceSet.size > 0 && !prevServiceSet.has(name)
          const existing = state.services.find((s) => s.name === name)
          return {
            name,
            type: existing?.type,
            status: isNew ? 'new' : 'present',
          }
        })

        if (prevServiceSet.size > 0) {
          for (const prev of state.previousServiceNames) {
            if (!currentServiceSet.has(prev)) {
              serviceList.push({
                name: prev,
                status: 'removed',
              })
            }
          }
        }

        set({
          topics: topicList,
          nodes: nodeList,
          services: serviceList,
          previousTopicNames: rawTopics.topics,
          previousNodeNames: rawNodes,
          previousServiceNames: rawServices,
          lastDiscoveredAt: Date.now(),
          isDiscovering: false,
          error: null,
        })
      },

      updateTopicDetails: (topicName, publishers, subscribers) => {
        set((state) => ({
          topics: state.topics.map((t) =>
            t.name === topicName ? { ...t, publishers, subscribers } : t,
          ),
        }))
      },

      updateNodeDetails: (nodeName, publications, subscriptions, services) => {
        set((state) => ({
          nodes: state.nodes.map((n) =>
            n.name === nodeName ? { ...n, publications, subscriptions, services } : n,
          ),
        }))
      },

      addManualTopic: (name, type) => {
        const cleanName = name.trim()
        const cleanType = type.trim()
        if (!cleanName || !cleanType) return

        set((state) => {
          if (state.manualTopics.some((m) => m.name === cleanName)) {
            return state
          }
          return {
            manualTopics: [...state.manualTopics, { name: cleanName, type: cleanType }],
          }
        })
      },

      removeManualTopic: (name) => {
        set((state) => ({
          manualTopics: state.manualTopics.filter((m) => m.name !== name),
        }))
      },

      setRefreshInterval: (interval) => set({ refreshInterval: interval }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setTypeFilter: (typeFilter) => set({ typeFilter }),

      clear: () =>
        set({
          topics: [],
          nodes: [],
          services: [],
          isDiscovering: false,
          lastDiscoveredAt: null,
          error: null,
          previousTopicNames: [],
          previousNodeNames: [],
          previousServiceNames: [],
        }),
    }),
    {
      name: 'jetracer_ros_discovery_state',
      partialize: (state) => ({
        manualTopics: state.manualTopics,
        refreshInterval: state.refreshInterval,
      }),
    },
  ),
)
