import { useState, useEffect, useRef } from 'react'
import {
  Keyboard,
  Info,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { VirtualJoystick, type JoystickValue } from '@/components/common/VirtualJoystick'
import { VideoViewport } from '@/components/common/VideoViewport'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useSettingsStore } from '@/store/settingsStore'
import type { ControlState, DriveMode } from '@/types'

export function ControlPage() {
  const controlPrefs = useSettingsStore((state) => state.control)
  const safetyPrefs = useSettingsStore((state) => state.safety)
  const updateSafety = useSettingsStore((state) => state.updateSafety)

  // Driving telemetry state (displayed with tabular numerals)
  const [controlState, setControlState] = useState<ControlState>({
    linear: 0,
    angular: 0,
    maxSpeedPct: safetyPrefs.maxSpeedPct,
    mode: 'manual',
    deadmanActive: false,
    timestamp: 0,
  })

  const [activeMode, setActiveMode] = useState<DriveMode>('manual')
  const [deadmanEnabled, setDeadmanEnabled] = useState<boolean>(controlPrefs.deadmanRequired)
  const [isLandscape, setIsLandscape] = useState<boolean>(false)

  // Track orientation changes
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerWidth < 1024)
    }
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    return () => window.removeEventListener('resize', checkOrientation)
  }, [])

  // Joystick change handler (No-op in Phase 1: updates local UI only)
  const handleJoystickChange = (val: JoystickValue) => {
    setControlState((prev) => ({
      ...prev,
      linear: val.linear,
      angular: val.angular,
      timestamp: Date.now(),
    }))
  }

  // Keyboard navigation driver (WASD / Arrows)
  useEffect(() => {
    const keysDown = new Set<string>()

    const updateFromKeyboard = () => {
      let linear = 0
      let angular = 0

      if (keysDown.has('w') || keysDown.has('arrowup')) linear += 1.0
      if (keysDown.has('s') || keysDown.has('arrowdown')) linear -= 1.0
      if (keysDown.has('d') || keysDown.has('arrowright')) angular += 1.0
      if (keysDown.has('a') || keysDown.has('arrowleft')) angular -= 1.0

      handleJoystickChange({ linear, angular })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
        keysDown.add(key)
        updateFromKeyboard()
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (keysDown.has(key)) {
        keysDown.delete(key)
        updateFromKeyboard()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Gamepad API polling loop
  const rafHandleRef = useRef<number | null>(null)
  useEffect(() => {
    const pollGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : []
      const gp = gamepads[0]

      if (gp && gp.connected) {
        const rawAngular = gp.axes[0] || 0
        const rawLinear = -(gp.axes[1] || 0)

        const deadzone = 0.08
        const cleanAngular = Math.abs(rawAngular) > deadzone ? rawAngular : 0
        const cleanLinear = Math.abs(rawLinear) > deadzone ? rawLinear : 0

        handleJoystickChange({ linear: cleanLinear, angular: cleanAngular })
      }

      rafHandleRef.current = requestAnimationFrame(pollGamepad)
    }

    rafHandleRef.current = requestAnimationFrame(pollGamepad)
    return () => {
      if (rafHandleRef.current) cancelAnimationFrame(rafHandleRef.current)
    }
  }, [])

  const handleMaxSpeedChange = (val: number[]) => {
    const newPct = val[0]
    updateSafety({ maxSpeedPct: newPct })
    setControlState((prev) => ({ ...prev, maxSpeedPct: newPct }))
  }

  return (
    <TooltipProvider>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <PageHeader
          title="Manual Teleoperation"
          description="Real-time vehicle steering and throttle control with safety clamping"
          phase="8 Integration"
        />

        {/* Phase 3 Software E-Stop Safety Warning Banner */}
        <div className="p-3.5 rounded-lg bg-rose-500/15 border-2 border-rose-500/40 text-rose-500 dark:text-rose-400 text-xs flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 animate-pulse text-rose-500" />
            <div>
              <p className="font-bold tracking-wide uppercase">
                ⚠️ Software E-Stop is NOT wired in Phase 3.
              </p>
              <p className="text-[11px] text-foreground/80 mt-0.5">
                It will <strong>NOT</strong> stop the physical robot. Always use the robot's physical power switch or the gamepad R1 button to stop.
              </p>
            </div>
          </div>
          <Badge variant="destructive" className="text-[10px] uppercase font-mono flex-shrink-0">
            Physical Stop Only
          </Badge>
        </div>

        {/* Persistent UI Preview Banner */}
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-500 dark:text-blue-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>Control Preview:</strong> Virtual driving signals are processed locally in UI only. No motor commands are transmitted to the robot.
            </span>
          </div>
          <Badge variant="outline" className="text-[10px] uppercase font-mono">
            Safety Guard Active
          </Badge>
        </div>

        {/* Mode Selector and Speed Limiter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Selector */}
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Driving Mode</span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant={activeMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveMode('manual')}
                  className="min-h-[44px] sm:min-h-[32px] text-xs"
                >
                  Manual
                </Button>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="min-h-[44px] sm:min-h-[32px] text-xs"
                      >
                        Assisted
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Obstacle-assisted driving arrives in Phase 8</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="min-h-[44px] sm:min-h-[32px] text-xs"
                      >
                        Autonomous
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Waypoint autonomy arrives in Phase 9</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </Card>

          {/* Speed Limiter Slider */}
          <Card className="p-3 flex items-center justify-between gap-4">
            <div className="space-y-0.5 flex-1">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground uppercase">Speed Cap Limit</span>
                <span className="font-mono text-primary">{controlState.maxSpeedPct}%</span>
              </div>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[controlState.maxSpeedPct]}
                onValueChange={handleMaxSpeedChange}
                className="py-1"
                aria-label="Vehicle speed limiter percentage"
              />
            </div>
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <Label htmlFor="deadman-toggle" className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                Deadman
              </Label>
              <Switch
                id="deadman-toggle"
                checked={deadmanEnabled}
                onCheckedChange={setDeadmanEnabled}
              />
            </div>
          </Card>
        </div>

        {/* Dynamic Portrait / Landscape Driving Cockpit */}
        {isLandscape ? (
          /* Landscape View: Steering on left, Camera center, Throttle on right */
          <div className="grid grid-cols-4 gap-4 items-center">
            <Card className="p-4 flex flex-col items-center justify-center col-span-1">
              <span className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Steering</span>
              <VirtualJoystick
                size="sm"
                onChange={handleJoystickChange}
                invertX={controlPrefs.invertX}
              />
            </Card>

            <div className="col-span-2">
              <VideoViewport aspectRatio="16/9" />
            </div>

            <Card className="p-4 flex flex-col items-center justify-center col-span-1">
              <span className="text-xs font-semibold text-muted-foreground mb-3 uppercase">Throttle</span>
              <VirtualJoystick
                size="sm"
                onChange={handleJoystickChange}
                invertY={controlPrefs.invertY}
              />
            </Card>
          </div>
        ) : (
          /* Portrait / Standard Desktop View */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Camera Viewport Slot */}
            <div className="lg:col-span-2">
              <Card className="p-3 sm:p-4">
                <div className="flex items-center justify-between pb-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Driving Viewport</span>
                  <Badge variant="outline" className="text-[10px]">16:9 HD</Badge>
                </div>
                <VideoViewport />
              </Card>
            </div>

            {/* Virtual Joystick Drive Control Surface */}
            <Card className="lg:col-span-1 flex flex-col justify-between p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Virtual Touch Controller</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {controlPrefs.handedness === 'right' ? 'Right-Handed' : 'Left-Handed'}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Touch or drag to steer and accelerate
                </CardDescription>
              </CardHeader>

              {/* Joystick Container */}
              <div className="flex-1 flex flex-col items-center justify-center py-6">
                <VirtualJoystick
                  size={controlPrefs.joystickSize}
                  invertX={controlPrefs.invertX}
                  invertY={controlPrefs.invertY}
                  onChange={handleJoystickChange}
                />
              </div>

              {/* Real-time Normalized Telemetry Readout */}
              <div className="grid grid-cols-2 gap-2 text-center pt-3 border-t border-border">
                <div className="p-2 rounded bg-muted/30">
                  <span className="text-[10px] text-muted-foreground block uppercase">Throttle (Linear)</span>
                  <span className="font-mono font-bold text-sm tabular-nums">
                    {(controlState.linear * (controlState.maxSpeedPct / 100)).toFixed(2)}
                  </span>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <span className="text-[10px] text-muted-foreground block uppercase">Steering (Angular)</span>
                  <span className="font-mono font-bold text-sm tabular-nums">
                    {controlState.angular.toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Peripheral Controls Legend & Safety Notice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <Card className="p-4">
            <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <span>Keyboard & Gamepad Controls</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Drive using <strong>W / S / Up / Down</strong> for throttle, and <strong>A / D / Left / Right</strong> for steering. Connected USB or Bluetooth gamepads automatically control the primary drive axes.
            </p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
              <Info className="h-4 w-4 text-primary" />
              <span>Fail-Safe Command Timeout</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Velocity commands expire in <strong>{safetyPrefs.commandTimeoutMs}ms</strong> if no subsequent frame is received. If communication drops, the robot halts motion automatically.
            </p>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default ControlPage
