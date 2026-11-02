/**
 * JetRacer Control Center — Local Map Library Panel (Phase 7A)
 *
 * Provides map snapshot creation, PGM+YAML export and import, local IndexedDB library list,
 * viewer loading, rename, and delete actions with mobile-friendly cards and location badges.
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
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  const [isLoading, setIsLoading] = useState(false)
  const [storageInfo, setStorageInfo] = useState<{ usedBytes: number; quotaBytes: number; isAvailable: boolean }>({
    usedBytes: 0,
    quotaBytes: 0,
    isAvailable: false,
  })

  // Save Snapshot Dialog State
  const [isSaveOpen, setIsSaveOpen] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [newMapNotes, setNewMapNotes] = useState('')

  // Rename Dialog State
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renamingName, setRenamingName] = useState('')

  // Delete Confirm Dialog State
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // File Import Refs
  const pgmInputRef = useRef<HTMLInputElement>(null)
  const yamlInputRef = useRef<HTMLInputElement>(null)
  const [pendingPgmBytes, setPendingPgmBytes] = useState<Uint8Array | null>(null)

  const loadMaps = async () => {
    setIsLoading(true)
    try {
      const list = await localMapLibrary.listMaps()
      setMaps(list)
      const storage = await localMapLibrary.getStorageUsage()
      setStorageInfo(storage)
    } catch (err) {
      console.warn('[MapLibraryPanel] Failed to load local maps:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true
    localMapLibrary.listMaps().then((list) => {
      if (!isMounted) return
      setMaps(list)
      localMapLibrary.getStorageUsage().then((storage) => {
        if (!isMounted) return
        setStorageInfo(storage)
      }).catch(() => {})
    }).catch(() => {})

    return () => {
      isMounted = false
    }
  }, [])

  const handleOpenSave = () => {
    if (!currentMap) {
      toast.error('No active map to save. Start SLAM or fetch a snapshot first.')
      return
    }
    const defaultName = `map_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${Date.now().toString().slice(-4)}`
    setNewMapName(defaultName)
    setNewMapNotes('')
    setIsSaveOpen(true)
  }

  const handleConfirmSave = async () => {
    if (!currentMap || !newMapName.trim()) return
    try {
      const record = await localMapLibrary.saveMap(
        currentMap,
        newMapName.trim(),
        newMapNotes.trim() || undefined,
        'device_snapshot',
      )
      toast.success(`Saved map "${record.name}" to this device.`)
      setIsSaveOpen(false)
      loadMaps()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to save map: ${msg}`)
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
      toast.error(`Failed to export map: ${msg}`)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingId) return
    try {
      await localMapLibrary.deleteMap(deletingId)
      toast.success('Map deleted from device storage.')
      setDeletingId(null)
      loadMaps()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Delete failed: ${msg}`)
    }
  }

  const handleConfirmRename = async () => {
    if (!renamingId || !renamingName.trim()) return
    try {
      await localMapLibrary.renameMap(renamingId, renamingName.trim())
      toast.success('Map renamed.')
      setRenamingId(null)
      loadMaps()
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
    // Trigger YAML picker
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
        loadMaps()
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
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <Button
            size="sm"
            className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={handleOpenSave}
            disabled={!currentMap}
          >
            <Plus className="h-3.5 w-3.5" />
            Save Snapshot
          </Button>

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

      {/* 2. Saved Maps List */}
      <Card className="bg-card/70 border-border/60">
        <CardHeader className="pb-2.5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Saved Maps Library
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              {maps.length} saved
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Stored locally in IndexedDB on this device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-zinc-500 text-center py-4">Loading library...</p>
          ) : maps.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 space-y-1">
              <FolderOpen className="h-8 w-8 mx-auto opacity-40 mb-2" />
              <p className="font-medium text-xs">No saved maps on this device.</p>
              <p className="text-[11px] text-zinc-600">
                Click "Save Snapshot" while viewing a live map or import PGM+YAML.
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

                    {/* Metadata & Actions */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-200 truncate block text-xs">
                          {m.name}
                        </span>
                        <Badge
                          variant={m.source === 'device_snapshot' ? 'default' : 'secondary'}
                          className="text-[9px] font-mono shrink-0 ml-1"
                        >
                          On this device
                        </Badge>
                      </div>

                      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-2">
                        <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{m.width}×{m.height}</span>
                        <span>•</span>
                        <span>{m.metrics.areaSquareMeters.toFixed(0)} m²</span>
                        <span>•</span>
                        <span>{(m.resolution * 100).toFixed(0)}cm/cell</span>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                        <Button
                          variant={isCurrentlyActive ? 'secondary' : 'default'}
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => {
                            const decoded: DecodedOccupancyGrid = {
                              header: { seq: 0, timestampMs: new Date(m.createdAt).getTime(), frameId: m.frameId },
                              info: { width: m.width, height: m.height, resolution: m.resolution, origin: m.origin, originQuat: { x: 0, y: 0, z: Math.sin(m.origin.yawRad / 2), w: Math.cos(m.origin.yawRad / 2) } },
                              data: m.data,
                              metrics: m.metrics,
                              warnings: [],
                            }
                            onLoadMapToViewer(decoded, m.name)
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          {isCurrentlyActive ? 'Viewing' : 'View'}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2 gap-1"
                          onClick={() => handleExport(m)}
                          title="Export PGM + YAML"
                        >
                          <Download className="h-3 w-3" />
                          Export
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1.5 text-zinc-400 hover:text-white"
                          onClick={() => {
                            setRenamingId(m.id)
                            setRenamingName(m.name)
                          }}
                          title="Rename"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-1.5 text-rose-400 hover:text-rose-300"
                          onClick={() => setDeletingId(m.id)}
                          title="Delete"
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

          {/* Storage Quota Footer */}
          {storageInfo.isAvailable && storageInfo.quotaBytes > 0 && (
            <div className="pt-2 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Device Storage:</span>
              <span className="font-mono">
                {(storageInfo.usedBytes / (1024 * 1024)).toFixed(1)} MB / {(storageInfo.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Map Dialog */}
      <Dialog open={isSaveOpen} onOpenChange={setIsSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save Map Snapshot</DialogTitle>
            <DialogDescription className="text-xs">
              Saves the current occupancy grid and metric metadata locally on this device.
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
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-zinc-300">Notes (Optional)</label>
              <Input
                value={newMapNotes}
                onChange={(e) => setNewMapNotes(e.target.value)}
                placeholder="Lab hall mapping run"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSaveOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmSave} disabled={!newMapName.trim()}>
              Save Snapshot
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
      <Dialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Saved Map?</DialogTitle>
            <DialogDescription className="text-xs">
              This will permanently delete this map record and thumbnail from your device's IndexedDB.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
