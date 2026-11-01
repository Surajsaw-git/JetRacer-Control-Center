import { useState, useEffect } from 'react'
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Copy,
  Server,
  RefreshCw,
  XCircle,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useConnectionStore } from '@/store/connectionStore'
import { useSettingsStore } from '@/store/settingsStore'
import { rosbridgeClient } from '@/services/rosbridgeClient'
import { parseRobotAddress, isValidPort } from '@/utils/validators'
import { cn } from '@/lib/utils'

export function ConnectionWizard() {
  const connectionState = useConnectionStore()
  const settings = useSettingsStore()

  const getInitialValue = (key: string, fallback: string): string => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get(key)
      if (p) return p
    }
    return fallback
  }

  const [addressInput, setAddressInput] = useState(() =>
    getInitialValue('host', settings.connection.host || ''),
  )
  const [rosbridgePortInput, setRosbridgePortInput] = useState(() =>
    getInitialValue('rosbridgePort', String(settings.connection.rosbridgePort || 9090)),
  )
  const [backendPortInput, setBackendPortInput] = useState(() =>
    getInitialValue('backendPort', String(settings.connection.backendPort || 8000)),
  )
  const [showAdvancedPorts, setShowAdvancedPorts] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validationWarning, setValidationWarning] = useState<string | null>(null)
  const [maskIpInDiagnostics, setMaskIpInDiagnostics] = useState(true)

  // Handle URL query parameter for automated connection
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const autoConnect = params.get('autoConnect') === 'true'
    const targetHost = params.get('host') || addressInput

    if (autoConnect && targetHost) {
      const rPort = Number(params.get('rosbridgePort')) || Number(rosbridgePortInput) || 9090
      const bPort = Number(params.get('backendPort')) || Number(backendPortInput) || 8000
      rosbridgeClient.connect(targetHost, rPort, bPort)
    }
  }, [])

  const isConnected = connectionState.status === 'connected'
  const isConnecting = connectionState.status === 'connecting'
  const isReconnecting = connectionState.status === 'reconnecting'
  const isBusy = isConnecting || isReconnecting

  const handleAddressChange = (val: string) => {
    setAddressInput(val)
    if (!val.trim()) {
      setValidationError(null)
      setValidationWarning(null)
      return
    }

    const parsed = parseRobotAddress(val)
    if (!parsed.valid) {
      setValidationError(parsed.error || 'Invalid address')
      setValidationWarning(null)
    } else {
      setValidationError(null)
      setValidationWarning(parsed.warning || null)
    }
  }

  const handleConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    const parsed = parseRobotAddress(addressInput, {
      customRosbridgePort: Number(rosbridgePortInput) || 9090,
      customBackendPort: Number(backendPortInput) || 8000,
    })

    if (!parsed.valid) {
      setValidationError(parsed.error || 'Invalid address')
      toast.error('Invalid connection target', { description: parsed.error })
      return
    }

    if (!isValidPort(rosbridgePortInput)) {
      setValidationError('Rosbridge port must be an integer between 1 and 65535.')
      return
    }

    if (!isValidPort(backendPortInput)) {
      setValidationError('Backend port must be an integer between 1 and 65535.')
      return
    }

    setValidationError(null)
    setValidationWarning(parsed.warning || null)

    const targetHost = parsed.host
    const rPort = parsed.rosbridgePort
    const bPort = parsed.backendPort

    settings.updateConnection({
      host: targetHost,
      rosbridgePort: rPort,
      backendPort: bPort,
    })

    toast.info(`Connecting to ${targetHost}...`)
    const ok = await rosbridgeClient.connect(targetHost, rPort, bPort)
    if (ok) {
      toast.success('Connected to Robot (Link A Rosbridge Active)!', {
        description: 'Read-only telemetry and time synchronization enabled.',
      })
    } else {
      toast.error('Connection failed', {
        description: connectionState.errorMessage || 'Unable to establish WebSocket session.',
      })
    }
  }

  const handleDisconnect = () => {
    rosbridgeClient.disconnect()
    toast.info('Disconnected from robot.')
  }

  const handleQuickFillMock = () => {
    handleAddressChange('127.0.0.1')
    setRosbridgePortInput('9090')
    setBackendPortInput('8000')
    toast.info('Quick-filled Local Mock (127.0.0.1)', {
      description: 'Ensure "npm run mock:rosbridge" is running in your terminal.',
    })
  }

  const handleForgetSavedHost = () => {
    setAddressInput('')
    settings.updateConnection({ host: '' })
    toast.success('Cleared saved robot host.')
  }

  const handleCopyDiagnostics = () => {
    const ts = new Date().toISOString()
    const rawHost = connectionState.host || settings.connection.host || 'unknown'
    const displayHost = maskIpInDiagnostics
      ? rawHost.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.***.***')
      : rawHost

    const rosTimeStr = connectionState.rosTime
      ? `${connectionState.rosTime.secs}.${String(connectionState.rosTime.nsecs).padStart(9, '0')}`
      : 'N/A'

    const diagnosticsText = `=== JetRacer Connection Diagnostics ===
Timestamp:        ${ts}
Target Host:      ${displayHost}
Rosbridge Port:   ${connectionState.rosbridgePort}
Backend Port:     ${connectionState.backendPort}

[LINK A - Rosbridge WebSocket ws://]
Status:           ${connectionState.status.toUpperCase()}
Latency:          ${connectionState.latencyMs !== null ? `${connectionState.latencyMs} ms` : 'N/A'}
ROS Time:         ${rosTimeStr}
Reconnect Retries:${connectionState.reconnectAttempt || 0}/${connectionState.maxReconnectAttempts || 5}

[LINK B - FastAPI Backend http://]
Status:           ${(connectionState.linkBStatus || 'unreachable').toUpperCase()}
Latency:          ${connectionState.linkBLatencyMs !== null ? `${connectionState.linkBLatencyMs} ms` : 'N/A'}
Backend Version:  ${connectionState.linkBVersion || 'N/A (optional for Phase 3)'}

[ERROR LOGS]
Active Error:     ${connectionState.errorMessage || 'None'}
Connection Step:  ${connectionState.connectionStep || 'Idle'}
=======================================`

    navigator.clipboard.writeText(diagnosticsText).then(
      () => toast.success('Diagnostics copied to clipboard!'),
      () => toast.error('Failed to copy to clipboard.'),
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Primary Target Configuration Card */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                <span>Target Robot Connection</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Enter your JetRacer robot's Wi-Fi IP address or hostname to establish Link A
                (rosbridge) communication.
              </CardDescription>
            </div>
            <StatusBadge status={connectionState.status} />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnect} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="target-address" className="text-xs font-medium">
                  Robot Address (IPv4 or Hostname)
                </Label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleQuickFillMock}
                    className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                    title="Quick-fill 127.0.0.1 for local mock server testing"
                  >
                    Local Mock (127.0.0.1)
                  </Button>
                  {settings.connection.host && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleForgetSavedHost}
                      className="h-6 text-[11px] px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                      title="Clear saved host from storage"
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Forget
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  id="target-address"
                  value={addressInput}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder="e.g. 192.168.1.100 or jetracer.local"
                  disabled={isBusy}
                  className="font-mono text-sm min-h-[44px]"
                />

                {isConnected ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDisconnect}
                    className="min-h-[44px] min-w-[110px]"
                  >
                    <WifiOff className="h-4 w-4 mr-1.5" />
                    Disconnect
                  </Button>
                ) : isBusy ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisconnect}
                    className="min-h-[44px] min-w-[110px] border-amber-500/50 text-amber-500"
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />
                    Cancel
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={Boolean(validationError) || !addressInput.trim()}
                    className="min-h-[44px] min-w-[110px]"
                  >
                    <Wifi className="h-4 w-4 mr-1.5" />
                    Connect
                  </Button>
                )}
              </div>

              {validationError && (
                <p className="text-xs text-rose-500 font-medium flex items-center gap-1.5 pt-1">
                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </p>
              )}

              {validationWarning && (
                <p className="text-xs text-amber-500 font-medium flex items-center gap-1.5 pt-1">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{validationWarning}</span>
                </p>
              )}
            </div>

            {/* Toggle Advanced Ports */}
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedPorts(!showAdvancedPorts)}
                className="text-xs text-muted-foreground p-0 h-auto hover:text-foreground"
              >
                {showAdvancedPorts ? '▲ Hide Advanced Ports' : '▼ Advanced Ports (9090 / 8000)'}
              </Button>

              {showAdvancedPorts && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 mt-2 border-t border-border">
                  <div className="space-y-1.5">
                    <Label htmlFor="rosbridge-port" className="text-xs">
                      Rosbridge WebSocket Port (Link A)
                    </Label>
                    <Input
                      id="rosbridge-port"
                      value={rosbridgePortInput}
                      onChange={(e) => setRosbridgePortInput(e.target.value)}
                      placeholder="9090"
                      disabled={isBusy || isConnected}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Default: 9090 (WebSocket)</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="backend-port" className="text-xs">
                      FastAPI Backend Port (Link B)
                    </Label>
                    <Input
                      id="backend-port"
                      value={backendPortInput}
                      onChange={(e) => setBackendPortInput(e.target.value)}
                      placeholder="8000"
                      disabled={isBusy || isConnected}
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">Default: 8000 (HTTP / WS)</p>
                  </div>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 2. Connection Progress & State Machine Card */}
      {isBusy && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-amber-500 animate-spin flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                Connection in Progress
              </p>
              <p className="text-xs text-foreground font-mono">
                {connectionState.connectionStep || 'Establishing WebSocket handshake...'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Link A and Link B Diagnostic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Link A: Rosbridge */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span>Link A: Rosbridge WebSocket</span>
              </CardTitle>
              <Badge
                variant={isConnected ? 'default' : 'outline'}
                className={cn(
                  'text-[10px] uppercase font-mono',
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'text-muted-foreground',
                )}
              >
                {connectionState.status}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Primary robotics bridge on port {connectionState.rosbridgePort}. Mandatory for robot state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Target Endpoint:</span>
              <span className="font-mono text-foreground font-medium">
                {connectionState.host ? `ws://${connectionState.host}:${connectionState.rosbridgePort}` : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Heartbeat Latency:</span>
              <span className="font-mono text-foreground">
                {connectionState.latencyMs !== null ? `${connectionState.latencyMs} ms` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">ROS Clock (/rosapi/get_time):</span>
              <span className="font-mono text-foreground">
                {connectionState.rosTime
                  ? `${connectionState.rosTime.secs}.${String(connectionState.rosTime.nsecs).slice(0, 3)} s`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Permissions:</span>
              <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30">
                Phase 3 Read-Only
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Link B: FastAPI Backend */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Link B: FastAPI Backend</span>
              </CardTitle>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] uppercase font-mono',
                  connectionState.linkBStatus === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'text-amber-500 border-amber-500/30',
                )}
              >
                {connectionState.linkBStatus || 'unreachable'}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Auxiliary telemetry &amp; persistence API on port {connectionState.backendPort}. Optional for Phase 3.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Target Endpoint:</span>
              <span className="font-mono text-foreground font-medium">
                {connectionState.host ? `http://${connectionState.host}:${connectionState.backendPort}` : 'Not set'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">API Status:</span>
              <span className="font-mono text-foreground">
                {connectionState.linkBStatus === 'connected'
                  ? `Online (v${connectionState.linkBVersion || '0.2.1'})`
                  : 'Unreachable / Not Deployed'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">HTTP Latency:</span>
              <span className="font-mono text-foreground">
                {connectionState.linkBLatencyMs !== null ? `${connectionState.linkBLatencyMs} ms` : '—'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Operational Note:</span>
              <span className="text-[11px] text-muted-foreground text-right">
                Normal if Jetson runs Python 3.6
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Troubleshooting and Diagnostics Card */}
      {connectionState.errorMessage && (
        <Card className="border-rose-500/40 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-rose-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Connection Diagnostic Feedback</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <p className="font-mono text-foreground bg-rose-500/10 p-2.5 rounded border border-rose-500/20">
              {connectionState.errorMessage}
            </p>
            <div className="text-[11px] text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Common Remedies:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Check that your computer/phone is on the same Wi-Fi network as the robot.</li>
                <li>Verify rosbridge is running on the Jetson: <code className="bg-muted px-1 py-0.5 rounded">robot/scripts/start_rosbridge.sh</code></li>
                <li>Check firewall status or port conflicts on port 9090.</li>
                <li>Review the troubleshooting steps in <strong className="text-foreground">docs/FIRST_CONNECTION_RUNBOOK.md</strong>.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Diagnostics Export */}
      <Card className="border-border">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-xs font-semibold text-foreground">Connection Diagnostics</p>
            <p className="text-[11px] text-muted-foreground">
              Export redacted diagnostic details to share when troubleshooting network issues.
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMaskIpInDiagnostics(!maskIpInDiagnostics)}
              className="text-xs h-8"
            >
              {maskIpInDiagnostics ? 'IP Masked' : 'IP Visible'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleCopyDiagnostics}
              className="text-xs h-8"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy Diagnostics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ConnectionWizard
