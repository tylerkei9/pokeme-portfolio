import * as THREE from 'three'
import crowdData from '../data/crowd.json'
import type { Dir, MapDef } from '../maps/types'
import { Actor, DIR_VEC, OPPOSITE } from './actor'
import type { Assets } from './assets'
import type { World } from './world'

type Habitat = 'grass' | 'path' | 'shore'

interface Species {
  id: string
  name: string
  cry: string
  habitat: string[]
  weight: number
  sleeper?: boolean
}

export interface CrowdMember {
  kind: 'npc' | 'wild' | 'companion'
  actor: Actor
  /** Username for trainers, species name for Pokémon. */
  name: string
  species?: Species
  owner?: CrowdMember
  companion?: CrowdMember
  homeX: number
  homeY: number
  /** Talking to the player: holds still, facing them. */
  busy: boolean
  timer: number
  /** Tiles left in the current stroll, and its direction. */
  stroll: number
  strollDir: Dir
}

const NPC_SPEED = 3.2
const MON_SPEED = 2.8
const LEASH = { npc: 6, wild: 3 }
/** Per-tile weights for "walkable tiles per spawned trainer / Pokémon" on outdoor maps. */
const TILES_PER_NPC = 90
const TILES_PER_MON = 120

const PATH_CHARS = new Set(['d', 'p', 's', 'q', 'o', 'b', 'v', 'j', 'k', 'w', 'c', 'h', 'm', 'z'])
const GRASS_CHARS = new Set(['g', 'G', 'f'])

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]
const DIRS: Dir[] = ['up', 'down', 'left', 'right']

function shuffle<T>(xs: T[]) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}

/**
 * The "other players" layer that makes the overworld feel like a live MMO server instead of
 * an empty sandbox: every time a map loads, a fresh random set of trainers (BW overworld
 * NPC sprites, each with a username tag and sometimes a partner Pokémon trailing them) and
 * wild Pokémon (BW overworld sprites, placed by habitat — water-lovers by the shore, bugs
 * in the grass) is scattered across the walkable tiles. They wander on their own — strolls
 * of a few tiles, turning to look around, idling — each leashed to where it spawned so the
 * crowd stays spread out, and they never step onto doors, signs, or the legendary's
 * trigger zone. Press A facing one to hear what they have to say.
 */
export class Crowd {
  readonly members: CrowdMember[] = []
  private group = new THREE.Group()

  constructor(private assets: Assets, private scene: THREE.Scene) {
    scene.add(this.group)
  }

