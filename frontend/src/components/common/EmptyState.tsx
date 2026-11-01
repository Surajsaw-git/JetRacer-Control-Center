import React from 'react'
import { Link } from 'react-router-dom'
import { PlugZap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title?: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon: Icon = PlugZap,
  title = 'No Robot Connected',
  description = 'Connect to your NVIDIA JetRacer over Wi-Fi to view real-time data.',
  actionLabel = 'Configure Connection',
  actionHref = '/settings',
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn('border-dashed border-2 bg-muted/20 text-center py-10 px-4', className)}>
      <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
        <div className="p-3.5 rounded-full bg-muted/60 text-muted-foreground border border-border">
          <Icon className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {actionHref ? (
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to={actionHref}>{actionLabel}</Link>
          </Button>
        ) : onAction ? (
          <Button variant="outline" onClick={onAction} className="min-h-[44px]">
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default EmptyState
