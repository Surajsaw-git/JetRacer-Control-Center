/**
 * SIMULATION ENGINE (UI DEV & DEMO ONLY)
 *
 * CRITICAL POLICY:
 * This module is isolated for local frontend mock testing.
 * It is completely tree-shaken and excluded from default production builds.
 * Marker: SIMULATION_MODULE_ACTIVE_MOCK_PAYLOAD_PHASE1
 */

import type { LidarScanData, SystemMetrics } from '@/types'

export const SIMULATION_MARKER = 'SIMULATION_MODULE_ACTIVE_MOCK_PAYLOAD_PHASE1'

export const isSimulationEnabled =
  typeof import.meta !== 'undefined' &&
  import.meta.env &&
  import.meta.env.VITE_ENABLE_SIMULATION === 'true'

export const mockSimulatedMetrics: SystemMetrics = {
  cpuUsage: 28.5,
  cpuTemp: 44.2,
  gpuUsage: 12.0,
  gpuTemp: 41.8,
  memoryUsedMb: 1840,
  memoryTotalMb: 3956,
  diskUsedGb: 14.2,
  diskTotalGb: 58.4,
  batteryVolts: 12.4,
  batteryPercent: 88,
  uptimeSeconds: 3412,
}

export function generateMockLidarScan(): LidarScanData {
  const points = []
  const count = 360
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI) / 180
    // Generate simulated room boundaries (walls)
    const baseDist = 1.8 + Math.sin(angle * 4) * 0.4 + (Math.random() - 0.5) * 0.05
    points.push({
      range: Math.max(0.2, baseDist),
      angle,
      intensity: 120,
    })
  }
  return {
    points,
    minRange: 0.15,
    maxRange: 12.0,
    timestamp: Date.now(),
  }
}
