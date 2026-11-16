import { useEffect, useRef, useState, useCallback } from 'react'
import { Edit2, Image, MapPin, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import type { CampaignMap, MapPin as MapPinType, Entity } from '../types/electron.d'
import { EntityTypeBadge } from './ui/EntityTypeBadge'

// ---------------------------------------------------------------------------
// MapViewer
// ---------------------------------------------------------------------------

export function MapViewer() {
  const { activeCampaign } = useAppStore()
  const [mapList, setMapList] = useState<CampaignMap[]>([])
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [pins, setPins] = useState<MapPinType[]>([])
  const [creatingMap, setCreatingMap] = useState(false)
  const [newMapName, setNewMapName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const selectedMap = mapList.find(m => m.id === selectedMapId) ?? null

  const loadMaps = useCallback(async () => {
    if (!activeCampaign) return
    const list = await window.api.maps.list(activeCampaign.id)
    setMapList(list)
    if (list.length > 0 && !selectedMapId) setSelectedMapId(list[0].id)
  }, [activeCampaign, selectedMapId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMaps()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign])

  const loadPins = useCallback(async (mapId: string) => {
    const p = await window.api.maps.getPins(mapId)
    setPins(p)
  }, [])

  useEffect(() => {
    if (selectedMapId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadPins(selectedMapId)
    } else {
      Promise.resolve().then(() => setPins([]))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapId])

  // ── Create map ────────────────────────────────────────────────────────────
  const handleCreateMap = async () => {
    if (!activeCampaign || !newMapName.trim()) return
    const created = await window.api.maps.create({ campaignId: activeCampaign.id, name: newMapName.trim() })
    setMapList(prev => [...prev, created])
    setSelectedMapId(created.id)
    setCreatingMap(false)
    setNewMapName('')
    // Immediately prompt for image
    const imgPath = await window.api.maps.pickImage()
    if (imgPath) {
      const updated = await window.api.maps.update(created.id, activeCampaign.id, { imagePath: imgPath })
      setMapList(prev => prev.map(m => m.id === updated.id ? updated : m))
    }
  }

  // ── Rename map ────────────────────────────────────────────────────────────
  const startRename = (map: CampaignMap) => { setRenamingId(map.id); setRenameValue(map.name) }
  const commitRename = async () => {
    if (!activeCampaign || !renamingId || !renameValue.trim()) { setRenamingId(null); return }
    const updated = await window.api.maps.update(renamingId, activeCampaign.id, { name: renameValue.trim() })
    setMapList(prev => prev.map(m => m.id === updated.id ? updated : m))
    setRenamingId(null)
  }

  // ── Delete map ────────────────────────────────────────────────────────────
  const handleDeleteMap = async (mapId: string) => {
    if (!activeCampaign) return
    await window.api.maps.delete(mapId, activeCampaign.id)
    const next = mapList.filter(m => m.id !== mapId)
    setMapList(next)
    if (selectedMapId === mapId) setSelectedMapId(next[0]?.id ?? null)
  }

  // ── Change map image ──────────────────────────────────────────────────────
  const handlePickImage = async () => {
    if (!activeCampaign || !selectedMap) return
    const imgPath = await window.api.maps.pickImage()
    if (!imgPath) return
    const updated = await window.api.maps.update(selectedMap.id, activeCampaign.id, { imagePath: imgPath })
    setMapList(prev => prev.map(m => m.id === updated.id ? updated : m))
  }

  // ── Pin added from canvas ─────────────────────────────────────────────────
  const handlePinCreated = (pin: MapPinType) => setPins(prev => [...prev, pin])
  const handlePinDeleted = (pinId: string) => setPins(prev => prev.filter(p => p.id !== pinId))

  if (!activeCampaign) return null

  return (
    <div style={pageStyle}>
      {/* Left panel */}
      <div style={leftPanel}>
        <div style={leftHeader}>
          <span style={leftTitle}>Maps</span>
          <button
            onClick={() => setCreatingMap(true)}
            style={addBtn}
            title="New map"
          >
            <Plus size={14} />
          </button>
        </div>

        {creatingMap && (
          <div style={newMapForm}>
            <input
              autoFocus
              value={newMapName}
              onChange={e => setNewMapName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateMap(); if (e.key === 'Escape') { setCreatingMap(false); setNewMapName('') } }}
              placeholder="Map name…"
              style={inlineInput}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={handleCreateMap} disabled={!newMapName.trim()} style={confirmBtn}>Create</button>
              <button onClick={() => { setCreatingMap(false); setNewMapName('') }} style={cancelInlineBtn}>Cancel</button>
            </div>
          </div>
        )}

        <div style={mapListScroll}>
          {mapList.length === 0 && !creatingMap && (
            <p style={emptyHint}>No maps yet.<br />Click + to create one.</p>
          )}
          {mapList.map(map => (
            <MapListItem
              key={map.id}
              map={map}
              selected={map.id === selectedMapId}
              renamingId={renamingId}
              renameValue={renameValue}
              onSelect={() => setSelectedMapId(map.id)}
              onStartRename={() => startRename(map)}
              onRenameChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={() => setRenamingId(null)}
              onDelete={() => handleDeleteMap(map.id)}
            />
          ))}
        </div>
      </div>

      {/* Main canvas area */}
      <div style={mainArea}>
        {!selectedMap ? (
          <div style={emptyState}>
            <MapPin size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
              {mapList.length === 0 ? 'Create a map to get started' : 'Select a map'}
            </p>
          </div>
        ) : (
          <MapCanvas
            map={selectedMap}
            pins={pins}
            campaignId={activeCampaign.id}
            onPickImage={handlePickImage}
            onPinCreated={handlePinCreated}
            onPinDeleted={handlePinDeleted}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MapListItem
// ---------------------------------------------------------------------------

function MapListItem({
  map, selected, renamingId, renameValue,
  onSelect, onStartRename, onRenameChange, onRenameCommit, onRenameCancel, onDelete,
}: {
  map: CampaignMap; selected: boolean; renamingId: string | null; renameValue: string
  onSelect: () => void; onStartRename: () => void
  onRenameChange: (v: string) => void; onRenameCommit: () => void; onRenameCancel: () => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const isRenaming = renamingId === map.id

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (!isRenaming) onSelect() }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
        background: selected ? 'var(--bg-active)' : hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      <MapPin size={13} style={{ color: selected ? '#60a5fa' : 'var(--text-muted)', flexShrink: 0 }} />
      {isRenaming ? (
        <input
          autoFocus
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel() }}
          onBlur={onRenameCommit}
          onClick={e => e.stopPropagation()}
          style={{ ...inlineInput, flex: 1 }}
        />
      ) : (
        <span style={{
          flex: 1, fontSize: 13, fontWeight: selected ? 600 : 400,
          color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{map.name}</span>
      )}
      {hovered && !isRenaming && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onStartRename} style={iconMiniBtn} title="Rename"><Edit2 size={11} /></button>
          <button onClick={onDelete} style={{ ...iconMiniBtn, color: '#f87171' }} title="Delete"><Trash2 size={11} /></button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// MapCanvas — zoom / pan / pins
// ---------------------------------------------------------------------------

interface MapCanvasProps {
  map: CampaignMap
  pins: MapPinType[]
  campaignId: string
  onPickImage: () => void
  onPinCreated: (pin: MapPinType) => void
  onPinDeleted: (pinId: string) => void
}

function MapCanvas({ map, pins, campaignId, onPickImage, onPinCreated, onPinDeleted }: MapCanvasProps) {
  const { navigateToEntity } = useAppStore()

  // Zoom / pan state
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [addPinMode, setAddPinMode] = useState(false)
  const [activePinId, setActivePinId] = useState<string | null>(null)

  // Entity search modal
  const [searchOpen, setSearchOpen] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null)

  // Dragging
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const [isDragging, setIsDragging] = useState(false)

  // Image natural size (needed for coordinate math)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Reset view when map changes
  useEffect(() => {
    Promise.resolve().then(() => {
      setZoom(1); setPan({ x: 0, y: 0 }); setActivePinId(null); setAddPinMode(false)
    })
  }, [map.id])

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setZoom(prev => {
      const next = Math.min(8, Math.max(0.1, prev * factor))
      // Zoom toward cursor
      const rect = containerRef.current!.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setPan(p => ({
        x: cx - (cx - p.x) * (next / prev),
        y: cy - (cy - p.y) * (next / prev),
      }))
      return next
    })
  }, [])

  // ── Pan drag ──────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (addPinMode) return
    if ((e.target as HTMLElement).closest('[data-pin]')) return
    dragging.current = true
    setIsDragging(true)
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
  }, [addPinMode, pan])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    })
  }, [])

  const onMouseUp = useCallback(() => { dragging.current = false; setIsDragging(false) }, [])

  // ── Click on canvas (place pin) ───────────────────────────────────────────
  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!addPinMode) { setActivePinId(null); return }
    if ((e.target as HTMLElement).closest('[data-pin]')) return
    const img = imgRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const relX = (e.clientX - rect.left) / rect.width
    const relY = (e.clientY - rect.top) / rect.height
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return
    setPendingCoords({ x: relX, y: relY })
    setSearchOpen(true)
  }, [addPinMode])

  // ── Reset view ────────────────────────────────────────────────────────────
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // ── Pin created from modal ─────────────────────────────────────────────────
  const handleEntityChosen = async (entity: Entity) => {
    if (!pendingCoords) return
    setSearchOpen(false)
    setAddPinMode(false)
    const pin = await window.api.maps.createPin({
      mapId: map.id,
      campaignId,
      entityId: entity.id,
      x: pendingCoords.x,
      y: pendingCoords.y,
    })
    onPinCreated(pin)
    setPendingCoords(null)
    setActivePinId(pin.id)
  }

  const imageUrl = map.imagePath
    ? `campaign-media://local/${encodeURIComponent(map.imagePath)}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={toolbar}>
        <div style={{ display: 'flex', gap: 6 }}>
          <ToolBtn
            onClick={onPickImage}
            icon={<Image size={14} />}
            label={map.imagePath ? 'Change Image' : 'Set Image'}
          />
          <ToolBtn
            onClick={() => { setAddPinMode(v => !v); setActivePinId(null) }}
            icon={<MapPin size={14} />}
            label="Add Pin"
            active={addPinMode}
          />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{map.name}</span>
        <ToolBtn onClick={resetView} icon={<RotateCcw size={14} />} label="Reset View" />
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={onCanvasClick}
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          cursor: addPinMode ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          background: 'var(--bg-primary)',
          userSelect: 'none',
        }}
      >
        {!imageUrl ? (
          <div style={emptyState}>
            <Image size={36} style={{ color: 'var(--text-muted)', marginBottom: 10 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 12px' }}>No image set for this map</p>
            <button onClick={onPickImage} style={confirmBtn}>Set Image</button>
          </div>
        ) : (
          // Transform wrapper — everything inside moves/scales together
          <div
            style={{
              position: 'absolute',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Map image */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                ref={imgRef}
                src={imageUrl}
                draggable={false}
                style={{ display: 'block', maxWidth: 'none', userSelect: 'none' }}
              />

              {/* Pins rendered over image */}
              {pins.map(pin => (
                <PinMarker
                  key={pin.id}
                  pin={pin}
                  active={activePinId === pin.id}
                  addPinMode={addPinMode}
                  campaignId={campaignId}
                  onActivate={() => setActivePinId(pin.id)}
                  onDismiss={() => setActivePinId(null)}
                  onDelete={() => { onPinDeleted(pin.id); setActivePinId(null) }}
                  onNavigate={navigateToEntity}
                />
              ))}
            </div>
          </div>
        )}

        {addPinMode && imageUrl && (
          <div style={addPinBanner}>
            Click on the map to place a pin · <button onClick={() => setAddPinMode(false)} style={bannerCancelBtn}>Cancel</button>
          </div>
        )}
      </div>

      {/* Entity search modal */}
      {searchOpen && (
        <EntitySearchModal
          campaignId={campaignId}
          onChoose={handleEntityChosen}
          onCancel={() => { setSearchOpen(false); setPendingCoords(null) }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PinMarker
// ---------------------------------------------------------------------------

function PinMarker({
  pin, active, addPinMode, campaignId,
  onActivate, onDismiss, onDelete, onNavigate,
}: {
  pin: MapPinType; active: boolean; addPinMode: boolean; campaignId: string
  onActivate: () => void; onDismiss: () => void
  onDelete: () => void; onNavigate: (id: string) => void
}) {
  const [entity, setEntity] = useState<Entity | null>(null)

  useEffect(() => {
    window.api.entities.get(pin.entityId, campaignId).then(setEntity)
  }, [pin.entityId, campaignId])

  if (!entity) return null

  const typeColors: Record<string, string> = {
    npc: 'var(--npc-color)',
    location: 'var(--location-color)',
    faction: 'var(--faction-color)',
    item: 'var(--item-color)',
    monster: 'var(--monster-color)',
    player: 'var(--player-color)',
    spell: 'var(--spell-color)',
  }
  const color = typeColors[entity.type] ?? 'var(--accent)'

  const imageUrl = (entity.metadata as Record<string, string>).image
    ? `campaign-media://local/${encodeURIComponent((entity.metadata as Record<string, string>).image)}`
    : null

  return (
    <div
      data-pin="true"
      style={{
        position: 'absolute',
        left: `${pin.x * 100}%`,
        top: `${pin.y * 100}%`,
        transform: 'translate(-50%, -100%)',
        zIndex: active ? 20 : 10,
        pointerEvents: addPinMode ? 'none' : 'auto',
      }}
    >
      {/* The pin marker */}
      <div
        onClick={e => { e.stopPropagation(); if (active) { onDismiss() } else { onActivate() } }}
        title={entity.name}
        style={{
          width: 28, height: 28,
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          background: color,
          border: `2px solid ${active ? '#fff' : 'rgba(0,0,0,0.4)'}`,
          cursor: 'pointer',
          boxShadow: active ? `0 0 0 3px ${color}60, 0 2px 8px rgba(0,0,0,0.5)` : '0 2px 6px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.15s, border-color 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      />

      {/* Popup */}
      {active && (
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 220,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            padding: '12px 14px',
            zIndex: 30,
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entity.name}</div>
              <EntityTypeBadge type={entity.type} size="sm" />
            </div>
            <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
              <X size={13} />
            </button>
          </div>

          {/* Entity image */}
          {imageUrl && (
            <img
              src={imageUrl}
              style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, marginBottom: 8, border: '1px solid var(--border)' }}
            />
          )}

          {/* Description snippet */}
          {entity.description && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const,
            }}>
              {entity.description.replace(/<[^>]+>/g, '')}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onNavigate(entity.id)}
              style={{
                flex: 1, padding: '5px 8px', borderRadius: 6, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              View in World Bible
            </button>
            <button
              onClick={onDelete}
              title="Remove pin"
              style={{
                padding: '5px 7px', borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', color: '#f87171', cursor: 'pointer',
              }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EntitySearchModal
// ---------------------------------------------------------------------------

function EntitySearchModal({
  campaignId, onChoose, onCancel,
}: { campaignId: string; onChoose: (e: Entity) => void; onCancel: () => void }) {
  const [query, setQuery] = useState('')
  const [all, setAll] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.entities.list(campaignId).then(list => {
      setAll(list)
      setLoading(false)
    })
  }, [campaignId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  const filtered = query.trim()
    ? all.filter(e => e.name.toLowerCase().includes(query.toLowerCase()))
    : all

  const typeColors: Record<string, string> = {
    npc: 'var(--npc-color)', location: 'var(--location-color)', faction: 'var(--faction-color)',
    item: 'var(--item-color)', monster: 'var(--monster-color)', player: 'var(--player-color)', spell: 'var(--spell-color)',
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}
    >
      <div style={{ width: 460, maxHeight: '70vh', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search entities…"
            style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No entities found</p>
          )}
          {filtered.map(entity => (
            <button
              key={entity.id}
              onClick={() => onChoose(entity)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: typeColors[entity.type] ?? 'var(--accent)',
              }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{entity.name}</span>
              <EntityTypeBadge type={entity.type} size="sm" />
            </button>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={cancelInlineBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function ToolBtn({ onClick, icon, label, active }: { onClick: () => void; icon: React.ReactNode; label: string; active?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer',
        border: active ? 'none' : '1px solid var(--border)',
        background: active ? 'var(--accent)' : hovered ? 'var(--bg-hover)' : 'var(--bg-tertiary)',
        color: active ? '#fff' : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'all 0.12s',
      }}
    >
      {icon}{label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageStyle: React.CSSProperties = {
  flex: 1, display: 'flex', height: '100%', overflow: 'hidden',
}

const leftPanel: React.CSSProperties = {
  width: 220, minWidth: 220, flexShrink: 0,
  borderRight: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}

const leftHeader: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 14px 10px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const leftTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
}

const addBtn: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const mapListScroll: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '6px 6px',
}

const newMapForm: React.CSSProperties = {
  padding: '8px 10px', borderBottom: '1px solid var(--border)',
  display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0,
}

const inlineInput: React.CSSProperties = {
  width: '100%', padding: '5px 8px',
  background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
  boxSizing: 'border-box',
}

const confirmBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: 'none',
  background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
}

const cancelInlineBtn: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
}

const iconMiniBtn: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 4, border: 'none',
  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const emptyHint: React.CSSProperties = {
  fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
  padding: '20px 12px', lineHeight: 1.6, margin: 0,
}

const mainArea: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
}

const toolbar: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 14px', borderBottom: '1px solid var(--border)',
  background: 'var(--bg-secondary)', flexShrink: 0, gap: 10,
}

const emptyState: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', height: '100%',
}

const addPinBanner: React.CSSProperties = {
  position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(96,165,250,0.15)', border: '1px solid #60a5fa55',
  borderRadius: 20, padding: '6px 16px', fontSize: 12, color: '#93c5fd',
  pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 50,
}

const bannerCancelBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#93c5fd', cursor: 'pointer',
  fontSize: 12, fontWeight: 600, padding: 0, pointerEvents: 'auto',
}
