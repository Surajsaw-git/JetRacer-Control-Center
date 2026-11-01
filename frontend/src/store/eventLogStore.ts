import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UiEvent, UiEventType } from '@/types'

const MAX_EVENT_LOG_CAPACITY = 200

export interface EventLogState {
  events: UiEvent[]
  addEvent: (event: Omit<UiEvent, 'id' | 'timestamp'>) => void
  clearEvents: () => void
}

export const useEventLogStore = create<EventLogState>()(
  persist(
    (set) => ({
      events: [
        {
          id: 'init-0',
          timestamp: new Date().toISOString(),
          type: 'general',
          title: 'System Initialized',
          detail: 'JetRacer Control Center UI session started in Phase 1 preview mode.',
        },
      ],

      addEvent: (event) =>
        set((state) => {
          const newEntry: UiEvent = {
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: new Date().toISOString(),
            ...event,
          }
          // Ring buffer: prepend latest and enforce capacity limit
          const updated = [newEntry, ...state.events].slice(0, MAX_EVENT_LOG_CAPACITY)
          return { events: updated }
        }),

      clearEvents: () => set({ events: [] }),
    }),
    {
      name: 'jetracer_ui_event_log',
    },
  ),
)

/**
 * Filter helper for history event querying.
 */
export function filterEvents(
  events: UiEvent[],
  typeFilter: UiEventType | 'all',
  searchQuery: string,
): UiEvent[] {
  const query = searchQuery.trim().toLowerCase()
  return events.filter((evt) => {
    const matchesType = typeFilter === 'all' || evt.type === typeFilter
    const matchesQuery =
      !query ||
      evt.title.toLowerCase().includes(query) ||
      (evt.detail && evt.detail.toLowerCase().includes(query))
    return matchesType && matchesQuery
  })
}
