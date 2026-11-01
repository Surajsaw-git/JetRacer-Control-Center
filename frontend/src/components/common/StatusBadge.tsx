import React from 'react'
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Slash,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ConnectionStatus } from '@/types'

export type ExtendedStatus = ConnectionStatus | 'not_available' | 'simulated'

export interface StatusBadgeProps {
  status: ExtendedStatus
  label?: string
  showIcon?: boolean
  className?: string
}

const statusConfig: Record<
  ExtendedStatus,
  {
    label: string
    bgClass: string
    textClass: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  connected: {
    label: 'Connected',
    bgClass: 'bg-emerald-500/15 border-emerald-500/30',
    textClass: 'text-emerald-500 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  connecting: {
    label: 'Connecting',
    bgClass: 'bg-blue-500/15 border-blue-500/30',
    textClass: 'text-blue-500 dark:text-blue-400',
    icon: (props) => <Loader2 className={cn('animate-spin', props.className)} />,
  },
  reconnecting: {
    label: 'Reconnecting',
    bgClass: 'bg-amber-500/15 border-amber-500/30',
    textClass: 'text-amber-500 dark:text-amber-400',
    icon: (props) => <RefreshCw className={cn('animate-spin', props.className)} />,
  },
  disconnected: {
    label: 'Disconnected',
    bgClass: 'bg-slate-500/15 border-slate-500/30',
    textClass: 'text-slate-500 dark:text-slate-400',
    icon: XCircle,
  },
  error: {
    label: 'Error',
    bgClass: 'bg-rose-500/15 border-rose-500/30',
    textClass: 'text-rose-600 dark:text-rose-400',
    icon: AlertTriangle,
  },
  not_available: {
    label: 'Not Available',
    bgClass: 'bg-muted border-border',
    textClass: 'text-muted-foreground',
    icon: Slash,
  },
  simulated: {
    label: 'Simulated',
    bgClass: 'bg-purple-500/15 border-purple-500/30',
    textClass: 'text-purple-600 dark:text-purple-400',
    icon: Sparkles,
  },
}

export function StatusBadge({ status, label, showIcon = true, className }: StatusBadgeProps) {
  const cfg = statusConfig[status] || statusConfig.disconnected
  const Icon = cfg.icon
  const displayLabel = label || cfg.label

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full transition-colors',
        cfg.bgClass,
        cfg.textClass,
        className,
      )}
    >
      {showIcon && <Icon className="h-3.5 w-3.5 flex-shrink-0" />}
      <span>{displayLabel}</span>
    </Badge>
  )
}

export default StatusBadge
