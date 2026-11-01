import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ControlPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Control</CardTitle>
            <Badge variant="outline">Phase 8</Badge>
          </div>
          <CardDescription>
            Virtual joystick, throttle/steering controls, and emergency stop
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 8</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default ControlPage
