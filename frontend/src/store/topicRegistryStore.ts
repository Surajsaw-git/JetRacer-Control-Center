import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TopicMapping, TopicRegistryProfile, TopicRole } from '@/types'

/**
 * Standard specification of application roles and their expected ROS message types.
 */
export const DEFAULT_ROLE_SPECIFICATIONS: Record<TopicRole, { expectedTypes: string[]; label: string }> = {
  cmd_vel: {
    expectedTypes: ['geometry_msgs/Twist'],
    label: 'Velocity Commands (cmd_vel)',
  },
  odometry: {
    expectedTypes: ['nav_msgs/Odometry'],
    label: 'Wheel Odometry',
  },
  imu: {
    expectedTypes: ['sensor_msgs/Imu'],
    label: 'Inertial Measurement Unit (IMU)',
  },
  laser_scan: {
    expectedTypes: ['sensor_msgs/LaserScan'],
    label: '2D LiDAR LaserScan',
  },
  occupancy_map: {
    expectedTypes: ['nav_msgs/OccupancyGrid'],
    label: 'SLAM 2D Occupancy Grid Map',
  },
  camera_image: {
    expectedTypes: ['sensor_msgs/Image', 'sensor_msgs/CompressedImage'],
    label: 'CSI Camera Image Stream',
  },
  joystick: {
    expectedTypes: ['sensor_msgs/Joy'],
    label: 'Hardware Gamepad Joy Telemetry',
  },
  tf: {
    expectedTypes: ['tf2_msgs/TFMessage'],
    label: 'Dynamic Coordinate Transforms (tf)',
  },
  tf_static: {
    expectedTypes: ['tf2_msgs/TFMessage'],
    label: 'Static Robot Frames (tf_static)',
  },
  battery: {
    expectedTypes: ['sensor_msgs/BatteryState'],
    label: 'Battery Telemetry & Voltage',
  },
}

function createInitialMappings(): Record<TopicRole, TopicMapping> {
  const mappings = {} as Record<TopicRole, TopicMapping>
  for (const [role, spec] of Object.entries(DEFAULT_ROLE_SPECIFICATIONS)) {
    const typedRole = role as TopicRole
    mappings[typedRole] = {
      role: typedRole,
      expectedTypes: spec.expectedTypes,
      assignedTopic: null,
      detectedType: null,
      verification: 'unmapped',
      lastSeenAt: null,
      hz: null,
      notes: '',
    }
  }
  return mappings
}

export interface TopicRegistryState {
  profileName: string
  mappings: Record<TopicRole, TopicMapping>

  // Actions
  assignTopicToRole: (role: TopicRole, topic: string | null, detectedType?: string | null) => void
  recordLiveMessage: (topic: string, hz?: number) => void
  recordStaleTopic: (topic: string) => void
  syncWithDiscoveredTopics: (discoveredTopics: { name: string; type: string }[]) => void
  importProfile: (profile: TopicRegistryProfile) => boolean
  exportProfile: (robotHost: string) => TopicRegistryProfile
  resetRegistry: () => void
}

export const useTopicRegistryStore = create<TopicRegistryState>()(
  persist(
    (set, get) => ({
      profileName: 'Default Profile',
      mappings: createInitialMappings(),

      assignTopicToRole: (role, topic, detectedType) => {
        set((state) => {
          const current = state.mappings[role]
          if (!topic) {
            return {
              mappings: {
                ...state.mappings,
                [role]: {
                  ...current,
                  assignedTopic: null,
                  detectedType: null,
                  verification: 'unmapped',
                  lastSeenAt: null,
                  hz: null,
                },
              },
            }
          }

          return {
            mappings: {
              ...state.mappings,
              [role]: {
                ...current,
                assignedTopic: topic,
                detectedType: detectedType || current.detectedType,
                verification: 'mapped_unverified',
                lastSeenAt: null,
                hz: null,
              },
            },
          }
        })
      },

      recordLiveMessage: (topic, hz) => {
        set((state) => {
          let updated = false
          const nextMappings = { ...state.mappings }

          for (const [role, mapping] of Object.entries(state.mappings)) {
            if (mapping.assignedTopic === topic) {
              updated = true
              nextMappings[role as TopicRole] = {
                ...mapping,
                verification: 'verified_live',
                lastSeenAt: Date.now(),
                hz: hz ?? mapping.hz,
              }
            }
          }

          return updated ? { mappings: nextMappings } : state
        })
      },

      recordStaleTopic: (topic) => {
        set((state) => {
          let updated = false
          const nextMappings = { ...state.mappings }

          for (const [role, mapping] of Object.entries(state.mappings)) {
            if (mapping.assignedTopic === topic && mapping.verification === 'verified_live') {
              updated = true
              nextMappings[role as TopicRole] = {
                ...mapping,
                verification: 'stale',
                hz: 0,
              }
            }
          }

          return updated ? { mappings: nextMappings } : state
        })
      },

      syncWithDiscoveredTopics: (discoveredTopics) => {
        set((state) => {
          const discoveredSet = new Set(discoveredTopics.map((t) => t.name))
          let updated = false
          const nextMappings = { ...state.mappings }

          for (const [role, mapping] of Object.entries(state.mappings)) {
            if (mapping.assignedTopic && !discoveredSet.has(mapping.assignedTopic)) {
              if (mapping.verification !== 'missing') {
                updated = true
                nextMappings[role as TopicRole] = {
                  ...mapping,
                  verification: 'missing',
                  hz: 0,
                }
              }
            }
          }

          return updated ? { mappings: nextMappings } : state
        })
      },

      importProfile: (profile) => {
        if (!profile || profile.version !== '1.0.0' || !profile.mappings) {
          return false
        }

        const validRoles = Object.keys(DEFAULT_ROLE_SPECIFICATIONS)
        const sanitizedMappings = createInitialMappings()

        for (const [roleKey, mapping] of Object.entries(profile.mappings)) {
          if (validRoles.includes(roleKey) && mapping) {
            sanitizedMappings[roleKey as TopicRole] = {
              ...sanitizedMappings[roleKey as TopicRole],
              assignedTopic: mapping.assignedTopic ?? null,
              detectedType: mapping.detectedType ?? null,
              verification: mapping.assignedTopic ? 'mapped_unverified' : 'unmapped',
              notes: typeof mapping.notes === 'string' ? mapping.notes : '',
            }
          }
        }

        set({
          profileName: profile.profileName || 'Imported Profile',
          mappings: sanitizedMappings,
        })
        return true
      },

      exportProfile: (robotHost) => {
        const state = get()
        return {
          version: '1.0.0',
          profileName: state.profileName,
          robotHost: robotHost || 'unknown',
          updatedAt: new Date().toISOString(),
          mappings: state.mappings,
        }
      },

      resetRegistry: () => {
        set({
          profileName: 'Default Profile',
          mappings: createInitialMappings(),
        })
      },
    }),
    {
      name: 'jetracer_topic_registry',
    },
  ),
)
