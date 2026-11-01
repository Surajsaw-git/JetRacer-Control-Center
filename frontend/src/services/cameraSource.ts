/**
 * Camera source interface abstraction.
 *
 * NOTE FOR PHASE 1: Real MJPEG or WebRTC video feeds are implemented in Phase 5.
 */

export interface CameraStreamInfo {
  width: number
  height: number
  fps: number
  format: 'mjpeg' | 'webrtc' | 'h264'
}

export interface CameraSource {
  streamUrl: string | null
  isConnected: boolean
  info: CameraStreamInfo | null
}

export const disconnectedCameraSource: CameraSource = {
  streamUrl: null,
  isConnected: false,
  info: null,
}
