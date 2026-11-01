import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function SettingsPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Settings</CardTitle>
            <Badge variant="outline">Phase 3</Badge>
          </div>
          <CardDescription>
            Network IP connection configuration and application preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 3</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
