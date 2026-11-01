import { create } from 'zustand'
import type { ConnectionState, ConnectionStatus } from '@/types'

export interface ConnectionStoreState extends ConnectionState {
  setConnecting: () => void
  setConnected: (latencyMs?: number) => void
  setReconnecting: () => void
  setDisconnected: () => void
  setError: (errorMessage: string) => void
  reset: () => void
}

const initialState: ConnectionState = {
  status: 'disconnected', // Phase 1 is strictly disconnected by default
  host: '',
  backendPort: 8000,
  rosbridgePort: 9090,
  useSsl: false,
  latencyMs: null,
  lastConnected: null,
  errorMessage: null,
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  ...initialState,

  setConnecting: () =>
    set({
      status: 'connecting',
      errorMessage: null,
    }),

  setConnected: (latencyMs = 15) =>
    set({
      status: 'connected',
      latencyMs,
      lastConnected: new Date().toISOString(),
      errorMessage: null,
    }),

  setReconnecting: () =>
    set({
      status: 'reconnecting',
    }),

  setDisconnected: () =>
    set({
      status: 'disconnected',
      latencyMs: null,
      errorMessage: null,
    }),

  setError: (errorMessage: string) =>
    set({
      status: 'error',
      errorMessage,
      latencyMs: null,
    }),

  reset: () => set(initialState),
}))

/**
 * Pure transition validator helper for unit tests and safety guards.
 */
export function canTransition(from: ConnectionStatus, to: ConnectionStatus): boolean {
  if (from === to) return true
  switch (from) {
    case 'disconnected':
      return to === 'connecting'
    case 'connecting':
      return to === 'connected' || to === 'error' || to === 'disconnected'
    case 'connected':
      return to === 'reconnecting' || to === 'disconnected' || to === 'error'
    case 'reconnecting':
      return to === 'connected' || to === 'error' || to === 'disconnected'
    case 'error':
      return to === 'connecting' || to === 'disconnected'
    default:
      return false
  }
}
