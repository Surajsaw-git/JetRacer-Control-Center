import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CameraManager } from '@/services/camera/cameraManager'
import { QUALITY_PRESETS } from '@/services/camera/cameraTypes'

describe('CameraManager (Coordinator & Ref-Counting)', () => {
  let manager: CameraManager

  beforeEach(() => {
    manager = new CameraManager()
  })

  afterEach(() => {
    manager.destroy()
  })

  it('correctly tracks active consumers via ref-counting', () => {
    expect(manager.getConsumerCount()).toBe(0)

    const detach1 = manager.attachConsumer('view_1')
    expect(manager.getConsumerCount()).toBe(1)

    const detach2 = manager.attachConsumer('view_2')
    expect(manager.getConsumerCount()).toBe(2)

    detach1()
    expect(manager.getConsumerCount()).toBe(1)

    detach2()
    expect(manager.getConsumerCount()).toBe(0)
  })

  it('stops stream when all consumers detach', async () => {
    manager.setSelectedTopic('/mock/camera')
    manager.currentState = 'streaming'

    const detach = manager.attachConsumer('main_viewport')
    expect(manager.getConsumerCount()).toBe(1)

    detach()
    expect(manager.getConsumerCount()).toBe(0)
    expect(manager.currentState).toBe('idle')
  })

  it('updates quality presets and custom configurations', () => {
    manager.setQualityPreset('low')
    expect(manager.qualityConfig.preset).toBe('low')
    expect(manager.qualityConfig.quality).toBe(QUALITY_PRESETS.low.quality)
    expect(manager.qualityConfig.fps).toBe(QUALITY_PRESETS.low.fps)

    manager.setQualityPreset('high')
    expect(manager.qualityConfig.preset).toBe('high')
    // High requests native resolution without upscale (width is undefined)
    expect(manager.qualityConfig.width).toBeUndefined()
    expect(manager.qualityConfig.fps).toBeLessThanOrEqual(20)

    manager.setQualityPreset('custom', {
      width: 500,
      height: 375,
      fps: 15,
      quality: 80,
    })
    expect(manager.qualityConfig.preset).toBe('custom')
    expect(manager.qualityConfig.width).toBe(500)
    expect(manager.qualityConfig.quality).toBe(80)
  })

  it('captures client-side snapshots and generates timestamped files', async () => {
    const fakeCanvas = document.createElement('canvas')
    fakeCanvas.width = 64
    fakeCanvas.height = 48
    fakeCanvas.toBlob = (callback) => {
      callback(new Blob(['fake-png-bytes'], { type: 'image/png' }))
    }

    const blob = await manager.captureSnapshot(fakeCanvas)
    expect(blob).not.toBeNull()
    expect(blob?.type).toBe('image/png')
  })
})
