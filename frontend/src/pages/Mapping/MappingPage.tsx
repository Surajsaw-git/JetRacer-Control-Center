import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function MappingPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl md:text-2xl font-bold">Mapping</CardTitle>
            <Badge variant="outline">Phase 7</Badge>
          </div>
          <CardDescription>SLAM map generation, occupancy grid, and map saving</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Not implemented — planned for Phase 7</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default MappingPage
