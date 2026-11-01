import { OctagonX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useEventLogStore } from '@/store/eventLogStore'
import { cn } from '@/lib/utils'

export interface EmergencyStopButtonProps {
  className?: string
  compact?: boolean
}

/**
 * Emergency Stop (E-Stop) primary trigger.
 * Single-press immediate action (confirm-free by safety design).
 *
 * NOTE FOR SAFETY ARCHITECTURE:
 * Wired to the backend safety service in Phases 8 and 13.
 * In Phase 1, this operates in UI Preview Mode.
 */
export function EmergencyStopButton({ className, compact = false }: EmergencyStopButtonProps) {
  const addEvent = useEventLogStore((state) => state.addEvent)

  const handleEmergencyStop = () => {
    // Phase 1 UI-only preview notification
    toast.error('Emergency stop is not connected yet (UI preview)', {
      description: 'Physical robot braking and motor cutoffs will be wired in Phases 8 & 13.',
      duration: 4000,
    })

    addEvent({
      type: 'safety',
      title: 'E-STOP Triggered (UI Preview)',
      detail: 'Operator pressed the Emergency Stop button in Phase 1 UI preview.',
    })
  }

  return (
    <Button
      type="button"
      variant="destructive"
      size={compact ? 'sm' : 'default'}
      onClick={handleEmergencyStop}
      className={cn(
        'font-bold tracking-wider uppercase shadow-md active:scale-95 transition-transform min-h-[44px] min-w-[44px]',
        'bg-rose-600 hover:bg-rose-700 text-white border-2 border-rose-400/40',
        compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
        className,
      )}
      aria-label="Emergency Stop: Immediately halt robot motors and motion"
      title="EMERGENCY STOP (UI Preview in Phase 1)"
    >
      <OctagonX className="h-5 w-5 mr-1.5 animate-pulse flex-shrink-0" />
      <span>E-STOP</span>
    </Button>
  )
}

export default EmergencyStopButton
