import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function CameraPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Camera</CardTitle>
            <Badge variant="outline">Phase 5</Badge>
          </div>
          <CardDescription>Live video stream and camera controls</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 5</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default CameraPage
