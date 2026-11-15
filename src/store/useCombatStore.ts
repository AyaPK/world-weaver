import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { EMPTY_COMBAT } from '../utils/combatUtils'
import type { CombatState } from '../utils/combatUtils'

interface CombatStore {
  byCampaign: Record<string, CombatState>
  getCombat: (campaignId: string) => CombatState
  updateCombat: (campaignId: string, updater: (state: CombatState) => CombatState) => void
  resetCombat: (campaignId: string) => void
}

export const useCombatStore = create<CombatStore>()(
  persist(
    (set, get) => ({
      byCampaign: {},

      getCombat: (campaignId) => get().byCampaign[campaignId] ?? EMPTY_COMBAT,

      updateCombat: (campaignId, updater) =>
        set((s) => ({
          byCampaign: {
            ...s.byCampaign,
            [campaignId]: updater(s.byCampaign[campaignId] ?? EMPTY_COMBAT),
          },
        })),

      resetCombat: (campaignId) =>
        set((s) => {
          const next = { ...s.byCampaign }
          delete next[campaignId]
          return { byCampaign: next }
        }),
    }),
    {
      name: 'world-weaver-combat-tracker',
      partialize: (s) => ({ byCampaign: s.byCampaign }),
    },
  ),
)
