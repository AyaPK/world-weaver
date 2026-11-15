import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Dices, Heart, ListOrdered, Minus, Play, Plus, Search, Shield,
  Skull, Square, Swords, Trash2, User, Users, X,
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useCombatStore } from '../store/useCombatStore'
import type { Encounter, Entity, MonsterMetadata, PlayerMetadata } from '../types/electron.d'
import {
  EMPTY_COMBAT, addEnemies, applyHpChange, displayName, endCombat, formatModifier, isDefeated,
  monsterInitiativeBonus, nextTurn, previousTurn, removeCombatant, rollInitiative, sortByInitiative,
  startCombat,
} from '../utils/combatUtils'
import type { Combatant, CombatState } from '../utils/combatUtils'
import { ActionBlock, MonsterStatBlock } from './ui/MonsterStatBlock'
import { statLine } from './ui/statBlockStyles'

// ---------------------------------------------------------------------------
// Combatant factories
// ---------------------------------------------------------------------------

function playerToCombatant(entity: Entity): Combatant {
  const m = entity.metadata as unknown as PlayerMetadata
  const subtitle = [m.race, m.playerClass, m.level ? `Lv ${m.level}` : null].filter(Boolean).join(' · ')
  return {
    id: crypto.randomUUID(),
    kind: 'player',
    baseName: entity.name,
    number: null,
    entityId: entity.id,
    initiative: null,
    initiativeBonus: m.initiativeBonus ?? 0,
    ac: m.armorClass ?? null,
    maxHp: m.hitPoints ?? null,
    currentHp: m.hitPoints ?? null,
    cr: null,
    subtitle: subtitle || null,
    monster: null,
  }
}

function monsterToCombatant(entity: Entity): Combatant {
  const m = entity.metadata as unknown as MonsterMetadata
  const bonus = monsterInitiativeBonus(m)
  return {
    id: crypto.randomUUID(),
    kind: 'enemy',
    baseName: entity.name,
    number: null,
    entityId: entity.id,
    initiative: rollInitiative(bonus),
    initiativeBonus: bonus,
    ac: m.armorClass ?? null,
    maxHp: m.hitPoints ?? null,
    currentHp: m.hitPoints ?? null,
    cr: m.challengeRating ?? null,
    subtitle: [m.size, m.monsterType].filter(Boolean).join(' ') || null,
    monster: m,
  }
}

function customEnemy(data: { name: string; cr?: string; ac: number | null; hp: number | null; initiativeBonus: number }): Combatant {
  return {
    id: crypto.randomUUID(),
    kind: 'enemy',
    baseName: data.name,
    number: null,
    entityId: null,
    initiative: rollInitiative(data.initiativeBonus),
    initiativeBonus: data.initiativeBonus,
    ac: data.ac,
    maxHp: data.hp,
    currentHp: data.hp,
    cr: data.cr ?? null,
    subtitle: 'Custom enemy',
    monster: null,
  }
}

function parseIntOrNull(v: string): number | null {
  const n = parseInt(v, 10)
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Small inputs
// ---------------------------------------------------------------------------

function NumberInput({
  value,
  onCommit,
  width = 48,
  placeholder = '—',
  title,
  highlight,
}: {
  value: number | null
  onCommit: (v: number | null) => void
  width?: number
  placeholder?: string
  title?: string
  highlight?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = () => {
    if (draft == null) return
    const next = parseIntOrNull(draft)
    if (next !== value) onCommit(next)
    setDraft(null)
  }

  return (
    <input
      value={draft ?? value?.toString() ?? ''}
      title={title}
      inputMode="numeric"
      placeholder={placeholder}
      onClick={(e) => e.stopPropagation()}
      onFocus={(e) => { setDraft(value?.toString() ?? ''); e.target.select() }}
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9-]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(null); e.currentTarget.blur() }
      }}
      style={{
        ...numberField,
        width,
        borderColor: highlight ? 'var(--warning)' : 'var(--border)',
      }}
    />
  )
}

