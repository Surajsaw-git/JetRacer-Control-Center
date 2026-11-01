import { cn } from '@/lib/utils'

export interface GaugeProps {
  value: number | null // 0 to 100 or null if no data
  label: string
  unit?: string
  min?: number
  max?: number
  warningThreshold?: number
  dangerThreshold?: number
  size?: number
  className?: string
}

export function Gauge({
  value,
  label,
  unit = '%',
  min = 0,
  max = 100,
  warningThreshold = 75,
  dangerThreshold = 90,
  size = 120,
  className,
}: GaugeProps) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  // Arc spans 240 degrees (from 150 to 390 deg)
  const arcLength = circumference * (240 / 360)

  const hasData = value !== null && !isNaN(value)
  const clampedValue = hasData ? Math.min(Math.max(value, min), max) : min
  const pct = (clampedValue - min) / (max - min)
  const strokeDashoffset = arcLength - pct * arcLength

  let strokeColor = 'text-primary'
  if (hasData) {
    if (clampedValue >= dangerThreshold) {
      strokeColor = 'text-rose-500'
    } else if (clampedValue >= warningThreshold) {
      strokeColor = 'text-amber-500'
    }
  }

  return (
    <div
      className={cn('flex flex-col items-center justify-center p-3', className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={hasData ? clampedValue : undefined}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90 origin-center"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/40"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active progress arc */}
          {hasData && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className={cn(strokeColor, 'transition-all duration-500 ease-out')}
              strokeDasharray={`${arcLength} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          )}
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {hasData ? (
            <>
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums leading-none">
                {Math.round(clampedValue)}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{unit}</span>
            </>
          ) : (
            <span className="text-xs font-mono text-muted-foreground italic">No data</span>
          )}
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground mt-1 text-center">{label}</span>
    </div>
  )
}

export default Gauge
