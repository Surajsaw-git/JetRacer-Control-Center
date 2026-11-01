import React, { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface JoystickValue {
  linear: number // -1.0 (full reverse) to 1.0 (full forward)
  angular: number // -1.0 (full left) to 1.0 (full right)
}

export interface VirtualJoystickProps {
  size?: 'sm' | 'md' | 'lg'
  invertX?: boolean
  invertY?: boolean
  disabled?: boolean
  onChange?: (val: JoystickValue) => void
  className?: string
}

export function VirtualJoystick({
  size = 'md',
  invertX = false,
  invertY = false,
  disabled = false,
  onChange,
  className,
}: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const [isEngaged, setIsEngaged] = useState<boolean>(false)

  // Pixel dimensions based on size variant
  const sizeMap = {
    sm: { base: 140, knob: 50, maxRadius: 45 },
    md: { base: 180, knob: 64, maxRadius: 58 },
    lg: { base: 220, knob: 80, maxRadius: 70 },
  }
  const dims = sizeMap[size]

  // Reset knob visually and emit zero state
  const returnToCenter = useCallback(() => {
    activePointerIdRef.current = null
    setIsEngaged(false)

    if (knobRef.current) {
      knobRef.current.style.transition = 'transform 0.15s ease-out'
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0px)'
    }

    if (onChange) {
      onChange({ linear: 0, angular: 0 })
    }
  }, [onChange])

  // Safety listeners: return to center on window blur, visibility loss, or pointer cancel
  useEffect(() => {
    const handleSafetyCancel = () => {
      if (activePointerIdRef.current !== null) {
        returnToCenter()
      }
    }

    window.addEventListener('blur', handleSafetyCancel)
    document.addEventListener('visibilitychange', handleSafetyCancel)

    return () => {
      window.removeEventListener('blur', handleSafetyCancel)
      document.removeEventListener('visibilitychange', handleSafetyCancel)
    }
  }, [returnToCenter])

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerIdRef.current !== null) return

    activePointerIdRef.current = e.pointerId
    setIsEngaged(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)

    if (knobRef.current) {
      knobRef.current.style.transition = 'none'
    }

    processPointerPosition(e.clientX, e.clientY)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerIdRef.current !== e.pointerId) return
    processPointerPosition(e.clientX, e.clientY)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Ignore if capture was already released
    }
    returnToCenter()
  }

  const processPointerPosition = (clientX: number, clientY: number) => {
    if (!baseRef.current) return

    const rect = baseRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    // Raw offset from center
    let dx = clientX - centerX
    let dy = clientY - centerY

    // Clamp distance to maxRadius
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance > dims.maxRadius) {
      const angle = Math.atan2(dy, dx)
      dx = Math.cos(angle) * dims.maxRadius
      dy = Math.sin(angle) * dims.maxRadius
    }

    // Direct DOM transform for maximum performance (60/120fps)
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0px)`
    }

    if (onChange) {
      // Normalize to -1.0 ... 1.0
      // Screen Y is inverted (negative is UP on screen, but forward linear velocity)
      let normX = dx / dims.maxRadius
      let normY = -(dy / dims.maxRadius)

      if (invertX) normX = -normX
      if (invertY) normY = -normY

      // Deadzone threshold (3% to prevent drift)
      const deadzone = 0.03
      const cleanAngular = Math.abs(normX) < deadzone ? 0 : Number(normX.toFixed(3))
      const cleanLinear = Math.abs(normY) < deadzone ? 0 : Number(normY.toFixed(3))

      onChange({
        linear: cleanLinear,
        angular: cleanAngular,
      })
    }
  }

  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ width: dims.base, height: dims.base }}
      className={cn(
        'relative rounded-full border-2 border-border/70 select-none touch-none flex items-center justify-center transition-all',
        isEngaged
          ? 'bg-card/90 border-primary/60 shadow-[0_0_15px_rgba(34,197,94,0.15)]'
          : 'bg-card/50 hover:bg-card/70',
        disabled && 'opacity-40 pointer-events-none cursor-not-allowed',
        className,
      )}
      role="slider"
      aria-label="Virtual Drive Joystick (Drag to steer and throttle)"
      aria-valuetext={isEngaged ? 'Active' : 'Centered'}
    >
      {/* Direction Guide Crosshairs */}
      <div className="absolute inset-x-3 top-1/2 h-[1px] bg-border/40 pointer-events-none" />
      <div className="absolute inset-y-3 left-1/2 w-[1px] bg-border/40 pointer-events-none" />

      {/* Outer Limit Ring */}
      <div
        className="absolute rounded-full border border-dashed border-border/50 pointer-events-none"
        style={{ width: dims.maxRadius * 2, height: dims.maxRadius * 2 }}
      />

      {/* Moveable Joystick Knob Handle */}
      <div
        ref={knobRef}
        style={{ width: dims.knob, height: dims.knob }}
        className={cn(
          'absolute rounded-full border-2 border-border shadow-lg cursor-grab active:cursor-grabbing flex items-center justify-center select-none',
          isEngaged
            ? 'bg-primary text-primary-foreground border-primary shadow-primary/20 scale-105'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
        )}
      >
        <div className="h-3 w-3 rounded-full bg-current opacity-70" />
      </div>
    </div>
  )
}

export default VirtualJoystick
