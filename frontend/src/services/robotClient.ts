/**
 * Abstract client interface for robot backend and ROS communication.
 *
 * NOTE FOR PHASE 1: No network requests, fetch calls, or roslib sockets
 * are opened. The NotConnectedClient provides safe no-op fallbacks.
 */

import type { ConnectionStatus, ControlState, SystemMetrics } from '@/types'

export interface RobotClient {
  getStatus(): Promise<ConnectionStatus>
  getMetrics(): Promise<SystemMetrics | null>
  sendControlCommand(cmd: ControlState): Promise<boolean>
  triggerEmergencyStop(): Promise<boolean>
}

/**
 * Default disconnected client implementation for Phase 1.
 * Guaranteed zero network or socket activity.
 */
export class NotConnectedClient implements RobotClient {
  async getStatus(): Promise<ConnectionStatus> {
    return 'disconnected'
  }

  async getMetrics(): Promise<SystemMetrics | null> {
    return null
  }

  async sendControlCommand(_cmd: ControlState): Promise<boolean> {
    // Phase 1 preview: No commands are sent to physical hardware
    return false
  }

  async triggerEmergencyStop(): Promise<boolean> {
    // Phase 1 preview: Emergency stop is not connected to robot yet
    return false
  }
}

export const defaultRobotClient = new NotConnectedClient()
