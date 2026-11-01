import { describe, it, expect } from 'vitest'
import {
  buildWebVideoUrl,
  checkMixedContent,
  resolveBaseTopic,
} from '@/services/camera/cameraUrl'

describe('Camera URL Builder & Guards', () => {
  it('correctly resolves base topic by stripping transport suffixes', () => {
    expect(resolveBaseTopic('/csi_cam_0/image_raw/compressed')).toBe('/csi_cam_0/image_raw')
    expect(resolveBaseTopic('/camera/image/theora')).toBe('/camera/image')
    expect(resolveBaseTopic('/camera/image_raw')).toBe('/camera/image_raw')
    expect(resolveBaseTopic('')).toBe('')
  })

  it('builds standard web_video_server stream URLs with query parameters', () => {
    const url = buildWebVideoUrl('192.168.1.100', 8080, 'stream', '/csi_cam_0/image_raw', {
      fps: 20,
      quality: 70,
      width: 640,
      height: 480,
      preset: 'medium',
    })

    expect(url).toBe(
      'http://192.168.1.100:8080/stream?topic=%2Fcsi_cam_0%2Fimage_raw&quality=70&width=640&height=480&type=mjpeg',
    )
  })

  it('builds snapshot URLs without type=mjpeg', () => {
    const url = buildWebVideoUrl('10.0.0.42', 8080, 'snapshot', '/mock_world/camera/image_raw', {
      quality: 90,
      fps: 30,
      preset: 'high',
    })

    expect(url).toBe(
      'http://10.0.0.42:8080/snapshot?topic=%2Fmock_world%2Fcamera%2Fimage_raw&quality=90',
    )
  })

  it('throws helpful errors on empty host or invalid topic', () => {
    expect(() => buildWebVideoUrl('', 8080, 'stream', '/cam')).toThrow(/Host cannot be empty/i)
    expect(() => buildWebVideoUrl('1.2.3.4', 8080, 'stream', '')).toThrow(/Valid ROS topic/i)
  })

  it('clamps quality parameters to between 1 and 100', () => {
    const lowUrl = buildWebVideoUrl('1.2.3.4', 8080, 'stream', '/cam', {
      quality: -10,
      fps: 10,
      preset: 'low',
    })
    expect(lowUrl).toContain('quality=1')

    const highUrl = buildWebVideoUrl('1.2.3.4', 8080, 'stream', '/cam', {
      quality: 999,
      fps: 30,
      preset: 'high',
    })
    expect(highUrl).toContain('quality=100')
  })

  it('detects mixed content conditions in browsers', () => {
    // In node/JSDOM default window is http://localhost:3000
    const localCheck = checkMixedContent('127.0.0.1')
    expect(localCheck.isMixedContent).toBe(false)
  })
})
