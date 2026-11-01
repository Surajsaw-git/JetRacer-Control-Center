import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function LidarPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Lidar</CardTitle>
            <Badge variant="outline">Phase 6</Badge>
          </div>
          <CardDescription>2D laser scan visualization and obstacle proximity</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 6</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default LidarPage
