/**
 * JetRacer Control Center — Robot Agent Client (Phase 7B)
 *
 * Provides typed, safety-guarded client interface to the robot-side JCC helper agent.
 * Enforces operator opt-in (Settings -> allowRobotMutations) before dispatching
 * state-altering commands (start/stop mapping, map saving, map deletion).
 */

import { rosbridgeClient } from '@/services/rosbridgeClient'
import { useSettingsStore } from '@/store/settingsStore'
import type {
  AgentStatus,
  ChunkTransferResult,
  RobotMapItem,
  RobotMapListResult,
  SavedRobotMapDetails,
} from './agentTypes'

export class AgentClient {
  private serviceName: string = '/jetracer_cc_agent/command'

  public setServiceName(name: string): void {
    this.serviceName = name.trim() || '/jetracer_cc_agent/command'
  }

  public getServiceName(): string {
    return this.serviceName
  }

  private assertMutationsAllowed(actionDescription: string): void {
    const isAllowed = useSettingsStore.getState().safety.allowRobotMutations ?? false
    if (!isAllowed) {
      throw new Error(
        `[SAFETY GUARD] Cannot perform "${actionDescription}": Robot actions are disabled in Settings. Enable "Allow Robot Actions" in Settings to proceed.`,
      )
    }
  }

  /**
   * Queries agent status, uptime, mapping process state, and disk info.
   * Safe read-only call.
   */
  public async getStatus(): Promise<AgentStatus> {
    const res = await rosbridgeClient.callAgentCommand(
      this.serviceName,
      'status',
      '{}',
      'AgentClient',
      5000,
    )

    if (!res.success) {
      throw new Error(res.message || 'Failed to query agent status.')
    }

    const data = JSON.parse(res.payload_json) as {
      version: string
      uptime_secs: number
      is_mapping: boolean
      mapping_pid: number | null
      mapping_duration_secs: number
      maps_dir: string
      map_count: number
      trash_count: number
      slam_pkg: string
      slam_launch: string
    }

    return {
      version: data.version,
      uptimeSecs: data.uptime_secs,
      isMapping: data.is_mapping,
      mappingPid: data.mapping_pid,
      mappingDurationSecs: data.mapping_duration_secs,
      mapsDir: data.maps_dir,
      mapCount: data.map_count,
      trashCount: data.trash_count,
      slamPkg: data.slam_pkg,
      slamLaunch: data.slam_launch,
    }
  }

  /**
   * Dispatches command to launch SLAM mapping on the robot.
   * Requires operator opt-in.
   */
  public async startMapping(pkg?: string, launch?: string): Promise<{ success: boolean; message: string; pid?: number }> {
    this.assertMutationsAllowed('Start SLAM Mapping')

    const args = JSON.stringify({ pkg, launch })
    const res = await rosbridgeClient.callAgentCommand(
      this.serviceName,
      'start_mapping',
      args,
      'AgentClient',
      8000,
    )

    let pid: number | undefined
    try {
      const payload = JSON.parse(res.payload_json) as { pid?: number }
      pid = payload.pid
    } catch {
      // Ignore parse error
    }

    return {
      success: res.success,
      message: res.message,
      pid,
    }
  }

  /**
   * Dispatches command to stop SLAM mapping on the robot.
   * Requires operator opt-in.
   */
  public async stopMapping(): Promise<{ success: boolean; message: string }> {
    this.assertMutationsAllowed('Stop SLAM Mapping')

    const res = await rosbridgeClient.callAgentCommand(
      this.serviceName,
      'stop_mapping',
      '{}',
      'AgentClient',
      8000,
    )

    return {
      success: res.success,
      message: res.message,
    }
  }

  /**
   * Saves current live map on the robot via map_saver.
   * Requires operator opt-in.
   */
  public async saveMapOnRobot(name: string): Promise<{
    success: boolean
    message: string
    details?: SavedRobotMapDetails
  }> {
    this.assertMutationsAllowed(`Save Map "${name}"`)

    const args = JSON.stringify({ name: name.trim() })
    const res = await rosbridgeClient.callAgentCommand(
      this.serviceName,
      'save_map',
      args,
      'AgentClient',
      12000,
    )

    let details: SavedRobotMapDetails | undefined
    if (res.success) {
      try {
        details = JSON.parse(res.payload_json) as SavedRobotMapDetails
      } catch {
        // Ignore parse error
      }
    }

    return {
      success: res.success,
      message: res.message,
      details,
    }
  }

