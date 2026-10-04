import legendariesJson from '../data/legendaries.json'

export type LegendaryId = 'lake' | 'seacave'
export type BattleEnv = 'grass' | 'ruins' | 'cave'

export interface LegendaryData {
  id: LegendaryId
  /** Full title used in overworld text (never the real Pokémon name). */
  displayName: string
  /** Short name that fits the battle HUD's name box. */
  battleName: string
  level: number
  maxHp: number
  stage: LegendaryId
  introDialogue: string[]
  cry: string
  finishingMove: string
  finishingMoveDesc: string
  defeatText: string
  overworld: { sheet: 'latias' | 'zekrom' | 'lugia'; hover: boolean }
  battleSprite: 'latias_front' | 'zekrom_front' | 'lugia_front'
  environment: { battle: BattleEnv; description: string }
}

export const LEGENDARIES = legendariesJson as LegendaryData[]

export function legendary(id: string) {
  const l = LEGENDARIES.find((x) => x.id === id)
  if (!l) throw new Error(`unknown legendary "${id}"`)
  return l
}

/** The one fixed partner. */
export const STARTER = {
  id: 'typhlosion',
  displayName: 'Typhlosion',
  level: 100,
  maxHp: 359,
  moveName: 'Eruption',
  moveType: 'Fire',
  movePP: 5,
} as const
