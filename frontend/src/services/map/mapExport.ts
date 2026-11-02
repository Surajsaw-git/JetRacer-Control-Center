/**
 * JetRacer Control Center — ROS map_server Compatible Map Serializer & Exporter (Phase 7A)
 *
 * Implements binary PGM (NetPBM P5) generation, YAML metadata generation conforming strictly
 * to the official ROS 1 map_server specification, and defensive parser for PGM/YAML import.
 *
 * Citations & References:
 * - ROS 1 map_server specification: http://wiki.ros.org/map_server
 * - ROS 1 map_saver source code:
 *   In map_saver, the OccupancyGrid data is row-major bottom-up (row 0 = bottom).
 *   The PGM file format is top-down (row 0 = top). Therefore rows are written in reverse order:
 *   for (int y = height - 1; y >= 0; --y).
 *   Free space is written as 254, occupied space as 0, and unknown (-1) as 205.
 */

import type { DecodedOccupancyGrid, MapOrigin2D } from './mapTypes'

export interface MapExportBundle {
  name: string
  pgmBlob: Blob
  yamlString: string
  jsonString: string
}

export interface MapImportResult {
  success: boolean
  map?: DecodedOccupancyGrid
  error?: string
}

/**
 * Encodes an OccupancyGrid into a standard ROS P5 (binary) NetPBM grayscale image.
 */
export function encodeOccupancyGridToPgm(
  data: Int8Array,
  width: number,
  height: number,
): Uint8Array {
  const headerStr = `P5\n# CREATOR: JetRacer Control Center map_saver\n${width} ${height}\n255\n`
  const headerBytes = new TextEncoder().encode(headerStr)
  const imageSize = width * height
  const totalLength = headerBytes.length + imageSize

  const buffer = new Uint8Array(totalLength)
  buffer.set(headerBytes, 0)

  let writePtr = headerBytes.length

  // Write top-to-bottom: row (height - 1) down to 0
  for (let r = height - 1; r >= 0; r--) {
    const rowOffset = r * width
    for (let c = 0; c < width; c++) {
      const cellVal = data[rowOffset + c]
      let pgmVal: number

      if (cellVal === -1) {
        pgmVal = 205 // Standard ROS unknown gray value (~0.8)
      } else if (cellVal === 0) {
        pgmVal = 254 // Standard ROS free white value
      } else if (cellVal === 100) {
        pgmVal = 0 // Standard ROS occupied black value
      } else {
        // Linear interpolation for probability 1..99
        pgmVal = Math.round((100 - cellVal) * 2.54)
      }

      buffer[writePtr++] = pgmVal
    }
  }

  return buffer
}

/**
 * Generates official ROS map_server YAML metadata string.
 */
export function generateMapYaml(
  imageFileName: string,
  resolution: number,
  origin: MapOrigin2D,
  occupiedThresh = 0.65,
  freeThresh = 0.196,
  negate = 0,
): string {
  const x = Number(origin.x.toFixed(6))
  const y = Number(origin.y.toFixed(6))
  const yaw = Number(origin.yawRad.toFixed(6))

  return [
    `image: ${imageFileName}`,
    `resolution: ${resolution.toFixed(6)}`,
    `origin: [${x}, ${y}, ${yaw}]`,
    `negate: ${negate}`,
    `occupied_thresh: ${occupiedThresh.toFixed(3)}`,
    `free_thresh: ${freeThresh.toFixed(3)}`,
    `mode: trinary`,
  ].join('\n') + '\n'
}

/**
 * Generates JSON sidecar with rich metrics and metadata.
 */
export function generateMapJsonSidecar(
  map: DecodedOccupancyGrid,
  mapName: string,
): string {
  const sidecar = {
    schemaVersion: 1,
    name: mapName,
    createdAt: new Date().toISOString(),
    generator: 'JetRacer Control Center (Phase 7A)',
    header: map.header,
    info: {
      width: map.info.width,
      height: map.info.height,
      resolution: map.info.resolution,
      origin: map.info.origin,
      originQuat: map.info.originQuat,
    },
    metrics: map.metrics,
  }
  return JSON.stringify(sidecar, null, 2)
}

/**
 * Packages a map into a complete export bundle with PGM blob, YAML, and JSON.
 */
export function exportMapBundle(
  map: DecodedOccupancyGrid,
  mapName: string = 'map',
): MapExportBundle {
  const cleanName = mapName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'map'
  const pgmFileName = `${cleanName}.pgm`

  const pgmBytes = encodeOccupancyGridToPgm(
    map.data,
    map.info.width,
    map.info.height,
  )
  const pgmBlob = new Blob([pgmBytes.buffer as ArrayBuffer], { type: 'image/x-portable-graymap' })

  const yamlString = generateMapYaml(
    pgmFileName,
    map.info.resolution,
    map.info.origin,
  )

  const jsonString = generateMapJsonSidecar(map, cleanName)

  return {
    name: cleanName,
    pgmBlob,
    yamlString,
    jsonString,
  }
}

/**
 * Parses a P5 binary PGM image file buffer.
 */
