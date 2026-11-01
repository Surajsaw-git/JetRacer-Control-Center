import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { useConnectionStore } from '@/store/connectionStore'
import { cn } from '@/lib/utils'

export function RosHeaderIndicator() {
  const isConnected = useConnectionStore((state) => state.status === 'connected')
  const status = useRosStatusStore((state) => state.status)
  const latencyMs = useRosStatusStore((state) => state.latencyMs)
  const clockOffsetSecs = useRosStatusStore((state) => state.clockOffsetSecs)
  const clockExplanation = useRosStatusStore((state) => state.clockOffsetExplanation)

  if (!isConnected) {
    return null
  }

  let badgeColor = 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  let Icon = XCircle
  let text = 'ROS Unreachable'

  if (status === 'ok') {
    badgeColor = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    Icon = CheckCircle2
    text = latencyMs !== null ? `ROS OK (${latencyMs}ms)` : 'ROS OK'
  } else if (status === 'degraded') {
    badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    Icon = AlertTriangle
    text = 'ROS Degraded'
  } else if (status === 'rosbridge_only') {
    badgeColor = 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    Icon = Activity
    text = 'Rosbridge Only'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/system"
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-medium transition-colors hover:opacity-80 min-h-[36px]',
              badgeColor,
            )}
            aria-label={`ROS Status: ${status}. ${clockExplanation}`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{text}</span>
            <span className="sm:hidden font-semibold">ROS</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          <p className="font-semibold capitalize">ROS 1 Master Status: {status.replace('_', ' ')}</p>
          <p className="mt-1 text-muted-foreground">{clockExplanation}</p>
          {clockOffsetSecs !== null && (
            <p className="text-[11px] font-mono mt-0.5">Offset: {clockOffsetSecs.toFixed(2)}s</p>
          )}
          <p className="mt-1 text-primary text-[11px]">Click to view ROS Introspection System</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
