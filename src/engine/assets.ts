import * as THREE from 'three'
import { BitmapFont } from './font'
import { pixelTexture } from './pixel'
import type { Dir } from '../maps/types'
import crowdData from '../data/crowd.json'

export interface SpriteSheet {
  texture: THREE.Texture
  cols: number
  rows: number
  /** Frame size in DS pixels. */
  frameW: number
  frameH: number
  rowOf: Record<Dir, number>
  /** Column used when standing still. */
  stand: number
  /** Columns alternated on successive steps. */
  steps: number[]
  /** Pokémon animate even when idle (HG/SS style). */
  idleAnim?: boolean
  /** Idle animation speed, frames per second (default 3). */
  idleFps?: number
}

/** An animated BW battle sprite (grid sheet + per-frame durations in ms). */
export interface AnimSheet {
  texture: THREE.Texture
  w: number
  h: number
  cols: number
  count: number
  durations: number[]
}

export interface Assets {
  font: BitmapFont
  hudFont: BitmapFont
  sheets: {
    heroWalk: SpriteSheet
    heroRun: SpriteSheet
    typhlosion: SpriteSheet
    latias: SpriteSheet
    lugia: SpriteSheet
    zekrom: SpriteSheet
  }
  battle: Record<'typhlosion_back' | 'latias_front' | 'zekrom_front' | 'lugia_front', AnimSheet>
  hud: Record<'foe' | 'player' | 'exp', HTMLImageElement>
  /** The wandering crowd (see src/engine/crowd.ts), keyed by crowd.json id. */
  crowd: { npcs: Record<string, SpriteSheet>; pokemon: Record<string, SpriteSheet> }
}

const BASE = '/assets/bw'
const UDLR: Record<Dir, number> = { up: 0, down: 1, left: 2, right: 3 }
const allRows = (row: number): Record<Dir, number> => ({ up: row, down: row, left: row, right: row })

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error(`failed to load ${src}`))
    i.src = src
  })
}

async function loadAnim(name: string): Promise<AnimSheet> {
  const [img, meta] = await Promise.all([
    loadImage(`${BASE}/battle/${name}.png`),
    fetch(`${BASE}/battle/${name}.json`).then((r) => r.json()),
  ])
  return { texture: pixelTexture(img), ...meta }
}

export async function loadAssets(): Promise<Assets> {
  // the script face for the Lilly logo statue, painted onto a canvas when the hall is built
  // (capped so a slow font server never holds up the game)
  await Promise.race([document.fonts.load('700 60px "Dancing Script"').catch(() => undefined), new Promise((r) => setTimeout(r, 1500))])
  const [font, hudFont, heroWalk, heroRun, typhlosion, latias, lugia, zekrom] = await Promise.all([
    BitmapFont.load(`${BASE}/font_dialog`),
    BitmapFont.load(`${BASE}/font_hud`),
    ...['hero_walk', 'hero_run', 'typhlosion_ow', 'latias_ow', 'lugia_ow', 'zekrom_ow'].map((n) => loadImage(`${BASE}/${n}.png`)),
  ] as const)
  const [typhBack, latiasFront, zekromFront, lugiaFront] = await Promise.all(
    ['typhlosion_back', 'latias_front', 'zekrom_front', 'lugia_front'].map(loadAnim),
  )
  const [foe, player, exp] = await Promise.all(['hud_foe', 'hud_player', 'hud_exp'].map((n) => loadImage(`${BASE}/battle/${n}.png`)))

  const hero = (img: HTMLImageElement): SpriteSheet => ({
    texture: pixelTexture(img), cols: 3, rows: 4, frameW: 32, frameH: 32,
    rowOf: UDLR, stand: 0, steps: [1, 2],
  })
  const loadCrowd = async (prefix: string, ids: string[], make: (img: HTMLImageElement) => SpriteSheet) => {
    const imgs = await Promise.all(ids.map((id) => loadImage(`${BASE}/crowd/${prefix}_${id}.png`)))
    return Object.fromEntries(ids.map((id, i) => [id, make(imgs[i])]))
  }
  const [crowdNpcs, crowdPokemon] = await Promise.all([
    loadCrowd('npc', crowdData.npcs.map((n) => n.id), hero),
    loadCrowd('pkmn', crowdData.pokemon.map((p) => p.id), (img) => ({
      texture: pixelTexture(img), cols: 2, rows: 4, frameW: 32, frameH: 32,
      rowOf: UDLR, stand: 0, steps: [1, 0], idleAnim: true,
    })),
  ])

  return {
    font: font as BitmapFont,
    hudFont: hudFont as BitmapFont,
    sheets: {
      heroWalk: hero(heroWalk as HTMLImageElement),
      heroRun: hero(heroRun as HTMLImageElement),
      typhlosion: {
        texture: pixelTexture(typhlosion as HTMLImageElement), cols: 2, rows: 4, frameW: 32, frameH: 32,
        rowOf: UDLR, stand: 0, steps: [1, 0], idleAnim: true,
      },
      // legendaries only ever face the player: row 1 is their front view
      latias: {
        texture: pixelTexture(latias as HTMLImageElement), cols: 2, rows: 4, frameW: 32, frameH: 32,
        rowOf: allRows(1), stand: 0, steps: [0, 1], idleAnim: true,
      },
      lugia: {
        texture: pixelTexture(lugia as HTMLImageElement), cols: 2, rows: 3, frameW: 64, frameH: 64,
        rowOf: allRows(1), stand: 0, steps: [0, 1], idleAnim: true, idleFps: 2,
      },
      zekrom: {
        texture: pixelTexture(zekrom as HTMLImageElement), cols: 8, rows: 1, frameW: 64, frameH: 64,
        rowOf: allRows(0), stand: 0, steps: [0, 1, 2, 3, 4, 5, 6, 7], idleAnim: true, idleFps: 8,
      },
    },
    battle: {
      typhlosion_back: typhBack,
      latias_front: latiasFront,
      zekrom_front: zekromFront,
      lugia_front: lugiaFront,
    },
    hud: { foe, player, exp },
    crowd: { npcs: crowdNpcs, pokemon: crowdPokemon },
  }
}
