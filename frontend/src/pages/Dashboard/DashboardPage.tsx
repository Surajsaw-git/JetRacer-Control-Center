import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function DashboardPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Dashboard</CardTitle>
            <Badge variant="outline">Phase 1</Badge>
          </div>
          <CardDescription>Main robot overview and status dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 1</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default DashboardPage
