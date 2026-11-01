import { useState } from 'react'
import { Server, Search, CheckCircle2, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { isServiceAllowed } from '@/services/rosPolicy'

export function RosServicesTab() {
  const services = useRosDiscoveryStore((state) => state.services)
  const [search, setSearch] = useState('')

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase().trim()),
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Registered ROS Services ({filtered.length})
            </CardTitle>
            <CardDescription className="text-xs">
              rosapi and daemon services with Phase 4 capability policy tags
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search service name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs font-mono"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filtered.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-muted-foreground text-xs">
              <p>No services discovered or matching filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map((service) => {
                const allowed = isServiceAllowed(service.name)

                return (
                  <div
                    key={service.name}
                    className="py-2.5 flex items-center justify-between text-xs"
                  >
                    <span className="font-mono text-foreground">{service.name}</span>

                    <Badge
                      variant={allowed ? 'outline' : 'secondary'}
                      className={`text-[10px] font-mono flex items-center gap-1 ${
                        allowed ? 'text-emerald-500 border-emerald-500/30' : 'text-muted-foreground'
                      }`}
                    >
                      {allowed ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Allowed Read-Only
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3 w-3" />
                          Blocked Policy
                        </>
                      )}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
