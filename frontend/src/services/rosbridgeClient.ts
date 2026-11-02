/**
 * Rosbridge Client Wrapper for JetRacer Control Center.
 *
 * Implements Link A connection lifecycle, health probing, reconnect backoff with jitter,
 * and strict Phase 3 read-only enforcement.
 */

import type { Ros } from 'roslib'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { buildBackendUrl, buildRosbridgeUrl } from '@/utils/validators'
import {
  ALLOWED_ROSAPI_SERVICES,
  assertOperationAllowed,
  assertServiceAllowed,
  assertCameraCompressedSubscriptionAllowed,
  MIN_CAMERA_THROTTLE_MS,
} from '@/services/rosPolicy'
import type { ConnectionStatus, RosTimestamp } from '@/types'

/**
 * Lazy module loader for roslib to prevent bundle bloat in main chunk.
 */
let roslibModulePromise: Promise<typeof import('roslib')> | null = null

export function getRoslib(): Promise<typeof import('roslib')> {
  if (!roslibModulePromise) {
    roslibModulePromise = import('roslib')
  }
  return roslibModulePromise
}

/**
 * Strict allow-list of services permitted in Phase 4.
 * Backwards compatible export mapping to approved rosapi introspection services.
 */
export const ALLOWED_SERVICES = Object.keys(ALLOWED_ROSAPI_SERVICES)
export type AllowedService = keyof typeof ALLOWED_ROSAPI_SERVICES

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
  private activeCameraSubscriptions: number = 0
  private stableConnectionTimer: ReturnType<typeof setTimeout> | null = null

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
  }

  /**
   * Stops active reconnect attempts immediately and permanently sets disconnected status.
   */
  public stopReconnecting(): void {
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
    this.transitionTo('disconnected', 'Reconnection stopped by user.')
  }

  /**
   * Internal connection attempt with timeout and socket event handlers.
   */
  private async attemptRosbridgeConnection(): Promise<boolean> {
    const targetUrl = buildRosbridgeUrl(this.host, this.rosbridgePort)
    useConnectionStore.getState().setConnectionStep(`Connecting to ${targetUrl}...`)

    try {
      const { Ros } = await getRoslib()
      this.ros = new Ros({
        url: targetUrl,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.transitionTo('error', `Failed to initialize Rosbridge socket: ${msg}`)
      return false
    }

    const rosInstance = this.ros
    if (!rosInstance) return false

    return new Promise((resolve) => {
      let hasSettled = false

      // Timeout watchdog
      this.connectTimer = setTimeout(() => {
        if (!hasSettled) {
          hasSettled = true
          this.isIntentionalDisconnect = true
          try {
            rosInstance.close()
          } catch {
            // Ignore
          }
          this.isIntentionalDisconnect = false
          const timeoutMsg = `Timed out connecting to rosbridge at ${this.host}:${this.rosbridgePort}. Are you on the same Wi-Fi? Can you ping the robot?`
          if (this.status === 'reconnecting') {
            this.handleUnexpectedDrop()
          } else {
            this.transitionTo('error', timeoutMsg)
          }
          resolve(false)
        }
      }, this.options.connectTimeoutMs)

      // Connection established
      rosInstance.on('connection', () => {
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
      rosInstance.on('error', (_error) => {
        if (hasSettled) {
          // If already connected, delegate to close/reconnect handler
          return
        }
        hasSettled = true
        if (this.connectTimer) {
          clearTimeout(this.connectTimer)
          this.connectTimer = null
        }

        const errorMsg = `Cannot reach rosbridge at ${this.host}:${this.rosbridgePort}. Is rosbridge running? (See runbook)`
        if (this.status === 'reconnecting') {
          this.handleUnexpectedDrop()
        } else {
          this.transitionTo('error', errorMsg)
        }
        resolve(false)
      })

      // Connection closed
      rosInstance.on('close', () => {
        if (this.connectTimer) {
          clearTimeout(this.connectTimer)
          this.connectTimer = null
        }

        if (this.isIntentionalDisconnect) {
          return
        }

        if (this.status === 'connected' || this.status === 'reconnecting') {
          this.handleUnexpectedDrop()
        } else if (!hasSettled) {
          hasSettled = true
          this.transitionTo(
            'error',
            `Cannot reach rosbridge at ${this.host}:${this.rosbridgePort}.`,
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
    const { Service } = await getRoslib()

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
            useRosStatusStore.getState().updateHeartbeat(latency, rosTime, startTime)
            resolve(true)
          },
          (_err: unknown) => {
            if (isTimedOut) return
            clearTimeout(timeout)
            useRosStatusStore.getState().recordHeartbeatFailure('Failed to query /rosapi/get_time')
            resolve(false)
          },
        )
      } catch {
        if (!isTimedOut) {
          clearTimeout(timeout)
          useRosStatusStore.getState().recordHeartbeatFailure('Exception during /rosapi/get_time')
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
    if (this.isIntentionalDisconnect) {
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
    if (this.isIntentionalDisconnect) {
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.reconnectAttempts += 1
    this.transitionTo('reconnecting', null)
    useConnectionStore
      .getState()
      .setReconnecting(this.reconnectAttempts)

    const MAX_DELAY_MS = 30_000
    // Exponential backoff capped at 30 seconds: 1, 2, 4, 8, 16, 30, 30...
    const rawDelay = Math.min(
      this.options.initialReconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      MAX_DELAY_MS,
    )
    // +/- 20% jitter
    const jitter = (Math.random() - 0.5) * 0.4 * rawDelay
    let delay = Math.max(500, Math.floor(rawDelay + jitter))
    if (delay > MAX_DELAY_MS) {
      delay = MAX_DELAY_MS
    }

    // Battery saver / background throttle: clamp min delay to 30s if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      delay = Math.max(delay, MAX_DELAY_MS)
    }

    useConnectionStore
      .getState()
      .setConnectionStep(
        `Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`,
      )

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      if (this.isIntentionalDisconnect) return
      const ok = await this.attemptRosbridgeConnection()
      if (!ok && !this.isIntentionalDisconnect && this.status === 'reconnecting' && !this.reconnectTimer) {
        this.scheduleReconnect()
      }
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
   * Strict Read-Only Guard delegating to centralized Capability Policy.
   * Throws Error unconditionally across all environments (dev, test, and production).
   * Forbidden operations are never transmitted over the socket.
   */
  private assertReadOnlyAllowed(
    operation: 'publish' | 'advertise' | 'subscribe' | 'call_service',
    target?: string,
  ): void {
    assertOperationAllowed(operation, target)
  }

  /**
   * Protected Service Caller with Allow-List Enforcement.
   */
  public callService<T = unknown>(
    serviceName: string,
    serviceType: string,
    requestPayload: Record<string, unknown> = {},
  ): Promise<T> {
    assertServiceAllowed(serviceName)

    if (!this.ros || !this.ros.isConnected) {
      return Promise.reject(new Error('Rosbridge socket is not connected.'))
    }

    return getRoslib().then(({ Service }) => {
      return new Promise<T>((resolve, reject) => {
        const srv = new Service({
          ros: this.ros!,
          name: serviceName,
          serviceType,
        })

        srv.callService(
          requestPayload,
          (res: unknown) => resolve(res as T),
          (err: unknown) => reject(new Error(String(err))),
        )
      })
    })
  }

  /**
   * Controlled Subscription Manager hook for read-only telemetry topics.
   * Rates are throttled and heavy types are guarded before subscription.
   */
  public async subscribeToTopic(
    topicName: string,
    messageType: string,
    callback: (message: unknown) => void,
    throttleRateMs: number = 200,
  ): Promise<() => void> {
    this.assertReadOnlyAllowed('subscribe', topicName)

    if (!this.ros || !this.ros.isConnected) {
      throw new Error('Rosbridge socket is not connected.')
    }

    const { Topic } = await getRoslib()
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType,
      throttle_rate: throttleRateMs,
    })

    topic.subscribe(callback)

    return () => {
      try {
        topic.unsubscribe(callback)
      } catch {
        // Safe teardown
      }
    }
  }

  /**
   * Controlled subscription for camera compressed image streams over rosbridge.
   * Strictly enforces caller identity, throttle floor (>=100ms), and single active subscription.
   */
  public async subscribeCameraCompressed(
    topicName: string,
    callback: (message: unknown) => void,
    throttleRateMs: number = MIN_CAMERA_THROTTLE_MS,
    caller: string = 'RosbridgeCompressedSource',
  ): Promise<() => void> {
    assertCameraCompressedSubscriptionAllowed(
      caller,
      'sensor_msgs/CompressedImage',
      throttleRateMs,
      this.activeCameraSubscriptions,
    )

    if (!this.ros || !this.ros.isConnected) {
      throw new Error('Rosbridge socket is not connected.')
    }

    const { Topic } = await getRoslib()
    const topic = new Topic({
      ros: this.ros,
      name: topicName,
      messageType: 'sensor_msgs/CompressedImage',
      throttle_rate: Math.max(MIN_CAMERA_THROTTLE_MS, throttleRateMs),
      queue_length: 1,
    })

    this.activeCameraSubscriptions++
    topic.subscribe(callback)

    let cleanedUp = false
    return () => {
      if (cleanedUp) return
      cleanedUp = true
      this.activeCameraSubscriptions = Math.max(0, this.activeCameraSubscriptions - 1)
      try {
        topic.unsubscribe(callback)
      } catch {
        // Safe teardown
      }
    }
  }

  public getActiveCameraSubscriptionsCount(): number {
    return this.activeCameraSubscriptions
  }

  public getRosInstance(): Ros | null {
    return this.ros
  }

  public isConnected(): boolean {
    return Boolean(this.ros && this.ros.isConnected && this.status === 'connected')
  }

  /**
   * Explicitly forbidden ROS publishing and advertising operations.
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

  private startStableConnectionTimer(): void {
    this.clearStableConnectionTimer()
    this.stableConnectionTimer = setTimeout(() => {
      this.stableConnectionTimer = null
      if (this.status === 'connected') {
        this.reconnectAttempts = 0
      }
    }, 10_000)
  }

  private clearStableConnectionTimer(): void {
    if (this.stableConnectionTimer) {
      clearTimeout(this.stableConnectionTimer)
      this.stableConnectionTimer = null
    }
  }

  private transitionTo(status: ConnectionStatus, message?: string | null): void {
    this.status = status
    const store = useConnectionStore.getState()

    switch (status) {
      case 'connecting':
        this.clearStableConnectionTimer()
        store.setConnecting(message || undefined)
        break
      case 'connected':
        store.setConnected()
        this.startStableConnectionTimer()
        break
      case 'reconnecting':
        this.clearStableConnectionTimer()
        store.setReconnecting(this.reconnectAttempts)
        useRosStatusStore
          .getState()
          .setStatus('disconnected', 'Link to robot is down; the ROS master state is unknown')
        break
      case 'disconnected':
        this.clearStableConnectionTimer()
        store.setDisconnected(message)
        useRosStatusStore.getState().reset()
        break
      case 'error':
        this.clearStableConnectionTimer()
        store.setError(message || 'Unknown connection error')
        useRosStatusStore
          .getState()
          .setStatus('disconnected', 'Link to robot is down; the ROS master state is unknown')
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
    this.clearStableConnectionTimer()
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
