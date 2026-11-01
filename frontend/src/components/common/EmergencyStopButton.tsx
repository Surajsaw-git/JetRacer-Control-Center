import { useState } from 'react'
import { AlertTriangle, OctagonX } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEventLogStore } from '@/store/eventLogStore'
import { cn } from '@/lib/utils'

export interface EmergencyStopButtonProps {
  className?: string
  compact?: boolean
}

/**
 * Emergency Stop (E-Stop) Trigger.
 *
 * CRITICAL SAFETY REQUIREMENT (PHASE 3):
 * Software E-Stop is NOT wired in Phase 3. It will NOT stop the physical robot.
 * Displays prominent warning advising operator to use physical power switch / gamepad R1.
 */
export function EmergencyStopButton({ className, compact = false }: EmergencyStopButtonProps) {
  const [showWarningModal, setShowWarningModal] = useState(false)
  const addEvent = useEventLogStore((state) => state.addEvent)

  const handleButtonClick = () => {
    setShowWarningModal(true)
    toast.error('Software E-Stop is NOT wired in Phase 3', {
      description: 'Use the robot physical power switch or gamepad R1 to halt motion.',
      duration: 6000,
    })

    addEvent({
      type: 'safety',
      title: 'E-STOP Clicked (Phase 3 Not Wired)',
      detail:
        'Operator pressed E-STOP button. Software E-Stop is NOT wired in Phase 3. Physical switch required.',
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size={compact ? 'sm' : 'default'}
        onClick={handleButtonClick}
        className={cn(
          'font-bold tracking-wider uppercase shadow-md active:scale-95 transition-transform min-h-[44px] min-w-[44px]',
          'bg-rose-600 hover:bg-rose-700 text-white border-2 border-rose-400/40',
          compact ? 'px-3 py-1 text-xs' : 'px-4 py-2 text-sm',
          className,
        )}
        aria-label="Emergency Stop: Software stop is not wired in Phase 3. Use physical power switch."
        title="⚠️ SOFTWARE E-STOP IS NOT WIRED IN PHASE 3. Use robot power switch or gamepad R1."
      >
        <OctagonX className="h-5 w-5 mr-1.5 animate-pulse flex-shrink-0" />
        <span>E-STOP</span>
      </Button>

      <Dialog open={showWarningModal} onOpenChange={setShowWarningModal}>
        <DialogContent className="max-w-md border-rose-500/40 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500 font-bold text-lg">
              <AlertTriangle className="h-6 w-6 text-rose-500 flex-shrink-0" />
              <span>Software E-Stop Not Wired in Phase 3</span>
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-foreground/90 space-y-3 pt-2 text-sm">
                <p className="font-semibold text-rose-400">
                  ⚠️ SOFTWARE E-STOP IS NOT WIRED IN PHASE 3. It will NOT stop the physical robot.
                </p>
                <p>
                  To immediately halt the robot, you MUST use:
                </p>
                <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-muted-foreground">
                  <li><strong className="text-foreground">Physical Battery Switch:</strong> Toggle the main power switch on the JetRacer chassis.</li>
                  <li><strong className="text-foreground">Wireless Gamepad:</strong> Press the R1 dead-man emergency trigger.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Software dead-man switches and motor cutoffs will be wired in Phases 8 &amp; 13.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWarningModal(false)}
              className="w-full sm:w-auto"
            >
              I Understand (Use Physical Switch)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default EmergencyStopButton
