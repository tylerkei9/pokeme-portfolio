import * as THREE from 'three'
import type { CameraConfig, Dir, MapDef, Warp } from '../maps/types'
import { MAPS } from '../maps'
import { Actor, DIR_VEC, OPPOSITE } from './actor'
import { loadAssets, type Assets } from './assets'
import { DS_H, DS_W, Hud, type DialogStyle } from './hud'
import { World } from './world'
import { Crowd } from './crowd'
import { Battle } from './battle'
import { buildPortal, buildSparkle } from './props'
import { legendary, STARTER, type LegendaryData } from '../systems/BattleSystem'
import { useBottom } from '../systems/BottomState'

/** 3D render resolution relative to the DS screen (2 = 512×384). */
const RENDER_SCALE = 2
const WALK_SPEED = 4 // tiles / s
const RUN_SPEED = 8
/** A quick tap turns in place; holding longer than this walks (BW behaviour). */
const TURN_DELAY = 0.09
const FADE_TIME = 0.22

const CAMERA: Record<MapDef['kind'], CameraConfig> = {
  outdoor: { pitch: 58, dist: 20, fov: 34 },
  indoor: { pitch: 56, dist: 16, fov: 38 },
}

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
}
const A_KEYS = new Set(['Enter', 'z', 'Z', ' '])
const B_KEYS = new Set(['Shift'])

export interface EngineHooks {
  /** Open a portfolio ContentModal. */
  openContent: (id: string) => void
  /** True while a React overlay (modal, phone, title) owns the keyboard. */
  isPaused: () => boolean
  isDefeated: (legendaryId: string) => boolean
  defeat: (legendaryId: string) => void
  /** Called once, the first time Latias is defeated. */
  unlockMusic: () => void
}

export interface ScriptContext {
  say: (text: string | string[], opts?: { speaker?: Actor | null; style?: DialogStyle }) => Promise<void>
  /** Opens a ContentModal and resolves once it's closed. */
  openContent: (id: string) => Promise<void>
  warp: (to: string, x: number, y: number, dir: Dir) => Promise<void>
  wait: (seconds: number) => Promise<void>
  /** Ask a question with a BW YES/NO-style box; resolves with the chosen index. */
  ask: (question: string, options: string[]) => Promise<number>
  /** Run a full legendary battle (always won). */
  battle: (legendaryId: string) => Promise<void>
  player: Actor
  follower: Actor
}

type Mode = 'loading' | 'explore' | 'script' | 'transition' | 'battle'

interface PendingLegendary {
  data: LegendaryData
  /** Where to place a defeat sparkle on a later visit, if the live landing spot isn't known. */
  fallbackX: number
  fallbackY: number
  zone: { x: number; y: number; w: number; h: number }
}

export class Engine {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(34, DS_W / DS_H, 0.1, 300)
  private cam: CameraConfig = CAMERA.outdoor
  private assets!: Assets
  private hud!: Hud
  private world: World | null = null
  private player!: Actor
  private follower!: Actor
  private mode: Mode = 'loading'
  private raf = 0
  private last = 0
  private held = new Map<Dir, number>()
  private runHeld = false
  private aQueued = false
  private bQueued = false
  /** Direction presses not yet consumed by a menu (choice box / bottom screen). */
  private dirQueue: Dir[] = []
  private battle: Battle | null = null
  /** The legendary standing on this map, if it hasn't been defeated. */
  private legend: { data: LegendaryData; actor: Actor; x: number; y: number } | null = null
  /** A legendary waiting to fly in once the player steps on its trigger tile. */
  private pendingLegendary: PendingLegendary | null = null
  /** keydown time of the press that last turned the player in place */
  private turnPress = -1
  private tweens: ((dt: number) => boolean)[] = []
  private pauseWaiters: (() => void)[] = []
  private destroyed = false
  /** View size in virtual (DS-scale) pixels; follows the browser window. */
  private viewW = DS_W
  private viewH = DS_H
  private ambient: THREE.AmbientLight
  private sun: THREE.DirectionalLight
  /** While set, the camera frames this point instead of the player (cutscene pans). */
  private camFocus: { x: number; z: number } | null = null
  /** Warps added at runtime (the Hall of Fame portal). */
  private extraWarps: Warp[] = []
  /** Name of the `areas` entry the player is standing in, if any. */
  private area: string | null = null
  /** The walk-in trigger the player is standing in, if any (fires once per entry). */
  private trigger: NonNullable<MapDef['triggers']>[number] | null = null
  /** Pitch the actor billboards were last stretched for. */
  private spritePitch = NaN
  /** Wandering trainers and wild Pokémon — the "other players" on this map. */
  private crowd!: Crowd

