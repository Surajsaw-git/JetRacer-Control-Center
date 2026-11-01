import { useState } from 'react'
import { Copy, Download, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useConnectionStore } from '@/store/connectionStore'
import { useRosStatusStore } from '@/store/rosStatusStore'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { useTopicRegistryStore } from '@/store/topicRegistryStore'

export interface InspectionReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InspectionReportModal({ open, onOpenChange }: InspectionReportModalProps) {
  const [maskIp, setMaskIp] = useState(true)

  const host = useConnectionStore((state) => state.host)
  const rosStatus = useRosStatusStore((state) => state.status)
  const latencyMs = useRosStatusStore((state) => state.latencyMs)
  const clockOffsetSecs = useRosStatusStore((state) => state.clockOffsetSecs)
  const clockExplanation = useRosStatusStore((state) => state.clockOffsetExplanation)

  const topics = useRosDiscoveryStore((state) => state.topics)
  const nodes = useRosDiscoveryStore((state) => state.nodes)
  const services = useRosDiscoveryStore((state) => state.services)
  const mappings = useTopicRegistryStore((state) => state.mappings)

  const displayHost = maskIp
    ? host.replace(/\d+\.\d+\.\d+\.(\d+)/, 'xxx.xxx.xxx.$1')
    : host

  const reportText = `==========================================================
    JetRacer Control Center - ROS 1 Inspection Report
==========================================================
Generated At: ${new Date().toISOString()}
Target Host: ${displayHost}
Link A Status: Connected (rosbridge WebSocket :9090)
ROS 1 Master Status: ${rosStatus}
Ping Latency (/rosapi/get_time): ${latencyMs ?? 'N/A'} ms
Clock Offset: ${clockOffsetSecs !== null ? `${clockOffsetSecs.toFixed(3)}s` : 'Unknown'}
Clock Status: ${clockExplanation}

----------------------------------------------------------
1. DISCOVERED NODES (${nodes.length})
----------------------------------------------------------
${
  nodes.length > 0
    ? nodes.map((n) => `  * ${n.name} [status: ${n.status ?? 'present'}]`).join('\n')
    : '  (No nodes discovered via /rosapi/nodes)'
}

----------------------------------------------------------
2. DISCOVERED TOPICS & TYPES (${topics.length})
----------------------------------------------------------
${
  topics.length > 0
    ? topics.map((t) => `  * ${t.name} -> ${t.type} [status: ${t.status ?? 'present'}]`).join('\n')
    : '  (No topics discovered via /rosapi/topics)'
}

----------------------------------------------------------
3. DISCOVERED SERVICES (${services.length})
----------------------------------------------------------
${
  services.length > 0
    ? services.map((s) => `  * ${s.name}`).join('\n')
    : '  (No services discovered via /rosapi/services)'
}

----------------------------------------------------------
4. TOPIC REGISTRY ROLE MAPPINGS
----------------------------------------------------------
${Object.values(mappings)
  .map(
    (m) =>
      `  * Role: ${m.role.padEnd(16)} -> Assigned: ${m.assignedTopic ?? 'NONE'.padEnd(20)} [Verification: ${m.verification}]`,
  )
  .join('\n')}

==========================================================
End of Report - Safe for Public Issue Sharing (IP Redacted: ${maskIp ? 'YES' : 'NO'})
`

  const handleCopy = () => {
    navigator.clipboard.writeText(reportText)
    toast.success('Inspection report copied to clipboard')
  }

  const handleDownload = () => {
    const blob = new Blob([reportText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ros_inspection_report_${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Inspection report downloaded')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Export Redacted ROS Inspection Report
          </DialogTitle>
          <DialogDescription className="text-xs">
            Generate clean diagnostics of ROS nodes, topics, services, and clock drift. Safe to paste
            in GitHub Issues or documentation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-y border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMaskIp(!maskIp)}
              className="text-xs min-h-[32px]"
            >
              {maskIp ? <Eye className="h-3.5 w-3.5 mr-1" /> : <EyeOff className="h-3.5 w-3.5 mr-1" />}
              {maskIp ? 'Reveal IP Address' : 'Redact / Mask IP'}
            </Button>
            <span className="text-xs text-muted-foreground font-mono">
              IP Masking: {maskIp ? 'ACTIVE (Safe)' : 'UNMASKED'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs min-h-[32px]">
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy
            </Button>
            <Button size="sm" onClick={handleDownload} className="text-xs min-h-[32px]">
              <Download className="h-3.5 w-3.5 mr-1" />
              Download
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded bg-muted/40 p-3 font-mono text-xs whitespace-pre select-text border border-border/50">
          {reportText}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
