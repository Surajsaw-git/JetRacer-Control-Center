import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SystemPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">System</CardTitle>
            <Badge variant="outline">Phase 10</Badge>
          </div>
          <CardDescription>
            Jetson hardware resource monitoring, temperatures, and service management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 10</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SystemPage
