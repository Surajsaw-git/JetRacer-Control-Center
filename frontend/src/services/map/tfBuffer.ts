/**
 * JetRacer Control Center — Client-Side Coordinate Transform Buffer (Phase 7A)
 *
 * Stores and traverses ROS 2D/3D coordinate transform graphs (/tf and /tf_static),
 * composes multi-hop transform chains, computes quaternion kinematics & inverses,
 * and detects cyclic, broken, or stale coordinate frames.
 */

import { quaternionToYaw } from './mapDecoder'
import type { RobotPose2D } from './mapTypes'

export interface TransformStamped {
  header: {
    seq?: number
    stamp?: { secs: number; nsecs: number }
    frame_id: string
  }
  child_frame_id: string
  transform: {
    translation: { x: number; y: number; z: number }
    rotation: { x: number; y: number; z: number; w: number }
  }
}

export interface TfEdge {
  parent: string
  child: string
  translation: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  timestampMs: number
  isStatic: boolean
}

export interface TfLookupResult {
  success: boolean
  pose?: RobotPose2D
  error?: string
  chain?: string[]
}

/**
 * Quaternion multiplication: qA * qB
 */
export function multiplyQuaternions(
  qA: { x: number; y: number; z: number; w: number },
  qB: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  return {
    x: qA.w * qB.x + qA.x * qB.w + qA.y * qB.z - qA.z * qB.y,
    y: qA.w * qB.y - qA.x * qB.z + qA.y * qB.w + qA.z * qB.x,
    z: qA.w * qB.z + qA.x * qB.y - qA.y * qB.x + qA.z * qB.w,
    w: qA.w * qB.w - qA.x * qB.x - qA.y * qB.y - qA.z * qB.z,
  }
}

/**
 * Rotates a 3D vector by a unit quaternion: v' = q * v * q^-1
 */
export function rotateVectorByQuaternion(
  v: { x: number; y: number; z: number },
  q: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number } {
  // Normalize q
  const norm = Math.hypot(q.x, q.y, q.z, q.w)
  const qx = norm > 0 ? q.x / norm : 0
  const qy = norm > 0 ? q.y / norm : 0
  const qz = norm > 0 ? q.z / norm : 0
  const qw = norm > 0 ? q.w / norm : 1

  // Extract rotation matrix columns
  const xx = qx * qx
  const yy = qy * qy
  const zz = qz * qz
  const xy = qx * qy
  const xz = qx * qz
  const yz = qy * qz
  const wx = qw * qx
  const wy = qw * qy
  const wz = qw * qz

  const m00 = 1 - 2 * (yy + zz)
  const m01 = 2 * (xy - wz)
  const m02 = 2 * (xz + wy)

  const m10 = 2 * (xy + wz)
  const m11 = 1 - 2 * (xx + zz)
  const m12 = 2 * (yz - wx)

  const m20 = 2 * (xz - wy)
  const m21 = 2 * (yz + wx)
  const m22 = 1 - 2 * (xx + yy)

  return {
    x: m00 * v.x + m01 * v.y + m02 * v.z,
    y: m10 * v.x + m11 * v.y + m12 * v.z,
    z: m20 * v.x + m21 * v.y + m22 * v.z,
  }
}

/**
 * Inverts a unit quaternion: q^-1 = (-x, -y, -z, w)
 */
export function invertQuaternion(
  q: { x: number; y: number; z: number; w: number },
): { x: number; y: number; z: number; w: number } {
  const normSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w
  const s = normSq > 0 ? 1 / normSq : 1
  return {
    x: -q.x * s,
    y: -q.y * s,
    z: -q.z * s,
    w: q.w * s,
  }
}

export class TfBuffer {
  // Map of "parent/child" -> TfEdge
  private edges = new Map<string, TfEdge>()
  // Adjacency graph: frame -> Set of adjacent frames
  private adjacency = new Map<string, Set<string>>()
  private static STALE_THRESHOLD_MS = 5000

  public cleanFrame(frame: string): string {
    if (!frame) return ''
    return frame.trim().replace(/^\/+/, '') // Remove leading slash
  }

  /**
   * Sets or updates a transform edge.
   */
  public setTransform(tf: TransformStamped, isStatic = false): void {
    const parent = this.cleanFrame(tf.header.frame_id)
    const child = this.cleanFrame(tf.child_frame_id)

    if (!parent || !child || parent === child) return

    const secs = tf.header.stamp?.secs ?? Math.floor(Date.now() / 1000)
    const nsecs = tf.header.stamp?.nsecs ?? 0
    const timestampMs = secs * 1000 + Math.floor(nsecs / 1_000_000)

    const tx = Number(tf.transform?.translation?.x ?? 0)
    const ty = Number(tf.transform?.translation?.y ?? 0)
    const tz = Number(tf.transform?.translation?.z ?? 0)

    const qx = Number(tf.transform?.rotation?.x ?? 0)
    const qy = Number(tf.transform?.rotation?.y ?? 0)
    const qz = Number(tf.transform?.rotation?.z ?? 0)
    const qw = Number(tf.transform?.rotation?.w ?? 1)

    const edge: TfEdge = {
      parent,
      child,
      translation: {
        x: Number.isFinite(tx) ? tx : 0,
        y: Number.isFinite(ty) ? ty : 0,
        z: Number.isFinite(tz) ? tz : 0,
      },
      rotation: {
        x: Number.isFinite(qx) ? qx : 0,
        y: Number.isFinite(qy) ? qy : 0,
        z: Number.isFinite(qz) ? qz : 0,
        w: Number.isFinite(qw) ? qw : 1,
      },
      timestampMs,
      isStatic,
    }

    const key = `${parent}->${child}`
    this.edges.set(key, edge)

    // Update adjacency
    if (!this.adjacency.has(parent)) this.adjacency.set(parent, new Set())
    if (!this.adjacency.has(child)) this.adjacency.set(child, new Set())
    this.adjacency.get(parent)!.add(child)
    this.adjacency.get(child)!.add(parent)
  }

