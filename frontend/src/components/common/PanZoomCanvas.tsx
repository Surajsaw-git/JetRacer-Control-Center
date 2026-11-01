import React, { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface TransformState {
  offsetX: number
  offsetY: number
  scale: number
}

export interface PanZoomCanvasProps {
  onDraw: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    transform: TransformState,
  ) => void
  minScale?: number
  maxScale?: number
  initialScale?: number
  className?: string
  children?:
    | React.ReactNode
    | ((props: { resetView: () => void; scale: number }) => React.ReactNode)
}

export function PanZoomCanvas({
  onDraw,
  minScale = 0.2,
  maxScale = 8.0,
  initialScale = 1.0,
  className,
  children,
}: PanZoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [transform, setTransform] = useState<TransformState>({
    offsetX: 0,
    offsetY: 0,
    scale: initialScale,
  })

  const isDraggingRef = useRef(false)
  const lastPosRef = useRef({ x: 0, y: 0 })

  // Redraw canvas with high-DPI scaling
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = rect.width
    const height = rect.height

    if (width === 0 || height === 0) return

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    // Center origin before applying user offsets
    ctx.translate(width / 2 + transform.offsetX, height / 2 + transform.offsetY)
    ctx.scale(transform.scale, transform.scale)

    onDraw(ctx, width, height, transform)
    ctx.restore()
  }, [onDraw, transform])

  useEffect(() => {
    render()
  }, [render])

  // Handle ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver(() => {
      render()
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [render])

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
    setTransform((prev) => {
      const newScale = Math.min(Math.max(prev.scale * zoomFactor, minScale), maxScale)
      return { ...prev, scale: newScale }
    })
  }

  // Pointer event handlers for drag / pan
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Left mouse button or single touch
    if (e.button !== 0) return
    isDraggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return
    const dx = e.clientX - lastPosRef.current.x
    const dy = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }

    setTransform((prev) => ({
      ...prev,
      offsetX: prev.offsetX + dx,
      offsetY: prev.offsetY + dy,
    }))
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Ignore if pointer was already lost
    }
  }

  // Reset transform helper
  const resetView = () => {
    setTransform({ offsetX: 0, offsetY: 0, scale: initialScale })
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        'relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing bg-card rounded-lg border border-border',
        className,
      )}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Expose reset helper to parent children */}
      {typeof children === 'function'
        ? (children as (props: { resetView: () => void; scale: number }) => React.ReactNode)({
            resetView,
            scale: transform.scale,
          })
        : children}
    </div>
  )
}

export default PanZoomCanvas