  /**
   * Lists saved maps in ~/maps on the robot.
   * Safe read-only call.
   */
  public async listRobotMaps(): Promise<{ maps: RobotMapItem[]; mapsDir: string }> {
    const res = await rosbridgeClient.callAgentCommand(
      this.serviceName,
      'list_maps',
      '{}',
      'AgentClient',
      6000,
    )

    if (!res.success) {
      throw new Error(res.message || 'Failed to list maps on robot.')
    }

    const parsed = JSON.parse(res.payload_json) as RobotMapListResult
    return {
      maps: parsed.maps || [],
      mapsDir: parsed.maps_dir || '~/maps',
    }
  }

  /**
   * Moves map files on the robot to .trash directory.
   * Requires operator opt-in.
   */
  public async deleteMapOnRobot(name: string): Promise<{ success: boolean; message: string }> {
    this.assertMutationsAllowed(`Delete Map "${name}"`)

    const args = JSON.stringify({ name: name.trim() })
    const res = await rosbridgeClient.callAgentCommand(
      this.serviceName,
      'delete_map',
      args,
      'AgentClient',
      6000,
    )

    return {
      success: res.success,
      message: res.message,
    }
  }

  /**
   * Downloads a map from the robot via chunked transfer and returns raw text/bytes.
   * Safe read-only call.
   */
  public async downloadMapFromRobot(
    name: string,
    onProgress?: (receivedBytes: number, totalBytes: number, ext: string) => void,
  ): Promise<{ yamlText: string; pgmBytes: Uint8Array }> {
    const cleanName = name.trim()

    // 1. Download YAML file
    const yamlChunks: string[] = []
    let chunkIdx = 0

    while (true) {
      const args = JSON.stringify({ name: cleanName, ext: 'yaml', chunk_index: chunkIdx })
      const res = await rosbridgeClient.callAgentCommand(
        this.serviceName,
        'get_map_chunk',
        args,
        'AgentClient',
        8000,
      )

      if (!res.success) {
        throw new Error(`Failed to download YAML chunk ${chunkIdx}: ${res.message}`)
      }

      const chunkData = JSON.parse(res.payload_json) as ChunkTransferResult
      const decodedChunk = atob(chunkData.data_base64)
      yamlChunks.push(decodedChunk)

      onProgress?.(yamlChunks.join('').length, chunkData.total_size_bytes, 'yaml')

      if (chunkData.is_last_chunk) break
      chunkIdx++
    }

    const yamlText = yamlChunks.join('')

    // 2. Download PGM file
    const pgmByteArrays: Uint8Array[] = []
    chunkIdx = 0
    let accumulatedPgmBytes = 0

    while (true) {
      const args = JSON.stringify({ name: cleanName, ext: 'pgm', chunk_index: chunkIdx })
      const res = await rosbridgeClient.callAgentCommand(
        this.serviceName,
        'get_map_chunk',
        args,
        'AgentClient',
        10000,
      )

      if (!res.success) {
        throw new Error(`Failed to download PGM chunk ${chunkIdx}: ${res.message}`)
      }

      const chunkData = JSON.parse(res.payload_json) as ChunkTransferResult
      const binaryStr = atob(chunkData.data_base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      pgmByteArrays.push(bytes)
      accumulatedPgmBytes += bytes.length

      onProgress?.(accumulatedPgmBytes, chunkData.total_size_bytes, 'pgm')

      if (chunkData.is_last_chunk) break
      chunkIdx++
    }

    // Assemble full PGM Uint8Array
    const fullPgmBytes = new Uint8Array(accumulatedPgmBytes)
    let offset = 0
    for (const chunk of pgmByteArrays) {
      fullPgmBytes.set(chunk, offset)
      offset += chunk.length
    }

    return {
      yamlText,
      pgmBytes: fullPgmBytes,
    }
  }
}

export const agentClient = new AgentClient()
