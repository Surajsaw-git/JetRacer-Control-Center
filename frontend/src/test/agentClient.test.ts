import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { agentClient } from '@/services/agent/agentClient'
import { rosbridgeClient } from '@/services/rosbridgeClient'
import { useSettingsStore } from '@/store/settingsStore'
import { assertAgentCommandServiceAllowed } from '@/services/rosPolicy'

describe('agentClient & Agent Policy (Phase 7B)', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      safety: {
        maxSpeedPct: 50,
        commandTimeoutMs: 500,
        allowRobotMutations: false,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('assertAgentCommandServiceAllowed enforces caller identity and service type', () => {
    expect(() =>
      assertAgentCommandServiceAllowed('AgentClient', 'jetracer_cc_msgs/AgentCommand')
    ).not.toThrow()

    expect(() =>
      assertAgentCommandServiceAllowed('RandomCaller', 'jetracer_cc_msgs/AgentCommand')
    ).toThrow(/Unauthorized caller/)

    expect(() =>
      assertAgentCommandServiceAllowed('AgentClient', 'wrong_type')
    ).toThrow(/Agent service call requires/)
  })

  it('queries agent status and parses telemetry payload', async () => {
    vi.spyOn(rosbridgeClient, 'callAgentCommand').mockResolvedValue({
      success: true,
      message: 'Agent is operational.',
      payload_json: JSON.stringify({
        version: '0.8.1-phase7b',
        uptime_secs: 120,
        is_mapping: true,
        mapping_pid: 4567,
        mapping_duration_secs: 45,
        maps_dir: '/home/jetson/maps',
        map_count: 2,
        trash_count: 1,
        slam_pkg: 'jetracer',
        slam_launch: 'slam.launch',
      }),
    })

    const status = await agentClient.getStatus()
    expect(status.version).toBe('0.8.1-phase7b')
    expect(status.isMapping).toBe(true)
    expect(status.mappingPid).toBe(4567)
    expect(status.mapsDir).toBe('/home/jetson/maps')
    expect(status.mapCount).toBe(2)
  })

  it('blocks startMapping when allowRobotMutations is disabled in Settings', async () => {
    useSettingsStore.setState({
      safety: {
        maxSpeedPct: 50,
        commandTimeoutMs: 500,
        allowRobotMutations: false,
      },
    })

    await expect(agentClient.startMapping()).rejects.toThrow(/SAFETY GUARD/)
  })

  it('permits startMapping when allowRobotMutations is enabled in Settings', async () => {
    useSettingsStore.setState({
      safety: {
        maxSpeedPct: 50,
        commandTimeoutMs: 500,
        allowRobotMutations: true,
      },
    })

    const callSpy = vi.spyOn(rosbridgeClient, 'callAgentCommand').mockResolvedValue({
      success: true,
      message: 'Mapping started.',
      payload_json: JSON.stringify({ pid: 8888 }),
    })

    const res = await agentClient.startMapping('jetracer', 'slam.launch')
    expect(res.success).toBe(true)
    expect(res.pid).toBe(8888)
    expect(callSpy).toHaveBeenCalledWith(
      '/jetracer_cc_agent/command',
      'start_mapping',
      JSON.stringify({ pkg: 'jetracer', launch: 'slam.launch' }),
      'AgentClient',
      8000
    )
  })

  it('blocks saveMapOnRobot and deleteMapOnRobot when mutations disabled', async () => {
    useSettingsStore.setState({
      safety: {
        maxSpeedPct: 50,
        commandTimeoutMs: 500,
        allowRobotMutations: false,
      },
    })

    await expect(agentClient.saveMapOnRobot('test_map')).rejects.toThrow(/SAFETY GUARD/)
    await expect(agentClient.deleteMapOnRobot('test_map')).rejects.toThrow(/SAFETY GUARD/)
  })

  it('downloads map from robot via chunked transfer and reassembles buffers', async () => {
    // Mock get_map_chunk responses: 1 YAML chunk, 2 PGM chunks
    vi.spyOn(rosbridgeClient, 'callAgentCommand').mockImplementation(
      async (_srv, _cmd, argsJson) => {
        const parsed = JSON.parse(argsJson || '{}')
        if (parsed.ext === 'yaml') {
          return {
            success: true,
            message: 'YAML chunk',
            payload_json: JSON.stringify({
              name: 'room_map',
              ext: 'yaml',
              chunk_index: 0,
              total_chunks: 1,
              total_size_bytes: 30,
              chunk_size_bytes: 30,
              is_last_chunk: true,
              data_base64: btoa('image: room_map.pgm\nresolution: 0.05\n'),
            }),
          }
        } else {
          // PGM chunks
          if (parsed.chunk_index === 0) {
            return {
              success: true,
              message: 'PGM chunk 1',
              payload_json: JSON.stringify({
                name: 'room_map',
                ext: 'pgm',
                chunk_index: 0,
                total_chunks: 2,
                total_size_bytes: 4,
                chunk_size_bytes: 2,
                is_last_chunk: false,
                data_base64: btoa(String.fromCharCode(10, 20)),
              }),
            }
          } else {
            return {
              success: true,
              message: 'PGM chunk 2',
              payload_json: JSON.stringify({
                name: 'room_map',
                ext: 'pgm',
                chunk_index: 1,
                total_chunks: 2,
                total_size_bytes: 4,
                chunk_size_bytes: 2,
                is_last_chunk: true,
                data_base64: btoa(String.fromCharCode(30, 40)),
              }),
            }
          }
        }
      }
    )

    const result = await agentClient.downloadMapFromRobot('room_map')
    expect(result.yamlText).toContain('image: room_map.pgm')
    expect(result.pgmBytes).toHaveLength(4)
    expect(result.pgmBytes[0]).toBe(10)
    expect(result.pgmBytes[1]).toBe(20)
    expect(result.pgmBytes[2]).toBe(30)
    expect(result.pgmBytes[3]).toBe(40)
  })
})
