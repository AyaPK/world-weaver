import type { MonsterMetadata } from '../types/electron.d'

export type CombatantKind = 'player' | 'enemy'

export interface Combatant {
  id: string
  kind: CombatantKind
  baseName: string
  number: number | null
  entityId: string | null
  initiative: number | null
  initiativeBonus: number
  ac: number | null
  maxHp: number | null
  currentHp: number | null
  cr: string | null
  subtitle: string | null
  monster: MonsterMetadata | null
}

export interface CombatState {
  combatants: Combatant[]
  started: boolean
  round: number
  activeId: string | null
}

export const EMPTY_COMBAT: CombatState = { combatants: [], started: false, round: 0, activeId: null }

export function abilityModifier(score: number | null | undefined): number {
  if (score == null) return 0
  return Math.floor((score - 10) / 2)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}

export function rollD20(rng: () => number = Math.random): number {
  return Math.floor(rng() * 20) + 1
}

export function rollInitiative(bonus: number, rng: () => number = Math.random): number {
  return rollD20(rng) + bonus
}

export function displayName(c: Pick<Combatant, 'baseName' | 'number'>): string {
  return c.number != null ? `${c.baseName} ${c.number}` : c.baseName
}

export function isDefeated(c: Combatant): boolean {
  return c.kind === 'enemy' && c.currentHp != null && c.currentHp <= 0
}

/** Highest initiative first; ties go to the higher bonus, then insertion order. */
export function sortByInitiative(combatants: Combatant[]): Combatant[] {
  return [...combatants].sort((a, b) => {
    if (a.initiative == null && b.initiative == null) return 0
    if (a.initiative == null) return 1
    if (b.initiative == null) return -1
    if (b.initiative !== a.initiative) return b.initiative - a.initiative
    return b.initiativeBonus - a.initiativeBonus
  })
}

/**
 * Adds enemies, numbering any that share a name with each other or with existing enemies
 * (e.g. "Goblin 1", "Goblin 2"). Existing numbers are never changed except to number a
 * previously lone, unnumbered enemy as 1.
 */
export function addEnemies(existing: Combatant[], incoming: Combatant[]): Combatant[] {
  const result = [...existing]
  for (const enemy of incoming) {
    const key = enemy.baseName.toLowerCase()
    const sameName = result.filter((c) => c.kind === 'enemy' && c.baseName.toLowerCase() === key)
    const pendingSameName = incoming.filter((c) => c.baseName.toLowerCase() === key).length
    if (sameName.length === 0) {
      result.push({ ...enemy, number: pendingSameName > 1 ? 1 : null })
      continue
    }
    const lone = sameName.find((c) => c.number == null)
    if (lone) {
      const idx = result.indexOf(lone)
      result[idx] = { ...lone, number: 1 }
    }
    const maxNumber = Math.max(1, ...sameName.map((c) => c.number ?? 1))
    result.push({ ...enemy, number: maxNumber + 1 })
  }
  return result
}

function step(state: CombatState, direction: 1 | -1): CombatState {
  const order = sortByInitiative(state.combatants)
  if (order.length === 0) return state
  const current = order.findIndex((c) => c.id === state.activeId)
  let idx = current === -1 ? (direction === 1 ? -1 : 0) : current
  let round = state.round
  for (let i = 0; i < order.length; i++) {
    idx += direction
    if (idx >= order.length) {
      idx = 0
      round += 1
    } else if (idx < 0) {
      idx = order.length - 1
      round = Math.max(1, round - 1)
    }
    if (!isDefeated(order[idx])) return { ...state, activeId: order[idx].id, round }
  }
  return state
}

export function startCombat(state: CombatState): CombatState {
  const order = sortByInitiative(state.combatants)
  const first = order.find((c) => !isDefeated(c)) ?? order[0]
  return { ...state, started: true, round: 1, activeId: first?.id ?? null }
}

export function endCombat(state: CombatState): CombatState {
  return { ...state, started: false, round: 0, activeId: null }
}

export function nextTurn(state: CombatState): CombatState {
  return state.started ? step(state, 1) : state
}

export function previousTurn(state: CombatState): CombatState {
  if (!state.started) return state
  const order = sortByInitiative(state.combatants).filter((c) => !isDefeated(c))
  if (state.round <= 1 && order[0]?.id === state.activeId) return state
  return step(state, -1)
}

export function removeCombatant(state: CombatState, id: string): CombatState {
  let activeId = state.activeId
  let round = state.round
  if (state.started && activeId === id) {
    const advanced = step(state, 1)
    activeId = advanced.activeId === id ? null : advanced.activeId
    round = advanced.round
  }
  const combatants = state.combatants.filter((c) => c.id !== id)
  return { ...state, combatants, activeId, round, started: state.started && combatants.length > 0 }
}

export function applyHpChange(c: Combatant, delta: number): Combatant {
  if (c.currentHp == null) return c
  const max = c.maxHp ?? Infinity
  const next = Math.min(max, Math.max(0, c.currentHp + delta))
  return { ...c, currentHp: next }
}

export function monsterInitiativeBonus(monster: MonsterMetadata | null | undefined): number {
  return abilityModifier(monster?.dexterity)
}
