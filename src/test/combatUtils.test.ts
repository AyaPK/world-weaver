import { describe, it, expect } from 'vitest'
import {
  EMPTY_COMBAT, addEnemies, applyHpChange, displayName, monsterInitiativeBonus, nextTurn,
  previousTurn, removeCombatant, rollInitiative, sortByInitiative, startCombat,
} from '../utils/combatUtils'
import type { Combatant, CombatState } from '../utils/combatUtils'

function make(id: string, overrides: Partial<Combatant> = {}): Combatant {
  return {
    id,
    kind: 'enemy',
    baseName: id,
    number: null,
    entityId: null,
    initiative: 10,
    initiativeBonus: 0,
    ac: 12,
    maxHp: 10,
    currentHp: 10,
    cr: null,
    subtitle: null,
    monster: null,
    ...overrides,
  }
}

function state(combatants: Combatant[]): CombatState {
  return { ...EMPTY_COMBAT, combatants }
}

describe('rollInitiative', () => {
  it('adds the bonus to a d20 roll', () => {
    expect(rollInitiative(3, () => 0)).toBe(4)
    expect(rollInitiative(-1, () => 0.999)).toBe(19)
  })

  it('derives the bonus from dexterity', () => {
    expect(monsterInitiativeBonus({ type: 'monster', dexterity: 14 })).toBe(2)
    expect(monsterInitiativeBonus({ type: 'monster', dexterity: 7 })).toBe(-2)
    expect(monsterInitiativeBonus(null)).toBe(0)
  })
})

describe('sortByInitiative', () => {
  it('orders by initiative, then bonus, with missing initiative last', () => {
    const sorted = sortByInitiative([
      make('a', { initiative: 12, initiativeBonus: 1 }),
      make('b', { initiative: null }),
      make('c', { initiative: 18 }),
      make('d', { initiative: 12, initiativeBonus: 3 }),
    ])
    expect(sorted.map((c) => c.id)).toEqual(['c', 'd', 'a', 'b'])
  })
})

describe('addEnemies', () => {
  it('numbers duplicate enemies', () => {
    const result = addEnemies([], [make('1', { baseName: 'Goblin' }), make('2', { baseName: 'Goblin' }), make('3', { baseName: 'Ogre' })])
    expect(result.map(displayName)).toEqual(['Goblin 1', 'Goblin 2', 'Ogre'])
  })

  it('numbers a lone existing enemy when another with the same name is added', () => {
    const first = addEnemies([], [make('1', { baseName: 'Goblin' })])
    const result = addEnemies(first, [make('2', { baseName: 'goblin' })])
    expect(result.map(displayName)).toEqual(['Goblin 1', 'goblin 2'])
  })

  it('continues numbering after the highest existing number', () => {
    const existing = [make('1', { baseName: 'Goblin', number: 1 }), make('3', { baseName: 'Goblin', number: 3 })]
    const result = addEnemies(existing, [make('4', { baseName: 'Goblin' })])
    expect(result.map(displayName)).toEqual(['Goblin 1', 'Goblin 3', 'Goblin 4'])
  })
})

describe('turn order', () => {
  const combatants = [
    make('slow', { initiative: 5 }),
    make('fast', { initiative: 20, kind: 'player' }),
    make('mid', { initiative: 12 }),
  ]

  it('starts with the highest initiative in round 1', () => {
    const s = startCombat(state(combatants))
    expect(s).toMatchObject({ started: true, round: 1, activeId: 'fast' })
  })

  it('cycles through the order and increments the round', () => {
    let s = startCombat(state(combatants))
    s = nextTurn(s)
    expect(s.activeId).toBe('mid')
    s = nextTurn(s)
    expect(s.activeId).toBe('slow')
    s = nextTurn(s)
    expect(s).toMatchObject({ activeId: 'fast', round: 2 })
  })

  it('goes back a turn, but not before the start of combat', () => {
    let s = startCombat(state(combatants))
    expect(previousTurn(s)).toEqual(s)
    s = nextTurn(nextTurn(nextTurn(s)))
    s = previousTurn(s)
    expect(s).toMatchObject({ activeId: 'slow', round: 1 })
  })

  it('skips defeated enemies but not downed players', () => {
    const s = startCombat(state([
      make('fast', { initiative: 20, kind: 'player', currentHp: 0 }),
      make('mid', { initiative: 12, currentHp: 0 }),
      make('slow', { initiative: 5 }),
    ]))
    expect(s.activeId).toBe('fast')
    expect(nextTurn(s).activeId).toBe('slow')
  })

  it('does nothing before combat starts', () => {
    const s = state(combatants)
    expect(nextTurn(s)).toBe(s)
  })

  it('passes the turn on when the active combatant is removed', () => {
    const s = removeCombatant(startCombat(state(combatants)), 'fast')
    expect(s.activeId).toBe('mid')
    expect(s.combatants).toHaveLength(2)
  })

  it('ends combat when the last combatant is removed', () => {
    const s = removeCombatant(startCombat(state([make('only')])), 'only')
    expect(s).toMatchObject({ started: false, activeId: null, combatants: [] })
  })
})

describe('applyHpChange', () => {
  it('clamps between 0 and max HP', () => {
    expect(applyHpChange(make('a'), -15).currentHp).toBe(0)
    expect(applyHpChange(make('a', { currentHp: 4 }), 20).currentHp).toBe(10)
    expect(applyHpChange(make('a', { currentHp: 4 }), -3).currentHp).toBe(1)
  })

  it('ignores combatants without HP', () => {
    const c = make('a', { currentHp: null })
    expect(applyHpChange(c, -5)).toBe(c)
  })
})
