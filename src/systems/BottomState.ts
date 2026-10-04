import { create } from 'zustand'

export type BottomMode = 'menu' | 'battleIdle' | 'battleCommand' | 'battleMoves'

export interface MoveSlot {
  name: string
  type: string
  pp: number
  maxPp: number
}

/** Command-screen targets, in keyboard-cursor order. */
export const COMMANDS = ['fight', 'bag', 'run', 'pokemon'] as const
export type Command = (typeof COMMANDS)[number]

interface BottomState {
  mode: BottomMode
  /** Highlighted command / move index (keyboard cursor). */
  cursor: number
  moves: MoveSlot[]
  /** What each cursor position picks, in order. */
  choices: string[]
  /** Set by the battle while it waits for a choice; called by clicks or the A button. */
  onPick: ((choice: string) => void) | null
  set: (patch: Partial<Omit<BottomState, 'set' | 'pick'>>) => void
  pick: (choice: string) => void
}

/**
 * Shared state for the DS bottom screen, written by the engine (battles) and read by the
 * React canvas that draws it.
 */
export const useBottom = create<BottomState>((set, get) => ({
  mode: 'menu',
  cursor: 0,
  moves: [],
  choices: [],
  onPick: null,
  set: (patch) => set(patch),
  pick: (choice) => get().onPick?.(choice),
}))
