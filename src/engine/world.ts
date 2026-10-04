import * as THREE from 'three'
import type { MapDef } from '../maps/types'
import type { Assets } from './assets'
import { paintGround } from './ground'
import { lambert, makeCanvas, pixelTexture, rect, type RGB } from './pixel'
import { buildBoulders, buildCaveWalls, buildProp, buildSkyline, buildTallGrass, buildTrees, buildWallWindow, buildWater } from './props'

// 'u' is the raised stone curb along a bridge deck's edge; 'X' cave rock, 'R' boulders
const SOLID_GROUND = new Set(['T', 'Y', 'r', 'W', 'u', 'X', 'R', ' '])
const WALL_H = 2.6
const HALL_WALL_H = 4.6
/** How many tiles of forest surround outdoor maps so the camera never sees the edge. */
const FOREST_RING = 6

/** A map instantiated as a Three.js scene graph plus its collision grid. */
export class World {
  readonly group = new THREE.Group()
  private solid: Uint8Array
  /** Per-frame animations (water ripples, sparkles). */
  private animations: ((dt: number) => void)[] = []
  /** Built props, by kind — so scripts can reach e.g. the waterfall to make it surge. */
  private propObjects = new Map<string, THREE.Object3D[]>()

  constructor(readonly def: MapDef, assets: Assets) {
    const { width: W, height: H } = def
    this.solid = new Uint8Array(W * H)
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (SOLID_GROUND.has(def.ground[y][x])) this.solid[y * W + x] = 1
      }
    }

    // ground
    const groundTex = pixelTexture(paintGround(def))
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: groundTex, alphaTest: 0.5 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.set(W / 2, 0, H / 2)
    this.group.add(floor)

    // props
    for (const p of def.props) {
      const obj = buildProp(p, assets)
      this.group.add(obj)
      this.propObjects.set(p.kind, [...(this.propObjects.get(p.kind) ?? []), obj])
      if (obj.userData.animate) this.animations.push(obj.userData.animate)
      if (p.solid !== false) {
        for (let y = p.y; y < p.y + (p.d ?? 1); y++) {
          for (let x = p.x; x < p.x + (p.w ?? 1); x++) this.setSolid(x, y)
        }
      }
    }

    // tall grass, water, boulders
    const grass: { x: number; z: number }[] = []
    const water: { x: number; y: number }[] = []
    const boulders: { x: number; z: number }[] = []
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (def.ground[y][x] === 'G') grass.push({ x: x + 0.5, z: y + 0.5 })
        if (def.ground[y][x] === 'W') water.push({ x, y })
        if (def.ground[y][x] === 'R') boulders.push({ x: x + 0.5, z: y + 0.5 })
      }
    }
    if (grass.length) this.group.add(buildTallGrass(grass, W * 7 + H))
    if (boulders.length) this.group.add(buildBoulders(boulders, W * 13 + H))
    if (water.length) {
      const isWater = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && def.ground[y][x] === 'W'
      const w = buildWater(water, isWater, W, H, this.def.skyBridge
        ? { fillBackground: true, depth: 2.4, viaduct: true, teal: true }
        : this.def.cave
          ? { deep: true, depth: 0.5, bankColor: [30, 50, 48] }
          : {})
      this.animations.push(w.userData.animate)
      this.group.add(w)
    }

    if (def.kind === 'outdoor') this.buildOutdoorSurroundings()
    else this.buildRoomWalls()
  }

  update(dt: number) {
    for (const a of this.animations) a(dt)
  }

  /** Add something animated (it must carry `userData.animate`). */
  addAnimated(obj: THREE.Object3D) {
    this.group.add(obj)
    this.animations.push(obj.userData.animate)
  }

  propsOfKind(kind: string) {
    return this.propObjects.get(kind) ?? []
  }

  isSolid(x: number, y: number) {
    const { width: W, height: H } = this.def
    if (x < 0 || y < 0 || x >= W || y >= H) return true
    return this.solid[y * W + x] === 1
  }

  setSolid(x: number, y: number) {
    const { width: W, height: H } = this.def
    if (x >= 0 && y >= 0 && x < W && y < H) this.solid[y * W + x] = 1
  }

  private buildOutdoorSurroundings() {
    const { width: W, height: H, ground, skyBridge, cave, city } = this.def
    const spots: { x: number; z: number }[] = []
    const autumn: { x: number; z: number }[] = []
    const maple: { x: number; z: number }[] = []
    const rock: { x: number; z: number }[] = []
    for (let y = -FOREST_RING; y < H + FOREST_RING; y++) {
      for (let x = -FOREST_RING; x < W + FOREST_RING; x++) {
        const inside = x >= 0 && y >= 0 && x < W && y < H
        // cave rock: explicit 'X' tiles, plus the whole ring around a cave map
        if ((inside && ground[y][x] === 'X') || (!inside && cave)) {
          rock.push({ x: x + 0.5, z: y + 0.5 })
          continue
        }
        // A bridge/open-water map only plants trees it explicitly asks for — no automatic
        // forest wall around a scene that's meant to be open sky and sea.
        if ((inside && ground[y][x] === 'T') || (!inside && !skyBridge && !cave && !city)) spots.push({ x: x + 0.5, z: y + 0.5 })
        if (inside && ground[y][x] === 'Y') autumn.push({ x: x + 0.5, z: y + 0.5 })
        if (inside && ground[y][x] === 'r') maple.push({ x: x + 0.5, z: y + 0.5 })
      }
    }
    if (spots.length) this.group.add(buildTrees(spots, W * 131 + H, this.def.treePalette ?? 'teal'))
    if (autumn.length) this.group.add(buildTrees(autumn, W * 17 + H, 'autumn'))
    if (maple.length) this.group.add(buildTrees(maple, W * 23 + H, 'crimson'))
    if (rock.length) this.group.add(buildCaveWalls(rock, W * 29 + H))

    if (city) this.group.add(buildSkyline(W, H, this.def.cityStreet ?? [0, -1], FOREST_RING))

    // A bridge scene's water plane already fills the horizon (and sits far below the
    // deck) — a flat fallback floor here would cover it.
    if (skyBridge) return
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(W + FOREST_RING * 2, H + FOREST_RING * 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cave ? 'rgb(20,30,30)' : city ? 'rgb(96,98,104)' : 'rgb(168,180,158)') }),
    )
    under.rotation.x = -Math.PI / 2
    under.position.set(W / 2, city ? -0.02 : -0.6, H / 2)
    this.group.add(under)
  }

  /** BW interiors: back and side walls only, the front is cut away, black void beyond. */
  private buildRoomWalls() {
    const { width: W, height: H } = this.def
    const hall = this.def.wallStyle === 'hall'
    const wallH = hall ? HALL_WALL_H : WALL_H
    /** Cream stone blocks with gold trim; the back wall gets a tall arched doorway. */
    const hallStone = (w: number, arch: boolean): THREE.Texture => {
      const px = Math.round(w * 16)
      const ph = Math.round(wallH * 16)
      const { c, g } = makeCanvas(px, ph)
      rect(g, 0, 0, px, ph, [228, 216, 190])
      for (let y = 0; y < ph; y += 8) {
        rect(g, 0, y, px, 1, [200, 186, 158])
        for (let x = (y / 8) % 2 ? 0 : 8; x < px; x += 16) rect(g, x, y, 1, 8, [200, 186, 158])
      }
      rect(g, 0, 0, px, 4, [196, 156, 70])
      rect(g, 0, 4, px, 1, [240, 208, 120])
      rect(g, 0, ph - 8, px, 8, [150, 110, 60])
      rect(g, 0, ph - 8, px, 1, [214, 172, 80])
      if (arch) {
        const cx = px / 2
        const r = 26
        const top = 14
        for (let y = top; y < ph - 8; y++) {
          const dy = top + r - y
          const outer = dy > 0 ? Math.sqrt(Math.max(0, (r + 4) ** 2 - dy * dy)) : r + 4
          const inner = dy > 0 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r
          rect(g, Math.round(cx - outer), y, Math.round(outer * 2), 1, [214, 172, 80])
          rect(g, Math.round(cx - inner), y, Math.round(inner * 2), 1, [40, 30, 50])
        }
      }
      return pixelTexture(c)
    }
    const wallpaper = (w: number): THREE.Texture => {
      const px = Math.round(w * 16)
      const ph = Math.round(WALL_H * 16)
      const { c, g } = makeCanvas(px, ph)
      // cream wall, blue top trim, thick blue lower band (BW bedroom palette)
      rect(g, 0, 0, px, ph, [248, 244, 232])
      for (let x = 0; x < px; x += 8) rect(g, x, 4, 1, ph - 14, [238, 232, 216])
      rect(g, 0, 0, px, 3, [48, 100, 184])
      rect(g, 0, 3, px, 1, [120, 168, 216])
      rect(g, 0, ph - 10, px, 10, [48, 100, 184])
      rect(g, 0, ph - 10, px, 1, [132, 176, 224])
      rect(g, 0, ph - 2, px, 2, [32, 68, 132])
      return pixelTexture(c)
    }
    const cap = lambert(hall ? [196, 156, 70] : [64, 64, 72])
    const addWall = (w: number, x: number, z: number, rotY: number, back: boolean) => {
      const map = hall ? hallStone(w, back) : wallpaper(w)
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, wallH), new THREE.MeshLambertMaterial({ map }))
      wall.position.set(x, wallH / 2, z)
      wall.rotation.y = rotY
      this.group.add(wall)
      const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.08, 0.2), cap)
      top.position.set(x, wallH, z)
      top.rotation.y = rotY
      this.group.add(top)
    }
    addWall(W, W / 2, 0, 0, true)
    addWall(H, 0, H / 2, Math.PI / 2, false)
    addWall(H, W, H / 2, -Math.PI / 2, false)

    for (const wx of this.def.windows ?? []) {
      const win = buildWallWindow()
      win.position.set(wx, 1.45, 0.01)
      this.group.add(win)
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (!m.userData.sharedGeometry) m.geometry?.dispose()
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const map = (mat as THREE.MeshBasicMaterial).map
        map?.dispose()
        mat.dispose()
      }
    })
  }
}