  /**
   * Scatter a new crowd over `def`. `reserved` marks tiles nobody should stand on (warps,
   * signs, trigger zones); the area around the player's arrival tile is kept clear.
   */
  spawn(def: MapDef, world: World, pitch: number, reserved: (x: number, y: number) => boolean, player: { x: number; y: number }) {
    this.clear()
    const habitatAt = (x: number, y: number): Habitat[] => {
      const ch = def.ground[y][x]
      const out: Habitat[] = []
      if (GRASS_CHARS.has(ch)) out.push('grass')
      if (PATH_CHARS.has(ch)) out.push('path')
      const nearWater = DIRS.some((d) => {
        const nx = x + DIR_VEC[d][0]
        const ny = y + DIR_VEC[d][1]
        return def.ground[ny]?.[nx] === 'W'
      })
      if (nearWater) out.push('shore')
      return out
    }

    const free: { x: number; y: number; hab: Habitat[] }[] = []
    for (let y = 0; y < def.height; y++) {
      for (let x = 0; x < def.width; x++) {
        if (world.isSolid(x, y) || reserved(x, y)) continue
        if (Math.abs(x - player.x) + Math.abs(y - player.y) <= 3) continue
        free.push({ x, y, hab: habitatAt(x, y) })
      }
    }
    shuffle(free)

    const outdoor = def.kind === 'outdoor'
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
    const nNpc = def.crowd?.npcs ?? (outdoor ? clamp(Math.round(free.length / TILES_PER_NPC), 1, 3) : 0)
    const nMon = def.crowd?.pokemon ?? (outdoor ? clamp(Math.round(free.length / TILES_PER_MON), 1, 2) : 0)

    const taken = new Set<string>()
    const key = (x: number, y: number) => `${x},${y}`
    // Keep everyone at least 2 tiles apart at spawn so the crowd reads as spread out.
    const roomy = (x: number, y: number) => this.members.every((m) => Math.max(Math.abs(m.actor.tx - x), Math.abs(m.actor.ty - y)) >= 2)
    const take = (ok: (t: (typeof free)[number]) => boolean) => {
      const t = free.find((c) => !taken.has(key(c.x, c.y)) && ok(c) && roomy(c.x, c.y))
      if (t) taken.add(key(t.x, t.y))
      return t
    }

    const add = (m: Omit<CrowdMember, 'busy' | 'timer' | 'stroll' | 'strollDir' | 'homeX' | 'homeY'>) => {
      const member: CrowdMember = {
        ...m, busy: false, timer: rand(0.2, 2.5), stroll: 0, strollDir: 'down',
        homeX: m.actor.tx, homeY: m.actor.ty,
      }
      m.actor.setPitch(pitch)
      this.group.add(m.actor.group)
      this.members.push(member)
      return member
    }

    // ── trainers ──
    const looks = shuffle([...crowdData.npcs.map((n) => n.id)])
    const names = shuffle([...crowdData.usernames])
    const species = crowdData.pokemon as Species[]
    const byId = new Map(species.map((s) => [s.id, s]))
    for (let i = 0; i < nNpc; i++) {
      const spot = take(() => true)
      if (!spot) break
      const look = looks[i % looks.length]
      const actor = new Actor(this.assets.crowd.npcs[look], spot.x, spot.y, pick(DIRS), pitch)
      const npc = add({ kind: 'npc', actor, name: names[i % names.length] })

      // ~25% of trainers walk with a partner Pokémon, like the player's Typhlosion.
      if (Math.random() < 0.25) {
        const beside = DIRS.map((d) => ({ x: spot.x + DIR_VEC[d][0], y: spot.y + DIR_VEC[d][1] }))
          .find((p) => free.some((c) => c.x === p.x && c.y === p.y) && !taken.has(key(p.x, p.y)))
        if (beside) {
          taken.add(key(beside.x, beside.y))
          const sp = byId.get(pick(crowdData.companions))!
          const mon = new Actor(this.assets.crowd.pokemon[sp.id], beside.x, beside.y, actor.dir, pitch)
          const companion = add({ kind: 'companion', actor: mon, name: sp.name, species: sp, owner: npc })
          npc.companion = companion
        }
      }
    }

    // ── wild Pokémon, by habitat ──
    const present = new Set(free.flatMap((c) => c.hab))
    const pool = species.filter((s) => s.habitat.some((h) => present.has(h as Habitat)))
    const total = pool.reduce((sum, s) => sum + s.weight, 0)
    for (let i = 0; i < nMon && pool.length; i++) {
      let r = Math.random() * total
      const sp = pool.find((s) => (r -= s.weight) <= 0) ?? pool[0]
      // Snorlax/Sudowoodo never move, so they only nap in open ground where they can't
      // wall off a path: every surrounding tile must be walkable.
      const open = (c: { x: number; y: number }) => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => !world.isSolid(c.x + dx, c.y + dy)))
      const spot = take((c) => c.hab.some((h) => sp.habitat.includes(h)) && (!sp.sleeper || open(c)))
      if (!spot) continue
      const actor = new Actor(this.assets.crowd.pokemon[sp.id], spot.x, spot.y, pick(DIRS), pitch)
      add({ kind: 'wild', actor, name: sp.name, species: sp })
    }
  }

  /** Is anyone standing on — or stepping off — this tile? */
  occupies(x: number, y: number, except?: CrowdMember) {
    return this.members.some((m) => m !== except && covers(m.actor, x, y))
  }

  at(x: number, y: number) {
    return this.members.find((m) => m.actor.tx === x && m.actor.ty === y)
  }

  /**
   * Advance everyone. `canEnter` answers for the world (solids, reserved tiles, the player
   * and their partner); `frozen` holds new moves during cutscenes and dialogue so nobody
   * wanders into a legendary's landing spot.
   */
  update(dt: number, canEnter: (x: number, y: number) => boolean, frozen: boolean) {
    for (const m of this.members) m.actor.update(dt)
    if (frozen) return
    for (const m of this.members) {
      if (m.busy || m.actor.moving || m.kind === 'companion') continue
      if (m.species?.sleeper) {
        // Snorlax dozes and Sudowoodo pretends to be a tree: they only ever turn.
        if ((m.timer -= dt) <= 0) {
          m.timer = rand(4, 9)
          if (Math.random() < 0.4) m.actor.face(pick(DIRS))
        }
        continue
      }
      if (m.stroll > 0 && this.tryStep(m, m.strollDir, canEnter)) {
        m.stroll--
        continue
      }
      m.stroll = 0
      if ((m.timer -= dt) > 0) continue
      m.timer = m.kind === 'npc' ? rand(0.8, 3.2) : rand(1, 3.5)

      const roll = Math.random()
      if (roll < 0.55) {
        const leash = LEASH[m.kind === 'npc' ? 'npc' : 'wild']
        const dx = m.homeX - m.actor.tx
        const dy = m.homeY - m.actor.ty
        const away = Math.abs(dx) + Math.abs(dy) > leash
        const dir: Dir = away
          ? Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
          : pick(DIRS)
        // Trainers stroll a few tiles with purpose, like other players; Pokémon hop about.
        m.strollDir = dir
        m.stroll = m.kind === 'npc' ? Math.floor(rand(1, 5)) : Math.floor(rand(1, 3))
        if (this.tryStep(m, dir, canEnter)) m.stroll--
        else {
          m.stroll = 0
          m.actor.face(dir)
        }
      } else if (roll < 0.85) {
        m.actor.face(pick(DIRS))
      }
    }
  }

  private tryStep(m: CrowdMember, dir: Dir, canEnter: (x: number, y: number) => boolean) {
    const nx = m.actor.tx + DIR_VEC[dir][0]
    const ny = m.actor.ty + DIR_VEC[dir][1]
    const partner = m.companion
    const blockedByCrowd = this.members.some((o) => o !== m && o !== partner && covers(o.actor, nx, ny))
    if (blockedByCrowd || !canEnter(nx, ny)) return false
    const ox = m.actor.tx
    const oy = m.actor.ty
    const speed = m.kind === 'npc' ? NPC_SPEED : MON_SPEED
    m.actor.step(dir, speed)
    if (partner && !partner.busy) partner.actor.stepTo(ox, oy, speed)
    return true
  }

  /** Face the player and hold still while they talk. */
  greet(m: CrowdMember, playerDir: Dir) {
    m.busy = true
    m.stroll = 0
    m.actor.face(OPPOSITE[playerDir])
  }

  release(m: CrowdMember) {
    m.busy = false
    m.timer = rand(1, 2.5)
  }

  /** What they say when the player presses A at them. */
  lines(m: CrowdMember, mapId: string): string[] {
    if (m.kind === 'npc') {
      const chatter = crowdData.chatter as Record<string, string[]>
      const local = chatter[mapId] ?? []
      const line = local.length && Math.random() < 0.5 ? pick(local) : pick(chatter.any)
      return [line]
    }
    const sp = m.species!
    if (m.kind === 'companion') return [`${sp.name}: ${sp.cry}`, "It's a trainer's partner Pokémon."]
    return [`A wild ${sp.name} is hanging around.`, `${sp.name}: ${sp.cry}`]
  }

  setPitch(pitch: number) {
    for (const m of this.members) {
      m.actor.setPitch(pitch)
    }
  }

  clear() {
    for (const m of this.members) {
      this.group.remove(m.actor.group)
      m.actor.dispose()
    }
    this.members.length = 0
  }

  dispose() {
    this.clear()
    this.scene.remove(this.group)
  }
}

/** The tile an actor stands on, or both tiles while it's mid-step. */
function covers(a: Actor, x: number, y: number) {
  if (a.tx === x && a.ty === y) return true
  const from = a.fromTile
  return !!from && from[0] === x && from[1] === y
}
