import { describe, it, expect } from 'vitest'
import {
  TfBuffer,
  multiplyQuaternions,
  rotateVectorByQuaternion,
  invertQuaternion,
} from '@/services/map/tfBuffer'

describe('tfBuffer — Coordinate Transform Graph & Kinematics', () => {
  it('correctly calculates quaternion multiplication and vector rotation', () => {
    // 90 deg rotation around Z
    const qZ90 = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }
    const vX = { x: 1, y: 0, z: 0 }

    // Rotating (1, 0, 0) by 90 deg around Z gives (0, 1, 0)
    const vRot = rotateVectorByQuaternion(vX, qZ90)
    expect(vRot.x).toBeCloseTo(0, 4)
    expect(vRot.y).toBeCloseTo(1, 4)
    expect(vRot.z).toBeCloseTo(0, 4)

    // Inverse quaternion should reverse rotation back to (1, 0, 0)
    const qInv = invertQuaternion(qZ90)
    const vBack = rotateVectorByQuaternion(vRot, qInv)
    expect(vBack.x).toBeCloseTo(1, 4)
    expect(vBack.y).toBeCloseTo(0, 4)

    // Two 90 deg rotations equal 180 deg
    const q180 = multiplyQuaternions(qZ90, qZ90)
    const v180 = rotateVectorByQuaternion(vX, q180)
    expect(v180.x).toBeCloseTo(-1, 4)
    expect(v180.y).toBeCloseTo(0, 4)
  })

  it('stores edges and composes multi-hop transform chains (map -> odom -> base_link)', () => {
    const buffer = new TfBuffer()
    const now = Date.now()

    // Edge 1: map -> odom (translation: x=2.0, y=1.0)
    buffer.setTransform({
      header: { stamp: { secs: Math.floor(now / 1000), nsecs: 0 }, frame_id: 'map' },
      child_frame_id: 'odom',
      transform: {
        translation: { x: 2.0, y: 1.0, z: 0.0 },
        rotation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
      },
    })

    // Edge 2: odom -> base_link (translation: x=0.5, y=0.5, 90 deg yaw)
    buffer.setTransform({
      header: { stamp: { secs: Math.floor(now / 1000), nsecs: 0 }, frame_id: 'odom' },
      child_frame_id: 'base_link',
      transform: {
        translation: { x: 0.5, y: 0.5, z: 0.0 },
        rotation: { x: 0.0, y: 0.0, z: Math.SQRT1_2, w: Math.SQRT1_2 },
      },
    })

    // Frames list
    expect(buffer.getAllFrames()).toEqual(['base_link', 'map', 'odom'])

    // Path finding
    const path = buffer.findPath('map', 'base_link')
    expect(path).toEqual(['map', 'odom', 'base_link'])

    // Lookup pose of base_link in map frame:
    // x = 2.0 + 0.5 = 2.5, y = 1.0 + 0.5 = 1.5, yaw = 90 deg
    const lookup = buffer.lookupPose('map', 'base_link', now)
    expect(lookup.success).toBe(true)
    expect(lookup.pose).toBeDefined()
    if (!lookup.pose) return

    expect(lookup.pose.x).toBeCloseTo(2.5, 4)
    expect(lookup.pose.y).toBeCloseTo(1.5, 4)
    expect(lookup.pose.yawDeg).toBeCloseTo(90, 2)
    expect(lookup.pose.isStale).toBe(false)
  })

  it('traverses inverse edges correctly (child -> parent lookup)', () => {
    const buffer = new TfBuffer()
    const now = Date.now()

    // Edge: base_link -> laser (translation: x=0.2, y=0.0)
    buffer.setTransform(
      {
        header: { stamp: { secs: Math.floor(now / 1000), nsecs: 0 }, frame_id: 'base_link' },
        child_frame_id: 'laser',
        transform: {
          translation: { x: 0.2, y: 0.0, z: 0.0 },
          rotation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
        },
      },
      true // static
    )

    // Lookup base_link in laser frame (should be x = -0.2)
    const lookup = buffer.lookupPose('laser', 'base_link', now)
    expect(lookup.success).toBe(true)
    expect(lookup.pose?.x).toBeCloseTo(-0.2, 4)
  })

  it('flags stale transforms when older than 5 seconds', () => {
    const buffer = new TfBuffer()
    const pastTime = 1700000000000 // Fixed past timestamp
    const now = pastTime + 8000 // 8s later

    buffer.setTransform({
      header: { stamp: { secs: Math.floor(pastTime / 1000), nsecs: 0 }, frame_id: 'odom' },
      child_frame_id: 'base_footprint',
      transform: {
        translation: { x: 1.0, y: 0.0, z: 0.0 },
        rotation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
      },
    })

    const lookup = buffer.lookupPose('odom', 'base_footprint', now)
    expect(lookup.success).toBe(true)
    expect(lookup.pose?.isStale).toBe(true)
    expect(lookup.pose?.ageMs).toBeGreaterThanOrEqual(5000)
  })

  it('static transforms (/tf_static) do not flag as stale', () => {
    const buffer = new TfBuffer()
    const pastTime = 1700000000000
    const now = pastTime + 60000 // 60s later

    buffer.setTransform(
      {
        header: { stamp: { secs: Math.floor(pastTime / 1000), nsecs: 0 }, frame_id: 'base_link' },
        child_frame_id: 'laser_frame',
        transform: {
          translation: { x: 0.1, y: 0.0, z: 0.15 },
          rotation: { x: 0.0, y: 0.0, z: 0.0, w: 1.0 },
        },
      },
      true // isStatic = true
    )

    const lookup = buffer.lookupPose('base_link', 'laser_frame', now)
    expect(lookup.success).toBe(true)
    expect(lookup.pose?.isStale).toBe(false)
  })

  it('returns clean error when no path exists between disconnected frames', () => {
    const buffer = new TfBuffer()
    buffer.setTransform({
      header: { frame_id: 'map' },
      child_frame_id: 'odom',
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
    })
    buffer.setTransform({
      header: { frame_id: 'camera_link' },
      child_frame_id: 'optical_frame',
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
      },
    })

    const lookup = buffer.lookupPose('map', 'optical_frame')
    expect(lookup.success).toBe(false)
    expect(lookup.error).toMatch(/No transform path found/)
  })
})