export function parsePgmBuffer(
  buffer: ArrayBuffer | Uint8Array,
): { width: number; height: number; maxVal: number; data: Uint8Array } {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let pos = 0

  function readNextToken(): string {
    // Skip whitespace and comments
    while (pos < bytes.length) {
      const ch = String.fromCharCode(bytes[pos])
      if (ch === '#') {
        // Skip comment line
        while (pos < bytes.length && String.fromCharCode(bytes[pos]) !== '\n') {
          pos++
        }
      } else if (/\s/.test(ch)) {
        pos++
      } else {
        break
      }
    }

    if (pos >= bytes.length) return ''

    let token = ''
    while (pos < bytes.length && !/\s/.test(String.fromCharCode(bytes[pos]))) {
      token += String.fromCharCode(bytes[pos])
      pos++
    }

    return token
  }

  const magic = readNextToken()
  if (magic !== 'P5') {
    throw new Error(`Invalid PGM file format: expected magic "P5", received "${magic}".`)
  }

  const width = Number.parseInt(readNextToken(), 10)
  const height = Number.parseInt(readNextToken(), 10)
  const maxVal = Number.parseInt(readNextToken(), 10)

  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error(`Invalid PGM dimensions: ${width}x${height}.`)
  }

  // Consume single whitespace character after maxVal before binary payload starts
  if (pos < bytes.length && /\s/.test(String.fromCharCode(bytes[pos]))) {
    pos++
  }

  const binaryLength = width * height
  if (bytes.length - pos < binaryLength) {
    throw new Error(
      `Truncated PGM payload: expected ${binaryLength} bytes, found ${bytes.length - pos}.`,
    )
  }

  const data = bytes.subarray(pos, pos + binaryLength)
  return { width, height, maxVal, data }
}

/**
 * Parses a map_server YAML metadata text.
 */
export function parseMapYaml(yamlText: string): {
  image: string
  resolution: number
  origin: MapOrigin2D
  occupiedThresh: number
  freeThresh: number
} {
  const lines = yamlText.split('\n')
  const mapProps: Record<string, string> = {}

  for (const line of lines) {
    const clean = line.trim()
    if (!clean || clean.startsWith('#')) continue
    const idx = clean.indexOf(':')
    if (idx !== -1) {
      const key = clean.slice(0, idx).trim()
      const val = clean.slice(idx + 1).trim()
      mapProps[key] = val
    }
  }

  const image = mapProps.image || 'map.pgm'
  const resolution = Number.parseFloat(mapProps.resolution || '0.05')

  let originX = 0
  let originY = 0
  let originYawRad = 0

  if (mapProps.origin) {
    // Parse "[x, y, yaw]"
    const rawMatches = mapProps.origin.replace(/[[\]]/g, '').split(',')
    if (rawMatches.length >= 2) {
      originX = Number.parseFloat(rawMatches[0].trim()) || 0
      originY = Number.parseFloat(rawMatches[1].trim()) || 0
      originYawRad = Number.parseFloat(rawMatches[2]?.trim() || '0') || 0
    }
  }

  const occupiedThresh = Number.parseFloat(mapProps.occupied_thresh || '0.65')
  const freeThresh = Number.parseFloat(mapProps.free_thresh || '0.196')

  return {
    image,
    resolution,
    origin: {
      x: originX,
      y: originY,
      yawRad: originYawRad,
      yawDeg: (originYawRad * 180) / Math.PI,
    },
    occupiedThresh,
    freeThresh,
  }
}

/**
 * Decodes imported PGM binary bytes + YAML metadata into a live DecodedOccupancyGrid.
 */
export function importMapFromPgmAndYaml(
  pgmBytes: ArrayBuffer | Uint8Array,
  yamlText: string,
): MapImportResult {
  try {
    const { width, height, data: pgmData } = parsePgmBuffer(pgmBytes)
    const { resolution, origin } = parseMapYaml(yamlText)

    const totalCells = width * height
    const gridData = new Int8Array(totalCells)

    let knownCells = 0
    let freeCells = 0
    let occupiedCells = 0

    // Reverse rows: PGM top-to-bottom -> OccupancyGrid bottom-to-top
    for (let r = 0; r < height; r++) {
      const pgmRow = (height - 1 - r) * width
      const gridRow = r * width

      for (let c = 0; c < width; c++) {
        const pgmVal = pgmData[pgmRow + c]
        let cellVal: number

        // In standard map_server:
        // pgmVal >= 254 (free, p <= free_thresh)
        // pgmVal <= 20  (occupied, p >= occupied_thresh)
        // 205 is standard unknown
        if (pgmVal === 205 || (pgmVal > 200 && pgmVal < 250)) {
          cellVal = -1
        } else if (pgmVal >= 250) {
          cellVal = 0
          freeCells++
          knownCells++
        } else if (pgmVal <= 30) {
          cellVal = 100
          occupiedCells++
          knownCells++
        } else {
          // Inverted probability: 100 - (pgmVal / 2.54)
          cellVal = Math.round(100 - (pgmVal / 2.54))
          knownCells++
          if (cellVal >= 50) occupiedCells++
          else freeCells++
        }

        gridData[gridRow + c] = cellVal
      }
    }

    const widthMeters = width * resolution
    const heightMeters = height * resolution

    const qz = Math.sin(origin.yawRad / 2)
    const qw = Math.cos(origin.yawRad / 2)

    return {
      success: true,
      map: {
        header: {
          seq: 0,
          timestampMs: Date.now(),
          frameId: 'map',
        },
        info: {
          width,
          height,
          resolution,
          origin,
          originQuat: { x: 0, y: 0, z: qz, w: qw },
        },
        data: gridData,
        metrics: {
          totalCells,
          knownCells,
          freeCells,
          occupiedCells,
          knownPercent: totalCells > 0 ? (knownCells / totalCells) * 100 : 0,
          freePercent: totalCells > 0 ? (freeCells / totalCells) * 100 : 0,
          occupiedPercent: totalCells > 0 ? (occupiedCells / totalCells) * 100 : 0,
          widthMeters,
          heightMeters,
          areaSquareMeters: widthMeters * heightMeters,
        },
        warnings: [],
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to import map: ${msg}`,
    }
  }
}
