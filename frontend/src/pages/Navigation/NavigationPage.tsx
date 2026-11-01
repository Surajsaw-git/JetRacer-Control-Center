import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function NavigationPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Navigation</CardTitle>
            <Badge variant="outline">Phase 9</Badge>
          </div>
          <CardDescription>
            Waypoint navigation, path planning, and obstacle avoidance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 9</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default NavigationPage
