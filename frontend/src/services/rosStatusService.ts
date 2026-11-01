/**
 * ROS Status Service
 *
 * Coordinates ROS master reachability, rosapi node status, latency measurements,
 * and clock offset tracking.
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { useConnectionStore } from '@/store/connectionStore'
import type { RosMasterStatus, RosTimestamp } from '@/types'

export class RosStatusService {
  /**
   * Performs an immediate active status probe via /rosapi/get_time.
   */
  public async probeStatus(): Promise<RosMasterStatus> {
    const connectionStatus = useConnectionStore.getState().status
    if (connectionStatus !== 'connected') {
      useRosStatusStore.getState().setStatus('disconnected')
      return 'disconnected'
    }

    try {
      const startTime = Date.now()
      const res = await rosbridgeClient.callService<{ time?: RosTimestamp }>(
        '/rosapi/get_time',
        'rosapi/GetTime',
        {},
      )

      const latencyMs = Date.now() - startTime
      const rosTime = res?.time ?? null

      useRosStatusStore.getState().updateHeartbeat(latencyMs, rosTime)
      return useRosStatusStore.getState().status
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      useRosStatusStore.getState().recordHeartbeatFailure(msg)
      return useRosStatusStore.getState().status
    }
  }

  /**
   * Resets status state on disconnect.
   */
  public reset(): void {
    useRosStatusStore.getState().reset()
  }
}

export const rosStatusService = new RosStatusService()