function HpControl({ combatant, onChange }: { combatant: Combatant; onChange: (patch: Partial<Combatant>) => void }) {
  const [amount, setAmount] = useState('')
  const { currentHp, maxHp } = combatant
  const pct = currentHp != null && maxHp ? Math.max(0, Math.min(1, currentHp / maxHp)) : null
  const barColor = pct == null ? 'var(--border)' : pct > 0.5 ? 'var(--success)' : pct > 0 ? 'var(--warning)' : 'var(--danger)'

  const apply = (sign: 1 | -1) => {
    const n = parseIntOrNull(amount)
    if (n == null || n <= 0) return
    onChange(applyHpChange(combatant, sign * n))
    setAmount('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Heart size={13} style={{ color: barColor, flexShrink: 0 }} />
        <NumberInput
          value={currentHp}
          title="Current HP"
          onCommit={(v) => onChange({ currentHp: v == null ? null : Math.max(0, v) })}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>/</span>
        <NumberInput
          value={maxHp}
          title="Max HP"
          onCommit={(v) => onChange({ maxHp: v, currentHp: currentHp ?? v })}
        />
        <input
          value={amount}
          inputMode="numeric"
          placeholder="Amt"
          title="Amount to damage or heal"
          disabled={currentHp == null}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') apply(-1) }}
          style={{ ...numberField, width: 52, marginLeft: 6 }}
        />
        <button title="Damage (Enter)" disabled={currentHp == null} onClick={() => apply(-1)} style={hpBtn('var(--danger)')}>
          <Minus size={13} />
        </button>
        <button title="Heal" disabled={currentHp == null} onClick={() => apply(1)} style={hpBtn('var(--success)')}>
          <Plus size={13} />
        </button>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-hover)', overflow: 'hidden', marginLeft: 19, marginRight: 64 }}>
        <div style={{ width: `${(pct ?? 0) * 100}%`, height: '100%', background: barColor, transition: 'width 0.2s, background 0.2s' }} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Initiative row
// ---------------------------------------------------------------------------

function CombatantRow({
  combatant,
  active,
  selected,
  onSelect,
  onChange,
  onRemove,
}: {
  combatant: Combatant
  active: boolean
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<Combatant>) => void
  onRemove: () => void
}) {
  const defeated = isDefeated(combatant)
  const isPlayer = combatant.kind === 'player'
  const color = isPlayer ? 'var(--player-color)' : 'var(--monster-color)'
  const down = combatant.currentHp != null && combatant.currentHp <= 0
  const bloodied = !down && combatant.currentHp != null && combatant.maxHp != null && combatant.currentHp <= combatant.maxHp / 2

  return (
    <div
      onClick={onSelect}
      style={{
        ...rowGrid,
        padding: '10px 14px',
        marginBottom: 6,
        borderRadius: 8,
        cursor: 'pointer',
        background: active ? 'rgba(251, 146, 60, 0.10)' : selected ? 'var(--bg-hover)' : 'var(--bg-secondary)',
        border: `1px solid ${active ? '#fb923c' : selected ? 'var(--border-light)' : 'var(--border)'}`,
        opacity: defeated ? 0.45 : 1,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Initiative */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
        <NumberInput
          value={combatant.initiative}
          title={`Initiative (${formatModifier(combatant.initiativeBonus)})`}
          highlight={combatant.initiative == null}
          onCommit={(v) => onChange({ initiative: v })}
        />
        {!isPlayer && (
          <button
            title={`Reroll initiative (d20 ${formatModifier(combatant.initiativeBonus)})`}
            onClick={() => onChange({ initiative: rollInitiative(combatant.initiativeBonus) })}
            style={iconBtn}
          >
            <Dices size={14} />
          </button>
        )}
      </div>

      {/* Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {active ? (
          <Play size={14} style={{ color: '#fb923c', flexShrink: 0 }} fill="#fb923c" />
        ) : defeated ? (
          <Skull size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        ) : isPlayer ? (
          <User size={14} style={{ color, flexShrink: 0 }} />
        ) : (
          <Swords size={14} style={{ color, flexShrink: 0 }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: defeated ? 'line-through' : 'none' }}>
              {displayName(combatant)}
            </span>
            {down && <span style={tag('var(--danger)')}>{isPlayer ? 'Down' : 'Defeated'}</span>}
            {bloodied && <span style={tag('var(--warning)')}>Bloodied</span>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[combatant.cr ? `CR ${combatant.cr}` : null, combatant.subtitle].filter(Boolean).join(' · ') || (isPlayer ? 'Player' : 'Enemy')}
          </div>
        </div>
      </div>

      {/* AC */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
        <Shield size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <NumberInput value={combatant.ac} title="Armour Class" width={42} onCommit={(v) => onChange({ ac: v })} />
      </div>

      {/* HP */}
      <HpControl combatant={combatant} onChange={onChange} />

      <button
        title="Remove from combat"
        onClick={(e) => { e.stopPropagation(); onRemove() }}
        style={iconBtn}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

function DetailPanel({ combatant, acting }: { combatant: Combatant | null; acting: boolean }) {
  const [showFull, setShowFull] = useState(false)

  if (!combatant) {
    return (
      <div style={{ ...panelWrap, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 24 }}>
        Select a combatant to see their details.
      </div>
    )
  }

  const m = combatant.monster
  const chips: { label: string; value: string }[] = [
    { label: 'AC', value: combatant.ac?.toString() ?? '—' },
    { label: 'HP', value: combatant.currentHp != null ? `${combatant.currentHp}${combatant.maxHp != null ? ` / ${combatant.maxHp}` : ''}` : '—' },
    { label: 'Init', value: combatant.initiative?.toString() ?? '—' },
  ]
  if (m?.speed) chips.push({ label: 'Speed', value: m.speed })

  return (
    <div style={panelWrap}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: acting ? '#fb923c' : 'var(--text-muted)' }}>
          {acting ? 'Now acting' : 'Selected'}
        </div>
        <h2 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700 }}>{displayName(combatant)}</h2>
        {combatant.subtitle && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{combatant.subtitle}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {chips.map((c) => (
            <span key={c.label} style={chip}>
              <span style={{ color: 'var(--text-muted)' }}>{c.label}</span> {c.value}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 18px' }}>
        {combatant.kind === 'player' ? (
          <p style={{ ...statLine, marginTop: 12 }}>
            Player character. Initiative bonus {formatModifier(combatant.initiativeBonus)}.
          </p>
        ) : !m ? (
          <p style={{ ...statLine, marginTop: 12 }}>
            No stat block linked. Add this monster to the World Bible to see its actions here.
          </p>
        ) : showFull ? (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowFull(false)} style={{ ...linkBtn, marginBottom: 10 }}>Show actions only</button>
            <MonsterStatBlock monster={m} />
          </div>
        ) : (
          <>
            <ActionBlock title="Actions" actions={m.actions ?? []} />
            <ActionBlock title="Reactions" actions={m.reactions ?? []} />
            <ActionBlock title="Legendary Actions" actions={m.legendaryActions ?? []} />
            <ActionBlock title="Special Abilities" actions={m.specialAbilities ?? []} />
            {!m.actions?.length && !m.reactions?.length && !m.legendaryActions?.length && !m.specialAbilities?.length && (
              <p style={{ ...statLine, marginTop: 12 }}>This monster has no actions recorded.</p>
            )}
            <button onClick={() => setShowFull(true)} style={linkBtn}>Show full stat block</button>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function ModalShell({ title, width = 460, onClose, children }: { title: string; width?: number; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={{ ...modalBox, width }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={iconBtn}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ImportPlayersModal({
  campaignId,
  existingEntityIds,
  onImport,
  onClose,
}: {
  campaignId: string
  existingEntityIds: Set<string>
  onImport: (players: Entity[]) => void
  onClose: () => void
}) {
  const [players, setPlayers] = useState<Entity[] | null>(null)
  const [picked, setPicked] = useState<Set<string> | null>(null)
  const selected = picked ?? new Set((players ?? []).filter((p) => !existingEntityIds.has(p.id)).map((p) => p.id))

  useEffect(() => {
    window.api.entities.list(campaignId, { type: 'player' }).then(setPlayers)
  }, [campaignId])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  return (
    <ModalShell title="Import Players" onClose={onClose}>
      <div style={listBox}>
        {players?.length === 0 && (
          <div style={emptyListMsg}>No players in the World Bible yet.</div>
        )}
        {players?.map((p) => {
          const already = existingEntityIds.has(p.id)
          const m = p.metadata as unknown as PlayerMetadata
          return (
            <label key={p.id} style={{ ...listRow, cursor: already ? 'default' : 'pointer', opacity: already ? 0.5 : 1 }}>
              <input type="checkbox" disabled={already} checked={selected.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 'auto', padding: 0 }} />
              <User size={14} style={{ color: 'var(--player-color)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{p.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {already ? 'In combat' : [m.armorClass != null ? `AC ${m.armorClass}` : null, m.hitPoints != null ? `HP ${m.hitPoints}` : null].filter(Boolean).join(' · ')}
              </span>
            </label>
          )
        })}
      </div>
      <div style={modalFooter}>
        <button onClick={onClose} style={secondaryBtn}>Cancel</button>
        <button
          disabled={selected.size === 0}
          onClick={() => onImport((players ?? []).filter((p) => selected.has(p.id)))}
          style={{ ...primaryBtn, opacity: selected.size ? 1 : 0.4 }}
        >
          Add {selected.size || ''} {selected.size === 1 ? 'Player' : 'Players'}
        </button>
      </div>
    </ModalShell>
  )
}

function ImportEncounterModal({
  campaignId,
  onImport,
  onClose,
}: {
  campaignId: string
  onImport: (enemies: Combatant[]) => void
  onClose: () => void
}) {
  const [encounters, setEncounters] = useState<Encounter[] | null>(null)
  const [monsters, setMonsters] = useState<Entity[]>([])

  useEffect(() => {
    window.api.encounters.list(campaignId).then(setEncounters)
    window.api.entities.list(campaignId, { type: 'monster' }).then(setMonsters)
  }, [campaignId])

  const importEncounter = (enc: Encounter) => {
    const byName = new Map(monsters.map((m) => [m.name.toLowerCase(), m]))
    const enemies: Combatant[] = []
    for (const group of enc.groups) {
      for (const entry of group.entries) {
        const monster = byName.get(entry.name.toLowerCase())
        for (let i = 0; i < entry.count; i++) {
          enemies.push(
            monster
              ? { ...monsterToCombatant(monster), baseName: entry.name }
              : customEnemy({ name: entry.name, cr: entry.cr, ac: null, hp: null, initiativeBonus: 0 }),
          )
        }
      }
    }
    onImport(enemies)
  }

  return (
    <ModalShell title="Import Encounter" onClose={onClose}>
      <div style={listBox}>
        {encounters?.length === 0 && (
          <div style={emptyListMsg}>No encounters yet. Build one in the Encounter Builder.</div>
        )}
        {encounters?.map((enc) => {
          const total = enc.groups.reduce((sum, g) => sum + g.entries.reduce((s, e) => s + e.count, 0), 0)
          return (
            <button key={enc.id} disabled={total === 0} onClick={() => importEncounter(enc)} style={{ ...listRow, ...hoverRow, opacity: total ? 1 : 0.5 }}>
              <Swords size={14} style={{ color: 'var(--monster-color)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{enc.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{total} {total === 1 ? 'enemy' : 'enemies'}</span>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
        Enemies are matched to World Bible monsters by name for their stats. Initiative is rolled for each enemy.
      </p>
    </ModalShell>
  )
}

function AddEnemyModal({
  campaignId,
  onAdd,
  onClose,
}: {
  campaignId: string
  onAdd: (enemies: Combatant[]) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'entities' | 'custom'>('entities')
  const [monsters, setMonsters] = useState<Entity[]>([])
  const [search, setSearch] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [name, setName] = useState('')
  const [ac, setAc] = useState('')
  const [hp, setHp] = useState('')
  const [bonus, setBonus] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.entities.list(campaignId, { type: 'monster' }).then(setMonsters)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [campaignId])

  const filtered = monsters.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
  const times = <T,>(make: () => T) => Array.from({ length: quantity }, make)

  const addCustom = () => {
    if (!name.trim()) return
    onAdd(times(() => customEnemy({ name: name.trim(), ac: parseIntOrNull(ac), hp: parseIntOrNull(hp), initiativeBonus: parseIntOrNull(bonus) ?? 0 })))
  }

  return (
    <ModalShell title="Add Enemy" onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        {(['entities', 'custom'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
            {t === 'entities' ? 'From World Bible' : 'Custom Enemy'}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Qty</span>
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} style={stepBtn}>−</button>
          <span style={{ minWidth: 18, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{quantity}</span>
          <button onClick={() => setQuantity(Math.min(20, quantity + 1))} style={stepBtn}>+</button>
        </div>
      </div>

      {tab === 'entities' ? (
        <>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search monsters..." style={{ ...textInput, paddingLeft: 32 }} />
          </div>
          <div style={listBox}>
            {filtered.length === 0 && (
              <div style={emptyListMsg}>
                {monsters.length === 0 ? 'No monsters in the World Bible yet. Use Custom Enemy instead.' : 'No monsters match your search.'}
              </div>
            )}
            {filtered.map((m) => {
              const meta = m.metadata as unknown as MonsterMetadata
              return (
                <button key={m.id} onClick={() => onAdd(times(() => monsterToCombatant(m)))} style={{ ...listRow, ...hoverRow }}>
                  <Skull size={14} style={{ color: 'var(--monster-color)', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{m.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {[meta.challengeRating ? `CR ${meta.challengeRating}` : null, meta.armorClass != null ? `AC ${meta.armorClass}` : null, meta.hitPoints != null ? `HP ${meta.hitPoints}` : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <label style={fieldLabel}>Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }} placeholder="Bandit captain..." style={textInput} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
            <div>
              <label style={fieldLabel}>AC</label>
              <input value={ac} inputMode="numeric" onChange={(e) => setAc(e.target.value.replace(/[^0-9]/g, ''))} placeholder="13" style={textInput} />
            </div>
            <div>
              <label style={fieldLabel}>HP</label>
              <input value={hp} inputMode="numeric" onChange={(e) => setHp(e.target.value.replace(/[^0-9]/g, ''))} placeholder="22" style={textInput} />
            </div>
            <div>
              <label style={fieldLabel}>Init Bonus</label>
              <input value={bonus} inputMode="numeric" onChange={(e) => setBonus(e.target.value.replace(/[^0-9-]/g, ''))} placeholder="+2" style={textInput} />
            </div>
          </div>
          <div style={modalFooter}>
            <button onClick={onClose} style={secondaryBtn}>Cancel</button>
            <button disabled={!name.trim()} onClick={addCustom} style={{ ...primaryBtn, opacity: name.trim() ? 1 : 0.4 }}>Add</button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function CombatTracker() {
  const { activeCampaign } = useAppStore()
  const campaignId = activeCampaign?.id ?? ''
  const combat = useCombatStore((s) => s.byCampaign[campaignId]) ?? EMPTY_COMBAT
  const updateCombat = useCombatStore((s) => s.updateCombat)
  const resetCombat = useCombatStore((s) => s.resetCombat)
  // A manual selection only lasts until the turn changes, then the panel follows the acting combatant.
  const [selection, setSelection] = useState<{ id: string; turnOf: string | null } | null>(null)
  const [modal, setModal] = useState<'players' | 'encounter' | 'enemy' | null>(null)

  const order = useMemo(() => sortByInitiative(combat.combatants), [combat.combatants])
  const update = (fn: (s: CombatState) => CombatState) => updateCombat(campaignId, fn)

  if (!activeCampaign) return null

  const patchCombatant = (id: string, patch: Partial<Combatant>) =>
    update((s) => ({ ...s, combatants: s.combatants.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))

  const addPlayers = (players: Entity[]) => {
    update((s) => ({ ...s, combatants: [...s.combatants, ...players.map(playerToCombatant)] }))
    setModal(null)
  }

  const addEnemyCombatants = (enemies: Combatant[]) => {
    update((s) => ({ ...s, combatants: addEnemies(s.combatants, enemies) }))
    setModal(null)
  }

  const rerollEnemies = () =>
    update((s) => ({
      ...s,
      combatants: s.combatants.map((c) => (c.kind === 'enemy' ? { ...c, initiative: rollInitiative(c.initiativeBonus) } : c)),
    }))

  const handleStart = () => {
    const missing = combat.combatants.filter((c) => c.initiative == null)
    if (missing.length && !confirm(`${missing.map(displayName).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no initiative yet. Start combat anyway?`)) return
    update(startCombat)
  }

  const handleClear = () => {
    if (!confirm('Remove everyone from the combat tracker?')) return
    resetCombat(campaignId)
    setSelection(null)
  }

  const viewedId = selection && selection.turnOf === combat.activeId ? selection.id : combat.activeId
  const viewed = combat.combatants.find((c) => c.id === viewedId) ?? null
  const activeCombatant = combat.combatants.find((c) => c.id === combat.activeId)
  const existingPlayerIds = new Set(combat.combatants.map((c) => c.entityId).filter((id): id is string => !!id))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ListOrdered size={20} style={{ color: '#fb923c' }} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Combat Tracker</h1>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 4 }}>· {activeCampaign.name}</span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {combat.started ? (
            <>
              <span style={roundBadge}>Round {combat.round}</span>
              {activeCombatant && (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', marginRight: 4 }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{displayName(activeCombatant)}</strong>'s turn
                </span>
              )}
              <button title="Previous turn" onClick={() => update(previousTurn)} style={secondaryBtn}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button title="Next turn" onClick={() => update(nextTurn)} style={{ ...primaryBtn, background: '#fb923c' }}>
                Next Turn <ChevronRight size={14} />
              </button>
              <button title="End combat" onClick={() => update(endCombat)} style={secondaryBtn}>
                <Square size={12} /> End
              </button>
            </>
          ) : (
            <button disabled={combat.combatants.length === 0} onClick={handleStart} style={{ ...primaryBtn, background: '#fb923c', opacity: combat.combatants.length ? 1 : 0.4 }}>
              <Play size={14} /> Start Combat
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button onClick={() => setModal('players')} style={secondaryBtn}><Users size={14} /> Import Players</button>
        <button onClick={() => setModal('encounter')} style={secondaryBtn}><Swords size={14} /> Import Encounter</button>
        <button onClick={() => setModal('enemy')} style={secondaryBtn}><Skull size={14} /> Add Enemy</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button disabled={!combat.combatants.some((c) => c.kind === 'enemy')} onClick={rerollEnemies} style={secondaryBtn}>
            <Dices size={14} /> Reroll Enemy Initiative
          </button>
          <button disabled={combat.combatants.length === 0} onClick={handleClear} style={secondaryBtn}>
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          {order.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
              <ListOrdered size={40} style={{ opacity: 0.2 }} />
              <p style={{ margin: 0, fontSize: 14 }}>Import players, an encounter or enemies to get started</p>
            </div>
          ) : (
            <>
              <div style={{ ...rowGrid, padding: '0 15px 8px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                <span>Init</span>
                <span>Combatant</span>
                <span>AC</span>
                <span>Hit Points</span>
                <span />
              </div>
              {order.map((c) => (
                <CombatantRow
                  key={c.id}
                  combatant={c}
                  active={combat.started && c.id === combat.activeId}
                  selected={c.id === viewedId}
                  onSelect={() => setSelection({ id: c.id, turnOf: combat.activeId })}
                  onChange={(patch) => patchCombatant(c.id, patch)}
                  onRemove={() => update((s) => removeCombatant(s, c.id))}
                />
              ))}
            </>
          )}
        </div>

        <DetailPanel key={viewed?.id ?? 'none'} combatant={viewed} acting={combat.started && viewed?.id === combat.activeId} />
      </div>

      {modal === 'players' && (
        <ImportPlayersModal campaignId={campaignId} existingEntityIds={existingPlayerIds} onImport={addPlayers} onClose={() => setModal(null)} />
      )}
      {modal === 'encounter' && (
        <ImportEncounterModal campaignId={campaignId} onImport={addEnemyCombatants} onClose={() => setModal(null)} />
      )}
      {modal === 'enemy' && (
        <AddEnemyModal campaignId={campaignId} onAdd={addEnemyCombatants} onClose={() => setModal(null)} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const rowGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '92px minmax(140px, 1fr) 80px 300px 28px',
  alignItems: 'center',
  gap: 12,
}

const numberField: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  background: 'var(--bg-tertiary)',
  borderRadius: 5,
}

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const hpBtn = (color: string): React.CSSProperties => ({
  width: 26,
  height: 26,
  borderRadius: 5,
  border: `1px solid ${color}55`,
  background: `${color}14`,
  color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
})

const tag = (color: string): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color,
  border: `1px solid ${color}55`,
  borderRadius: 4,
  padding: '0 5px',
  flexShrink: 0,
})

const panelWrap: React.CSSProperties = {
  width: 400,
  flexShrink: 0,
  borderLeft: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const chip: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-primary)',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '2px 8px',
}

const linkBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  fontSize: 12,
  padding: 0,
  cursor: 'pointer',
}

const roundBadge: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#fb923c',
  border: '1px solid #fb923c55',
  background: '#fb923c14',
  borderRadius: 20,
  padding: '4px 10px',
}

const secondaryBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: 13,
  cursor: 'pointer',
}

const primaryBtn: React.CSSProperties = {
  ...secondaryBtn,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontWeight: 600,
}

const stepBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg-hover)',
  color: 'var(--text-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 14,
  lineHeight: 1,
  padding: 0,
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
  fontWeight: active ? 600 : 400,
  fontSize: 13,
  padding: '6px 14px 10px',
  cursor: 'pointer',
  marginBottom: -1,
})

const listBox: React.CSSProperties = {
  maxHeight: 300,
  overflowY: 'auto',
  borderRadius: 6,
  border: '1px solid var(--border)',
}

const listRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '9px 12px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  textAlign: 'left',
}

const hoverRow: React.CSSProperties = {
  cursor: 'pointer',
}

const emptyListMsg: React.CSSProperties = {
  padding: '20px 16px',
  textAlign: 'center',
  color: 'var(--text-muted)',
  fontSize: 13,
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
}

const modalBox: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-light)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
}

const modalFooter: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
  marginTop: 20,
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}

const textInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text-primary)',
  fontSize: 14,
  boxSizing: 'border-box',
}
