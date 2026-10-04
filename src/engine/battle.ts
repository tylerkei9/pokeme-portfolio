import * as THREE from 'three'
import type { AnimSheet, Assets } from './assets'
import type { BattleEnv } from '../systems/BattleSystem'
import { useBottom, type BottomMode } from '../systems/BottomState'
import { makeCanvas, pixelTexture, rect, rng, speckle, type RGB } from './pixel'
import type { DialogStyle, Hud } from './hud'

export interface Combatant {
  name: string
  level: number
  hp: number
  maxHp: number
  sheet: AnimSheet
  /** Floating Pokémon hover above their platform. */
  hover?: boolean
}

export interface BattleSetup {
  env: BattleEnv
  /** Text used in "The X appeared!". */
  foeTitle: string
  foe: Combatant
  ally: Combatant
  move: { name: string; type: string; pp: number; maxPp: number }
  finisherText: string
}

type Say = (text: string, style: DialogStyle, opts?: { autoClose?: number; sticky?: boolean }) => Promise<void>

// ── layout (world units; the camera looks toward -z) ──────────────────────────────
const FOE_POS = new THREE.Vector3(2.5, 0, -4.6)
const ALLY_POS = new THREE.Vector3(-2.3, 0, 2.3)

interface Pose { pos: THREE.Vector3; look: THREE.Vector3 }
const pose = (p: [number, number, number], l: [number, number, number]): Pose => ({
  pos: new THREE.Vector3(...p), look: new THREE.Vector3(...l),
})
const POSES = {
  default: pose([-0.4, 2.8, 9.4], [0.9, 1.1, -2.2]),
  intro: pose([3.6, 1.5, -0.8], [2.5, 1.5, -4.6]),
  ally: pose([-0.4, 2.3, 7.2], [-2.1, 1.5, 1.6]),
  foe: pose([1.5, 1.9, 1.2], [2.5, 1.6, -4.6]),
}

// ── environments ──────────────────────────────────────────────────────────────────
interface EnvStyle {
  sky: RGB[]
  ground: RGB[]
  platform: [RGB, RGB, RGB]
  fog: RGB
  mosaic?: boolean
}

const ENVS: Record<BattleEnv, EnvStyle> = {
  // Route 1 / wild grass battle in the reference video
  grass: {
    sky: [[92, 164, 224], [156, 204, 240], [226, 242, 250], [244, 250, 252]],
    ground: [[176, 224, 176], [128, 202, 132], [84, 176, 96], [60, 150, 76]],
    platform: [[28, 116, 92], [48, 160, 122], [92, 206, 156]],
    fog: [236, 246, 250],
  },
  ruins: {
    sky: [[28, 22, 20], [56, 44, 36], [96, 78, 60], [120, 98, 74]],
    ground: [[150, 118, 76], [178, 140, 90], [200, 160, 104], [214, 176, 116]],
    platform: [[118, 106, 90], [170, 160, 140], [214, 206, 188]],
    fog: [84, 68, 54],
    mosaic: true,
  },
  cave: {
    sky: [[6, 14, 26], [14, 32, 48], [26, 60, 76], [40, 84, 98]],
    ground: [[40, 78, 90], [46, 92, 104], [54, 104, 114], [62, 112, 120]],
    platform: [[54, 74, 84], [86, 110, 120], [130, 156, 166]],
    fog: [24, 52, 68],
  },
}

/** Vertical gradient in hard DS-style bands; row 0 is the top. */
function bandTexture(colors: RGB[], height = 96, seed = 1, mosaic = false) {
  const { c, g } = makeCanvas(64, height)
  const bands = height / (colors.length - 1)
  for (let y = 0; y < height; y++) {
    const t = Math.min(colors.length - 1.001, y / bands)
    const i = Math.floor(t)
    const f = t - i
    const a = colors[i]
    const b = colors[i + 1]
    // row-dithered blend between neighbouring colours (horizontal scanline bands, not a
    // checkerboard, since the texture is stretched across a huge plane)
    rect(g, 0, y, 64, 1, (y % 2 === 0 ? f + 0.15 : f - 0.15) > 0.5 ? b : a)
  }
  speckle(g, 0, 0, 64, height, [[255, 255, 255]], 0.004, rng(seed))
  if (mosaic) {
    for (let y = 0; y < height; y += 8) {
      for (let x = 0; x < 64; x += 8) {
        for (let k = 0; k < 4; k++) {
          rect(g, x + 4 - k, y + k, 1, 1, [120, 88, 52])
          rect(g, x + 4 + k, y + k, 1, 1, [120, 88, 52])
          rect(g, x + k, y + 4 + k, 1, 1, [120, 88, 52])
          rect(g, x + 8 - k, y + 4 + k, 1, 1, [120, 88, 52])
        }
      }
    }
  }
  return pixelTexture(c)
}

