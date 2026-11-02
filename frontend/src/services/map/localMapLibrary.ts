/**
 * JetRacer Control Center — Local Map Library (IndexedDB Storage, Phase 7A)
 *
 * Lightweight, zero-dependency IndexedDB wrapper storing saved occupancy grids,
 * metadata, and thumbnails locally on the operator's device ("On this device").
 * Gracefully degrades in private browsing or when storage quota is exceeded.
 */

import type { DecodedOccupancyGrid, SavedMapRecord } from './mapTypes'

const DB_NAME = 'jetracer_map_library_v1'
const DB_VERSION = 1
const STORE_NAME = 'maps'

/**
 * Generates a lightweight PNG data URL thumbnail for a given map.
 */
export function generateMapThumbnail(
  map: DecodedOccupancyGrid,
  maxDimension = 128,
): string {
  if (typeof document === 'undefined') return ''

  try {
    const { width, height } = map.info
    const scale = Math.min(maxDimension / width, maxDimension / height, 1.0)
    const thumbW = Math.max(1, Math.round(width * scale))
    const thumbH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = thumbW
    canvas.height = thumbH
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const imgData = ctx.createImageData(thumbW, thumbH)
    const buf = imgData.data

    for (let ty = 0; ty < thumbH; ty++) {
      // Map row: inverse of canvas Y
      const my = Math.min(height - 1, Math.floor((thumbH - 1 - ty) / scale))
      const rowOffset = my * width

      for (let tx = 0; tx < thumbW; tx++) {
        const mx = Math.min(width - 1, Math.floor(tx / scale))
        const cell = map.data[rowOffset + mx]
        const ptr = (ty * thumbW + tx) * 4

        if (cell === -1) {
          // Unknown: dark neutral
          buf[ptr] = 60
          buf[ptr + 1] = 60
          buf[ptr + 2] = 65
          buf[ptr + 3] = 255
        } else if (cell === 0) {
          // Free: light neutral
          buf[ptr] = 220
          buf[ptr + 1] = 220
          buf[ptr + 2] = 225
          buf[ptr + 3] = 255
        } else {
          // Occupied: dark blue / black
          buf[ptr] = 15
          buf[ptr + 1] = 23
          buf[ptr + 2] = 42
          buf[ptr + 3] = 255
        }
      }
    }

    ctx.putImageData(imgData, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

export class LocalMapLibrary {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return Promise.reject(new Error('IndexedDB is not supported on this platform.'))
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const req = indexedDB.open(DB_NAME, DB_VERSION)

          req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
              store.createIndex('createdAt', 'createdAt', { unique: false })
              store.createIndex('name', 'name', { unique: false })
            }
          }

          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error || new Error('Failed to open map library database.'))
          req.onblocked = () => reject(new Error('Map library database open blocked by open tab.'))
        } catch (err) {
          reject(err)
        }
      })
    }

    return this.dbPromise
  }

  /**
   * Saves a map snapshot into local IndexedDB storage.
   */
  public async saveMap(
    map: DecodedOccupancyGrid,
    name: string,
    notes?: string,
    source: 'device_snapshot' | 'robot_import' = 'device_snapshot',
  ): Promise<SavedMapRecord> {
    const db = await this.getDB()
    const cleanName = name.trim() || `map_${Date.now()}`
    const id = `map_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const nowIso = new Date().toISOString()

    const thumbnail = generateMapThumbnail(map, 128)

    // Store array buffer copy
    const dataCopy = new Int8Array(map.data)

    const record: SavedMapRecord = {
      id,
      name: cleanName,
      createdAt: nowIso,
      updatedAt: nowIso,
      width: map.info.width,
      height: map.info.height,
      resolution: map.info.resolution,
      origin: { ...map.info.origin },
      frameId: map.header.frameId,
      data: dataCopy,
      thumbnailDataUrl: thumbnail,
      notes,
      source,
      metrics: { ...map.metrics },
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.add(record)

        req.onsuccess = () => resolve(record)
        req.onerror = () => reject(req.error || new Error('Failed to save map to local library.'))
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Retrieves all saved maps from local library.
   */
  public async listMaps(): Promise<SavedMapRecord[]> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.getAll()

        req.onsuccess = () => {
          const list = (req.result || []) as SavedMapRecord[]
          // Sort descending by creation date
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          resolve(list)
        }
        req.onerror = () => reject(req.error || new Error('Failed to list maps.'))
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Retrieves a single saved map record by ID.
   */
  public async getMap(id: string): Promise<SavedMapRecord | null> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const req = store.get(id)

        req.onsuccess = () => resolve((req.result as SavedMapRecord) || null)
        req.onerror = () => reject(req.error || new Error(`Failed to get map "${id}".`))
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Renames an existing saved map record.
   */
  public async renameMap(id: string, newName: string): Promise<boolean> {
    const record = await this.getMap(id)
    if (!record) return false

    record.name = newName.trim()
    record.updatedAt = new Date().toISOString()

    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.put(record)

        req.onsuccess = () => resolve(true)
        req.onerror = () => reject(req.error || new Error('Failed to rename map.'))
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Deletes a map record from local library.
   */
  public async deleteMap(id: string): Promise<boolean> {
    const db = await this.getDB()
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const req = store.delete(id)

        req.onsuccess = () => resolve(true)
        req.onerror = () => reject(req.error || new Error('Failed to delete map.'))
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Queries storage quota and usage if supported by the browser.
   */
  public async getStorageUsage(): Promise<{ usedBytes: number; quotaBytes: number; isAvailable: boolean }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate()
        return {
          usedBytes: est.usage ?? 0,
          quotaBytes: est.quota ?? 0,
          isAvailable: true,
        }
      } catch {
        return { usedBytes: 0, quotaBytes: 0, isAvailable: false }
      }
    }
    return { usedBytes: 0, quotaBytes: 0, isAvailable: false }
  }
}

export const localMapLibrary = new LocalMapLibrary()
