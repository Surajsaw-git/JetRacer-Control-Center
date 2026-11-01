import { Link } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full text-center border-dashed border-2 py-8">
        <CardContent className="space-y-4 flex flex-col items-center">
          <div className="p-4 rounded-full bg-muted border border-border">
            <Compass className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Page Not Found</h1>
            <p className="text-sm text-muted-foreground">
              The requested navigation path does not exist on the JetRacer console.
            </p>
          </div>
          <Button asChild className="min-h-[44px]">
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotFoundPage
