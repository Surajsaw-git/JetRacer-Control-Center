import { create } from 'zustand'
import type {
  BackendLinkStatus,
  ConnectionState,
  ConnectionStatus,
  RosTimestamp,
} from '@/types'

export interface ConnectionStoreState extends ConnectionState {
  setHostInfo: (host: string, rosbridgePort?: number, backendPort?: number) => void
  setConnecting: (step?: string) => void
  setConnected: (latencyMs?: number, rosTime?: RosTimestamp | null) => void
  setReconnecting: (attempt?: number, maxAttempts?: number | null) => void
  stopReconnecting: () => void
  setDisconnected: (errorMessage?: string | null) => void
  setError: (errorMessage: string) => void
  setHeartbeat: (latencyMs: number, rosTime?: RosTimestamp | null) => void
  setLinkB: (status: BackendLinkStatus, latencyMs?: number | null, version?: string | null) => void
  setConnectionStep: (step: string | null) => void
  reset: () => void
}

const initialState: ConnectionState = {
  status: 'disconnected',
  host: '',
  backendPort: 8000,
  rosbridgePort: 9090,
  useSsl: false,
  latencyMs: null,
  lastConnected: null,
  errorMessage: null,
  rosTime: null,
  reconnectAttempt: 0,
  maxReconnectAttempts: 5,
  linkBStatus: 'unreachable',
  linkBLatencyMs: null,
  linkBVersion: null,
  connectionStep: null,
}

export const useConnectionStore = create<ConnectionStoreState>((set) => ({
  ...initialState,

  setHostInfo: (host, rosbridgePort = 9090, backendPort = 8000) =>
    set({
      host,
      rosbridgePort,
      backendPort,
    }),

  setConnecting: (step = 'Initiating connection...') =>
    set({
      status: 'connecting',
      connectionStep: step,
      errorMessage: null,
    }),

  setConnected: (latencyMs = 15, rosTime = null) =>
    set({
      status: 'connected',
      latencyMs,
      rosTime,
      lastConnected: new Date().toISOString(),
      errorMessage: null,
      connectionStep: null,
      reconnectAttempt: 0,
    }),

  setReconnecting: (attempt = 1, maxAttempts?: number | null) =>
    set({
      status: 'reconnecting',
      reconnectAttempt: attempt,
      maxReconnectAttempts: maxAttempts ?? null,
      connectionStep: maxAttempts
        ? `Reconnecting (attempt ${attempt}/${maxAttempts})...`
        : `Reconnecting (attempt ${attempt})...`,
    }),

  stopReconnecting: () =>
    set({
      status: 'disconnected',
      reconnectAttempt: 0,
      connectionStep: null,
      errorMessage: 'Reconnection stopped by user.',
    }),

  setDisconnected: (errorMessage = null) =>
    set({
      status: 'disconnected',
      latencyMs: null,
      errorMessage: errorMessage ?? null,
      connectionStep: null,
      reconnectAttempt: 0,
    }),

  setError: (errorMessage: string) =>
    set({
      status: 'error',
      errorMessage,
      latencyMs: null,
      connectionStep: null,
    }),

  setHeartbeat: (latencyMs: number, rosTime = null) =>
    set((state) => ({
      latencyMs,
      rosTime: rosTime || state.rosTime,
    })),

  setLinkB: (linkBStatus, linkBLatencyMs = null, linkBVersion = null) =>
    set({
      linkBStatus,
      linkBLatencyMs,
      linkBVersion,
    }),

  setConnectionStep: (connectionStep) => set({ connectionStep }),

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
