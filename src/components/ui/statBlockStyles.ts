import type { CSSProperties } from 'react'

export const statBlockWrap: CSSProperties = {
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '18px 20px',
  marginBottom: 8,
}

export const statBlockDivider: CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '10px 0',
}

export const statBlockSectionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: '#f87171',
  margin: '0 0 8px',
  fontStyle: 'italic',
}

export const statLine: CSSProperties = {
  margin: '3px 0',
  fontSize: 13,
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

export const abilityGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 6,
  margin: '10px 0',
}

export const abilityCell: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  background: 'var(--bg-secondary)',
  borderRadius: 6,
  padding: '8px 4px',
  gap: 2,
}
