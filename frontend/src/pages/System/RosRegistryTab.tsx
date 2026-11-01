import { useRef } from 'react'
import {
  BookmarkCheck,
  Download,
  Upload,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Eye,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_ROLE_SPECIFICATIONS,
  useTopicRegistryStore,
} from '@/store/topicRegistryStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { useConnectionStore } from '@/store/connectionStore'
import { subscriptionManager } from '@/services/subscriptionManager'
import { topicRegistry } from '@/services/topicRegistry'
import type { TopicRegistryProfile, TopicRole, TopicRoleVerification } from '@/types'
import { toast } from 'sonner'

export function RosRegistryTab() {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const mappings = useTopicRegistryStore((state) => state.mappings)
  const profileName = useTopicRegistryStore((state) => state.profileName)
  const assignTopicToRole = useTopicRegistryStore((state) => state.assignTopicToRole)
  const importProfile = useTopicRegistryStore((state) => state.importProfile)
  const exportProfile = useTopicRegistryStore((state) => state.exportProfile)

  const discoveredTopics = useRosDiscoveryStore((state) => state.topics)
  const host = useConnectionStore((state) => state.host)

  const roles = Object.keys(DEFAULT_ROLE_SPECIFICATIONS) as TopicRole[]

  const handleTopicAssign = (role: TopicRole, topicName: string) => {
    if (topicName === '__unmapped__') {
      assignTopicToRole(role, null, null)
      toast.info(`Unmapped role: ${role}`)
      return
    }

    const found = discoveredTopics.find((t) => t.name === topicName)
    assignTopicToRole(role, topicName, found?.type || null)
    toast.success(`Assigned ${topicName} to ${role}`)
  }

  const handleVerifyLive = async (role: TopicRole) => {
    const mapping = mappings[role]
    if (!mapping.assignedTopic) {
      toast.error('Cannot verify unmapped role. Assign a topic first.')
      return
    }

    const found = discoveredTopics.find((t) => t.name === mapping.assignedTopic)
    const type = found?.type || mapping.expectedTypes[0]
    const ok = await subscriptionManager.startWatching(mapping.assignedTopic, type)
    if (ok) {
      toast.success(`Listening on ${mapping.assignedTopic} to verify live telemetry...`)
    }
  }

  const handleExport = () => {
    const profile = exportProfile(host)
    const blob = new Blob([JSON.stringify(profile, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `topic_registry_${profile.profileName.toLowerCase().replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Topic Registry profile exported')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as TopicRegistryProfile
        const success = importProfile(parsed)
        if (success) {
          toast.success(`Imported profile: ${parsed.profileName}`)
        } else {
          toast.error('Failed to import: invalid schema or version mismatch')
        }
      } catch {
        toast.error('Failed to parse JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const getVerificationBadge = (v: TopicRoleVerification) => {
    switch (v) {
      case 'verified_live':
        return (
          <Badge variant="default" className="text-[10px] font-mono flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Verified Live
          </Badge>
        )
      case 'mapped_unverified':
        return (
          <Badge variant="outline" className="text-[10px] font-mono flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Mapped (Unverified)
          </Badge>
        )
      case 'stale':
        return (
          <Badge variant="secondary" className="text-[10px] font-mono flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Stale
          </Badge>
        )
      case 'missing':
        return (
          <Badge variant="destructive" className="text-[10px] font-mono flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Topic Missing
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="text-[10px] font-mono flex items-center gap-1">
            <HelpCircle className="h-3 w-3" />
            Unmapped
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <Card>
        <CardContent className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookmarkCheck className="h-4 w-4 text-primary" />
              Active Profile: {profileName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Decouples UI components from robot topic names. Downstream phases consume this
              registry.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs"
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Import Profile
            </Button>
            <Button variant="secondary" size="sm" onClick={handleExport} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export JSON
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. Mappings Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Application Role Mappings</CardTitle>
          <CardDescription className="text-xs">
            Match discovered ROS topics to standard app subsystems strictly by message type.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="divide-y divide-border/40">
            {roles.map((role) => {
              const spec = DEFAULT_ROLE_SPECIFICATIONS[role]
              const mapping = mappings[role]
              const suggestions = topicRegistry.suggestTopicsForRole(role, discoveredTopics)

              return (
                <div
                  key={role}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-foreground font-mono">{role}</span>
                      {getVerificationBadge(mapping.verification)}
                    </div>
                    <p className="text-xs text-muted-foreground">{spec.label}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Expected:{' '}
                      <span className="text-foreground">{spec.expectedTypes.join(' | ')}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select
                      value={mapping.assignedTopic ?? '__unmapped__'}
                      onValueChange={(val) => handleTopicAssign(role, val)}
                    >
                      <SelectTrigger className="w-56 h-8 text-xs font-mono">
                        <SelectValue placeholder="Select topic..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__" className="text-xs italic text-muted-foreground">
                          -- None (Unmapped) --
                        </SelectItem>
                        {suggestions.map((s) => (
                          <SelectItem key={s.name} value={s.name} className="font-mono text-xs">
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {mapping.assignedTopic && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleVerifyLive(role)}
                        className="h-8 text-xs px-2"
                        title="Verify live message stream via Topic Watcher"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Verify
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
