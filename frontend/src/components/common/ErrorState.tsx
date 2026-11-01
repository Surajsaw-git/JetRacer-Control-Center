import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({
  title = 'Something Went Wrong',
  message = 'An unexpected UI error occurred while rendering this module.',
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Card
      className={cn('border-destructive/30 bg-destructive/5 text-center py-10 px-4', className)}
    >
      <CardContent className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
        <div className="p-3.5 rounded-full bg-destructive/15 text-destructive border border-destructive/20">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="min-h-[44px]">
            <RotateCcw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default ErrorState
