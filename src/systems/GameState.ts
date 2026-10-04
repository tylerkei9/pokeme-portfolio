import { create } from 'zustand'

export interface GameStateData {
  /** Which legendaries have been defeated — keyed by legendary id */
  defeatedLegendaries: Record<string, boolean>
  /** Which route content items have been viewed */
  viewedContent: Record<string, boolean>
  /** Current scene key the player is in */
  currentScene: string
  /** Whether the player has skipped to the sandbox */
  hasSkipped: boolean
  /** Whether a content modal is currently open */
  activeContentId: string | null
  /** Whether the battle overlay is active */
  battleActive: boolean
  /** The legendary currently being battled */
  activeBattleLegendary: string | null
  /** Whether the phone overlay is open */
  phoneOpen: boolean
  /** The Music Player reward — unlocked by defeating Latias */
  musicUnlocked: boolean
}

export interface GameStateActions {
  defeatLegendary: (id: string) => void
  viewContent: (id: string) => void
  setCurrentScene: (scene: string) => void
  skipToSandbox: () => void
  openContent: (id: string) => void
  closeContent: () => void
  startBattle: (legendaryId: string) => void
  endBattle: () => void
  togglePhone: () => void
  closePhone: () => void
  unlockMusic: () => void
  reset: () => void
}

const LEGENDARY_IDS = ['lake', 'seacave'] as const

// Every visit starts clean — no progress is read from or written to localStorage.
// (A previous version persisted defeatedLegendaries/viewedContent/hasSkipped; that's
// intentionally off for now per Tyler's request. Clear out any old save so it can't
// resurface if this is ever turned back on without a matching migration.)
try {
  localStorage.removeItem('pokeme-save')
} catch { /* storage unavailable */ }

const initialState: GameStateData = {
  defeatedLegendaries: {},
  viewedContent: {},
  currentScene: 'TitleScene',
  hasSkipped: false,
  activeContentId: null,
  battleActive: false,
  activeBattleLegendary: null,
  phoneOpen: false,
  musicUnlocked: false,
}

export const useGameState = create<GameStateData & GameStateActions>((set) => ({
  ...initialState,

  defeatLegendary: (id: string) => {
    set((s) => ({ defeatedLegendaries: { ...s.defeatedLegendaries, [id]: true } }))
  },

  viewContent: (id: string) => {
    set((s) => ({ viewedContent: { ...s.viewedContent, [id]: true } }))
  },

  setCurrentScene: (scene: string) => set({ currentScene: scene }),

  skipToSandbox: () => {
    const allDefeated: Record<string, boolean> = {}
    LEGENDARY_IDS.forEach((id) => { allDefeated[id] = true })
    set({ defeatedLegendaries: allDefeated, hasSkipped: true })
  },

  openContent: (id: string) => set({ activeContentId: id }),
  closeContent: () => set({ activeContentId: null }),

  startBattle: (legendaryId: string) => set({ battleActive: true, activeBattleLegendary: legendaryId }),
  endBattle: () => set({ battleActive: false, activeBattleLegendary: null }),

  togglePhone: () => set((s) => ({ phoneOpen: !s.phoneOpen })),
  closePhone: () => set({ phoneOpen: false }),
  unlockMusic: () => set({ musicUnlocked: true }),

  reset: () => set(initialState),
}))