  constructor(glCanvas: HTMLCanvasElement, private hudCanvas: HTMLCanvasElement, private hooks: EngineHooks) {
    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: false })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(DS_W * RENDER_SCALE, DS_H * RENDER_SCALE, false)
    // three.js lights are physically based (diffuse is divided by π), so these intensities
    // put a south-facing wall at ~1.0× its texture colour, roofs slightly brighter, east walls darker.
    this.ambient = new THREE.AmbientLight(0xffffff, 2.3)
    this.scene.add(this.ambient)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6)
    this.sun.position.set(-4, 10, 7)
    this.scene.add(this.sun)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
  }

  /** Set the view size in virtual pixels (the page scales the canvases up to fill the window). */
  resize(w: number, h: number) {
    this.viewW = w
    this.viewH = h
    this.renderer.setSize(w * RENDER_SCALE, h * RENDER_SCALE, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.hud?.resize(w, h)
    this.battle?.resize(w, h)
  }

  async start(mapId: string, x: number, y: number, dir: Dir) {
    this.assets = await loadAssets()
    if (this.destroyed) return
    this.hud = new Hud(this.hudCanvas, this.assets.font)
    this.hud.resize(this.viewW, this.viewH)
    this.player = new Actor(this.assets.sheets.heroWalk, x, y, dir, CAMERA.outdoor.pitch)
    this.follower = new Actor(this.assets.sheets.typhlosion, x, y, dir, CAMERA.outdoor.pitch)
    this.crowd = new Crowd(this.assets, this.scene)
    this.loadMap(mapId, x, y, dir)
    this.hud.fade = 1
    this.mode = 'transition'
    this.raf = requestAnimationFrame(this.frame)
    await this.fadeTo(0)
    const def = MAPS[mapId]
    if (def.kind === 'outdoor' && def.name) this.hud.showBanner(this.area ?? def.name)
    this.mode = 'explore'
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.raf)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.crowd?.dispose()
    this.world?.dispose()
    this.renderer.dispose()
  }

  /** Jump somewhere from outside the game (e.g. the bottom-screen menu). */
  async teleport(mapId: string, x: number, y: number, dir: Dir) {
    if (this.mode !== 'explore') return
    await this.warp(mapId, x, y, dir)
  }

  /** True while a dialogue/system text box is on screen (waiting on the A button). */
  isTextOpen() {
    return this.hud?.open ?? false
  }

  /** Show a message from outside the game (e.g. the controls help). */
  async message(text: string | string[]) {
    if (this.mode !== 'explore') return
    await this.runScript((ctx) => ctx.say(text, { style: 'system' }))
  }

  // ── map loading ──────────────────────────────────────────────────────────────

  private loadMap(mapId: string, x: number, y: number, dir: Dir) {
    const def = MAPS[mapId]
    if (!def) throw new Error(`unknown map "${mapId}"`)
    if (this.world) {
      this.scene.remove(this.world.group)
      this.world.dispose()
    }
    this.world = new World(def, this.assets)
    this.scene.add(this.world.group)
    this.camFocus = null
    this.extraWarps = []
    this.spawnLegendary(def)
    if (def.portal && this.hooks.isDefeated(def.portal.after)) this.spawnPortal(def)
    const light = def.lighting ?? (def.cave ? { ambient: 1.35, sun: 0.9 } : { ambient: 2.3, sun: 1.6 })
    this.ambient.intensity = light.ambient
    this.sun.intensity = light.sun
    this.cam = { ...CAMERA[def.kind], ...def.camera }
    this.camera.fov = this.cam.fov
    this.camera.updateProjectionMatrix()
    this.scene.background = new THREE.Color(
      def.kind === 'indoor' ? 0x000000 : def.sky ? def.sky : def.cave ? 'rgb(10,16,22)' : def.skyBridge ? 'rgb(140,196,232)' : 'rgb(168,180,158)',
    )

    this.spritePitch = Math.round(this.cam.pitch)
    this.player.setPitch(this.spritePitch)
    this.follower.setPitch(this.spritePitch)
    this.player.place(x, y, dir)
    // follower appears behind the player, or beside them if that's blocked
    const order: Dir[] = [OPPOSITE[dir], 'left', 'right', 'down', 'up']
    const spot = order.map((d) => [x + DIR_VEC[d][0], y + DIR_VEC[d][1]]).find(([fx, fy]) => !this.blocked(fx, fy))
    if (spot) this.follower.place(spot[0], spot[1], dir)
    else this.follower.place(x, y, dir)
    this.scene.add(this.player.group, this.follower.group)
    this.area = this.areaAt(x, y)
    this.trigger = this.triggerAt(x, y)
    this.crowd.spawn(def, this.world, this.spritePitch, (tx, ty) => this.reservedTile(tx, ty), { x, y })
    this.updateCamera()
  }

  private triggerAt(x: number, y: number) {
    return this.world!.def.triggers?.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) ?? null
  }

  private areaAt(x: number, y: number) {
    const a = this.world!.def.areas?.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
    return a?.name ?? null
  }

  /**
   * Tiles the crowd keeps off: doors/warps and the tiles in front of them, signs and other
   * interactions, bump triggers, the legendary's trigger zone and landing tile, and the portal.
   */
  private reservedTile(x: number, y: number) {
    const def = this.world!.def
    const near = (p: { x: number; y: number }, r = 1) => Math.abs(p.x - x) + Math.abs(p.y - y) <= r
    if (def.warps.some((w) => near(w)) || this.extraWarps.some((w) => near(w))) return true
    if (def.interactions.some((i) => near(i, 0)) || def.bumps?.some((b) => near(b, 0))) return true
    if (def.portal && near(def.portal, 1)) return true
    if (def.legendary && near(def.legendary, 1)) return true
    const z = def.legendaryZone
    return !!z && x >= z.x - 1 && x < z.x + z.w + 1 && y >= z.y - 1 && y < z.y + z.h + 1
  }

  /** Where a crowd member may step: open ground no one else (player, partner, legendary) holds. */
  private crowdCanEnter = (x: number, y: number) => {
    if (this.world!.isSolid(x, y) || this.reservedTile(x, y)) return false
    for (const a of [this.player, this.follower]) {
      if (a.tx === x && a.ty === y) return false
      const f = a.fromTile
      if (f && f[0] === x && f[1] === y) return false
    }
    return !(this.legend && this.legend.x === x && this.legend.y === y)
  }

  private spawnLegendary(def: MapDef) {
    if (this.legend) {
      this.scene.remove(this.legend.actor.group)
      this.legend.actor.dispose()
      this.legend = null
    }
    this.pendingLegendary = null
    if (!def.legendary) return
    const { id, x, y } = def.legendary
    if (this.hooks.isDefeated(id)) {
      this.placeSparkle(x, y)
      return
    }
    const data = legendary(id)
    const zone = def.legendaryZone ?? { x, y, w: 1, h: 1 }
    this.pendingLegendary = { data, fallbackX: x, fallbackY: y, zone }
  }

  private inLegendaryZone(px: number, py: number) {
    const z = this.pendingLegendary?.zone
    return !!z && px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h
  }

  /**
   * Where a legendary should land beside the player — never their own tile. Lateral (left/
   * right) spots are tried first: under this camera's pitch, a tile directly ahead in the
   * player's own travel direction reads as "stacked behind them", while a side tile reads
   * clearly as standing beside and facing them, which is the look we want.
   */
  private landingSpot(px: number, py: number, fallback: { x: number; y: number }) {
    const order: Dir[] = ['right', 'left', 'up', 'down']
    for (const d of order) {
      const [dx, dy] = DIR_VEC[d]
      const x = px + dx
      const y = py + dy
      if (!this.blocked(x, y)) return { x, y, dir: OPPOSITE[d] }
    }
    return { ...fallback, dir: 'down' as Dir }
  }

  /** The portal that opens once this map's `portal.after` legendary is beaten. */
  private spawnPortal(def: MapDef) {
    const p = def.portal!
    const portal = buildPortal()
    portal.position.set(p.x + 0.5, 0, p.y + 0.5)
    this.world!.addAnimated(portal)
    this.extraWarps.push({ x: p.x, y: p.y, to: p.to, tx: p.tx, ty: p.ty, dir: p.dir })
    return portal
  }

  private placeSparkle(x: number, y: number) {
    const s = buildSparkle()
    s.position.set(x + 0.5, 0.8, y + 0.5)
    this.world!.addAnimated(s)
  }

  private blocked(x: number, y: number) {
    return this.world!.isSolid(x, y) || (this.legend !== null && this.legend.x === x && this.legend.y === y) || this.crowd.occupies(x, y)
  }

  /** Fly a pending legendary in once the player nears its zone, landing beside — never on
   *  top of — the player, facing them. */
  private spawnAndEncounter(pending: PendingLegendary) {
    return this.runScript(async (ctx) => {
      const { data } = pending
      const def = this.world!.def
      const { x, y, dir } = def.legendaryFixed
        ? { x: pending.fallbackX, y: pending.fallbackY, dir: 'down' as Dir }
        : this.landingSpot(this.player.tx, this.player.ty, { x: pending.fallbackX, y: pending.fallbackY })
      const actor = new Actor(this.assets.sheets[data.overworld.sheet], x, y, dir, this.spritePitch)
      actor.hover = data.overworld.hover
      this.scene.add(actor.group)
      this.legend = { data, actor, x, y }

      if (def.legendaryIntro === 'waterfall') {
        await this.waterfallIntro(actor, x, y)
        await this.encounter(ctx)
        return
      }
      actor.group.position.y = 6.5

      await this.tween(1.15, (k) => {
        const ease = k * k * (3 - 2 * k)
        actor.group.position.y = 6.5 * (1 - ease)
      })
      // a little landing bounce
      await this.tween(0.22, (k) => (actor.group.position.y = -0.22 * Math.sin(k * Math.PI)))
      actor.group.position.y = 0

      await this.encounter(ctx)
    })
  }

  /**
   * The HGSS Lugia arrival: a light rises from the player and bursts, the camera pans to
   * the pool, the waterfall surges white, the legendary descends through it to hover over
   * the water, then the camera comes back to the player.
   */
  private async waterfallIntro(actor: Actor, x: number, y: number) {
    this.player.face('up')
    const px = this.player.worldX
    const pz = this.player.worldZ

    // a glowing light rising from the player, then an expanding ring burst
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d0 }))
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.35 }))
    orb.add(halo)
    orb.position.set(px, 1.2, pz)
    this.scene.add(orb)
    await this.tween(1.1, (k) => {
      orb.position.y = 1.2 + k * 1.3
      halo.scale.setScalar(1 + Math.sin(k * Math.PI * 4) * 0.15)
    })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }))
    ring.position.copy(orb.position)
    this.scene.add(ring)
    this.hud.fadeColor = 'white'
    await this.tween(0.6, (k) => {
      ring.scale.setScalar(1 + k * 5)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = 1 - k
      this.hud.fade = Math.sin(k * Math.PI) * 0.55
    })
    this.scene.remove(orb, ring)
    orb.geometry.dispose()
    halo.geometry.dispose()
    ring.geometry.dispose()

    // pan to the pool
    const tx = x + 0.5
    const tz = y - 2.5
    this.camFocus = { x: px, z: pz }
    await this.tween(1.3, (k) => {
      const e = k * k * (3 - 2 * k)
      this.camFocus = { x: px + (tx - px) * e, z: pz + (tz - pz) * e }
    })

    // the waterfall surges and whites out the screen
    const falls = this.world!.propsOfKind('waterfall')
    const setSurge = (v: number) => falls.forEach((f) => f.userData.setSurge?.(v))
    await this.tween(0.9, (k) => {
      setSurge(k)
      this.hud.fade = k * 0.85
    })
    // the legendary descends through the falls while the white clears
    actor.group.position.y = 7
    await this.tween(1.6, (k) => {
      const e = 1 - (1 - k) * (1 - k)
      actor.group.position.y = 7 * (1 - e)
      this.hud.fade = 0.85 * (1 - k)
      setSurge(1 - k * 0.8)
    })
    actor.group.position.y = 0
    this.hud.fade = 0
    this.hud.fadeColor = 'black'
    await this.tween(0.6, () => {})
    await this.tween(1.2, (k) => setSurge(0.2 * (1 - k)))

    // back to the player
    const from = { ...this.camFocus }
    await this.tween(1.1, (k) => {
      const e = k * k * (3 - 2 * k)
      this.camFocus = { x: from.x + (px - from.x) * e, z: from.z + (pz - from.z) * e }
    })
    this.camFocus = null
  }

  // ── main loop ───────────────────────────────────────────────────────────────

  private frame = (t: number) => {
    if (this.destroyed) return
    const dt = this.last ? Math.min(0.05, (t - this.last) / 1000) : 0
    this.last = t
    this.update(dt)
    if (this.battle) this.renderer.render(this.battle.scene, this.battle.camera)
    else this.renderer.render(this.scene, this.camera)
    this.hud.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private update(dt: number) {
    const paused = this.hooks.isPaused()
    if (!paused && this.pauseWaiters.length) {
      const waiters = this.pauseWaiters
      this.pauseWaiters = []
      waiters.forEach((w) => w())
    }
    this.tweens = this.tweens.filter((tw) => tw(dt))
    if (paused) {
      this.aQueued = false
      this.bQueued = false
      this.dirQueue = []
      return
    }
    this.hud.update(dt)
    if (this.handleMenus()) return
    if (this.battle) {
      this.battle.update(dt)
      return
    }

    this.world!.update(dt)
    const arrived = this.player.update(dt)
    this.follower.update(dt)
    this.legend?.actor.update(dt)
    this.crowd.update(dt, this.crowdCanEnter, this.mode !== 'explore')

    if (arrived) {
      // stepping into a named spot (a building's forecourt) flashes its name top-left
      const area = this.areaAt(this.player.tx, this.player.ty)
      if (area !== this.area) {
        this.area = area
        if (area) this.hud.showBanner(area)
      }
    }
    if (arrived && this.mode === 'explore') {
      // several rectangles can share one script (the tiles around an exhibit): moving between
      // them isn't a new arrival, so only a change of script fires
      const trig = this.triggerAt(this.player.tx, this.player.ty)
      const fresh = trig && trig.run !== this.trigger?.run
      this.trigger = trig
      if (fresh) void this.runScript(trig.run)
    }
    if (arrived && this.mode === 'explore' && this.inLegendaryZone(this.player.tx, this.player.ty)) {
      const pending = this.pendingLegendary!
      this.pendingLegendary = null
      void this.spawnAndEncounter(pending)
    }

    // A stays buffered until something can use it (e.g. pressed mid-step)
    if (this.aQueued && this.hud.open) {
      this.aQueued = false
      this.hud.advance()
    } else if (this.mode === 'explore' && !this.player.moving) {
      const aPressed = this.aQueued
      this.aQueued = false
      this.handleExplore(aPressed)
    }
    this.updateCamera()
  }

  /**
   * Route button presses to whatever menu is up: the YES/NO box, the battle's bottom-screen
   * commands, or battle text. Returns true when the frame's input was fully handled.
   */
  private handleMenus(): boolean {
    const dirs = this.dirQueue
    this.dirQueue = []
    if (this.hud.choosing) {
      for (const d of dirs) if (d === 'up' || d === 'down') this.hud.moveChoice(d === 'up' ? -1 : 1)
      if (this.aQueued) this.hud.confirmChoice()
      else if (this.bQueued) this.hud.confirmChoice(true)
      this.aQueued = this.bQueued = false
      return true
    }
    const bottom = useBottom.getState()
    if (bottom.onPick) {
      const n = bottom.choices.length
      let cursor = bottom.cursor
      for (const d of dirs) cursor = (cursor + (d === 'left' || d === 'up' ? -1 : 1) + n) % n
      if (cursor !== bottom.cursor) bottom.set({ cursor })
      const choice = bottom.choices[cursor]
      const emptyMove = choice.startsWith('move') && !bottom.moves[Number(choice.slice(4))]
      if (this.aQueued && !emptyMove) bottom.pick(choice)
      else if (this.bQueued && bottom.mode === 'battleMoves') bottom.pick('back')
      this.aQueued = this.bQueued = false
      return false
    }
    this.bQueued = false
    if (this.battle && this.aQueued) {
      this.aQueued = false
      if (this.hud.open) this.hud.advance()
    }
    return false
  }

  private handleExplore(aPressed: boolean) {
    if (aPressed) {
      this.interact()
      return
    }
    const dir = this.currentDir()
    if (!dir) {
      this.player.setSheet(this.assets.sheets.heroWalk)
      return
    }
    const pressedAt = this.held.get(dir) ?? 0
    const heldFor = (performance.now() - pressedAt) / 1000
    // A press that turned the player only starts walking once it's been held past the delay.
    if (this.player.dir !== dir) this.turnPress = pressedAt
    if (heldFor < TURN_DELAY && this.turnPress === pressedAt) {
      this.player.face(dir)
      return
    }
    this.tryMove(dir)
  }

  private currentDir(): Dir | null {
    let best: Dir | null = null
    let bestT = -1
    for (const [d, t] of this.held) {
      if (t > bestT) {
        best = d
        bestT = t
      }
    }
    return best
  }

  private tryMove(dir: Dir) {
    const world = this.world!
    const def = world.def
    const [dx, dy] = DIR_VEC[dir]
    const nx = this.player.tx + dx
    const ny = this.player.ty + dy

    const warp = def.warps.find((w) => w.x === nx && w.y === ny) ?? this.extraWarps.find((w) => w.x === nx && w.y === ny)
    if (warp) {
      this.player.face(dir)
      void this.warp(warp.to, warp.tx, warp.ty, warp.dir)
      return
    }
    const bump = def.bumps?.find((b) => b.x === nx && b.y === ny)
    if (bump) {
      this.player.face(dir)
      void this.runScript(bump.run)
      return
    }
    if (this.blocked(nx, ny)) {
      this.player.face(dir)
      return
    }
    const speed = this.runHeld ? RUN_SPEED : WALK_SPEED
    this.player.setSheet(this.runHeld ? this.assets.sheets.heroRun : this.assets.sheets.heroWalk)
    const ox = this.player.tx
    const oy = this.player.ty
    this.player.step(dir, speed)
    if (this.follower.tx !== ox || this.follower.ty !== oy) this.follower.stepTo(ox, oy, speed)
  }

  private interact() {
    const [dx, dy] = DIR_VEC[this.player.dir]
    const fx = this.player.tx + dx
    const fy = this.player.ty + dy
    if (this.follower.tx === fx && this.follower.ty === fy) {
      this.follower.face(OPPOSITE[this.player.dir])
      void this.runScript((ctx) => ctx.say('Typhlosion is happy to be walking with you!', { speaker: this.follower }))
      return
    }
    const other = this.crowd.at(fx, fy)
    if (other) {
      this.crowd.greet(other, this.player.dir)
      const lines = this.crowd.lines(other, this.world!.def.id)
      void this.runScript((ctx) => ctx.say(lines, { speaker: other.actor })).finally(() => this.crowd.release(other))
      return
    }
    if (this.legend && this.legend.x === fx && this.legend.y === fy) {
      void this.runScript((ctx) => this.encounter(ctx))
      return
    }
    const hit = this.world!.def.interactions.find((i) => i.x === fx && i.y === fy)
    if (hit) void this.runScript(hit.run)
  }

  // ── scripting ───────────────────────────────────────────────────────────────

  private async runScript(fn: (ctx: ScriptContext) => Promise<void>) {
    this.mode = 'script'
    this.held.clear()
    try {
      await fn(this.context())
    } finally {
      if (this.mode === 'script') this.mode = 'explore'
    }
  }

  private context(): ScriptContext {
    return {
      player: this.player,
      follower: this.follower,
      say: (text, opts = {}) => {
        const speaker = opts.speaker ?? null
        const style = opts.style ?? (speaker ? 'speech' : 'system')
        return this.hud.show(Array.isArray(text) ? text : [text], style, () => (speaker ? this.screenPos(speaker) : null))
      },
      openContent: (id) => {
        this.hooks.openContent(id)
        return new Promise<void>((res) => this.pauseWaiters.push(res))
      },
      warp: (to, x, y, dir) => this.warp(to, x, y, dir),
      ask: async (question, options) => {
        void this.hud.show([question], 'system', undefined, { sticky: true })
        const i = await this.hud.choose(options)
        this.hud.clear()
        return i
      },
      battle: (id) => this.runBattle(id),
      wait: (s) => new Promise<void>((res) => {
        let t = 0
        this.tweens.push((dt) => {
          t += dt
          if (t >= s) res()
          return t < s
        })
      }),
    }
  }

  // ── legendaries & battles ─────────────────────────────────────────────────────

  /** Walk up to a legendary and press A: intro text, its cry, then the challenge. */
  private async encounter(ctx: ScriptContext) {
    const legend = this.legend!
    const L = legend.data
    await ctx.say(L.introDialogue)
    await ctx.say(L.cry, { speaker: legend.actor })
    const choice = await ctx.ask(`Challenge the ${L.displayName}?`, ['YES', 'NO'])
    if (choice !== 0) return
    await ctx.battle(L.id)
    this.hooks.defeat(L.id)
    this.scene.remove(legend.actor.group)
    legend.actor.dispose()
    this.legend = null
    this.placeSparkle(legend.x, legend.y)
    await ctx.say(L.defeatText)
    const def = this.world!.def
    if (def.portal && def.portal.after === L.id) {
      this.spawnPortal(def)
      await ctx.say(['A shimmering portal has opened...', 'It seems to lead to the Hall of Fame.'])
    }
    // Reward: beating Latias unlocks the Music Player, a new
    // Spotify app on the phone. Hard-coded to this one legendary for now — extend the
    // condition here if a later legendary should grant its own reward.
    if (L.id === 'lake') {
      this.hooks.unlockMusic()
      await ctx.say(['You got the MUSIC PLAYER!', 'A new app just appeared on your phone.'])
    }
  }

  private async runBattle(id: string) {
    const L = legendary(id)
    const prev = this.mode
    this.mode = 'transition'
    this.held.clear()

    // BW wild intro: two quick white flashes, then a zoom-rush into white
    this.hud.fadeColor = 'white'
    for (let i = 0; i < 2; i++) {
      await this.tweenFade(0.85, 0.08)
      await this.tweenFade(0, 0.1)
    }
    const fov0 = this.camera.fov
    await this.tween(0.55, (k) => {
      this.camera.fov = fov0 * (1 - 0.6 * k)
      this.camera.updateProjectionMatrix()
      this.hud.fade = k
    })
    this.camera.fov = fov0
    this.camera.updateProjectionMatrix()

    const battle = new Battle({
      env: L.environment.battle,
      foeTitle: `The wild ${L.battleName}`,
      foe: { name: L.battleName, level: L.level, hp: L.maxHp, maxHp: L.maxHp, sheet: this.assets.battle[L.battleSprite], hover: L.overworld.hover },
      ally: { name: STARTER.displayName, level: STARTER.level, hp: STARTER.maxHp, maxHp: STARTER.maxHp, sheet: this.assets.battle.typhlosion_back },
      move: { name: STARTER.moveName, type: STARTER.moveType, pp: STARTER.movePP, maxPp: STARTER.movePP },
      finisherText: L.finishingMoveDesc,
    }, this.assets, this.hud, (text, style, opts) => this.hud.show([text], style, undefined, opts))
    battle.resize(this.viewW, this.viewH)
    this.battle = battle
    this.mode = 'battle'
    await battle.run()

    this.hud.fadeColor = 'black'
    await this.fadeTo(1)
    this.battle = null
    battle.dispose()
    this.mode = prev === 'explore' ? 'explore' : 'script'
    await this.fadeTo(0)
  }

  private tween(sec: number, fn: (k: number) => void) {
    return new Promise<void>((res) => {
      let t = 0
      this.tweens.push((dt) => {
        t = Math.min(sec, t + dt)
        fn(t / sec)
        if (t >= sec) res()
        return t < sec
      })
    })
  }

  private tweenFade(target: number, sec: number) {
    const from = this.hud.fade
    return this.tween(sec, (k) => (this.hud.fade = from + (target - from) * k))
  }

  private async warp(to: string, x: number, y: number, dir: Dir) {
    const prev = this.mode
    this.mode = 'transition'
    await this.fadeTo(1)
    this.loadMap(to, x, y, dir)
    await this.fadeTo(0)
    const def = MAPS[to]
    if (def.kind === 'outdoor' && def.name) this.hud.showBanner(this.area ?? def.name)
    this.mode = prev === 'script' ? 'script' : 'explore'
  }

  private fadeTo(target: number) {
    return new Promise<void>((res) => {
      const from = this.hud.fade
      let t = 0
      this.tweens.push((dt) => {
        t += dt
        const k = Math.min(1, t / FADE_TIME)
        this.hud.fade = from + (target - from) * k
        if (k >= 1) res()
        return k < 1
      })
    })
  }

  // ── camera ──────────────────────────────────────────────────────────────────

  /** The map's framing blended with any camera zone the player is in or near. */
  private zoneCamera() {
    const def = this.world!.def
    let { pitch, dist } = this.cam
    let lift = 0
    for (const z of def.cameraZones ?? []) {
      // distance (tiles) from the player's feet to the zone rectangle
      const px = this.player.worldX
      const pz = this.player.worldZ
      const dx = Math.max(z.x - px, 0, px - (z.x + z.w))
      const dz = Math.max(z.y - pz, 0, pz - (z.y + z.h))
      const fade = z.fade ?? 3
      const k = THREE.MathUtils.smoothstep(1 - Math.hypot(dx, dz) / fade, 0, 1)
      if (k <= 0) continue
      pitch += ((z.pitch ?? pitch) - pitch) * k
      dist += ((z.dist ?? dist) - dist) * k
      lift += (z.lift ?? 0) * k
    }
    return { pitch, dist, lift }
  }

  private updateCamera() {
    const def = this.world!.def
    const { fov } = this.cam
    const { pitch, dist, lift } = this.camFocus ? { ...this.cam, lift: 0 } : this.zoneCamera()
    // sprites are stretched to read at 1:1 through the camera's tilt; keep them matched
    // (whole degrees, so a zone blend doesn't rebuild billboards every frame)
    const spritePitch = Math.round(pitch)
    if (spritePitch !== this.spritePitch) {
      this.spritePitch = spritePitch
      this.player.setPitch(spritePitch)
      this.follower.setPitch(spritePitch)
      this.legend?.actor.setPitch(spritePitch)
      this.crowd.setPitch(spritePitch)
    }
    const p = THREE.MathUtils.degToRad(pitch)
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2)
    const halfW = halfH * (this.viewW / this.viewH)
    const halfZ = halfH / Math.sin(p)
    const slack = def.kind === 'outdoor' ? 2 : 0.5
    const clamp = (v: number, size: number, half: number) =>
      size <= half * 2 - slack * 2 ? size / 2 : Math.max(half - slack, Math.min(size - half + slack, v))

    const tx = clamp(this.camFocus?.x ?? this.player.worldX, def.width, halfW)
    const tz = clamp(this.camFocus?.z ?? this.player.worldZ, def.height, halfZ)
    this.camera.position.set(tx, lift + dist * Math.sin(p), tz + dist * Math.cos(p))
    this.camera.lookAt(tx, lift, tz)
  }

  /** Where an actor's head is on the DS top screen, for aiming the speech-bubble tail. */
  private screenPos(actor: Actor) {
    const v = new THREE.Vector3(actor.worldX, 1.6, actor.worldZ).project(this.camera)
    return { x: Math.round((v.x * 0.5 + 0.5) * this.viewW), y: Math.round((-v.y * 0.5 + 0.5) * this.viewH) }
  }

  // ── input ───────────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.hooks.isPaused()) return
    const dir = KEY_DIR[e.key]
    if (dir || A_KEYS.has(e.key) || B_KEYS.has(e.key)) e.preventDefault()
    if (dir) this.dirQueue.push(dir)
    if (e.repeat) return
    if (dir) this.held.set(dir, performance.now())
    if (A_KEYS.has(e.key)) this.aQueued = true
    if (B_KEYS.has(e.key)) {
      this.runHeld = true
      this.bQueued = true
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const dir = KEY_DIR[e.key]
    if (dir) this.held.delete(dir)
    if (B_KEYS.has(e.key)) this.runHeld = false
  }

  private onBlur = () => {
    this.held.clear()
    this.runHeld = false
  }
}
