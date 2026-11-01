import { Sparkles } from 'lucide-react'
import { isSimulationEnabled } from '@/simulation'
import { cn } from '@/lib/utils'

export interface SimulationBannerProps {
  className?: string
}

export function SimulationBanner({ className }: SimulationBannerProps) {
  if (!isSimulationEnabled) return null

  return (
    <div
      className={cn(
        'w-full bg-purple-600 text-white px-4 py-2 text-xs font-semibold tracking-wide flex items-center justify-center gap-2 shadow-sm z-50 select-none text-center',
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <Sparkles className="h-4 w-4 animate-spin flex-shrink-0" />
      <span>
        SIMULATION MODE ACTIVE — Telemetry & sensors are synthetic mocks for UI testing. NOT from
        robot.
      </span>
    </div>
  )
}

export default SimulationBanner