function platformTexture([edge, mid, centre]: [RGB, RGB, RGB]) {
  const { c, g } = makeCanvas(64, 64)
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 31.5, y - 31.5) / 32
      rect(g, x, y, 1, 1, d > 0.86 ? edge : d > 0.55 ? mid : centre)
    }
  }
  return pixelTexture(c)
}

function buildEnvironment(env: BattleEnv) {
  const style = ENVS[env]
  const group = new THREE.Group()
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), new THREE.MeshBasicMaterial({ map: bandTexture(style.sky, 96, 3), fog: false }))
  sky.position.set(0, 26, -60)
  group.add(sky)

  const groundTex = bandTexture(style.ground, 256, 5, style.mosaic)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 80), new THREE.MeshBasicMaterial({ map: groundTex }))
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, 0, -25)
  group.add(ground)

  const top = new THREE.MeshBasicMaterial({ map: platformTexture(style.platform) })
  const side = new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${style.platform[0].join(',')})`) })
  for (const [p, r] of [[FOE_POS, 2.3], [ALLY_POS, 2.9]] as const) {
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 40), [side, top, side])
    plat.position.copy(p).setY(0.07)
    group.add(plat)
  }
  return { group, fog: new THREE.Fog(new THREE.Color(`rgb(${style.fog.join(',')})`), 18, 70) }
}

// ── sprites ───────────────────────────────────────────────────────────────────────

/** A BW animated battle sprite on a camera-facing plane, anchored at its feet. */
class AnimSprite {
  readonly mesh: THREE.Mesh
  private tex: THREE.Texture
  private mat: THREE.MeshBasicMaterial
  private rows: number
  private frame = 0
  private t = 0

  constructor(private sheet: AnimSheet, unitsPerPx: number) {
    this.tex = sheet.texture.clone()
    this.tex.needsUpdate = true
    this.rows = Math.ceil(sheet.count / sheet.cols)
    this.tex.repeat.set(1 / sheet.cols, 1 / this.rows)
    const w = sheet.w * unitsPerPx
    const h = sheet.h * unitsPerPx
    const geo = new THREE.PlaneGeometry(w, h)
    geo.translate(0, h / 2, 0)
    this.mat = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.1, fog: false })
    this.mesh = new THREE.Mesh(geo, this.mat)
    this.setFrame(0)
  }

  update(dt: number) {
    this.t += dt * 1000
    while (this.t >= this.sheet.durations[this.frame]) {
      this.t -= this.sheet.durations[this.frame]
      this.frame = (this.frame + 1) % this.sheet.count
    }
    this.setFrame(this.frame)
  }

  private setFrame(i: number) {
    const col = i % this.sheet.cols
    const row = Math.floor(i / this.sheet.cols)
    this.tex.offset.set(col / this.sheet.cols, 1 - (row + 1) / this.rows)
  }

  /** 0 = normal, 1 = black silhouette (wild Pokémon start dark in BW). */
  set darkness(v: number) {
    this.mat.color.setScalar(1 - v)
  }

  set opacity(v: number) {
    this.mat.opacity = v
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
    this.tex.dispose()
  }
}

let fireTexture: THREE.Texture | null = null
function getFireTexture() {
  if (fireTexture) return fireTexture
  const { c, g } = makeCanvas(16, 16)
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5)
      if (d < 3) rect(g, x, y, 1, 1, [255, 248, 200])
      else if (d < 5.5) rect(g, x, y, 1, 1, [255, 200, 64])
      else if (d < 7.5) rect(g, x, y, 1, 1, [240, 96, 32])
    }
  }
  fireTexture = pixelTexture(c)
  return fireTexture
}

interface Particle {
  sprite: THREE.Sprite
  vel: THREE.Vector3
  life: number
  max: number
  gravity: number
}

// ── the battle ────────────────────────────────────────────────────────────────────

/**
 * A one-move legendary battle staged like BW's: the camera sweeps in on a darkened foe,
 * the partner is sent out, FIGHT is picked on the bottom screen, and a single finishing
 * move ends it. There is deliberately no way to lose.
 */
export class Battle {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(40, 256 / 192, 0.1, 400)
  private foe: AnimSprite
  private ally: AnimSprite
  private jobs: ((dt: number) => boolean)[] = []
  private particles: Particle[] = []
  private camPos = new THREE.Vector3()
  private camLook = new THREE.Vector3()
  private shake = 0
  private clock = 0
  private foeOffset = new THREE.Vector3()
  private allyOffset = new THREE.Vector3()
  private allyScale = 0

  // HUD state
  private foeBar = 0
  private allyBar = 0
  private foeHp: number
  private allyHp: number

  constructor(private setup: BattleSetup, private assets: Assets, private hud: Hud, private say: Say) {
    const env = buildEnvironment(setup.env)
    this.scene.add(env.group)
    this.scene.fog = env.fog
    this.scene.background = env.fog.color

    this.foe = new AnimSprite(setup.foe.sheet, 0.042)
    this.ally = new AnimSprite(setup.ally.sheet, 0.044)
    this.scene.add(this.foe.mesh, this.ally.mesh)
    this.foeHp = setup.foe.hp
    this.allyHp = setup.ally.hp
    this.ally.mesh.visible = false

    this.setPose(POSES.intro)
    hud.overlay = (g) => this.drawHud(g)
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  dispose() {
    this.hud.overlay = null
    this.foe.dispose()
    this.ally.dispose()
    for (const p of this.particles) this.scene.remove(p.sprite)
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        m.geometry.dispose()
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        mats.forEach((mat) => {
          ;(mat as THREE.MeshBasicMaterial).map?.dispose()
          mat.dispose()
        })
      }
    })
  }

  // ── per-frame ────────────────────────────────────────────────────────────────

  update(dt: number) {
    this.clock += dt
    this.jobs = this.jobs.filter((j) => j(dt))
    this.foe.update(dt)
    this.ally.update(dt)

    const hoverY = this.setup.foe.hover ? 0.7 + Math.sin(this.clock * 2) * 0.12 : 0.12
    this.foe.mesh.position.copy(FOE_POS).add(this.foeOffset).setY(FOE_POS.y + hoverY + this.foeOffset.y)
    this.ally.mesh.position.copy(ALLY_POS).add(this.allyOffset).setY(0.12 + this.allyOffset.y)
    this.ally.mesh.scale.setScalar(Math.max(0.001, this.allyScale))

    // gentle idle sway, like BW's always-drifting battle camera
    const sway = new THREE.Vector3(Math.sin(this.clock * 0.5) * 0.12, Math.sin(this.clock * 0.7) * 0.05, 0)
    const jitter = this.shake > 0 ? new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0) : new THREE.Vector3()
    this.shake = Math.max(0, this.shake - dt * 1.2)
    this.camera.position.copy(this.camPos).add(sway).add(jitter)
    this.camera.lookAt(this.camLook)
    this.foe.mesh.quaternion.copy(this.camera.quaternion)
    this.ally.mesh.quaternion.copy(this.camera.quaternion)

    this.particles = this.particles.filter((p) => {
      p.life += dt
      p.vel.y -= p.gravity * dt
      p.sprite.position.addScaledVector(p.vel, dt)
      const k = p.life / p.max
      p.sprite.material.opacity = 1 - k * k
      if (p.life >= p.max) {
        this.scene.remove(p.sprite)
        p.sprite.material.dispose()
        return false
      }
      return true
    })
  }

  // ── timing helpers ───────────────────────────────────────────────────────────

  private wait(sec: number) {
    return this.tween(sec, () => {})
  }

  private tween(sec: number, fn: (k: number) => void) {
    return new Promise<void>((res) => {
      let t = 0
      this.jobs.push((dt) => {
        t = Math.min(sec, t + dt)
        const k = sec === 0 ? 1 : t / sec
        fn(k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
        if (t >= sec) res()
        return t < sec
      })
    })
  }

  private setPose(p: Pose) {
    this.camPos.copy(p.pos)
    this.camLook.copy(p.look)
  }

  private moveCamera(p: Pose, sec: number) {
    const fromPos = this.camPos.clone()
    const fromLook = this.camLook.clone()
    return this.tween(sec, (k) => {
      this.camPos.lerpVectors(fromPos, p.pos, k)
      this.camLook.lerpVectors(fromLook, p.look, k)
    })
  }

  private pickOnBottom(mode: BottomMode, choices: string[]) {
    return new Promise<string>((res) => {
      useBottom.getState().set({
        mode, cursor: 0, choices,
        onPick: (c) => {
          useBottom.getState().set({ onPick: null })
          res(c)
        },
      })
    })
  }

  // ── the scripted fight ───────────────────────────────────────────────────────

  async run() {
    const { setup, hud } = this
    const bottom = useBottom.getState()
    bottom.set({ mode: 'battleIdle', moves: [setup.move] })

    // Wild intro: the camera starts right on the silhouetted foe and pulls back.
    this.foe.darkness = 0.9
    hud.fadeColor = 'white'
    await this.tween(0.35, (k) => (hud.fade = 1 - k))
    hud.fadeColor = 'black'
    void this.tween(1.1, (k) => (this.foe.darkness = 0.9 * (1 - k)))
    await this.moveCamera(POSES.default, 1.5)
    void this.tween(0.3, (k) => (this.foeBar = k))
    await this.say(`${setup.foeTitle} appeared!`, 'battle')

    // Send out the partner.
    await this.moveCamera(POSES.ally, 0.6)
    this.ally.mesh.visible = true
    this.burst(ALLY_POS.clone().setY(1.2), 18, [1, 1, 1])
    void this.tween(0.35, (k) => (this.allyScale = k))
    await this.say(`Go! ${setup.ally.name}!`, 'battle', { autoClose: 0.6 })
    void this.tween(0.3, (k) => (this.allyBar = k))
    await this.moveCamera(POSES.default, 0.6)

    // Command loop — only FIGHT → the finishing move actually does anything.
    for (;;) {
      void this.say(`What will ${setup.ally.name} do?`, 'battle', { sticky: true })
      const cmd = await this.pickOnBottom('battleCommand', ['fight', 'bag', 'run', 'pokemon'])
      if (cmd === 'fight') {
        const move = await this.pickOnBottom('battleMoves', ['move0', 'move1', 'move2', 'move3', 'back'])
        if (move === 'move0') break
        continue
      }
      hud.clear()
      useBottom.getState().set({ mode: 'battleIdle' })
      const reply: Record<string, string> = {
        bag: 'There\'s no time to rummage through the Bag now!',
        run: 'No! There\'s no running from this battle!',
        pokemon: `${setup.ally.name} is your only partner. Believe in it!`,
      }
      await this.say(reply[cmd], 'battle')
    }
    hud.clear()
    useBottom.getState().set({ mode: 'battleIdle' })

    await this.say(`${setup.ally.name} used ${setup.move.name}!`, 'battle', { autoClose: 0.4 })
    await this.eruption()

    // HP drains to zero, green → yellow → red.
    const from = this.foeHp
    await this.tween(1.3, (k) => (this.foeHp = from * (1 - k)))
    await this.say(setup.finisherText, 'battle')

    // BW faint: the sprite sinks into its platform and fades.
    await this.tween(0.6, (k) => {
      this.foeOffset.y = -1.2 * k
      this.foe.opacity = 1 - k
    })
    this.foeBar = 0
    await this.say(`${setup.foeTitle} fainted!`, 'battle')
    useBottom.getState().set({ mode: 'menu', onPick: null })
  }

  /** Fire erupts from the partner and rains down on the foe. */
  private async eruption() {
    await this.tween(0.25, (k) => (this.allyOffset.z = -0.5 * Math.sin(k * Math.PI)))
    for (let i = 0; i < 26; i++) {
      this.spawn(ALLY_POS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 1.4, (Math.random() - 0.5) * 0.6)),
        new THREE.Vector3((Math.random() - 0.5) * 2, 7 + Math.random() * 4, (Math.random() - 0.5) * 2), 1.0, 6, 0.9)
    }
    this.shake = 0.25
    await this.wait(0.45)
    await this.moveCamera(POSES.foe, 0.35)
    const blink = setInterval(() => (this.foe.mesh.visible = !this.foe.mesh.visible), 70)
    for (let wave = 0; wave < 4; wave++) {
      for (let i = 0; i < 12; i++) {
        const start = FOE_POS.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3.5, 7 + Math.random() * 2, (Math.random() - 0.5) * 2))
        this.spawn(start, new THREE.Vector3(0, -9 - Math.random() * 3, 0), 0.8, 2, 1.1)
      }
      this.burst(FOE_POS.clone().setY(1.2), 10, [1, 0.6, 0.2])
      this.shake = 0.45
      await this.wait(0.22)
    }
    clearInterval(blink)
    this.foe.mesh.visible = true
    await this.moveCamera(POSES.default, 0.45)
  }

  private spawn(pos: THREE.Vector3, vel: THREE.Vector3, life: number, gravity: number, size: number) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getFireTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }))
    sprite.position.copy(pos)
    sprite.scale.setScalar(size * (0.7 + Math.random() * 0.6))
    this.scene.add(sprite)
    this.particles.push({ sprite, vel, life: 0, max: life, gravity })
  }

  private burst(at: THREE.Vector3, n: number, tint: [number, number, number]) {
    for (let i = 0; i < n; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(3 + Math.random() * 3)
      this.spawn(at, dir, 0.45, 0, 0.7)
      this.particles[this.particles.length - 1].sprite.material.color.setRGB(...tint)
    }
  }

  // ── HUD (drawn on the top screen's 2D layer, using the ripped BW bar graphics) ──

  private drawHud(g: CanvasRenderingContext2D) {
    const { hud: img, hudFont } = this.assets
    const { foe, ally } = this.setup
    if (this.foeBar > 0) {
      const x = Math.round(-img.foe.width * (1 - this.foeBar))
      const y = 14
      g.drawImage(img.foe, x, y)
      hudFont.draw(g, foe.name, x + 4, y - 4)
      hudFont.draw(g, String(foe.level), x + 93, y - 4)
      hpFill(g, x + 44, y + 9, this.foeHp / foe.maxHp)
    }
    if (this.allyBar > 0) {
      const x = this.hud.w - img.player.width + Math.round(img.player.width * (1 - this.allyBar))
      const y = this.hud.h - 88
      g.drawImage(img.player, x, y)
      hudFont.draw(g, ally.name, x + 12, y - 4)
      hudFont.draw(g, String(ally.level), x + 89, y - 4)
      hpFill(g, x + 56, y + 9, this.allyHp / ally.maxHp)
      const cur = String(Math.round(this.allyHp))
      hudFont.draw(g, cur, x + 80 - hudFont.width(cur), y + 11)
      hudFont.draw(g, String(ally.maxHp), x + 88, y + 11)
      g.drawImage(img.exp, x + 30, y + 22)
    }
  }
}

/** 48-px HP track, two rows (light over dark), coloured by remaining HP like BW. */
function hpFill(g: CanvasRenderingContext2D, x: number, y: number, ratio: number) {
  const w = Math.max(0, Math.round(48 * Math.max(0, Math.min(1, ratio))))
  if (w === 0) return
  const [light, dark]: [RGB, RGB] = ratio > 0.5 ? [[0, 255, 74], [0, 189, 33]] : ratio > 0.2 ? [[234, 255, 0], [173, 189, 0]] : [[255, 0, 0], [189, 0, 0]]
  rect(g, x, y, w, 1, light)
  rect(g, x, y + 1, w, 1, dark)
}
