/**
 * JetRacer Control Center — Robot Agent Types (Phase 7B)
 */

export interface AgentStatus {
  version: string
  uptimeSecs: number
  isMapping: boolean
  mappingPid: number | null
  mappingDurationSecs: number
  mapsDir: string
  mapCount: number
  trashCount: number
  slamPkg: string
  slamLaunch: string
}

export interface RobotMapItem {
  name: string
  yaml_path: string
  pgm_path: string | null
  has_pgm: boolean
  yaml_size_bytes: number
  pgm_size_bytes: number
  modified_secs: number
}

export interface RobotMapListResult {
  maps: RobotMapItem[]
  maps_dir: string
}

export interface SavedRobotMapDetails {
  name: string
  yaml_path: string
  pgm_path: string
  yaml_size: number
  pgm_size: number
  saved_at: number
}

export interface ChunkTransferResult {
  name: string
  ext: 'yaml' | 'pgm'
  chunk_index: number
  total_chunks: number
  total_size_bytes: number
  chunk_size_bytes: number
  is_last_chunk: boolean
  data_base64: string
}
