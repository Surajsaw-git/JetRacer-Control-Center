import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
  title: string
  value: string | number | null
  unit?: string
  icon?: React.ComponentType<{ className?: string }>
  statusText?: string
  isSimulated?: boolean
  className?: string
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  statusText,
  isSimulated = false,
  className,
}: MetricCardProps) {
  const hasValue = value !== null && value !== undefined && value !== ''

  return (
    <Card className={cn('relative overflow-hidden transition-all', className)}>
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-2">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wider">{title}</span>
          <div className="flex items-center gap-1.5">
            {isSimulated && (
              <Badge
                variant="outline"
                className="text-[10px] px-1 py-0 border-purple-500/40 text-purple-400 bg-purple-500/10"
              >
                SIM
              </Badge>
            )}
            {Icon && <Icon className="h-4 w-4 text-primary flex-shrink-0" />}
          </div>
        </div>

        <div className="flex items-baseline gap-1.5">
          {hasValue ? (
            <>
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight tabular-nums text-foreground">
                {value}
              </span>
              {unit && <span className="text-xs font-mono text-muted-foreground">{unit}</span>}
            </>
          ) : (
            <span className="text-base font-medium text-muted-foreground italic">No data</span>
          )}
        </div>

        {statusText && (
          <p className="text-xs text-muted-foreground truncate pt-1 border-t border-border/50">
            {statusText}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default MetricCard
