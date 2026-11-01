/**
 * Rosbridge Client Wrapper for JetRacer Control Center.
 *
 * Implements Link A connection lifecycle, health probing, reconnect backoff with jitter,
 * and strict Phase 3 read-only enforcement.
 */

import { Ros, Service } from 'roslib'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { buildBackendUrl, buildRosbridgeUrl } from '@/utils/validators'
import type { ConnectionStatus, RosTimestamp } from '@/types'

/**
 * Strict allow-list of services permitted in Phase 3.
 * READ-ONLY ENFORCEMENT: No publishing, no topic advertisements, and no unapproved service calls.
 */
export const ALLOWED_SERVICES = ['/rosapi/get_time'] as const
export type AllowedService = (typeof ALLOWED_SERVICES)[number]

export interface RosbridgeClientOptions {
  connectTimeoutMs?: number
  heartbeatIntervalMs?: number
  heartbeatTimeoutMs?: number
  maxReconnectAttempts?: number
  initialReconnectDelayMs?: number
  maxReconnectDelayMs?: number
  probeBackend?: boolean
}

export class RosbridgeClient {
  private ros: Ros | null = null
  private host: string = ''
  private rosbridgePort: number = 9090
  private backendPort: number = 8000
  private options: Required<RosbridgeClientOptions>

  private status: ConnectionStatus = 'disconnected'
  private connectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatIntervalTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  private consecutiveFailedHeartbeats: number = 0
  private reconnectAttempts: number = 0
  private isIntentionalDisconnect: boolean = false

  constructor(options?: RosbridgeClientOptions) {
    this.options = {
      connectTimeoutMs: options?.connectTimeoutMs ?? 5000,
      heartbeatIntervalMs: options?.heartbeatIntervalMs ?? 5000,
      heartbeatTimeoutMs: options?.heartbeatTimeoutMs ?? 3000,
      maxReconnectAttempts: options?.maxReconnectAttempts ?? 5,
      initialReconnectDelayMs: options?.initialReconnectDelayMs ?? 1000,
      maxReconnectDelayMs: options?.maxReconnectDelayMs ?? 10000,
      probeBackend: options?.probeBackend ?? true,
    }

    this.setupBrowserListeners()
  }

  public getStatus(): ConnectionStatus {
    return this.status
  }

  public getHost(): string {
    return this.host
  }

  /**
   * Primary entry point: Connect to target robot IP/hostname.
   */
  public async connect(
    host: string,
    rosbridgePort: number = 9090,
    backendPort: number = 8000,
  ): Promise<boolean> {
    const cleanHost = host.trim()
    if (!cleanHost) {
      this.transitionTo('error', 'Cannot connect: host address is empty.')
      return false
    }

    // Check browser online state
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.transitionTo('error', 'Browser is currently offline. Connect to Wi-Fi first.')
      return false
    }

    // Abort previous in-flight connection or reconnect loop
    this.clearAllTimers()
    if (this.ros) {
      this.isIntentionalDisconnect = true
      try {
        this.ros.close()
      } catch {
        // Ignore close error during teardown
      }
      this.ros = null
    }

    this.isIntentionalDisconnect = false
    this.host = cleanHost
    this.rosbridgePort = rosbridgePort
    this.backendPort = backendPort
    this.reconnectAttempts = 0
    this.consecutiveFailedHeartbeats = 0

    useConnectionStore.getState().setHostInfo(cleanHost, rosbridgePort, backendPort)
    this.transitionTo('connecting', 'Connecting to rosbridge...')

