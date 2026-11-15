import type { MonsterMetadata } from '../../types/electron.d'
import { crToXp } from '../../utils/crUtils'
import { abilityModifier, formatModifier } from '../../utils/combatUtils'
import { statBlockWrap, statBlockDivider, statBlockSectionTitle, statLine, abilityGrid, abilityCell } from './statBlockStyles'

export function ActionBlock({ title, actions }: { title: string; actions: { name: string; desc: string; attack_bonus?: number; damage_dice?: string; damage_bonus?: number }[] }) {
  if (!actions?.length) return null
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={statBlockDivider} />
      <h4 style={statBlockSectionTitle}>{title}</h4>
      {actions.map((a, i) => (
        <p key={i} style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{a.name}.</strong>{' '}
          {a.desc}
        </p>
      ))}
    </div>
  )
}

export function MonsterStatBlock({ monster: m }: { monster: MonsterMetadata }) {
  const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const
  const ABILITY_SHORT = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  const xp = m.challengeRating ? crToXp(m.challengeRating) : null

  return (
    <div style={statBlockWrap}>
      {/* Type line */}
      {(m.size || m.monsterType) && (
        <p style={{ margin: '0 0 12px', fontSize: 13, fontStyle: 'italic', color: 'var(--text-muted)' }}>
          {[m.size, m.monsterType, m.subtype ? `(${m.subtype})` : null, m.alignment].filter(Boolean).join(' ')}
        </p>
      )}

      <div style={statBlockDivider} />

      {/* Combat basics */}
      <div style={{ marginBottom: 10 }}>
        {m.armorClass != null && (
          <p style={statLine}><strong>Armour Class</strong> {m.armorClass}</p>
        )}
        {m.hitPoints != null && (
          <p style={statLine}><strong>Hit Points</strong> {m.hitPoints}{m.hitDice ? ` (${m.hitDice})` : ''}</p>
        )}
        {m.speed && (
          <p style={statLine}><strong>Speed</strong> {m.speed}</p>
        )}
      </div>

      {/* Ability scores */}
      {ABILITIES.some((ab) => m[ab] != null) && (
        <>
          <div style={statBlockDivider} />
          <div style={abilityGrid}>
            {ABILITIES.map((ab, i) => {
              const score = m[ab]
              return (
                <div key={ab} style={abilityCell}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>{ABILITY_SHORT[i]}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{score ?? '—'}</span>
                  {score != null && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatModifier(abilityModifier(score))}</span>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Traits */}
      {(m.senses || m.languages || m.damageResistances || m.damageImmunities || m.damageVulnerabilities || m.conditionImmunities || m.challengeRating) && (
        <>
          <div style={statBlockDivider} />
          <div style={{ marginBottom: 10 }}>
            {m.damageVulnerabilities && <p style={statLine}><strong>Damage Vulnerabilities</strong> {m.damageVulnerabilities}</p>}
            {m.damageResistances && <p style={statLine}><strong>Damage Resistances</strong> {m.damageResistances}</p>}
            {m.damageImmunities && <p style={statLine}><strong>Damage Immunities</strong> {m.damageImmunities}</p>}
            {m.conditionImmunities && <p style={statLine}><strong>Condition Immunities</strong> {m.conditionImmunities}</p>}
            {m.senses && <p style={statLine}><strong>Senses</strong> {m.senses}</p>}
            {m.languages && <p style={statLine}><strong>Languages</strong> {m.languages}</p>}
            {m.challengeRating && (
              <p style={statLine}>
                <strong>Challenge</strong> {m.challengeRating}
                {xp != null && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> ({xp.toLocaleString()} XP)</span>}
              </p>
            )}
          </div>
        </>
      )}

      <ActionBlock title="Special Abilities" actions={m.specialAbilities ?? []} />
      <ActionBlock title="Actions" actions={m.actions ?? []} />
      <ActionBlock title="Reactions" actions={m.reactions ?? []} />
      <ActionBlock title="Legendary Actions" actions={m.legendaryActions ?? []} />
    </div>
  )
}
