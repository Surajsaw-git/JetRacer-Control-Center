/**
 * JetRacer Control Center — Robot Pose Coordinator & Odometry Fallback (Phase 7A)
 *
 * Polls TfBuffer at a controlled 10 Hz refresh rate to compute current robot pose,
 * maintains an in-memory trail buffer, detects transform staleness, and provides
 * an honest, labeled odometry-only fallback when map frame transforms are unavailable.
 */

import { tfBuffer } from './tfBuffer'
import type { PoseTrailPoint, RobotPose2D } from './mapTypes'

export interface PoseServiceConfig {
  mapFrame: string
  robotFrame: string
  odomFrame?: string
  maxTrailPoints?: number
  minTrailDistanceM?: number
}

export class PoseService {
  private mapFrame: string = ''
  private robotFrame: string = ''
  private odomFrame: string = 'odom'
  private currentPose: RobotPose2D | null = null
  private trail: PoseTrailPoint[] = []
  private maxTrailPoints: number = 500
  private minTrailDistanceM: number = 0.05 // 5cm step to record trail point

  private pollInterval: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<(pose: RobotPose2D | null, trail: PoseTrailPoint[]) => void>()

  constructor(config?: Partial<PoseServiceConfig>) {
    if (config?.mapFrame) this.mapFrame = tfBuffer.cleanFrame(config.mapFrame)
    if (config?.robotFrame) this.robotFrame = tfBuffer.cleanFrame(config.robotFrame)
    if (config?.odomFrame) this.odomFrame = tfBuffer.cleanFrame(config.odomFrame)
    if (config?.maxTrailPoints) this.maxTrailPoints = config.maxTrailPoints
  }

  public setFrames(mapFrame: string, robotFrame: string, odomFrame = 'odom'): void {
    this.mapFrame = tfBuffer.cleanFrame(mapFrame)
    this.robotFrame = tfBuffer.cleanFrame(robotFrame)
    this.odomFrame = tfBuffer.cleanFrame(odomFrame)
    this.updatePose()
  }

  public getMapFrame(): string {
    return this.mapFrame
  }

  public getRobotFrame(): string {
    return this.robotFrame
  }

  public startPolling(rateMs = 100): void {
    if (this.pollInterval) return
    this.updatePose()
    this.pollInterval = setInterval(() => {
      this.updatePose()
    }, Math.max(50, rateMs))
  }

  public stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  public updatePose(): void {
    const now = Date.now()

    // 1. Try primary map -> robot frame lookup
    if (this.mapFrame && this.robotFrame) {
      const result = tfBuffer.lookupPose(this.mapFrame, this.robotFrame, now)
      if (result.success && result.pose) {
        this.currentPose = result.pose
        this.recordTrail(result.pose.x, result.pose.y, now)
        this.notifyListeners()
        return
      }
    }

    // 2. Try odometry-only fallback: odom -> robot frame
    if (this.odomFrame && this.robotFrame && this.odomFrame !== this.mapFrame) {
      const odomResult = tfBuffer.lookupPose(this.odomFrame, this.robotFrame, now)
      if (odomResult.success && odomResult.pose) {
        this.currentPose = {
          ...odomResult.pose,
          source: 'odometry_fallback',
        }
        this.recordTrail(odomResult.pose.x, odomResult.pose.y, now)
        this.notifyListeners()
        return
      }
    }

    // 3. Pose unavailable or no frames selected
    if (this.currentPose !== null) {
      this.currentPose = null
      this.notifyListeners()
    }
  }

  private recordTrail(x: number, y: number, timestampMs: number): void {
    if (this.trail.length > 0) {
      const last = this.trail[this.trail.length - 1]
      const dist = Math.hypot(x - last.x, y - last.y)
      if (dist < this.minTrailDistanceM) {
        return // Too close to previous point, do not append redundant sample
      }
    }

    this.trail.push({ x, y, timestampMs })
    if (this.trail.length > this.maxTrailPoints) {
      this.trail.shift()
    }
  }

  public clearTrail(): void {
    this.trail = []
    this.notifyListeners()
  }

  public getCurrentPose(): RobotPose2D | null {
    return this.currentPose
  }

  public getTrail(): PoseTrailPoint[] {
    return this.trail
  }

  public subscribe(
    listener: (pose: RobotPose2D | null, trail: PoseTrailPoint[]) => void,
  ): () => void {
    this.listeners.add(listener)
    listener(this.currentPose, this.trail)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentPose, this.trail)
      } catch {
        // Safe listener execution
      }
    }
  }

  public reset(): void {
    this.stopPolling()
    this.currentPose = null
    this.trail = []
    this.notifyListeners()
  }
}

export const poseService = new PoseService()