    return this.attemptRosbridgeConnection()
  }

  /**
   * User cancellation or disconnection.
   */
  public disconnect(): void {
    this.isIntentionalDisconnect = true
    this.clearAllTimers()

    if (this.ros) {
      try {
        this.ros.close()
      } catch {
        // Ignore
      }
      this.ros = null
    }

    this.reconnectAttempts = 0
    this.consecutiveFailedHeartbeats = 0
    this.transitionTo('disconnected', null)
    useConnectionStore.getState().setDisconnected()
  }

  /**
   * Internal connection attempt with timeout and socket event handlers.
   */
  private attemptRosbridgeConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const targetUrl = buildRosbridgeUrl(this.host, this.rosbridgePort)
      useConnectionStore.getState().setConnectionStep(`Connecting to ${targetUrl}...`)

      try {
        this.ros = new Ros({
          url: targetUrl,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        this.transitionTo('error', `Failed to initialize Rosbridge socket: ${msg}`)
        resolve(false)
        return
      }

      let hasSettled = false

      // Timeout watchdog
      this.connectTimer = setTimeout(() => {
        if (!hasSettled) {
          hasSettled = true
          if (this.ros) {
            this.isIntentionalDisconnect = true
            try {
              this.ros.close()
            } catch {
              // Ignore
            }
          }
          const timeoutMsg = `Timed out connecting to ${this.host}:${this.rosbridgePort}. Are you on the same Wi-Fi? Can you ping the robot?`
          this.transitionTo('error', timeoutMsg)
          resolve(false)
        }
      }, this.options.connectTimeoutMs)

      // Connection established
      this.ros.on('connection', () => {
        if (hasSettled) return
        hasSettled = true
        if (this.connectTimer) {
          clearTimeout(this.connectTimer)
          this.connectTimer = null
        }

        useConnectionStore.getState().setConnectionStep('Checking ROS time service...')
        // Perform initial heartbeat probe to verify /rosapi/get_time
        this.probeRosTime()
          .then((success) => {
            if (success) {
              this.reconnectAttempts = 0
              this.consecutiveFailedHeartbeats = 0
              this.transitionTo('connected')

              // Persist last successful host to settings
              useSettingsStore.getState().updateConnection({
                host: this.host,
                rosbridgePort: this.rosbridgePort,
                backendPort: this.backendPort,
              })

              this.startHeartbeatLoop()

              if (this.options.probeBackend) {
                this.probeBackendHealth().catch(() => {})
              }

              resolve(true)
            } else {
              this.transitionTo(
                'error',
                `Connected to port ${this.rosbridgePort}, but /rosapi/get_time failed. Ensure rosapi node is active.`,
              )
              resolve(false)
            }
          })
          .catch((err) => {
            this.transitionTo('error', `Error verifying ROS service: ${err.message}`)
            resolve(false)
          })
      })

      // Connection error
      this.ros.on('error', (_error) => {
        if (hasSettled) {
          // If already connected, delegate to close/reconnect handler
          return
        }
        hasSettled = true
        if (this.connectTimer) {
          clearTimeout(this.connectTimer)
          this.connectTimer = null
        }

        const errorMsg = `Cannot reach robot at ${this.host}:${this.rosbridgePort}. Is rosbridge running? (See runbook)`
        this.transitionTo('error', errorMsg)
        resolve(false)
      })

      // Connection closed
      this.ros.on('close', () => {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer)
          this.connectTimer = null
        }

        if (this.isIntentionalDisconnect) {
          return
        }

        if (this.status === 'connected') {
          this.handleUnexpectedDrop()
        } else if (!hasSettled) {
          hasSettled = true
          this.transitionTo(
            'error',
            `Connection closed by remote host ${this.host}:${this.rosbridgePort}.`,
          )
          resolve(false)
        }
      })
    })
  }

  /**
   * Heartbeat check via /rosapi/get_time.
   */
  public async probeRosTime(): Promise<boolean> {
    if (!this.ros || !this.ros.isConnected) {
      return false
    }

    const startTime = Date.now()

    return new Promise((resolve) => {
      let isTimedOut = false
      const timeout = setTimeout(() => {
        isTimedOut = true
        resolve(false)
      }, this.options.heartbeatTimeoutMs)

      try {
        const timeService = new Service({
          ros: this.ros!,
          name: '/rosapi/get_time',
          serviceType: 'rosapi/GetTime',
        })

        // Read-only execution
        timeService.callService(
          {},
          (response: unknown) => {
            if (isTimedOut) return
            clearTimeout(timeout)
            const latency = Date.now() - startTime
            const typedRes = response as { time?: { secs: number; nsecs: number } } | null
            const rosTime: RosTimestamp | null = typedRes?.time
              ? { secs: typedRes.time.secs, nsecs: typedRes.time.nsecs }
              : null

            useConnectionStore.getState().setHeartbeat(latency, rosTime)
            resolve(true)
          },
          (_err: unknown) => {
            if (isTimedOut) return
            clearTimeout(timeout)
            resolve(false)
          },
        )
      } catch {
        if (!isTimedOut) {
          clearTimeout(timeout)
          resolve(false)
        }
      }
    })
  }

  /**
   * Periodic heartbeat timer running while connected.
   */
  private startHeartbeatLoop(intervalMs?: number): void {
    if (this.heartbeatIntervalTimer) {
      clearInterval(this.heartbeatIntervalTimer)
    }

    const interval = intervalMs ?? this.options.heartbeatIntervalMs
    this.heartbeatIntervalTimer = setInterval(async () => {
      if (this.status !== 'connected') {
        return
      }

      const ok = await this.probeRosTime()
      if (ok) {
        this.consecutiveFailedHeartbeats = 0
      } else {
        this.consecutiveFailedHeartbeats += 1
        if (this.consecutiveFailedHeartbeats >= 2) {
          this.handleUnexpectedDrop()
        }
      }
    }, interval)
  }

  /**
   * Handles lost connection with exponential backoff and jitter.
   */
  private handleUnexpectedDrop(): void {
    if (this.isIntentionalDisconnect || this.status === 'reconnecting') {
      return
    }

    this.clearAllTimers()
    if (this.ros) {
      try {
        this.ros.close()
      } catch {
        // Ignore
      }
      this.ros = null
    }

    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      const msg = `Reconnection attempts exhausted (${this.options.maxReconnectAttempts}/${this.options.maxReconnectAttempts}). Check robot power, Wi-Fi, and rosbridge server.`
      this.transitionTo('disconnected', msg)
      useConnectionStore.getState().setDisconnected(msg)
      return
    }

    this.reconnectAttempts += 1
    this.transitionTo('reconnecting', null)
    useConnectionStore
      .getState()
      .setReconnecting(this.reconnectAttempts, this.options.maxReconnectAttempts)

    // Exponential backoff: base * 2^(attempt - 1) clamped to max, with +/- 20% jitter
    const baseDelay = Math.min(
      this.options.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      this.options.maxReconnectDelayMs,
    )
    const jitter = (Math.random() - 0.5) * 0.4 * baseDelay
    const delay = Math.max(500, Math.floor(baseDelay + jitter))

    useConnectionStore
      .getState()
      .setConnectionStep(
        `Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})...`,
      )

    this.reconnectTimer = setTimeout(() => {
      if (this.isIntentionalDisconnect) return
      this.attemptRosbridgeConnection()
    }, delay)
  }

  /**
   * Link B auxiliary probe: Non-blocking health check against FastAPI backend.
   */
  public async probeBackendHealth(): Promise<void> {
    useConnectionStore.getState().setLinkB('checking')
    const backendUrl = `${buildBackendUrl(this.host, this.backendPort)}/api/v1/health`

    const startTime = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    try {
      const res = await fetch(backendUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      clearTimeout(timeout)
      const latency = Date.now() - startTime

      if (res.ok) {
        const body = await res.json().catch(() => ({}))
        const version = body?.version || '0.2.1'
        useConnectionStore.getState().setLinkB('connected', latency, version)
      } else {
        useConnectionStore.getState().setLinkB('unreachable', null, null)
      }
    } catch {
      clearTimeout(timeout)
      useConnectionStore.getState().setLinkB('unreachable', null, null)
    }
  }

  /**
   * Strict Read-Only Guard.
   * Throws Error in dev/test; no-ops with console warning in production.
   */
  private assertReadOnlyAllowed(operation: string, target?: string): void {
    const isAllowedService =
      operation === 'call_service' &&
      target &&
      (ALLOWED_SERVICES as readonly string[]).includes(target)

    if (isAllowedService) {
      return
    }

    const violationMessage = `[SECURITY VIOLATION] Phase 3 RosbridgeClient is strictly read-only. Attempted operation "${operation}" on "${target || 'unspecified'}" is prohibited.`

    const isDevOrTest =
      import.meta.env.DEV ||
      import.meta.env.MODE !== 'production' ||
      (typeof window !== 'undefined' && Boolean((window as unknown as { __VITEST__?: boolean }).__VITEST__))

    if (isDevOrTest) {
      throw new Error(violationMessage)
    } else {
      console.warn(violationMessage)
    }
  }

  /**
   * Protected Service Caller with Allow-List Enforcement.
   */
  public callService(
    serviceName: string,
    serviceType: string,
    requestPayload: Record<string, unknown> = {},
  ): Promise<unknown> {
    this.assertReadOnlyAllowed('call_service', serviceName)

    if (!this.ros || !this.ros.isConnected) {
      return Promise.reject(new Error('Rosbridge socket is not connected.'))
    }

    return new Promise((resolve, reject) => {
      const srv = new Service({
        ros: this.ros!,
        name: serviceName,
        serviceType,
      })

      srv.callService(
        requestPayload,
        (res: unknown) => resolve(res),
        (err: unknown) => reject(new Error(String(err))),
      )
    })
  }

  /**
   * Explicitly forbidden ROS operations in Phase 3.
   */
  public publish(topic: string, _message: unknown): void {
    this.assertReadOnlyAllowed('publish', topic)
  }

  public advertise(topic: string, _messageType: string): void {
    this.assertReadOnlyAllowed('advertise', topic)
  }

  public subscribe(topic: string, _messageType: string): void {
    this.assertReadOnlyAllowed('subscribe', topic)
  }

  private transitionTo(status: ConnectionStatus, message?: string | null): void {
    this.status = status
    const store = useConnectionStore.getState()

    switch (status) {
      case 'connecting':
        store.setConnecting(message || undefined)
        break
      case 'connected':
        store.setConnected()
        break
      case 'reconnecting':
        store.setReconnecting()
        break
      case 'disconnected':
        store.setDisconnected(message)
        break
      case 'error':
        store.setError(message || 'Unknown connection error')
        break
    }
  }

  private clearAllTimers(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer)
      this.connectTimer = null
    }
    if (this.heartbeatIntervalTimer) {
      clearInterval(this.heartbeatIntervalTimer)
      this.heartbeatIntervalTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setupBrowserListeners(): void {
    if (typeof window === 'undefined') return

    // Network connectivity change
    window.addEventListener('online', () => {
      if (this.status === 'reconnecting' && this.host) {
        this.attemptRosbridgeConnection()
      }
    })

    window.addEventListener('offline', () => {
      this.disconnect()
      useConnectionStore
        .getState()
        .setError('Network connection lost (device is offline).')
    })

    // Battery saver: slow down heartbeat when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (this.status === 'connected') {
        if (document.visibilityState === 'hidden') {
          this.startHeartbeatLoop(15000)
        } else {
          // Immediately probe on wake-up and resume 5s interval
          this.probeRosTime().catch(() => {})
          this.startHeartbeatLoop(this.options.heartbeatIntervalMs)
        }
      }
    })
  }

  public destroy(): void {
    this.disconnect()
  }
}

/**
 * Singleton client instance for application use.
 */
export const rosbridgeClient = new RosbridgeClient()