  /**
   * Returns list of all observed unique coordinate frames.
   */
  public getAllFrames(): string[] {
    return Array.from(this.adjacency.keys()).sort()
  }

  /**
   * Finds shortest path of frames between startFrame and endFrame using Breadth-First Search (BFS).
   */
  public findPath(startFrame: string, endFrame: string): string[] | null {
    const start = this.cleanFrame(startFrame)
    const end = this.cleanFrame(endFrame)

    if (!start || !end || !this.adjacency.has(start) || !this.adjacency.has(end)) {
      return null
    }

    if (start === end) return [start]

    const queue: string[][] = [[start]]
    const visited = new Set<string>([start])

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]

      if (current === end) {
        return path
      }

      const neighbors = this.adjacency.get(current)
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor)
            queue.push([...path, neighbor])
          }
        }
      }
    }

    return null
  }

  /**
   * Looks up 2D pose of sourceFrame in targetFrame coordinates (targetFrame -> sourceFrame).
   * E.g. targetFrame = "map", sourceFrame = "base_footprint".
   */
  public lookupPose(
    targetFrame: string,
    sourceFrame: string,
    nowMs: number = Date.now(),
  ): TfLookupResult {
    const target = this.cleanFrame(targetFrame)
    const source = this.cleanFrame(sourceFrame)

    if (!target || !source) {
      return { success: false, error: 'Target or source frame is empty.' }
    }

    if (target === source) {
      return {
        success: true,
        pose: {
          x: 0,
          y: 0,
          yawRad: 0,
          yawDeg: 0,
          frameId: source,
          referenceFrame: target,
          timestampMs: nowMs,
          ageMs: 0,
          isStale: false,
          source: 'tf',
        },
        chain: [target],
      }
    }

    // Path from target -> source:
    // P_target = T_target_to_source * P_source
    const path = this.findPath(target, source)
    if (!path || path.length < 2) {
      return {
        success: false,
        error: `No transform path found between "${target}" and "${source}". Ensure SLAM or odometry node is publishing transforms.`,
      }
    }

    let currentPos = { x: 0, y: 0, z: 0 }
    let currentRot = { x: 0, y: 0, z: 0, w: 1 }
    let oldestTimestamp = Number.POSITIVE_INFINITY
    let hasDynamicEdge = false

    // Traverse the path from target to source
    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i]
      const to = path[i + 1]

      const forwardKey = `${from}->${to}`
      const reverseKey = `${to}->${from}`

      if (this.edges.has(forwardKey)) {
        // Forward edge: from is parent, to is child
        // T_from_to_to: pos = translation, rot = rotation
        const edge = this.edges.get(forwardKey)!
        if (!edge.isStatic) {
          hasDynamicEdge = true
          oldestTimestamp = Math.min(oldestTimestamp, edge.timestampMs)
        }

        // Apply rotation to edge translation, then add to position
        const rotatedTrans = rotateVectorByQuaternion(edge.translation, currentRot)
        currentPos = {
          x: currentPos.x + rotatedTrans.x,
          y: currentPos.y + rotatedTrans.y,
          z: currentPos.z + rotatedTrans.z,
        }
        currentRot = multiplyQuaternions(currentRot, edge.rotation)
      } else if (this.edges.has(reverseKey)) {
        // Reverse edge: to is parent, from is child
        // Invert edge: rot = q^-1, pos = - (q^-1 * translation)
        const edge = this.edges.get(reverseKey)!
        if (!edge.isStatic) {
          hasDynamicEdge = true
          oldestTimestamp = Math.min(oldestTimestamp, edge.timestampMs)
        }

        const invRot = invertQuaternion(edge.rotation)
        const invTrans = rotateVectorByQuaternion(
          { x: -edge.translation.x, y: -edge.translation.y, z: -edge.translation.z },
          invRot,
        )

        const rotatedTrans = rotateVectorByQuaternion(invTrans, currentRot)
        currentPos = {
          x: currentPos.x + rotatedTrans.x,
          y: currentPos.y + rotatedTrans.y,
          z: currentPos.z + rotatedTrans.z,
        }
        currentRot = multiplyQuaternions(currentRot, invRot)
      } else {
        return {
          success: false,
          error: `Broken edge between "${from}" and "${to}".`,
          chain: path,
        }
      }
    }

    const { yawRad, yawDeg } = quaternionToYaw(
      currentRot.x,
      currentRot.y,
      currentRot.z,
      currentRot.w,
    )

    const ageMs = hasDynamicEdge && Number.isFinite(oldestTimestamp) ? Math.max(0, nowMs - oldestTimestamp) : 0
    const isStale = hasDynamicEdge && ageMs > TfBuffer.STALE_THRESHOLD_MS

    return {
      success: true,
      pose: {
        x: currentPos.x,
        y: currentPos.y,
        yawRad,
        yawDeg,
        frameId: source,
        referenceFrame: target,
        timestampMs: hasDynamicEdge && Number.isFinite(oldestTimestamp) ? oldestTimestamp : nowMs,
        ageMs,
        isStale,
        source: 'tf',
      },
      chain: path,
    }
  }

  public clear(): void {
    this.edges.clear()
    this.adjacency.clear()
  }
}

export const tfBuffer = new TfBuffer()
