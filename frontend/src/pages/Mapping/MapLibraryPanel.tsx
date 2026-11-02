/**
 * JetRacer Control Center — Map Library Panel (Phase 7B)
 *
 * Provides map snapshot creation, PGM+YAML export and import, local IndexedDB library,
 * and remote robot-side map management (listing, saving, chunked download, safe deletion).
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  Download,
  FolderOpen,
  HardDrive,
  Plus,
  Trash2,
  Upload,
  Eye,
  Edit2,
  FileText,
  Server,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { localMapLibrary } from '@/services/map/localMapLibrary'
import { exportMapBundle, importMapFromPgmAndYaml } from '@/services/map/mapExport'
import { agentClient } from '@/services/agent/agentClient'
import type { RobotMapItem } from '@/services/agent/agentTypes'
import { useRosDiscoveryStore } from '@/store/rosDiscoveryStore'
import { useSettingsStore } from '@/store/settingsStore'
import type { DecodedOccupancyGrid, SavedMapRecord } from '@/services/map/mapTypes'
import { toast } from 'sonner'

export interface MapLibraryPanelProps {
  currentMap: DecodedOccupancyGrid | null
  onLoadMapToViewer: (map: DecodedOccupancyGrid, recordName: string) => void
  activeLoadedMapName?: string | null
}

export const MapLibraryPanel: React.FC<MapLibraryPanelProps> = ({
  currentMap,
  onLoadMapToViewer,
  activeLoadedMapName,
}) => {
  const [maps, setMaps] = useState<SavedMapRecord[]>([])
  const [robotMaps, setRobotMaps] = useState<RobotMapItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingRobot, setIsLoadingRobot] = useState(false)
  const [isDownloadingChunk, setIsDownloadingChunk] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<string>('')

  // Check if JCC agent service is registered on ROS master
  const discoServices = useRosDiscoveryStore((s) => s.services)
  const isAgentDetected = discoServices.some((s) => s.name === '/jetracer_cc_agent/command')
  const allowRobotMutations = useSettingsStore((s) => s.safety.allowRobotMutations ?? false)

  // Save Snapshot Dialog State (Local & Robot)
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [saveTarget, setSaveTarget] = useState<'local' | 'robot'>('local')
  const [newMapName, setNewMapName] = useState('')
  const [newMapNotes, setNewMapNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Rename Dialog State
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingName, setRenamingName] = useState('')

  // Delete Confirm Dialog State
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingRobotMapName, setDeletingRobotMapName] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // File Import Refs
  const pgmInputRef = useRef<HTMLInputElement>(null)
  const yamlInputRef = useRef<HTMLInputElement>(null)
  const [pendingPgmBytes, setPendingPgmBytes] = useState<Uint8Array | null>(null)

  const loadLocalMaps = async () => {
    setIsLoading(true)
    try {
      const list = await localMapLibrary.listMaps()
      setMaps(list)
    } catch (err) {
      console.warn('[MapLibraryPanel] Failed to load local maps:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const loadRobotMaps = async () => {
    if (!isAgentDetected) return
    setIsLoadingRobot(true)
    try {
      const res = await agentClient.listRobotMaps()
      setRobotMaps(res.maps)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[MapLibraryPanel] Failed to list robot maps:', msg)
    } finally {
      setIsLoadingRobot(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    localMapLibrary
      .listMaps()
      .then((list) => {
        if (isMounted) setMaps(list)
      })
      .catch(() => {})

    if (isAgentDetected) {
      agentClient
        .listRobotMaps()
        .then((res) => {
          if (isMounted) setRobotMaps(res.maps)
        })
        .catch(() => {})
    }

    return () => {
      isMounted = false
    }
  }, [isAgentDetected])

  const handleOpenSave = (target: 'local' | 'robot') => {
    if (!currentMap) {
      toast.error('No active map to save. Start SLAM or fetch a snapshot first.')
      return
    }
    setSaveTarget(target)
    const defaultName = `map_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}`
    setNewMapName(defaultName)
    setNewMapNotes('')
    setIsSaveOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!currentMap || !newMapName.trim()) return
    setIsSaving(true)
    try {
      if (saveTarget === 'local') {
        const record = await localMapLibrary.saveMap(
          currentMap,
          newMapName.trim(),
          newMapNotes.trim() || undefined,
          'device_snapshot',
        )
        toast.success(`Saved map "${record.name}" to this device.`)
        setIsSaveOpen(false)
        loadLocalMaps()
      } else {
        if (!allowRobotMutations) {
          toast.error('Robot actions are disabled in Settings. Enable "Allow Robot Actions" to save on the robot.')
          return
        }
        const res = await agentClient.saveMapOnRobot(newMapName.trim())
        if (res.success) {
          toast.success(res.message || `Saved map "${newMapName}" on robot disk.`)
          setIsSaveOpen(false)
          loadRobotMaps()
        } else {
          toast.error(`Robot save failed: ${res.message}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Save failed: ${msg}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = (record: SavedMapRecord) => {
    try {
      const decodedMap: DecodedOccupancyGrid = {
        header: {
          seq: 0,
          timestampMs: new Date(record.createdAt).getTime(),
          frameId: record.frameId,
        },
        info: {
          width: record.width,
          height: record.height,
          resolution: record.resolution,
          origin: record.origin,
          originQuat: { x: 0, y: 0, z: Math.sin(record.origin.yawRad / 2), w: Math.cos(record.origin.yawRad / 2) },
        },
        data: record.data,
        metrics: record.metrics,
        warnings: [],
      }

      const bundle = exportMapBundle(decodedMap, record.name)

      // Download PGM
      const pgmUrl = URL.createObjectURL(bundle.pgmBlob)
      const aPgm = document.createElement('a')
      aPgm.href = pgmUrl
      aPgm.download = `${bundle.name}.pgm`
      aPgm.click()
      URL.revokeObjectURL(pgmUrl)

      // Download YAML
      const yamlBlob = new Blob([bundle.yamlString], { type: 'text/yaml' })
      const yamlUrl = URL.createObjectURL(yamlBlob)
      const aYaml = document.createElement('a')
      aYaml.href = yamlUrl
      aYaml.download = `${bundle.name}.yaml`
      aYaml.click()
      URL.revokeObjectURL(yamlUrl)

      // Download JSON Sidecar
      const jsonBlob = new Blob([bundle.jsonString], { type: 'application/json' })
      const jsonUrl = URL.createObjectURL(jsonBlob)
      const aJson = document.createElement('a')
      aJson.href = jsonUrl
      aJson.download = `${bundle.name}.json`
      aJson.click()
      URL.revokeObjectURL(jsonUrl)

      toast.success(`Exported ${bundle.name}.pgm, ${bundle.name}.yaml, and ${bundle.name}.json.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Export failed: ${msg}`)
    }
  }

  const handleLoadSavedMap = (record: SavedMapRecord) => {
    const decodedMap: DecodedOccupancyGrid = {
      header: {
        seq: 0,
        timestampMs: new Date(record.createdAt).getTime(),
        frameId: record.frameId,
      },
      info: {
        width: record.width,
        height: record.height,
        resolution: record.resolution,
        origin: record.origin,
        originQuat: { x: 0, y: 0, z: Math.sin(record.origin.yawRad / 2), w: Math.cos(record.origin.yawRad / 2) },
      },
      data: record.data,
      metrics: record.metrics,
      warnings: [],
    }
    onLoadMapToViewer(decodedMap, record.name)
    toast.info(`Loaded "${record.name}" into viewer.`)
  }

  const handleDownloadFromRobot = async (item: RobotMapItem) => {
    setIsDownloadingChunk(item.name)
    setDownloadProgress('Starting chunked transfer...')
    try {
      const { yamlText, pgmBytes } = await agentClient.downloadMapFromRobot(
        item.name,
        (received, total, ext) => {
          setDownloadProgress(`${ext.toUpperCase()}: ${Math.round((received / Math.max(1, total)) * 100)}% (${received}/${total} B)`)
        },
      )

      // Parse into DecodedOccupancyGrid and store locally in IndexedDB
      const imported = importMapFromPgmAndYaml(pgmBytes, yamlText)
      if (imported.success && imported.map) {
        await localMapLibrary.saveMap(
          imported.map,
          item.name,
          'Downloaded from robot disk via chunked transport',
          'robot_import',
        )
        toast.success(`Map "${item.name}" downloaded from robot and saved locally.`)
        loadLocalMaps()
        onLoadMapToViewer(imported.map, item.name)
      } else {
        toast.error(`Downloaded files could not be parsed: ${imported.error}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to download map from robot: ${msg}`)
    } finally {
      setIsDownloadingChunk(null)
      setDownloadProgress('')
    }
  }

  const handleConfirmDelete = async () => {
    if (deletingId) {
      try {
        await localMapLibrary.deleteMap(deletingId)
        toast.success('Map deleted from this device.')
        setDeletingId(null)
        loadLocalMaps()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Delete failed: ${msg}`)
      }
    } else if (deletingRobotMapName) {
      if (!allowRobotMutations) {
        toast.error('Robot actions are disabled in Settings. Enable "Allow Robot Actions" to delete.')
        return
      }
      setIsDeleting(true)
      try {
        const res = await agentClient.deleteMapOnRobot(deletingRobotMapName)
        if (res.success) {
          toast.success(res.message || `Map "${deletingRobotMapName}" moved to trash on robot.`)
          setDeletingRobotMapName(null)
          loadRobotMaps()
        } else {
          toast.error(`Robot delete failed: ${res.message}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`Robot delete error: ${msg}`)
      } finally {
        setIsDeleting(false)
      }
    }
  }

  const handleConfirmRename = async () => {
    if (!renamingId || !renamingName.trim()) return
    try {
      await localMapLibrary.renameMap(renamingId, renamingName.trim())
      toast.success('Map renamed.')
      setRenamingId(null)
      loadLocalMaps()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Rename failed: ${msg}`)
    }
  }

  const handlePgmFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const arrayBuffer = await file.arrayBuffer()
    setPendingPgmBytes(new Uint8Array(arrayBuffer))
    toast.info(`Loaded ${file.name}. Now select matching .yaml file.`)
    yamlInputRef.current?.click()
  }

  const handleYamlFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !pendingPgmBytes) return
    const text = await file.text()

    const importResult = importMapFromPgmAndYaml(pendingPgmBytes, text)
    if (importResult.success && importResult.map) {
      const baseName = file.name.replace(/\.yaml$/i, '')
      try {
        const record = await localMapLibrary.saveMap(
          importResult.map,
          baseName,
          'Imported from PGM/YAML',
          'robot_import',
        )
        toast.success(`Successfully imported map "${record.name}".`)
        loadLocalMaps()
      } catch (saveErr) {
        toast.error(`Failed to save imported map: ${saveErr}`)
      }
    } else {
      toast.error(`Import failed: ${importResult.error}`)
    }

    setPendingPgmBytes(null)
    if (pgmInputRef.current) pgmInputRef.current.value = ''
    if (yamlInputRef.current) yamlInputRef.current.value = ''
  }

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Action Controls Bar */}
      <Card className="bg-card/70 border-border/60">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => handleOpenSave('local')}
              disabled={!currentMap}
            >
              <Plus className="h-3.5 w-3.5" />
              Save (Device)
            </Button>

            {isAgentDetected && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => handleOpenSave('robot')}
                disabled={!currentMap || !allowRobotMutations}
                title={!allowRobotMutations ? 'Enable "Allow Robot Actions" in Settings to save on robot disk' : undefined}
              >
                <Server className="h-3.5 w-3.5" />
                Save (Robot)
              </Button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 text-xs"
            onClick={() => pgmInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Import (PGM/YAML)
          </Button>

          <input
            ref={pgmInputRef}
            type="file"
            accept=".pgm"
            className="hidden"
            onChange={handlePgmFileChange}
          />
          <input
            ref={yamlInputRef}
            type="file"
            accept=".yaml,.yml"
            className="hidden"
            onChange={handleYamlFileChange}
          />
        </CardContent>
      </Card>

      {/* 2. Saved Maps Library (Tabbed: This Device vs On Robot) */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Saved Maps Library
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] font-mono">
                {maps.length} local
              </Badge>
              {isAgentDetected && (
                <Badge variant="outline" className="text-[10px] font-mono text-emerald-400 border-emerald-500/30">
                  {robotMaps.length} on robot
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="text-xs">
            Stored locally in IndexedDB or on robot disk via JCC agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-3">
              <TabsTrigger value="local" className="text-xs gap-1.5">
                <HardDrive className="h-3 w-3" />
                This Device ({maps.length})
              </TabsTrigger>
              <TabsTrigger value="robot" className="text-xs gap-1.5" onClick={() => loadRobotMaps()}>
                <Server className="h-3 w-3" />
                On Robot {isAgentDetected ? `(${robotMaps.length})` : '(Offline)'}
              </TabsTrigger>
            </TabsList>

            {/* TAB: THIS DEVICE (LOCAL) */}
            <TabsContent value="local" className="m-0 focus-visible:outline-none space-y-3">
              {isLoading ? (
                <p className="text-zinc-500 text-center py-4">Loading library...</p>
              ) : maps.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 space-y-1">
                  <FolderOpen className="h-8 w-8 mx-auto opacity-40 mb-2" />
                  <p className="font-medium text-xs">No saved maps on this device.</p>
                  <p className="text-[11px] text-zinc-600">
                    Click "Save (Device)" while viewing a live map or import PGM+YAML.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {maps.map((m) => {
                    const isCurrentlyActive = activeLoadedMapName === m.name
                    return (
                      <div
                        key={m.id}
                        className="p-2.5 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors flex gap-3"
                      >
                        {/* Thumbnail */}
                        <div className="w-16 h-16 rounded overflow-hidden bg-zinc-950 border border-zinc-800 shrink-0 flex items-center justify-center">
                          {m.thumbnailDataUrl ? (
                            <img
                              src={m.thumbnailDataUrl}
                              alt={m.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <FileText className="h-6 w-6 text-zinc-600" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-medium text-foreground truncate">{m.name}</span>
                            {isCurrentlyActive && (
                              <Badge className="bg-primary/20 text-primary border-primary/30 text-[9px] px-1 py-0">
                                Active in View
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>{m.width}x{m.height} px</span>
                            <span>({(m.width * m.resolution).toFixed(1)}m x {(m.height * m.resolution).toFixed(1)}m)</span>
                            <span>{m.resolution}m/px</span>
                          </div>
                          <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                            <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                            <span>{m.metrics?.knownPercent ?? 0}% coverage</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1"
                              onClick={() => handleLoadSavedMap(m)}
                              title="Load into 2D viewer"
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1 text-zinc-400 hover:text-white"
                              onClick={() => handleExport(m)}
                              title="Export PGM, YAML, JSON"
                            >
                              <Download className="h-3 w-3" />
                              Export
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] gap-1 text-zinc-400 hover:text-white"
                              onClick={() => {
                                setRenamingId(m.id)
                                setRenamingName(m.name)
                              }}
                              title="Rename map"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                              onClick={() => setDeletingId(m.id)}
                              title="Delete from device"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB: ON ROBOT */}
            <TabsContent value="robot" className="m-0 focus-visible:outline-none space-y-3">
              {!isAgentDetected ? (
                <div className="p-4 rounded-lg bg-amber-950/30 border border-amber-600/30 text-amber-300 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <span>JCC Agent Node Offline</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    The robot agent is required to manage maps stored on the car. Deploy and start it on the robot:
                  </p>
                  <pre className="p-2 rounded bg-black/60 font-mono text-[10px] text-amber-100 overflow-x-auto">
                    ~/jetracer-cc/robot/scripts/install_agent.sh{'\n'}
                    ~/jetracer-cc/robot/scripts/start_agent.sh
                  </pre>
                </div>
              ) : isLoadingRobot ? (
                <div className="flex items-center justify-center py-6 gap-2 text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Querying robot maps (~/maps)...</span>
                </div>
              ) : robotMaps.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 space-y-1">
                  <FolderOpen className="h-8 w-8 mx-auto opacity-40 mb-2" />
                  <p className="font-medium text-xs">No saved maps found in ~/maps on robot.</p>
                  <p className="text-[11px] text-zinc-600">
                    Run SLAM and click "Save (Robot)" to write maps to the car.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
                    <span>Target: ~/maps</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] gap-1"
                      onClick={() => loadRobotMaps()}
                    >
                      <RefreshCw className="h-3 w-3" />
                      Refresh
                    </Button>
                  </div>

                  {robotMaps.map((item) => (
                    <div
                      key={item.name}
                      className="p-2.5 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-foreground truncate">{item.name}</span>
                          {item.has_pgm ? (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-400 py-0">
                              PGM+YAML
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400 py-0">
                              YAML Only
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 flex gap-2">
                          <span>{new Date(item.modified_secs * 1000).toLocaleDateString()}</span>
                          <span>{Math.round((item.yaml_size_bytes + item.pgm_size_bytes) / 1024)} KB</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => handleDownloadFromRobot(item)}
                          disabled={isDownloadingChunk === item.name}
                        >
                          {isDownloadingChunk === item.name ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>{downloadProgress || 'Downloading...'}</span>
                            </>
                          ) : (
                            <>
                              <Download className="h-3 w-3" />
                              <span>Download</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                          onClick={() => setDeletingRobotMapName(item.name)}
                          disabled={!allowRobotMutations || isDeleting}
                          title={!allowRobotMutations ? 'Enable "Allow Robot Actions" in Settings to delete' : undefined}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Save Snapshot Dialog */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Map Snapshot ({saveTarget === 'robot' ? 'On Robot Disk' : 'On This Device'})</DialogTitle>
            <DialogDescription className="text-xs">
              {saveTarget === 'robot'
                ? 'Saves map to ~/maps on the JetRacer using ROS map_saver.'
                : 'Saves current occupancy grid and thumbnail to local device IndexedDB.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-300">Map Name</label>
              <Input
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                placeholder="room_1"
                className="h-8 font-mono text-xs"
              />
            </div>
            {saveTarget === 'local' && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Notes (Optional)</label>
                <Input
                  value={newMapNotes}
                  onChange={(e) => setNewMapNotes(e.target.value)}
                  placeholder="Lab hall mapping run"
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSaveOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmSave} disabled={!newMapName.trim() || isSaving}>
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {saveTarget === 'robot' ? 'Save on Robot' : 'Save Snapshot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renamingId !== null} onOpenChange={(open) => !open && setRenamingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Map</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setRenamingId(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmRename} disabled={!renamingName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deletingId !== null || deletingRobotMapName !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null)
            setDeletingRobotMapName(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Saved Map?</DialogTitle>
            <DialogDescription className="text-xs">
              {deletingRobotMapName
                ? `Move map "${deletingRobotMapName}" on the robot to ~/maps/.trash? (Non-destructive safe delete).`
                : "This will permanently delete this map record and thumbnail from your device's IndexedDB."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeletingId(null)
                setDeletingRobotMapName(null)
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              {deletingRobotMapName ? 'Move to Trash' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
