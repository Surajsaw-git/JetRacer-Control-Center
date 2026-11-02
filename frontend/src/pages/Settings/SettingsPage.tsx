import { useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ConnectionWizard } from '@/components/common/ConnectionWizard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Wifi,
  Palette,
  Gamepad2,
  Shield,
  Info,
  RotateCcw,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settingsStore'
import type { AppTheme, Density, Handedness, JoystickSize, UnitSystem } from '@/types'

export function SettingsPage() {
  const settings = useSettingsStore()

  // Reset confirmation dialog
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)

  // Health check query state for About tab
  const [healthStatus, setHealthStatus] = useState<string | null>(null)
  const [isCheckingHealth, setIsCheckingHealth] = useState(false)

  const handleCheckBackendHealth = async () => {
    if (!settings.connection.host) {
      toast.error('No host configured', { description: 'Please enter a host IP address first.' })
      return
    }

    setIsCheckingHealth(true)
    setHealthStatus(null)
    const protocol = settings.connection.useSsl ? 'https' : 'http'
    const targetUrl = `${protocol}://${settings.connection.host}:${settings.connection.backendPort}/api/health`

    try {
      const res = await fetch(targetUrl, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        setHealthStatus(`Online: ${data.service} (v${data.version})`)
        toast.success('Backend is reachable!')
      } else {
        setHealthStatus(`Error response: HTTP ${res.status}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setHealthStatus(`Unreachable: ${msg}`)
      toast.error('Failed to reach backend')
    } finally {
      setIsCheckingHealth(false)
    }
  }

  const handleResetDefaults = () => {
    settings.resetToDefaults()
    toast.success('Settings reset to factory defaults')
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Settings"
        description="Network configuration, driving preferences, appearance, and system safety"
        phase="1 UI / 3 Conn"
      />

      <Tabs defaultValue="connection" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto p-1 mb-6">
          <TabsTrigger value="connection" className="min-h-[44px] text-xs">
            <Wifi className="h-4 w-4 mr-1.5" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="appearance" className="min-h-[44px] text-xs">
            <Palette className="h-4 w-4 mr-1.5" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="control" className="min-h-[44px] text-xs">
            <Gamepad2 className="h-4 w-4 mr-1.5" />
            Controls
          </TabsTrigger>
          <TabsTrigger value="safety" className="min-h-[44px] text-xs">
            <Shield className="h-4 w-4 mr-1.5" />
            Safety
          </TabsTrigger>
          <TabsTrigger value="about" className="min-h-[44px] text-xs">
            <Info className="h-4 w-4 mr-1.5" />
            About
          </TabsTrigger>
        </TabsList>

        {/* 1. Connection Settings Tab */}
        <TabsContent value="connection">
          <ConnectionWizard />
        </TabsContent>

        {/* 2. Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Display & Visual Preferences
              </CardTitle>
              <CardDescription className="text-xs">
                Theme and accessibility options for console readability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <Label>Color Theme</Label>
                  <p className="text-xs text-muted-foreground">
                    Dark-first theme designed for outdoor readability.
                  </p>
                </div>
                <Select
                  value={settings.appearance.theme}
                  onValueChange={(val: AppTheme) => settings.updateAppearance({ theme: val })}
                >
                  <SelectTrigger className="w-36 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Dark (Default)</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <Label>Layout Density</Label>
                  <p className="text-xs text-muted-foreground">
                    Controls spacing between telemetry cards.
                  </p>
                </div>
                <Select
                  value={settings.appearance.density}
                  onValueChange={(val: Density) => settings.updateAppearance({ density: val })}
                >
                  <SelectTrigger className="w-36 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <Label>Unit System</Label>
                  <p className="text-xs text-muted-foreground">
                    Units for metric telemetry readouts.
                  </p>
                </div>
                <Select
                  value={settings.appearance.units}
                  onValueChange={(val: UnitSystem) => settings.updateAppearance({ units: val })}
                >
                  <SelectTrigger className="w-36 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric (m, km/h)</SelectItem>
                    <SelectItem value="imperial">Imperial (ft, mph)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="reduce-motion">Reduce Motion</Label>
                  <p className="text-xs text-muted-foreground">Disable subtle animations.</p>
                </div>
                <Switch
                  id="reduce-motion"
                  checked={settings.appearance.reduceMotion}
                  onCheckedChange={(val) => settings.updateAppearance({ reduceMotion: val })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Control Preferences Tab */}
        <TabsContent value="control">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Touch & Gamepad Preferences</CardTitle>
              <CardDescription className="text-xs">
                Tune driving responsiveness and virtual joystick behavior.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <Label>Joystick Size</Label>
                  <p className="text-xs text-muted-foreground">Physical touch target radius.</p>
                </div>
                <Select
                  value={settings.control.joystickSize}
                  onValueChange={(val: JoystickSize) =>
                    settings.updateControl({ joystickSize: val })
                  }
                >
                  <SelectTrigger className="w-36 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small (140px)</SelectItem>
                    <SelectItem value="md">Medium (180px)</SelectItem>
                    <SelectItem value="lg">Large (220px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <Label>Handedness</Label>
                  <p className="text-xs text-muted-foreground">
                    Preferred thumb dominance in landscape mode.
                  </p>
                </div>
                <Select
                  value={settings.control.handedness}
                  onValueChange={(val: Handedness) => settings.updateControl({ handedness: val })}
                >
                  <SelectTrigger className="w-36 min-h-[44px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">Right-Handed</SelectItem>
                    <SelectItem value="left">Left-Handed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label htmlFor="invert-x">Invert Steering (Horizontal Axis)</Label>
                  <p className="text-xs text-muted-foreground">Reverse left/right drive vector.</p>
                </div>
                <Switch
                  id="invert-x"
                  checked={settings.control.invertX}
                  onCheckedChange={(val) => settings.updateControl({ invertX: val })}
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="space-y-0.5">
                  <Label htmlFor="invert-y">Invert Throttle (Vertical Axis)</Label>
                  <p className="text-xs text-muted-foreground">
                    Reverse forward/reverse drive vector.
                  </p>
                </div>
                <Switch
                  id="invert-y"
                  checked={settings.control.invertY}
                  onCheckedChange={(val) => settings.updateControl({ invertY: val })}
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="deadman-pref">Enforce Dead-Man Switch</Label>
                  <p className="text-xs text-muted-foreground">
                    Require continuous touch contact while driving.
                  </p>
                </div>
                <Switch
                  id="deadman-pref"
                  checked={settings.control.deadmanRequired}
                  onCheckedChange={(val) => settings.updateControl({ deadmanRequired: val })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Safety Limits Tab (Preview) */}
        <TabsContent value="safety">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">Safety & Watchdog Limits</CardTitle>
              <CardDescription className="text-xs">
                Software constraints enforced on the robot controller.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
                <strong>Safety Preview Note:</strong> These speed limits and watchdog thresholds
                will be enforced by the backend safety supervisor in Phase 13.
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <Label>Maximum Speed Cap Percentage</Label>
                  <span className="font-mono font-bold text-primary">
                    {settings.safety.maxSpeedPct}%
                  </span>
                </div>
                <Slider
                  min={10}
                  max={100}
                  step={5}
                  value={[settings.safety.maxSpeedPct]}
                  onValueChange={(val) => settings.updateSafety({ maxSpeedPct: val[0] })}
                  className="py-1"
                />
                <p className="text-[11px] text-muted-foreground">
                  Limits maximum motor output across manual, assisted, and autonomous driving.
                </p>
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex justify-between items-center text-xs">
                  <Label>Watchdog Command Timeout</Label>
                  <span className="font-mono font-bold">{settings.safety.commandTimeoutMs} ms</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  If the robot does not receive a keepalive command within this interval, motors
                  immediately halt.
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="space-y-0.5">
                  <Label htmlFor="allow-mutations-toggle" className="text-xs font-semibold">
                    Allow Robot Actions (Stage 7B & Phase 8)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Enables dispatching commands to the on-robot JCC agent (starting/stopping mapping, saving/deleting maps on car). Keep disabled for pure read-only monitoring.
                  </p>
                </div>
                <Switch
                  id="allow-mutations-toggle"
                  checked={settings.safety.allowRobotMutations ?? false}
                  onCheckedChange={(checked) => settings.updateSafety({ allowRobotMutations: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. About & Maintenance Tab */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Application Metadata & Diagnostics
              </CardTitle>
              <CardDescription className="text-xs">
                Version build information and factory reset tools.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 max-w-xl">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">App Name</span>
                  <span className="font-medium">JetRacer Control Center</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Version</span>
                  <span className="font-mono">v0.2.0 (Phase 1 UI)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span className="text-muted-foreground">Environment</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {import.meta.env.MODE}
                  </Badge>
                </div>
              </div>

              {/* Optional Health Check Diagnostic */}
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Backend Link Verification</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckBackendHealth}
                    disabled={isCheckingHealth}
                    className="min-h-[44px] sm:min-h-[32px] text-xs"
                  >
                    {isCheckingHealth ? 'Pinging...' : 'Check Health'}
                  </Button>
                </div>
                {healthStatus && (
                  <p className="text-xs font-mono text-muted-foreground bg-card p-2 rounded border border-border">
                    {healthStatus}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-rose-500">Factory Reset</p>
                  <p className="text-[11px] text-muted-foreground">
                    Restore all settings to initial defaults.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsResetConfirmOpen(true)}
                  className="min-h-[44px] sm:min-h-[36px]"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Factory Reset Confirmation Dialog */}
      <ConfirmDialog
        open={isResetConfirmOpen}
        onOpenChange={setIsResetConfirmOpen}
        title="Reset All Settings to Defaults?"
        description="This will clear your stored robot host IP, appearance, and driving preferences. This action cannot be undone."
        variant="destructive"
        confirmText="Reset Everything"
        onConfirm={handleResetDefaults}
      />
    </div>
  )
}

export default SettingsPage
