import { Link } from 'react-router-dom'
import { Wifi, WifiOff, AlertCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

export interface ConnectionChipProps {
  className?: string
}

export function ConnectionChip({ className }: ConnectionChipProps) {
  const status = useConnectionStore((state) => state.status)
  const latencyMs = useConnectionStore((state) => state.latencyMs)
  const reconnectAttempt = useConnectionStore((state) => state.reconnectAttempt)
  const maxReconnectAttempts = useConnectionStore((state) => state.maxReconnectAttempts)
  const errorMessage = useConnectionStore((state) => state.errorMessage)
  const host = useSettingsStore((state) => state.connection.host)

  const isConnected = status === 'connected'
  const isReconnecting = status === 'reconnecting'
  const isConnecting = status === 'connecting'
  const isError = status === 'error'
  const displayHost = host.trim() || 'No robot host'

  // Determine indicator dot color
  let dotColor = 'bg-rose-500'
  let labelText = 'Disconnected'

  if (isConnected) {
    dotColor = 'bg-emerald-500 animate-pulse'
    labelText = latencyMs !== null ? `${latencyMs}ms` : 'Connected'
  } else if (isConnecting) {
    dotColor = 'bg-amber-500 animate-ping'
    labelText = 'Connecting...'
  } else if (isReconnecting) {
    dotColor = 'bg-amber-500 animate-ping'
    labelText = `Retry ${reconnectAttempt || 1}/${maxReconnectAttempts || 5}`
  } else if (isError) {
    dotColor = 'bg-rose-600'
    labelText = 'Error'
  }

  const tooltipText = isConnected
    ? `Link A (rosbridge) Connected to ${displayHost}:9090 (${latencyMs ?? 0}ms). Click to manage.`
    : isReconnecting
      ? `Reconnecting to ${displayHost} (attempt ${reconnectAttempt}/${maxReconnectAttempts})...`
      : isConnecting
        ? `Connecting to ${displayHost}...`
        : errorMessage
          ? `Connection error: ${errorMessage}. Click to diagnose.`
          : 'Disconnected from robot. Click to connect.'

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/settings"
            className={cn(
              'group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-[36px]',
              className,
            )}
            aria-label={`Connection status: ${status}. Host: ${displayHost}. ${tooltipText}`}
          >
            {isConnected ? (
              <Wifi className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            ) : isError ? (
              <AlertCircle className="h-4 w-4 text-rose-500 flex-shrink-0" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            )}

            <span className="font-mono text-muted-foreground group-hover:text-foreground transition-colors max-w-[120px] sm:max-w-[180px] truncate">
              {displayHost}
            </span>

            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-muted/50 border-border">
              <span className={cn('h-2 w-2 rounded-full', dotColor)} />
              <span className="capitalize">{labelText}</span>
            </span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-xs">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default ConnectionChip
