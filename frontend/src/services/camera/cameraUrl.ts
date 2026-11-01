/**
 * Camera URL Generator & Mixed Content Guard
 *
 * Constructs validated, URL-encoded endpoints for ROS web_video_server.
 * Automatically checks for browser mixed-content restrictions (HTTPS host requesting HTTP stream).
 */

import type { CameraQualityConfig } from './cameraTypes'

/**
 * Strips transport suffixes (e.g. /compressed, /theora) so web_video_server
 * receives the canonical base image topic name.
 */
export function resolveBaseTopic(topicName: string): string {
  if (!topicName) return ''
  const clean = topicName.trim()
  return clean.replace(/\/(compressed|theora|compressedDepth)$/, '')
}

/**
 * Constructs an approved HTTP URL for web_video_server (/stream or /snapshot).
 */
export function buildWebVideoUrl(
  host: string,
  port: number = 8080,
  endpoint: 'stream' | 'snapshot' = 'stream',
  topic: string,
  config?: Partial<CameraQualityConfig>,
): string {
  if (!host) {
    throw new Error('Host cannot be empty when constructing camera URL.')
  }

  const cleanHost = host.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const validPort = Math.max(1, Math.min(65535, port || 8080))
  const baseTopic = resolveBaseTopic(topic)

  if (!baseTopic) {
    throw new Error('Valid ROS topic is required for camera streaming.')
  }

  const url = new URL(`http://${cleanHost}:${validPort}/${endpoint}`)
  url.searchParams.set('topic', baseTopic)

  if (config) {
    if (config.quality !== undefined) {
      url.searchParams.set('quality', String(Math.max(1, Math.min(100, Math.round(config.quality)))))
    }
    if (config.width !== undefined && config.width > 0) {
      url.searchParams.set('width', String(Math.round(config.width)))
    }
    if (config.height !== undefined && config.height > 0) {
      url.searchParams.set('height', String(Math.round(config.height)))
    }
    if (endpoint === 'stream') {
      url.searchParams.set('type', 'mjpeg')
    }
  }

  return url.toString()
}

/**
 * Checks whether the current page environment is HTTPS and the robot stream is HTTP,
 * which triggers standard browser mixed-content blocking.
 */
export function checkMixedContent(robotHost: string): { isMixedContent: boolean; warning?: string } {
  if (typeof window === 'undefined' || !window.location) {
    return { isMixedContent: false }
  }

  const isHttps = window.location.protocol === 'https:'
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    robotHost === 'localhost' ||
    robotHost === '127.0.0.1'

  if (isHttps && !isLocalhost) {
    return {
      isMixedContent: true,
      warning:
        'Browser mixed-content restriction: Control Center is loaded over HTTPS, but robot stream is unencrypted HTTP. Use Rosbridge Compressed mode or load the web app over HTTP / local network.',
    }
  }

  return { isMixedContent: false }
}
