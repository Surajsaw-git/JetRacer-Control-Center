import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  History,
  Trash2,
  Search,
  ShieldAlert,
  Settings,
  Navigation,
  Activity,
  Layers,
} from 'lucide-react'
import { useEventLogStore, filterEvents } from '@/store/eventLogStore'
import type { UiEventType } from '@/types'

const typeIconMap: Record<UiEventType, React.ComponentType<{ className?: string }>> = {
  safety: (props) => <ShieldAlert className={`text-rose-500 ${props.className || ''}`} />,
  settings: (props) => <Settings className={`text-blue-500 ${props.className || ''}`} />,
  navigation: (props) => <Navigation className={`text-emerald-500 ${props.className || ''}`} />,
  system: (props) => <Activity className={`text-amber-500 ${props.className || ''}`} />,
  general: (props) => <Layers className={`text-muted-foreground ${props.className || ''}`} />,
}

export function HistoryPage() {
  const events = useEventLogStore((state) => state.events)
  const clearEvents = useEventLogStore((state) => state.clearEvents)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<UiEventType | 'all'>('all')
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  const filteredEvents = filterEvents(events, selectedType, searchQuery)

  const handleClear = () => {
    clearEvents()
    toast.success('Local event history cleared')
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Event History"
        description="Local operator session events, settings modifications, and safety logs"
        phase="1 UI / 11 DB"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearConfirmOpen(true)}
            disabled={events.length === 0}
            className="min-h-[44px] sm:min-h-[36px]"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Clear Log
          </Button>
        }
      />

      {/* Scope Disclaimer Banner */}
      <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground flex items-center justify-between">
        <span>
          <strong>Local UI Ring Buffer:</strong> Displays events logged in this browser session.
          Server-side robot history and mission logs arrive in Phase 11.
        </span>
        <Badge variant="outline" className="text-[10px] font-mono">
          Max 200 Items
        </Badge>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search event logs by title or details..."
              className="pl-9 min-h-[44px]"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={selectedType}
              onValueChange={(val: UiEventType | 'all') => setSelectedType(val)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="safety">Safety Alerts</SelectItem>
                <SelectItem value="settings">Settings Changes</SelectItem>
                <SelectItem value="navigation">Navigation</SelectItem>
                <SelectItem value="system">System Events</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table / List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Logged Events
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              Showing {filteredEvents.length} of {events.length}
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Chronological log ordered newest first
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-1">
              <p className="font-semibold text-foreground">No Events Match Query</p>
              <p className="text-xs">Try clearing the search or category filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEvents.map((evt) => {
                const IconComponent = typeIconMap[evt.type] || typeIconMap.general
                return (
                  <div
                    key={evt.id}
                    className="p-3 rounded-lg border border-border/60 bg-card/60 hover:bg-muted/30 transition-colors flex items-start gap-3"
                  >
                    <div className="p-2 rounded-md bg-muted/60 border border-border/40 mt-0.5">
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                          {evt.title}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {evt.detail && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {evt.detail}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clear Confirmation Dialog */}
      <ConfirmDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
        title="Clear Local Event History?"
        description="This will clear all logged events stored in this browser session. This action cannot be undone."
        variant="destructive"
        confirmText="Clear Log"
        onConfirm={handleClear}
      />
    </div>
  )
}

export default HistoryPage
