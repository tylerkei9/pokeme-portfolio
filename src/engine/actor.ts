import * as THREE from 'three'
import type { SpriteSheet } from './assets'
import type { Dir } from '../maps/types'

export const DIR_VEC: Record<Dir, [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
}

export const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

/** DS pixels per world unit for sprites. BW's world is drawn larger than its 16 px
 *  sprite grid, so sprites are scaled down relative to tiles (and the camera sits closer). */
const PX = 22

/**
 * A 2D sprite standing in the 3D world, BW-style: an upright billboard anchored at the
 * character's feet, stretched vertically so it reads at 1:1 pixel scale through the
 * tilted camera. Moves one tile at a time.
 */
export class Actor {
  readonly group = new THREE.Group()
  private mesh: THREE.Mesh
  private texture: THREE.Texture
  private sheet: SpriteSheet

  /** Logical tile (the destination while moving). */
  tx: number
  ty: number
  dir: Dir
  moving = false
  /** Floating Pokémon (Latias, Lugia) bob above their shadow. */
  hover = false
  private fromX = 0
  private fromY = 0
  private progress = 0
  private speed = 4
  private stepParity = 0
  private clock = 0

  constructor(sheet: SpriteSheet, x: number, y: number, dir: Dir, pitchDeg: number) {
    this.sheet = sheet
    this.tx = x
    this.ty = y
    this.dir = dir
    this.texture = sheet.texture.clone()
    this.texture.needsUpdate = true
    this.mesh = new THREE.Mesh(this.billboard(pitchDeg), new THREE.MeshBasicMaterial({ map: this.texture, alphaTest: 0.5 }))
    // Nudge toward the camera so the billboard never pokes into whatever is north of it.
    this.mesh.position.z = 0.2
    this.group.add(this.mesh)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.scale.y = 0.55
    shadow.position.set(0, 0.02, 0.1)
    this.group.add(shadow)

    this.place(x, y, dir)
  }

  private pitch = NaN

  /**
   * Upright plane whose height is stretched by 1/cos(pitch), so after the camera's
   * foreshortening the sprite shows at its native pixel size, like on the DS.
   */
  private billboard(pitchDeg: number) {
    this.pitch = pitchDeg
    const w = this.sheet.frameW / PX
    const h = this.sheet.frameH / PX / Math.cos(THREE.MathUtils.degToRad(pitchDeg))
    const geo = new THREE.PlaneGeometry(w, h)
    geo.translate(0, h / 2, 0)
    return geo
  }

  setPitch(pitchDeg: number) {
    if (pitchDeg === this.pitch) return
    this.mesh.geometry.dispose()
    this.mesh.geometry = this.billboard(pitchDeg)
  }

  /** The tile being stepped off mid-move (still visually occupied), else null. */
  get fromTile(): [number, number] | null {
    return this.moving ? [this.fromX, this.fromY] : null
  }

  /** World-space x/z of the sprite's feet (tile centres sit on .5). */
  get worldX() { return this.group.position.x }
  get worldZ() { return this.group.position.z }

  place(x: number, y: number, dir: Dir) {
    this.tx = x
    this.ty = y
    this.dir = dir
    this.moving = false
    this.group.position.set(x + 0.5, 0, y + 0.5)
    this.applyFrame()
  }

  setSheet(sheet: SpriteSheet) {
    if (sheet === this.sheet) return
    this.sheet = sheet
    // Clones share their image source, so swap the whole texture rather than its image.
    this.texture.dispose()
    this.texture = sheet.texture.clone()
    this.texture.needsUpdate = true
    ;(this.mesh.material as THREE.MeshBasicMaterial).map = this.texture
    this.applyFrame()
  }

  face(dir: Dir) {
    this.dir = dir
    this.applyFrame()
  }

  /** Begin a one-tile step. `speed` is tiles per second. */
  step(dir: Dir, speed: number) {
    const [dx, dy] = DIR_VEC[dir]
    this.fromX = this.tx
    this.fromY = this.ty
    this.tx += dx
    this.ty += dy
    this.dir = dir
    this.speed = speed
    this.progress = 0
    this.moving = true
    this.stepParity ^= 1
  }

  /** Step toward an adjacent tile, whichever direction that is. */
  stepTo(x: number, y: number, speed: number) {
    const dx = x - this.tx
    const dy = y - this.ty
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      this.place(x, y, this.dir)
      return
    }
    this.step(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up', speed)
  }

  /** Advance animation/movement. Returns true on the frame the actor arrives on a tile. */
  update(dt: number): boolean {
    this.clock += dt
    let arrived = false
    if (this.moving) {
      this.progress += dt * this.speed
      if (this.progress >= 1) {
        this.progress = 1
        this.moving = false
        arrived = true
      }
      const t = this.progress
      this.group.position.set(
        this.fromX + (this.tx - this.fromX) * t + 0.5, 0,
        this.fromY + (this.ty - this.fromY) * t + 0.5,
      )
    }
    this.applyFrame()
    return arrived
  }

  private applyFrame() {
    const s = this.sheet
    let col = s.stand
    if (this.moving) {
      col = this.progress < 0.5 ? s.steps[this.stepParity % s.steps.length] : s.stand
      if (s.idleAnim) col = s.steps[Math.floor(this.clock * 6) % s.steps.length]
    } else if (s.idleAnim) {
      col = s.steps[Math.floor(this.clock * (s.idleFps ?? 3)) % s.steps.length]
    }
    this.mesh.position.y = this.hover ? 0.35 + Math.sin(this.clock * 2.2) * 0.08 : 0
    const row = s.rowOf[this.dir]
    this.texture.repeat.set(1 / s.cols, 1 / s.rows)
    this.texture.offset.set(col / s.cols, 1 - (row + 1) / s.rows)
  }

  dispose() {
    this.mesh.geometry.dispose()
    ;(this.mesh.material as THREE.Material).dispose()
    this.texture.dispose()
  }
}
