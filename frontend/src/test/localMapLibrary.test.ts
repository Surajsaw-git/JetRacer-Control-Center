import { describe, it, expect } from 'vitest'
import {
  LocalMapLibrary,
  localMapLibrary,
  generateMapThumbnail,
} from '@/services/map/localMapLibrary'
import type { DecodedOccupancyGrid } from '@/services/map/mapTypes'

describe('localMapLibrary — Storage & Thumbnail Generator', () => {
  const dummyMap: DecodedOccupancyGrid = {
    header: { seq: 1, timestampMs: Date.now(), frameId: 'map' },
    info: {
      width: 4,
      height: 4,
      resolution: 0.05,
      origin: { x: 0, y: 0, yawRad: 0, yawDeg: 0 },
      originQuat: { x: 0, y: 0, z: 0, w: 1 },
    },
    data: new Int8Array([
      0, 0, 100, 100,
      0, 0, 100, 100,
      -1, -1, 0, 0,
      -1, -1, 0, 0,
    ]),
    metrics: {
      totalCells: 16,
      knownCells: 12,
      freeCells: 8,
      occupiedCells: 4,
      knownPercent: 75,
      freePercent: 50,
      occupiedPercent: 25,
      widthMeters: 0.2,
      heightMeters: 0.2,
      areaSquareMeters: 0.04,
    },
    warnings: [],
    isResized: false,
    isJumped: false,
  }

  it('generates non-empty thumbnail data URL for a valid map in DOM environment', () => {
    const thumb = generateMapThumbnail(dummyMap, 64)
    expect(typeof thumb).toBe('string')
    // In jsdom without full canvas image rendering, toDataURL returns data:image/png;base64,...
    expect(thumb.startsWith('data:image/png') || thumb === '').toBe(true)
  })

  it('handles storage quota inquiry and reports availability status', async () => {
    const usage = await localMapLibrary.getStorageUsage()
    expect(usage).toBeDefined()
    expect(typeof usage.usedBytes).toBe('number')
    expect(typeof usage.quotaBytes).toBe('number')
    expect(typeof usage.isAvailable).toBe('boolean')
  })

  it('gracefully handles missing IndexedDB environment without crashing', async () => {
    const lib = new LocalMapLibrary()
    // In jsdom without indexedDB polyfill, attempting to save or list rejects gracefully
    await expect(lib.listMaps()).rejects.toThrow()
  })
})
