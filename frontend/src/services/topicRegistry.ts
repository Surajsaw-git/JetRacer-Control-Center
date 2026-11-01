/**
 * Topic Registry Service
 *
 * Provides a strongly typed, role-based abstraction layer over raw ROS topics.
 * Consumer modules (e.g., Joystick, LiDAR Canvas, Odometry Card) query this service
 * to obtain user-confirmed topic names rather than using hard-coded strings.
 */

import { DEFAULT_ROLE_SPECIFICATIONS, useTopicRegistryStore } from '@/store/topicRegistryStore'
import type { TopicRole, TopicRoleVerification } from '@/types'

export class TopicRegistryService {
  /**
   * Returns the assigned topic for a given application role, or null if unmapped.
   */
  public getTopicForRole(role: TopicRole): string | null {
    const mapping = useTopicRegistryStore.getState().mappings[role]
    return mapping?.assignedTopic ?? null
  }

  /**
   * Checks whether a role has an assigned topic and has verified live telemetry.
   */
  public isRoleVerified(role: TopicRole): boolean {
    const mapping = useTopicRegistryStore.getState().mappings[role]
    return mapping?.verification === 'verified_live'
  }

  /**
   * Returns verification state for a role.
   */
  public getRoleVerification(role: TopicRole): TopicRoleVerification {
    const mapping = useTopicRegistryStore.getState().mappings[role]
    return mapping?.verification ?? 'unmapped'
  }

  /**
   * Finds discovered topics matching the expected ROS message types for a role.
   */
  public suggestTopicsForRole(
    role: TopicRole,
    discoveredTopics: { name: string; type: string }[],
  ): { name: string; type: string }[] {
    const spec = DEFAULT_ROLE_SPECIFICATIONS[role]
    if (!spec) return []
    const expected = new Set(spec.expectedTypes)
    return discoveredTopics.filter((t) => expected.has(t.type))
  }
}

export const topicRegistry = new TopicRegistryService()
