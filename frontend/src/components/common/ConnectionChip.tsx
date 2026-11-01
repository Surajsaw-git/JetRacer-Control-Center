import { Link } from 'react-router-dom'
import { Wifi, WifiOff } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { cn } from '@/lib/utils'

export interface ConnectionChipProps {
  className?: string
}

export function ConnectionChip({ className }: ConnectionChipProps) {
  const status = useConnectionStore((state) => state.status)
  const host = useSettingsStore((state) => state.connection.host)

  const isConnected = status === 'connected'
  const displayHost = host.trim() || 'No host configured'

  return (
    <Link
      to="/settings"
      className={cn(
        'group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 backdrop-blur text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px] sm:min-h-[36px]',
        className,
      )}
      aria-label={`Connection status: ${status}. Host: ${displayHost}. Click to configure connection.`}
    >
      {isConnected ? (
        <Wifi className="h-4 w-4 text-emerald-500" />
      ) : (
        <WifiOff className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="font-mono text-muted-foreground group-hover:text-foreground transition-colors max-w-[120px] sm:max-w-[180px] truncate">
        {displayHost}
      </span>
      <StatusBadge status={status} className="py-0 px-2 text-[10px]" />
    </Link>
  )
}

export default ConnectionChip
