import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Prop } from '../maps/types'
import type { Assets } from './assets'
import { lambert, makeCanvas, pixelTexture, rect, rng, speckle, shade, type RGB } from './pixel'

/**
 * Low-poly, pixel-textured props in the style of BW's overworld models.
 * Every texture is painted at DS density (16 px per tile) so it matches the ground.
 */

const TP = 16

// ── shared helpers ──────────────────────────────────────────────────────────────

function boxMesh(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[]) {
  const geo = new THREE.BoxGeometry(w, h, d)
  geo.translate(0, h / 2, 0)
  return new THREE.Mesh(geo, mat)
}

/** Paint a texture of `w`×`h` tiles with a callback working in DS pixels. */
function paint(w: number, h: number, fn: (g: CanvasRenderingContext2D, W: number, H: number) => void) {
  const W = Math.max(1, Math.round(w * TP))
  const H = Math.max(1, Math.round(h * TP))
  const { c, g } = makeCanvas(W, H)
  fn(g, W, H)
  return pixelTexture(c)
}

function repeating(texture: THREE.Texture) {
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}

function windowPx(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: RGB = [250, 250, 248]) {
  rect(g, x, y, w, h, frame)
  rect(g, x + 1, y + 1, w - 2, h - 2, [104, 150, 196])
  rect(g, x + 1, y + 1, w - 2, Math.floor((h - 2) / 2), [132, 176, 214])
  rect(g, x + 2, y + 2, 2, 1, [200, 224, 240])
  rect(g, x + Math.floor(w / 2), y + 1, 1, h - 2, frame)
}

// ── trees ───────────────────────────────────────────────────────────────────────

const treeGeos = new Map<string, THREE.BufferGeometry>()

function coloredPart(geo: THREE.BufferGeometry, c: RGB, y: number) {
  const g = geo.toNonIndexed()
  g.translate(0, y, 0)
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 3)
  const color = new THREE.Color(`rgb(${c.join(',')})`)
  for (let i = 0; i < n; i++) color.toArray(col, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.deleteAttribute('uv')
  return g
}

/** Canopy colours, bottom → top. `teal` is Nuvema's blue conifer, `autumn` Route 1's orange trees. */
export const TREE_PALETTES: Record<'teal' | 'autumn' | 'cherry' | 'crimson', [RGB, RGB, RGB]> = {
  teal: [[26, 92, 124], [30, 112, 148], [44, 136, 170]],
  // the red maples around Purdue's Bell Tower in fall
  crimson: [[142, 30, 34], [184, 46, 44], [218, 84, 66]],
  autumn: [[196, 104, 32], [224, 146, 44], [244, 196, 88]],
  // cherry's third slot is the bright inner-canopy highlight, not a third layer colour
  cherry: [[224, 118, 156], [244, 150, 180], [252, 200, 210]],
}

/** A poofy, rounded cherry-blossom canopy (clustered spheres, not a conifer's cone). */
function buildCherryGeometry() {
  const [lo, mid, hi] = TREE_PALETTES.cherry
  const lobes: THREE.BufferGeometry[] = [
    coloredPart(new THREE.CylinderGeometry(0.1, 0.15, 0.5, 6), [90, 62, 50], 0.25),
  ]
  // Big, near-overlapping poofy lobes — cherry blossoms in reference footage read as a
  // dense, almost screen-filling canopy, not a neat single conifer cone.
  const puffs: [number, number, number, number, RGB][] = [
    [0, 1.1, 0, 0.92, lo], [0.62, 1.0, 0.2, 0.68, mid], [-0.6, 1.02, -0.22, 0.68, mid],
    [0.1, 0.98, 0.6, 0.62, mid], [-0.1, 0.98, -0.62, 0.62, mid],
    [0.15, 1.55, -0.4, 0.58, mid], [-0.4, 1.5, 0.36, 0.56, mid], [0, 1.48, 0.05, 0.5, hi],
    [0.44, 1.78, 0.08, 0.38, hi], [-0.34, 1.74, -0.1, 0.36, hi], [0.05, 1.98, -0.02, 0.28, hi],
  ]
  for (const [x, y, z, r, c] of puffs) {
    const puff = coloredPart(new THREE.IcosahedronGeometry(r, 1), c, y)
    puff.translate(x, 0, z)
    lobes.push(puff)
  }
  return mergeGeometries(lobes)!
}

function getTreeGeometry(palette: keyof typeof TREE_PALETTES) {
  const hit = treeGeos.get(palette)
  if (hit) return hit
  let geo: THREE.BufferGeometry
  if (palette === 'cherry') {
    geo = buildCherryGeometry()
  } else {
    const [lo, mid, hi] = TREE_PALETTES[palette]
    geo = mergeGeometries([
      coloredPart(new THREE.CylinderGeometry(0.12, 0.17, 0.55, 6), [96, 72, 58], 0.27),
      coloredPart(new THREE.ConeGeometry(0.98, 1.25, 8), lo, 1.05),
      coloredPart(new THREE.ConeGeometry(0.78, 1.05, 8), mid, 1.62),
      coloredPart(new THREE.ConeGeometry(0.5, 0.85, 8), hi, 2.12),
    ])!
  }
  treeGeos.set(palette, geo)
  return geo
}

/** All trees of one palette as a single instanced mesh. */
export function buildTrees(spots: { x: number; z: number }[], seed: number, palette: keyof typeof TREE_PALETTES = 'teal') {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })
  const mesh = new THREE.InstancedMesh(getTreeGeometry(palette), mat, spots.length)
  mesh.userData.sharedGeometry = true
  const rand = rng(seed)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const tint = new THREE.Color()
  spots.forEach((s, i) => {
    const k = 0.92 + rand() * 0.16
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2)
    m.compose(new THREE.Vector3(s.x + (rand() - 0.5) * 0.15, 0, s.z + (rand() - 0.5) * 0.15), q, new THREE.Vector3(k, k * (0.95 + rand() * 0.15), k))
    mesh.setMatrixAt(i, m)
    const v = 0.9 + rand() * 0.18
    mesh.setColorAt(i, tint.setRGB(v, v, v))
  })
  return mesh
}

// ── tall grass ──────────────────────────────────────────────────────────────────

let grassGeo: THREE.BufferGeometry | null = null

/** One tile of BW tall grass: a dense clump of leafy blades that hides the walker's legs. */
function getGrassGeometry() {
  if (grassGeo) return grassGeo
  const rand = rng(99)
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const blade = coloredPart(new THREE.ConeGeometry(0.16, 0.55 + rand() * 0.2, 4), i % 3 === 0 ? [96, 178, 92] : i % 2 ? [52, 136, 66] : [70, 156, 78], 0.3)
    blade.translate((i % 3) * 0.3 - 0.3 + (rand() - 0.5) * 0.1, 0, Math.floor(i / 3) * 0.3 - 0.3 + (rand() - 0.5) * 0.1)
    parts.push(blade)
  }
  grassGeo = mergeGeometries(parts)!
  return grassGeo
}

export function buildTallGrass(spots: { x: number; z: number }[], seed: number) {
  const mesh = new THREE.InstancedMesh(getGrassGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length)
  mesh.userData.sharedGeometry = true
  const rand = rng(seed)
  const m = new THREE.Matrix4()
  spots.forEach((s, i) => {
    m.makeRotationY(Math.floor(rand() * 4) * (Math.PI / 2))
    m.setPosition(s.x, 0, s.z)
    mesh.setMatrixAt(i, m)
  })
  return mesh
}

// ── water ───────────────────────────────────────────────────────────────────────

/** Water sits below the ground plane (whose water tiles are holes), with earth banks around it. */
export interface WaterStyle {
  /** Extend the water plane far past the map's own edges — an open-sea scene like a
   *  bridge crossing. Off for a bounded pond, where water must stop at its real shore. */
  fillBackground?: boolean
  /** How far below the ground the water surface sits. Deep water + `viaduct` makes a deck
   *  read as elevated high above the water on stone arches. */
  depth?: number
  /** Stone arcade walls instead of earth banks where land meets water. */
  viaduct?: boolean
  /** Black 2/White 2's teal sea instead of the Unova-pond blue. */
  teal?: boolean
  /** Deep navy cave water with pale streaks (the HGSS Lugia pool). */
  deep?: boolean
  /** Colour of plain (non-viaduct) banks where land meets water. */
  bankColor?: RGB
}

export function buildWater(
  tiles: { x: number; y: number }[], isWater: (x: number, y: number) => boolean,
  width: number, height: number, style: WaterStyle = {},
) {
  const { fillBackground = false, depth = 0.28, viaduct = false, teal = false, deep = false } = style
  const bankColor = style.bankColor ?? [96, 84, 62]
  const group = new THREE.Group()
  const pal = deep
    ? { base: [34, 62, 142], dark: [28, 52, 124], crest: [104, 150, 222], crest2: [64, 104, 186] }
    : teal
      ? { base: [70, 150, 146], dark: [60, 136, 134], crest: [150, 212, 200], crest2: [110, 184, 174] }
      : { base: [72, 150, 208], dark: [64, 138, 198], crest: [150, 206, 238], crest2: [112, 180, 226] }
  const base = pal.base as RGB
  const dark = pal.dark as RGB
  const crest = pal.crest as RGB
  const crest2 = pal.crest2 as RGB
  const tex = repeating(paint(1, 1, (g, W, H) => {
    rect(g, 0, 0, W, H, base)
    speckle(g, 0, 0, W, H, [dark], 0.3, rng(4))
    for (const [x, y] of [[2, 3], [9, 7], [4, 12], [11, 1]]) {
      rect(g, x, y, 4, 1, crest)
      rect(g, x + 1, y + 1, 2, 1, crest2)
    }
  }))
  const pad = fillBackground ? 60 : 0
  const pw = width + pad * 2
  const ph = height + pad * 2
  tex.repeat.set(pw, ph)
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex }))
  surface.rotation.x = -Math.PI / 2
  // padding is symmetric, so the plane grows around the same centre the map already uses
  surface.position.set(width / 2, -depth, height / 2)
  group.add(surface)

  const banks: THREE.BufferGeometry[] = []
  const side = (x0: number, z0: number, x1: number, z1: number) => {
    const g = new THREE.PlaneGeometry(Math.hypot(x1 - x0, z1 - z0), depth)
    g.rotateY(-Math.atan2(z1 - z0, x1 - x0))
    g.translate((x0 + x1) / 2, -depth / 2, (z0 + z1) / 2)
    if (viaduct) {
      // each strip samples its own third of a 3-tile-wide arch, so arches span 3 tiles
      const alongX = z0 === z1
      const base = Math.floor(alongX ? Math.min(x0, x1) : Math.min(z0, z1))
      const piece = ((base % 3) + 3) % 3
      const pos = g.getAttribute('position')
      const uv = g.getAttribute('uv')
      for (let i = 0; i < uv.count; i++) {
        const t = (alongX ? pos.getX(i) : pos.getZ(i)) - base
        uv.setX(i, (piece + t) / 3)
      }
    }
    banks.push(g)
  }
  // When the water fills the background past the map's own edge, a tile just outside the
  // map is still "water" as far as shorelines go — only a real land tile inside the map
  // (the deck) should get a bank. Without this, the loop below drew a long false bank the
  // length of the whole map edge.
  const shoreWater = (x: number, y: number) =>
    isWater(x, y) || (fillBackground && (x < 0 || y < 0 || x >= width || y >= height))
  for (const { x, y } of tiles) {
    if (!shoreWater(x, y - 1)) side(x + 1, y, x, y)
    if (!shoreWater(x, y + 1)) side(x, y + 1, x + 1, y + 1)
    if (!shoreWater(x - 1, y)) side(x, y, x, y + 1)
    if (!shoreWater(x + 1, y)) side(x + 1, y + 1, x + 1, y)
  }
  if (banks.length) {
    const mat = viaduct
      ? new THREE.MeshBasicMaterial({ map: viaductTexture(depth), side: THREE.DoubleSide })
      : new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${bankColor.join(',')})`), side: THREE.DoubleSide })
    group.add(new THREE.Mesh(mergeGeometries(banks)!, mat))
  }
  group.userData.animate = (dt: number) => {
    tex.offset.x = (tex.offset.x + dt * 0.06) % 1
    tex.offset.y = (tex.offset.y + dt * 0.025) % 1
  }
  return group
}

/** Three tiles of stone viaduct: coursed blocks around one wide arch opening, so a run of
 *  strips reads as an arcade holding the deck up over the water. */
function viaductTexture(depth: number) {
  return paint(3, depth, (g, W, H) => {
    rect(g, 0, 0, W, H, [178, 168, 146])
    for (let y = 0; y < H; y += 4) {
      rect(g, 0, y, W, 1, [150, 140, 120])
      for (let x = (y / 4) % 2 ? 4 : 10; x < W; x += 12) rect(g, x, y, 1, 4, [150, 140, 120])
    }
    rect(g, 0, 0, W, 3, [214, 206, 186]) // deck lip
    rect(g, 0, 3, W, 1, [120, 112, 96])
    // arch opening, water-shadowed, with a lighter voussoir ring
    const r = W / 2 - 4
    const cy = Math.round(H * 0.3) + r
    for (let y = 0; y < H; y++) {
      const dy = cy - y
      if (dy > r + 2) continue
      const ring = dy > 0 ? Math.sqrt(Math.max(0, (r + 2) ** 2 - dy * dy)) : r + 2
      const hole = dy > 0 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r
      rect(g, Math.round(W / 2 - ring), y, Math.round(ring * 2), 1, [198, 190, 168])
      if (dy <= r) rect(g, Math.round(W / 2 - hole), y, Math.round(hole * 2), 1, [52, 70, 72])
    }
  })
}

// ── Tyler's childhood home ──────────────────────────────────────────────────────
// White vinyl siding, front-facing gable with a dark shingle roof, brick porch steps.

const SIDING: RGB = [238, 238, 232]
const SIDING_LINE: RGB = [212, 212, 208]
const TRIM: RGB = [252, 252, 250]

function sidingPx(g: CanvasRenderingContext2D, W: number, H: number) {
  rect(g, 0, 0, W, H, SIDING)
  for (let y = 2; y < H; y += 3) rect(g, 0, y, W, 1, SIDING_LINE)
}

function buildHouse(p: Prop) {
  const w = p.w ?? 6
  const d = p.d ?? 4
  const H = 3.2
  const R = w * 0.34
  const doorCol = (p.opts?.doorCol as number) ?? Math.floor(w / 2)
  const group = new THREE.Group()

  const front = paint(w, H, (g, W, Hp) => {
    sidingPx(g, W, Hp)
    rect(g, 0, 0, 2, Hp, TRIM)
    rect(g, W - 2, 0, 2, Hp, TRIM)
    rect(g, 0, Hp - 3, W, 3, [150, 150, 146])
    // upstairs
    windowPx(g, 10, 8, 12, 13)
    windowPx(g, W - 22, 8, 12, 13)
    // downstairs
    const doorX = doorCol * TP + 3
    windowPx(g, 10, 29, 14, 13)
    if (doorX > 40) windowPx(g, 30, 29, 12, 13)
    rect(g, doorX - 1, Hp - 26, 12, 23, TRIM)
    rect(g, doorX, Hp - 25, 10, 22, [72, 74, 86])
    rect(g, doorX + 2, Hp - 23, 6, 6, [96, 98, 112])
    rect(g, doorX + 8, Hp - 14, 1, 2, [220, 200, 120])
    if (doorX + 14 < W - 20) windowPx(g, W - 20, 29, 12, 13)
  })
  const side = paint(d, H, (g, W, Hp) => {
    sidingPx(g, W, Hp)
    rect(g, 0, Hp - 3, W, 3, [150, 150, 146])
    windowPx(g, Math.floor(W / 2) - 6, 8, 12, 13)
    windowPx(g, Math.floor(W / 2) - 6, 29, 12, 13)
  })
  const back = paint(w, H, (g, W, Hp) => {
    sidingPx(g, W, Hp)
    rect(g, 0, Hp - 3, W, 3, [150, 150, 146])
  })
  const wallMats = [lambert(side), lambert(side), lambert(SIDING), lambert(SIDING), lambert(front), lambert(back)]
  group.add(boxMesh(w, H, d, wallMats))

  // front-gable roof, ridge running front→back
  const hw = w / 2 + 0.3
  const slope = Math.hypot(hw, R)
  const a = Math.atan2(R, hw)
  const shingles = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [88, 94, 106])
    for (let y = 0; y < Hp; y += 4) {
      rect(g, 0, y, W, 1, [66, 70, 82])
      for (let x = (y / 4) % 2 ? 2 : 6; x < W; x += 8) rect(g, x, y, 1, 4, [70, 74, 86])
    }
    speckle(g, 0, 0, W, Hp, [[104, 110, 122]], 0.08, rng(7))
  }))
  shingles.repeat.set(slope, d + 0.6)
  const roofMat = lambert(shingles)
  const eaveMat = lambert([70, 74, 84])
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.16, d + 0.6), [eaveMat, eaveMat, roofMat, eaveMat, eaveMat, eaveMat])
    slab.position.set((s * hw) / 2, H + R / 2 + 0.06, 0)
    slab.rotation.z = -s * a
    group.add(slab)
  }
  // gable ends
  const e = (R * (hw - w / 2)) / hw
  const shape = new THREE.Shape([
    new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, e),
    new THREE.Vector2(0, R), new THREE.Vector2(-w / 2, e),
  ])
  const gableTex = repeating(paint(1, 1, sidingPx))
  const gableMat = lambert(gableTex, { side: THREE.DoubleSide })
  for (const z of [d / 2 + 0.001, -d / 2 - 0.001]) {
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(shape), gableMat)
    gable.position.set(0, H, z)
    group.add(gable)
  }
  const attic = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.6),
    lambert(paint(0.7, 0.6, (g, W, Hp) => windowPx(g, 0, 0, W, Hp))),
  )
  attic.position.set(0, H + R * 0.38, d / 2 + 0.01)
  group.add(attic)

  // brick stoop in front of the door
  const brick = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [206, 176, 156])
    for (let r = 0; r < 4; r++) for (let b = -1; b < 2; b++) rect(g, (r % 2 ? 4 : 0) + b * 8 + 1, r * 4, 7, 3, [168, 86, 64])
  }))
  const doorX = -w / 2 + doorCol + 0.5
  for (const [depth, hgt] of [[0.45, 0.12], [0.25, 0.24]] as const) {
    const step = boxMesh(1.3, hgt, depth, lambert(brick))
    step.position.set(doorX, 0, d / 2 + depth / 2)
    group.add(step)
  }
  for (const s of [-1, 1]) {
    const rail = boxMesh(0.06, 0.5, 0.45, lambert(TRIM))
    rail.position.set(doorX + s * 0.62, 0.12, d / 2 + 0.22)
    group.add(rail)
  }
  return group
}

// ── New Hyde Park Memorial High School ─────────────────────────────────────────
// Low brick façade, long curved white overhang, blue-panelled doors, lettered name.

const SCHOOL_BRICK: RGB = [156, 74, 56]
const SCHOOL_MORTAR: RGB = [128, 60, 46]

function brickPx(g: CanvasRenderingContext2D, W: number, H: number) {
  rect(g, 0, 0, W, H, SCHOOL_BRICK)
  for (let y = 3; y < H; y += 4) {
    rect(g, 0, y, W, 1, SCHOOL_MORTAR)
    for (let x = (y / 4) % 2 ? 3 : 7; x < W; x += 8) rect(g, x, y - 3, 1, 3, shade(SCHOOL_MORTAR, 1.08))
  }
  speckle(g, 0, 0, W, H, [shade(SCHOOL_BRICK, 1.1), shade(SCHOOL_BRICK, 0.92)], 0.08, rng(3))
}

function buildSchool(p: Prop, assets: Assets) {
  const w = p.w ?? 13
  const d = p.d ?? 5
  const H = 3
  const doorCol = (p.opts?.doorCol as number) ?? Math.floor(w / 2)
  const name = (p.opts?.name as string) ?? ''
  const group = new THREE.Group()

  const front = paint(w, H, (g, W, Hp) => {
    brickPx(g, W, Hp)
    rect(g, 0, 0, W, 2, [236, 236, 230])
    // continuous window band with blue lower panels
    const top = Hp - 24
    for (let x = 4; x < W - 12; x += 14) {
      rect(g, x, top, 13, 19, [244, 244, 240])
      rect(g, x + 1, top + 1, 11, 8, [140, 176, 206])
      rect(g, x + 2, top + 2, 3, 1, [210, 230, 244])
      rect(g, x + 1, top + 10, 11, 8, [44, 88, 168])
      rect(g, x + 6, top + 10, 1, 8, [244, 244, 240])
    }
    // entrance: blue doors, white trim
    const dx = doorCol * TP - 8
    rect(g, dx - 2, Hp - 26, 36, 26, [244, 244, 240])
    for (let i = 0; i < 4; i++) {
      rect(g, dx + i * 8, Hp - 24, 7, 24, [36, 80, 170])
      rect(g, dx + i * 8 + 1, Hp - 22, 5, 9, [150, 186, 214])
    }
    rect(g, 0, Hp - 3, W, 3, [120, 112, 104])
  })
  const side = paint(d, H, (g, W, Hp) => {
    brickPx(g, W, Hp)
    rect(g, 0, 0, W, 2, [236, 236, 230])
  })
  const roof = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [150, 150, 146])
    speckle(g, 0, 0, W, Hp, [[136, 136, 132], [166, 166, 160]], 0.4, rng(11))
  }))
  roof.repeat.set(w, d)
  group.add(boxMesh(w, H, d, [lambert(side), lambert(side), lambert(roof), lambert(roof), lambert(front), lambert(side)]))

  // parapet cap
  const cap = boxMesh(w + 0.1, 0.12, d + 0.1, lambert([236, 236, 230]))
  cap.position.y = H
  const inner = boxMesh(w - 0.3, 0.13, d - 0.3, lambert(roof))
  inner.position.y = H + 0.001
  group.add(cap, inner)

  // curved white overhang running most of the façade
  const r = 0.45
  const len = w - 1.2
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 10, 1, true, 0, Math.PI / 2),
    lambert([242, 242, 238], { side: THREE.DoubleSide }),
  )
  canopy.rotation.z = Math.PI / 2
  canopy.position.set(0, 1.95, d / 2)
  group.add(canopy)

  // school name lettered on the brick above the overhang (drawn at 2× density so it stays legible)
  if (name) {
    const textW = assets.font.width(name)
    const { c, g } = makeCanvas(textW + 4, assets.font.height)
    assets.font.draw(g, name, 2, 0, [240, 230, 204], false)
    const t = pixelTexture(c)
    const pw = (textW + 4) / (TP * 2)
    const ph = assets.font.height / (TP * 2)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.5 }))
    sign.position.set(0, H - 0.34, d / 2 + 0.01)
    group.add(sign)
  }
  return group
}

// ── Hillside Grade School (Tyler's childhood elementary school) ─────────────────
// Red brick, a round "rose" window over a triple-arched entrance-bay window, a white
// pilastered entrance with a pediment ledge over black double doors, and low box hedges.

function buildGradeSchool(p: Prop, assets: Assets) {
  const w = p.w ?? 11
  const d = p.d ?? 5
  const H = 2.9
  const doorCol = (p.opts?.doorCol as number) ?? Math.floor(w / 2)
  const name = (p.opts?.name as string) ?? ''
  const group = new THREE.Group()

  const front = paint(w, H, (g, W, Hp) => {
    brickPx(g, W, Hp)
    rect(g, 0, 0, W, 3, [240, 238, 230])
    const cx = doorCol * TP + 8
    const doorX = doorCol * TP - 4

    // second-floor windows, both wings — skip the bay itself
    for (let x = 8; x < W - 16; x += 26) {
      if (Math.abs(x + 6 - cx) < 24) continue
      windowPx(g, x, 10, 12, 15)
    }
    // ground-floor windows
    for (let x = 8; x < W - 16; x += 26) {
      if (Math.abs(x + 6 - cx) < 30) continue
      windowPx(g, x, Hp - 26, 12, 15)
    }

    // rose window: a cream disc with a brick surround and painted spokes
    const r = 15
    g.fillStyle = 'rgb(150,74,56)'
    g.beginPath(); g.arc(cx, 22, r + 2, 0, Math.PI * 2); g.fill()
    g.fillStyle = 'rgb(226,224,212)'
    g.beginPath(); g.arc(cx, 22, r, 0, Math.PI * 2); g.fill()
    g.strokeStyle = 'rgb(150,74,56)'
    g.lineWidth = 1.4
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      g.beginPath()
      g.moveTo(cx, 22)
      g.lineTo(cx + Math.cos(a) * (r - 2), 22 + Math.sin(a) * (r - 2))
      g.stroke()
    }

    // entrance-bay upper window: three narrow arched panes
    rect(g, cx - 17, 42, 34, 17, [244, 244, 240])
    for (let i = 0; i < 3; i++) rect(g, cx - 15 + i * 11, 44, 9, 13, [122, 170, 208])

    // entrance: white pilaster surround, pediment ledge, black double doors
    rect(g, doorX - 4, Hp - 30, 28, 30, [244, 244, 240])
    rect(g, doorX - 7, Hp - 33, 34, 4, [244, 244, 240])
    rect(g, doorX, Hp - 27, 21, 27, [28, 28, 32])
    rect(g, doorX + 10, Hp - 27, 1, 27, [64, 64, 70])
    rect(g, doorX + 3, Hp - 22, 6, 6, [80, 80, 88])
    rect(g, doorX + 12, Hp - 22, 6, 6, [80, 80, 88])
  })
  const side = paint(d, H, (g, W, Hp) => {
    brickPx(g, W, Hp)
    rect(g, 0, 0, W, 3, [240, 238, 230])
    windowPx(g, Math.floor(W / 2) - 6, 10, 12, 15)
    windowPx(g, Math.floor(W / 2) - 6, Hp - 26, 12, 15)
  })
  const roof = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [140, 140, 136])
    speckle(g, 0, 0, W, Hp, [[126, 126, 122], [154, 154, 148]], 0.35, rng(13))
  }))
  roof.repeat.set(w, d)
  group.add(boxMesh(w, H, d, [lambert(side), lambert(side), lambert(roof), lambert(roof), lambert(front), lambert(side)]))

  const cap = boxMesh(w + 0.1, 0.12, d + 0.1, lambert([240, 238, 230]))
  cap.position.y = H
  const inner = boxMesh(w - 0.3, 0.13, d - 0.3, lambert(roof))
  inner.position.y = H + 0.001
  group.add(cap, inner)

  if (name) {
    const textW = assets.font.width(name)
    const { c, g } = makeCanvas(textW + 4, assets.font.height)
    assets.font.draw(g, name, 2, 0, [240, 230, 204], false)
    const t = pixelTexture(c)
    const pw = (textW + 4) / (TP * 2)
    const ph = assets.font.height / (TP * 2)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.5 }))
    sign.position.set(0, H - 0.86, d / 2 + 0.01)
    group.add(sign)
  }

  // steps and low box hedges flanking the entrance walk
  const doorCx = -w / 2 + doorCol + 0.5
  const concrete = lambert([206, 204, 196])
  for (const [depth, hgt] of [[0.55, 0.1], [0.32, 0.2]] as const) {
    const step = boxMesh(1.6, hgt, depth, concrete)
    step.position.set(doorCx, 0, d / 2 + depth / 2)
    group.add(step)
  }
  const hedge = lambert([54, 96, 56], { flatShading: true })
  for (const s of [-1, 1]) {
    const bush = boxMesh(0.9, 0.4, 0.5, hedge)
    bush.position.set(doorCx + s * 1.4, 0, d / 2 + 0.5)
    group.add(bush)
  }
  return group
}

// ── volleyball court (lines are painted on the ground by the map) ───────────────

/** A net (volleyball post-to-post, or the basketball backstop) spanning `w` tiles if
 *  w ≥ d (horizontal, east–west), otherwise `d` tiles (running north–south). */
function buildNet(p: Prop) {
  const horizontal = (p.w ?? 1) >= (p.d ?? 1)
  const len = horizontal ? p.w ?? 7 : p.d ?? 7
  const group = new THREE.Group()
  const postMat = lambert([120, 124, 132])
  for (const t of [-len / 2 + 0.3, len / 2 - 0.3]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6), postMat)
    post.position.set(horizontal ? t : 0, 0.85, horizontal ? 0 : t)
    group.add(post)
  }
  const net = paint(len, 0.6, (g, W, Hp) => {
    for (let x = 0; x < W; x += 3) rect(g, x, 0, 1, Hp, [40, 40, 44])
    for (let y = 0; y < Hp; y += 3) rect(g, 0, y, W, 1, [40, 40, 44])
    rect(g, 0, 0, W, 2, [248, 248, 248])
  })
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(len - 0.6, 0.6),
    new THREE.MeshLambertMaterial({ map: net, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
  )
  // A plane's default face lies along X already (horizontal); rotate 90° for a
  // north–south run instead.
  if (!horizontal) mesh.rotation.y = Math.PI / 2
  mesh.position.y = 1.35
  group.add(mesh)
  return group
}

// ── basketball hoop & chain-link fence (Memorial Park) ──────────────────────────

function buildHoop(p: Prop) {
  const group = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), lambert([90, 92, 98]))
  pole.position.y = 1.2
  group.add(pole)

  const arm = boxMesh(0.5, 0.08, 0.08, lambert([90, 92, 98]))
  arm.position.set(0, 2.3, 0.25)
  group.add(arm)

  const backboardTex = paint(0.9, 0.65, (g, W, H) => {
    rect(g, 0, 0, W, H, [248, 248, 248])
    rect(g, 2, 2, W - 4, H - 4, [248, 248, 248])
    rect(g, 3, 3, W - 6, H - 6, [255, 255, 255])
    rect(g, W / 2 - 9, H - 22, 18, 14, [220, 60, 56])
  })
  const board = boxMesh(0.9, 0.65, 0.06, [lambert([230, 230, 230]), lambert([230, 230, 230]), lambert([230, 230, 230]), lambert([230, 230, 230]), lambert(backboardTex), lambert([230, 230, 230])])
  board.position.set(0, 2.35, 0.5)
  group.add(board)

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 16), lambert([222, 92, 40]))
  rim.rotation.x = Math.PI / 2
  rim.position.set(0, 2.05, 0.75)
  group.add(rim)

  const netMat = lambert([245, 245, 245], { transparent: true, opacity: 0.85 })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const strand = boxMesh(0.02, 0.28, 0.02, netMat)
    strand.position.set(Math.cos(a) * 0.2, 1.9, 0.75 + Math.sin(a) * 0.2)
    group.add(strand)
  }

  if (p.opts?.rotation) group.rotation.y = THREE.MathUtils.degToRad(p.opts.rotation as number)
  return group
}

/** A straight run of chain-link fencing spanning the prop's w or d, whichever is longer. */
function buildFence(p: Prop) {
  const horizontal = (p.w ?? 1) >= (p.d ?? 1)
  const len = horizontal ? p.w ?? 1 : p.d ?? 1
  const group = new THREE.Group()
  const postMat = lambert([70, 72, 78])
  const poleN = Math.max(2, Math.round(len) + 1)
  for (let i = 0; i < poleN; i++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 6), postMat)
    const t = (i / (poleN - 1) - 0.5) * len
    post.position.set(horizontal ? t : 0, 1.15, horizontal ? 0 : t)
    group.add(post)
  }
  const mesh = repeating(paint(1, 1, (g, W, H) => {
    g.strokeStyle = 'rgba(40,40,44,0.65)'
    g.lineWidth = 1
    for (let x = -W; x < W * 2; x += 5) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + H, H); g.stroke()
      g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke()
    }
  }))
  mesh.repeat.set(len * 3, 1)
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(len, 2.1),
    new THREE.MeshBasicMaterial({ map: mesh, transparent: true, side: THREE.DoubleSide }),
  )
  panel.position.y = 1.15
  if (!horizontal) panel.rotation.y = Math.PI / 2
  group.add(panel)
  return group
}

// ── small outdoor props ─────────────────────────────────────────────────────────

function buildSign() {
  const group = new THREE.Group()
  const wood = lambert([150, 100, 62])
  for (const x of [-0.32, 0.32]) {
    const leg = boxMesh(0.08, 0.5, 0.08, wood)
    leg.position.x = x
    group.add(leg)
  }
  const faceTex = paint(0.9, 0.55, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [120, 78, 46])
    rect(g, 1, 1, W - 2, Hp - 2, [206, 160, 104])
    for (let y = 3; y < Hp - 2; y += 3) rect(g, 3, y, W - 6, 1, [150, 104, 62])
  })
  const board = boxMesh(0.9, 0.55, 0.1, [wood, wood, wood, wood, lambert(faceTex), wood])
  board.position.y = 0.38
  group.add(board)
  return group
}

function buildMailbox() {
  const group = new THREE.Group()
  const post = boxMesh(0.1, 0.7, 0.1, lambert([236, 236, 232]))
  const box = boxMesh(0.3, 0.26, 0.45, lambert([48, 52, 60]))
  box.position.y = 0.7
  group.add(post, box)
  return group
}

/** Stone monument with an engraved plaque — each route's one piece of portfolio content. */
function buildMonument() {
  const group = new THREE.Group()
  const stone: RGB = [168, 170, 178]
  const base = boxMesh(1.0, 0.25, 0.8, lambert(shade(stone, 0.85)))
  const plaque = paint(0.8, 1.3, (g, W, H) => {
    rect(g, 0, 0, W, H, stone)
    speckle(g, 0, 0, W, H, [shade(stone, 0.9), shade(stone, 1.08)], 0.2, rng(8))
    rect(g, 2, 3, W - 4, H - 8, [120, 122, 132])
    rect(g, 3, 4, W - 6, H - 10, [206, 178, 96])
    for (let y = 7; y < H - 8; y += 3) rect(g, 5, y, W - 10, 1, [150, 120, 56])
  })
  const s = lambert(stone)
  const slab = boxMesh(0.8, 1.3, 0.3, [s, s, s, s, lambert(plaque), s])
  slab.position.y = 0.25
  const cap = boxMesh(0.9, 0.12, 0.38, lambert(shade(stone, 1.1)))
  cap.position.y = 1.55
  group.add(base, slab, cap)
  return group
}

// ── indoor furniture ────────────────────────────────────────────────────────────

const WOOD_DARK: RGB = [132, 86, 52]
const WOOD_MID: RGB = [186, 128, 78]

function buildBed(p: Prop) {
  const w = p.w ?? 1
  const d = p.d ?? 2
  const g = new THREE.Group()
  const frame = boxMesh(w * 0.92, 0.32, d * 0.95, lambert(WOOD_DARK))
  const blanket = boxMesh(w * 0.9, 0.12, d * 0.7, lambert([126, 42, 92]))
  blanket.position.set(0, 0.32, d * 0.12)
  const pillow = boxMesh(w * 0.7, 0.12, 0.35, lambert([244, 244, 248]))
  pillow.position.set(0, 0.32, -d / 2 + 0.3)
  const head = boxMesh(w * 0.92, 0.75, 0.1, lambert(WOOD_DARK))
  head.position.z = -d / 2 + 0.05
  g.add(frame, blanket, pillow, head)
  return g
}

function buildTV(p: Prop) {
  const w = p.w ?? 2
  const g = new THREE.Group()
  const stand = boxMesh(w * 0.9, 0.5, 0.6, lambert(WOOD_DARK))
  const screenTex = paint(1.2, 0.7, (c, W, Hp) => {
    rect(c, 0, 0, W, Hp, [36, 36, 44])
    rect(c, 2, 2, W - 4, Hp - 4, [58, 110, 150])
    rect(c, 3, 3, W - 6, 2, [120, 170, 200])
  })
  const tv = boxMesh(1.2, 0.7, 0.14, [lambert([36, 36, 44]), lambert([36, 36, 44]), lambert([36, 36, 44]), lambert([36, 36, 44]), lambert(screenTex), lambert([36, 36, 44])])
  tv.position.set(0, 0.5, -0.1)
  const consoleBox = boxMesh(0.4, 0.08, 0.3, lambert([230, 230, 236]))
  consoleBox.position.set(w * 0.3, 0.5, 0.12)
  g.add(stand, tv, consoleBox)
  return g
}

function buildDesk(p: Prop) {
  const w = p.w ?? 2
  const g = new THREE.Group()
  g.add(boxMesh(w * 0.95, 0.7, 0.7, lambert(WOOD_MID)))
  const screen = paint(0.7, 0.5, (c, W, Hp) => {
    rect(c, 0, 0, W, Hp, [200, 204, 210])
    rect(c, 1, 1, W - 2, Hp - 3, [60, 120, 180])
    rect(c, 2, 2, 4, 1, [180, 220, 240])
  })
  const monitor = boxMesh(0.7, 0.5, 0.1, [lambert([200, 204, 210]), lambert([200, 204, 210]), lambert([200, 204, 210]), lambert([200, 204, 210]), lambert(screen), lambert([200, 204, 210])])
  monitor.position.set(0, 0.7, -0.15)
  const kb = boxMesh(0.5, 0.03, 0.18, lambert([230, 230, 232]))
  kb.position.set(0, 0.7, 0.15)
  g.add(monitor, kb)
  return g
}

function buildShelf(p: Prop) {
  const w = p.w ?? 1
  const face = paint(w, 1.8, (c, W, Hp) => {
    rect(c, 0, 0, W, Hp, WOOD_DARK)
    const books: RGB[] = [[200, 60, 60], [60, 110, 190], [230, 190, 70], [70, 150, 90], [230, 230, 220]]
    const rand = rng(5)
    for (let y = 2; y < Hp - 4; y += 9) {
      rect(c, 1, y + 7, W - 2, 1, [96, 60, 36])
      for (let x = 2; x < W - 2; ) {
        const bw = 2 + Math.floor(rand() * 2)
        rect(c, x, y + 1 + Math.floor(rand() * 2), bw, 6, books[Math.floor(rand() * books.length)])
        x += bw + 1
      }
    }
  })
  const wood = lambert(WOOD_DARK)
  return boxMesh(w * 0.95, 1.8, 0.45, [wood, wood, wood, wood, lambert(face), wood])
}

function buildPlant() {
  const g = new THREE.Group()
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.35, 8), lambert([196, 104, 64]))
  pot.position.y = 0.175
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), lambert([62, 146, 72], { flatShading: true }))
  leaves.position.y = 0.72
  leaves.scale.set(1, 1.25, 1)
  g.add(pot, leaves)
  return g
}

function buildTable(p: Prop) {
  const w = p.w ?? 2
  const d = p.d ?? 1
  const g = new THREE.Group()
  const top = boxMesh(w * 0.9, 0.1, d * 0.9, lambert(WOOD_MID))
  top.position.y = 0.55
  g.add(top)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = boxMesh(0.08, 0.55, 0.08, lambert(WOOD_DARK))
    leg.position.set(sx * (w * 0.45 - 0.08), 0, sz * (d * 0.45 - 0.08))
    g.add(leg)
  }
  return g
}

function buildChair() {
  const g = new THREE.Group()
  const seat = boxMesh(0.5, 0.08, 0.5, lambert(WOOD_MID))
  seat.position.y = 0.35
  const back = boxMesh(0.5, 0.5, 0.08, lambert(WOOD_MID))
  back.position.set(0, 0.35, -0.21)
  const base = boxMesh(0.4, 0.35, 0.4, lambert(WOOD_DARK))
  g.add(seat, back, base)
  return g
}

function buildCounter(p: Prop) {
  const w = p.w ?? 3
  const front = paint(w, 0.85, (c, W, Hp) => {
    rect(c, 0, 0, W, Hp, [214, 170, 118])
    for (let x = 0; x < W; x += TP) {
      rect(c, x, 0, 1, Hp, [170, 124, 80])
      rect(c, x + 6, 5, 4, 1, [120, 90, 60])
    }
  })
  const g = new THREE.Group()
  const wood = lambert([214, 170, 118])
  g.add(boxMesh(w, 0.85, 0.8, [wood, wood, wood, wood, lambert(front), wood]))
  const top = boxMesh(w + 0.05, 0.06, 0.85, lambert([236, 236, 236]))
  top.position.y = 0.85
  g.add(top)
  return g
}

function buildFridge() {
  const face = paint(0.9, 1.9, (c, W, Hp) => {
    rect(c, 0, 0, W, Hp, [226, 230, 234])
    rect(c, 0, 11, W, 1, [180, 186, 192])
    rect(c, W - 3, 4, 1, 5, [150, 156, 164])
    rect(c, W - 3, 15, 1, 8, [150, 156, 164])
  })
  const m = lambert([214, 218, 224])
  return boxMesh(0.9, 1.9, 0.75, [m, m, m, m, lambert(face), m])
}

function buildSofa(p: Prop) {
  const w = p.w ?? 3
  const g = new THREE.Group()
  const col: RGB = [86, 126, 170]
  g.add(boxMesh(w * 0.95, 0.4, 0.8, lambert(col)))
  const back = boxMesh(w * 0.95, 0.45, 0.22, lambert(shade(col, 0.85)))
  back.position.set(0, 0.4, 0.3)
  g.add(back)
  for (const s of [-1, 1]) {
    const arm = boxMesh(0.2, 0.25, 0.8, lambert(shade(col, 0.85)))
    arm.position.set(s * (w * 0.475 - 0.1), 0.4, 0)
    g.add(arm)
  }
  return g
}

/** Stairs down: steps sinking into a black stairwell (the floor tiles here are void). */
function buildStairsDown(p: Prop) {
  const d = p.d ?? 2
  const g = new THREE.Group()
  const n = 6
  for (let i = 0; i < n; i++) {
    const step = boxMesh(0.95, 0.12, d / n, lambert(shade([214, 170, 118], 1 - i * 0.1)))
    step.position.set(0, -0.2 - i * 0.28, d / 2 - (i + 0.5) * (d / n))
    g.add(step)
  }
  const rail = boxMesh(0.06, 0.45, d, lambert(WOOD_DARK))
  rail.position.x = -0.5
  g.add(rail)
  return g
}

/** Stairs up: steps rising toward the back wall. */
function buildStairsUp(p: Prop) {
  const d = p.d ?? 2
  const g = new THREE.Group()
  const n = 7
  for (let i = 0; i < n; i++) {
    const h = 0.3 * (i + 1)
    const step = boxMesh(0.95, h, d / n, lambert(shade([214, 170, 118], 1 - i * 0.03)))
    step.position.set(0, 0, d / 2 - (i + 0.5) * (d / n))
    g.add(step)
  }
  const rail = boxMesh(0.06, 2.4, d, lambert(WOOD_DARK))
  rail.position.x = 0.5
  g.add(rail)
  return g
}

// ── registry ────────────────────────────────────────────────────────────────────

// ── Windsor Oaks garden apartments (Oakland Gardens, Queens) ────────────────────
// Two-storey red-brick "garden apartment" blocks: paired front doors under a shared
// cream portico, regular double-hung windows, a window AC unit here and there, a
// gently pitched grey shingle roof with a cream fascia.

const APT_BRICK: RGB = [172, 68, 50]
const APT_MORTAR: RGB = [136, 58, 42]
const CREAM: RGB = [234, 224, 198]
const APT_DOOR: RGB = [40, 46, 58]

function aptBrickPx(g: CanvasRenderingContext2D, W: number, H: number) {
  rect(g, 0, 0, W, H, APT_BRICK)
  for (let y = 3; y < H; y += 4) {
    rect(g, 0, y, W, 1, APT_MORTAR)
    for (let x = (y / 4) % 2 ? 3 : 7; x < W; x += 8) rect(g, x, y - 3, 1, 3, shade(APT_MORTAR, 1.1))
  }
  speckle(g, 0, 0, W, H, [shade(APT_BRICK, 1.08), shade(APT_BRICK, 0.9)], 0.07, rng(19))
}

function acUnit(g: CanvasRenderingContext2D, x: number, y: number) {
  rect(g, x, y, 9, 6, [210, 212, 214])
  rect(g, x + 1, y + 1, 7, 4, [150, 156, 160])
  rect(g, x + 2, y + 2, 2, 2, [120, 128, 132])
}

function buildGardenApartment(p: Prop, assets: Assets) {
  const w = p.w ?? 10
  const d = p.d ?? 6
  const H = 2.7
  const pairs = (p.opts?.doorPairs as number[]) ?? [Math.floor(w / 2)]
  const group = new THREE.Group()

  const front = paint(w, H, (g, W, Hp) => {
    aptBrickPx(g, W, Hp)
    rect(g, 0, 0, W, 3, CREAM)
    for (let i = 0; i < w; i++) {
      if (pairs.some((t) => Math.abs(i - t) <= 1)) continue
      windowPx(g, i * TP + 3, 8, 10, 12)
      windowPx(g, i * TP + 3, Hp - 22, 10, 12)
      if (i % 3 === 1) acUnit(g, i * TP + 2, 20)
    }
    for (const t of pairs) {
      const x = t * TP - 9
      rect(g, x - 2, Hp - 31, 24, 4, CREAM)
      rect(g, x - 2, Hp - 27, 2, 27, CREAM)
      rect(g, x + 20, Hp - 27, 2, 27, CREAM)
      rect(g, x, Hp - 26, 9, 26, APT_DOOR)
      rect(g, x + 11, Hp - 26, 9, 26, APT_DOOR)
      rect(g, x + 2, Hp - 23, 5, 6, [104, 124, 150])
      rect(g, x + 13, Hp - 23, 5, 6, [104, 124, 150])
      rect(g, x + 3, Hp - 14, 1, 2, [214, 196, 140])
      rect(g, x + 14, Hp - 14, 1, 2, [214, 196, 140])
    }
  })
  const side = paint(d, H, (g, W, Hp) => {
    aptBrickPx(g, W, Hp)
    rect(g, 0, 0, W, 3, CREAM)
    windowPx(g, Math.floor(W / 2) - 5, 8, 10, 12)
    windowPx(g, Math.floor(W / 2) - 5, Hp - 22, 10, 12)
  })
  const roof = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [118, 118, 114])
    speckle(g, 0, 0, W, Hp, [[104, 104, 100], [130, 130, 126]], 0.4, rng(23))
  }))
  roof.repeat.set(w, d)
  group.add(boxMesh(w, H, d, [lambert(side), lambert(side), lambert(roof), lambert(roof), lambert(front), lambert(side)]))

  const cap = boxMesh(w + 0.1, 0.1, d + 0.1, lambert(CREAM))
  cap.position.y = H
  const inner = boxMesh(w - 0.3, 0.11, d - 0.3, lambert(roof))
  inner.position.y = H + 0.001
  group.add(cap, inner)
  void assets
  return group
}

/** A trimmed round topiary shrub. */
function buildTopiary(p: Prop) {
  const group = new THREE.Group()
  const green = lambert([44, 108, 58], { flatShading: true })
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), green)
  base.position.y = 0.34
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), lambert([54, 122, 68], { flatShading: true }))
  top.position.y = 0.72
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.14, 8), lambert([120, 112, 100]))
  pot.position.y = 0.07
  group.add(pot, base, top)
  if (p.opts?.tall) {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 8), lambert([58, 130, 72], { flatShading: true }))
    spire.position.y = 1.0
    group.add(spire)
  }
  return group
}

/** A raised, stone-bordered flower bed — the "WINDSOR OAKS" sign-style planting. */
function buildFlowerbed(p: Prop) {
  const w = p.w ?? 3
  const d = p.d ?? 2
  const top = paint(w, d, (g, W, H) => {
    rect(g, 0, 0, W, H, [86, 62, 46])
    speckle(g, 0, 0, W, H, [[74, 52, 38], [98, 72, 54]], 0.3, rng(31))
    const petals: RGB[] = [[224, 48, 64], [236, 88, 132], [248, 200, 64], [250, 250, 246]]
    const rand = rng(17)
    for (let i = 0; i < W * H * 0.55; i++) {
      const x = Math.floor(rand() * W)
      const y = Math.floor(rand() * H)
      const col = petals[Math.floor(rand() * petals.length)]
      rect(g, x, y, 2, 1, col)
      if (rand() < 0.5) rect(g, x, y + 1, 1, 1, [70, 130, 70])
    }
  })
  const stone = lambert([158, 156, 148])
  const group = new THREE.Group()
  // BoxGeometry face order is [+x, -x, +y, -y, +z, -z] — the top face is index 2.
  group.add(boxMesh(w, 0.22, d, [stone, stone, lambert(top), stone, stone, stone]))
  return group
}

/** A lily pad floating on the water, sometimes with a white lotus bloom. */
function buildLilyPad(p: Prop) {
  const group = new THREE.Group()
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 10, 0.4, Math.PI * 1.7),
    lambert([42, 116, 62], { flatShading: true, side: THREE.DoubleSide }),
  )
  pad.rotation.x = -Math.PI / 2
  pad.position.set(0, -0.24, 0)
  group.add(pad)
  if (p.opts?.flower) {
    const petal = lambert([252, 248, 248])
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), petal)
      leaf.position.set(Math.cos(a) * 0.07, -0.16, Math.sin(a) * 0.07)
      leaf.rotation.x = Math.PI
      leaf.rotation.y = a
      leaf.rotation.z = 0.5
      group.add(leaf)
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), lambert([248, 210, 90]))
    center.position.set(0, -0.13, 0)
    group.add(center)
  }
  return group
}

/** A wooden park bench. */
function buildBench() {
  const group = new THREE.Group()
  const wood = lambert([196, 168, 128])
  const seat = boxMesh(0.95, 0.06, 0.32, wood)
  seat.position.y = 0.34
  const back = boxMesh(0.95, 0.28, 0.06, wood)
  back.position.set(0, 0.5, -0.14)
  group.add(seat, back)
  for (const sx of [-0.4, 0.4]) {
    const leg = boxMesh(0.06, 0.34, 0.3, lambert([90, 90, 94]))
    leg.position.set(sx, 0, 0)
    group.add(leg)
  }
  return group
}

// ── suspension bridge (Throgs Neck-style crossing) ───────────────────────────────

/** A single overhead rib — a light crossbeam on two short posts, repeated along a bridge
 *  deck's full length so crossing it reads as walking through a structure, rhythmically,
 *  the way BW's own enclosed truss bridges do. */
/** A curved steel lattice arch spanning the deck, with crossed diagonal bracing inside —
 *  repeated along a bridge for the "walking through a structure" feel of an enclosed
 *  truss crossing. Original arch/lattice geometry, not traced from any specific bridge. */
function buildLatticeArch(p: Prop) {
  const group = new THREE.Group()
  const span = p.w ?? 7
  const radius = span / 2
  const steel = lambert([206, 212, 218])
  const arch = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 8, 28, Math.PI), steel)
  group.add(arch)

  const brace = lambert([178, 186, 194])
  const onArch = (a: number) => new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0)
  const onDeck = (x: number) => new THREE.Vector3(x, 0.05, 0)
  const p1 = onArch(Math.PI * 0.2)
  const p2 = onArch(Math.PI * 0.4)
  const p3 = onArch(Math.PI * 0.6)
  const p4 = onArch(Math.PI * 0.8)
  for (const [top, bottomX] of [[p1, radius * 0.35], [p2, -radius * 0.35], [p3, radius * 0.35], [p4, -radius * 0.35]] as const) {
    group.add(strutBetween(top, onDeck(bottomX), brace, 0.045))
  }
  group.add(strutBetween(p1, p3, brace, 0.035))
  group.add(strutBetween(p2, p4, brace, 0.035))
  return group
}

/** A straight strut between two points — robust two-point placement, no manual trig. */
function strutBetween(a: THREE.Vector3, b: THREE.Vector3, mat: THREE.Material, radius = 0.035) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 5), mat)
  mesh.position.copy(a).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return mesh
}

/** One simple suspension tower: twin pylons, a crossbeam, and a few straight cables
 *  running down to the deck on each approach. */
function buildBridgeTower(p: Prop) {
  const group = new THREE.Group()
  const h = (p.opts?.height as number) ?? 6
  const span = (p.w ?? 6) - 1
  const steel = lambert([214, 218, 222])
  const steelDark = lambert([176, 182, 190])
  const cableMat = lambert([150, 156, 164])

  for (const side of [-span / 2, span / 2]) {
    const leg = boxMesh(0.35, h, 0.35, steel)
    leg.position.set(side, 0, 0)
    group.add(leg)

    const top = new THREE.Vector3(side, h - 0.2, 0)
    for (const dz of [2, 4]) {
      group.add(strutBetween(top, new THREE.Vector3(side, 0.6, dz), cableMat))
      group.add(strutBetween(top, new THREE.Vector3(side, 0.6, -dz), cableMat))
    }
  }
  const beam = boxMesh(span + 0.35, 0.3, 0.3, steelDark)
  beam.position.set(0, h - 0.15, 0)
  group.add(beam)
  return group
}

/** A simple guardrail spanning a straight run — walkway edge for the bridge. */
function buildRailing(p: Prop) {
  const horizontal = (p.w ?? 1) >= (p.d ?? 1)
  const len = horizontal ? p.w ?? 1 : p.d ?? 1
  const group = new THREE.Group()
  const steel = lambert([224, 226, 230])
  const postN = Math.max(2, Math.round(len) + 1)
  for (let i = 0; i < postN; i++) {
    const t = (i / (postN - 1) - 0.5) * len
    const post = boxMesh(0.08, 0.9, 0.08, steel)
    post.position.set(horizontal ? t : 0, 0, horizontal ? 0 : t)
    group.add(post)
  }
  for (const y of [0.45, 0.85]) {
    const rail = boxMesh(horizontal ? len : 0.08, 0.06, horizontal ? 0.08 : len, steel)
    rail.position.y = y
    group.add(rail)
  }
  return group
}

/** A wooden truss railing — posts, top rail, and diagonal cross-bracing, like an open
 *  village footbridge rather than a steel guardrail. Original design. */
function buildWoodTruss(p: Prop) {
  const horizontal = (p.w ?? 1) >= (p.d ?? 1)
  const len = horizontal ? p.w ?? 1 : p.d ?? 1
  const group = new THREE.Group()
  const wood = lambert([94, 62, 40])
  const woodDark = lambert([70, 46, 30])
  const postN = Math.max(2, Math.round(len) + 1)
  const positions: number[] = []
  for (let i = 0; i < postN; i++) positions.push((i / (postN - 1) - 0.5) * len)

  for (const t of positions) {
    const post = boxMesh(0.1, 0.95, 0.1, wood)
    post.position.set(horizontal ? t : 0, 0, horizontal ? 0 : t)
    group.add(post)
  }
  const rail = boxMesh(horizontal ? len : 0.1, 0.08, horizontal ? 0.1 : len, wood)
  rail.position.y = 0.85
  group.add(rail)

  // diagonal X-bracing between each pair of posts, like a real timber truss
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i]
    const b = positions[i + 1]
    const mid = (a + b) / 2
    for (const sign of [1, -1] as const) {
      const brace = boxMesh(horizontal ? Math.abs(b - a) * 1.05 : 0.06, 0.06, horizontal ? 0.06 : Math.abs(b - a) * 1.05, woodDark)
      brace.position.set(horizontal ? mid : 0, 0.45, horizontal ? 0 : mid)
      brace.rotation.z = horizontal ? sign * 0.62 : 0
      brace.rotation.x = horizontal ? 0 : sign * 0.62
      group.add(brace)
    }
  }
  return group
}

/** A warm, glowing lantern on a wooden post. */
function buildLampPost() {
  const group = new THREE.Group()
  const post = boxMesh(0.09, 1.1, 0.09, lambert([70, 46, 30]))
  group.add(post)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffcf7a }))
  glow.position.y = 1.15
  group.add(glow)
  const light = new THREE.PointLight(0xffcf7a, 0.6, 3.5)
  light.position.y = 1.15
  group.add(light)
  return group
}

// ── American Turners (the volleyball gym by the water) ──────────────────────────

const TURNERS_BRICK: RGB = [150, 62, 46]
const TURNERS_MORTAR: RGB = [118, 50, 38]

function turnersBrickPx(g: CanvasRenderingContext2D, W: number, H: number) {
  rect(g, 0, 0, W, H, TURNERS_BRICK)
  for (let y = 3; y < H; y += 4) {
    rect(g, 0, y, W, 1, TURNERS_MORTAR)
    for (let x = (y / 4) % 2 ? 3 : 7; x < W; x += 8) rect(g, x, y - 3, 1, 3, shade(TURNERS_MORTAR, 1.12))
  }
  speckle(g, 0, 0, W, H, [shade(TURNERS_BRICK, 1.1), shade(TURNERS_BRICK, 0.9)], 0.08, rng(29))
}

function buildTurnersHall(p: Prop, assets: Assets) {
  const w = p.w ?? 12
  const d = p.d ?? 7
  const H = 3.4
  const doorCol = (p.opts?.doorCol as number) ?? Math.floor(w / 2)
  const group = new THREE.Group()

  const front = paint(w, H, (g, W, Hp) => {
    turnersBrickPx(g, W, Hp)
    rect(g, 0, 0, W, 3, [40, 40, 44]) // dark roofline band
    for (let x = 6; x < W - 10; x += 20) windowPx(g, x, 6, 10, 20, [60, 60, 66])
    const dx = doorCol * TP - 6
    rect(g, dx - 2, Hp - 30, 24, 30, [60, 60, 66])
    rect(g, dx, Hp - 26, 9, 26, [40, 44, 50])
    rect(g, dx + 11, Hp - 26, 9, 26, [40, 44, 50])
  })
  const side = paint(d, H, (g, W, Hp) => {
    turnersBrickPx(g, W, Hp)
    rect(g, 0, 0, W, 3, [40, 40, 44])
    windowPx(g, Math.floor(W / 2) - 6, 8, 12, 18, [60, 60, 66])
  })
  const roof = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [30, 30, 32])
    speckle(g, 0, 0, W, Hp, [[26, 26, 28], [38, 38, 40]], 0.35, rng(31))
  }))
  roof.repeat.set(w, d)
  group.add(boxMesh(w, H, d, [lambert(side), lambert(side), lambert(roof), lambert(roof), lambert(front), lambert(side)]))

  // rooftop parapet cap and a small vent/chimney block
  const cap = boxMesh(w + 0.1, 0.12, d + 0.1, lambert([224, 224, 220]))
  cap.position.y = H
  group.add(cap)
  const chimney = boxMesh(0.9, 1.0, 0.9, lambert([120, 122, 126]))
  chimney.position.set(-w * 0.28, H + 0.5, 0)
  group.add(chimney)

  // name lettering on the brick, above the entrance
  const name = (p.opts?.name as string) ?? ''
  if (name) {
    const textW = assets.font.width(name)
    const { c, g } = makeCanvas(textW + 4, assets.font.height)
    assets.font.draw(g, name, 2, 0, [232, 226, 210], false)
    const t = pixelTexture(c)
    const pw = (textW + 4) / (TP * 2.2)
    const ph = assets.font.height / (TP * 2.2)
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.5 }))
    sign.position.set(w * 0.18, H - 0.5, d / 2 + 0.01)
    group.add(sign)
  }

  // concrete entrance steps with hedges either side, matching the reference photo
  const doorCx = -w / 2 + doorCol + 0.5
  const concrete = lambert([206, 204, 196])
  for (const [depth, hgt] of [[0.55, 0.1], [0.32, 0.2]] as const) {
    const step = boxMesh(1.6, hgt, depth, concrete)
    step.position.set(doorCx, 0, d / 2 + depth / 2)
    group.add(step)
  }
  const hedge = lambert([52, 92, 54], { flatShading: true })
  for (const s of [-1, 1]) {
    const bush = boxMesh(1.1, 0.5, 0.6, hedge)
    bush.position.set(doorCx + s * 1.7, 0, d / 2 + 0.6)
    group.add(bush)
  }
  return group
}

// ── Ward's candy store + Bobb Howard's service station (New Hyde Park) ──

/** Flat sign plane with pixel-font lettering (optionally on a coloured board). `ppu` is
 *  texture pixels per world unit — higher reads smaller. Lines are centred. */
function letteredSign(assets: Assets, lines: string[], ink: RGB, board: RGB | null, ppu: number, pad = 2) {
  const font = assets.font
  const lw = Math.max(...lines.map((l) => font.width(l)))
  const W = lw + pad * 2
  const H = lines.length * font.height + pad * 2
  const { c, g } = makeCanvas(W, H)
  if (board) rect(g, 0, 0, W, H, board)
  lines.forEach((l, i) => font.draw(g, l, Math.round((W - font.width(l)) / 2), pad + i * font.height, ink, false))
  const mat = new THREE.MeshLambertMaterial({ map: pixelTexture(c), transparent: !board, alphaTest: board ? 0 : 0.5 })
  return new THREE.Mesh(new THREE.PlaneGeometry(W / ppu, H / ppu), mat)
}

/** A rainbow swirl lollipop head (like the giant one outside the candy store). */
function lollipopTexture() {
  const N = 48
  const { c, g } = makeCanvas(N, N)
  const bands: RGB[] = [[236, 64, 72], [252, 164, 48], [252, 228, 76], [96, 196, 92], [64, 140, 232], [176, 96, 208]]
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - N / 2
      const dy = y + 0.5 - N / 2
      const r = Math.hypot(dx, dy) / (N / 2)
      if (r > 1) continue
      const t = Math.atan2(dy, dx) / (Math.PI * 2) + r * 2.2
      rect(g, x, y, 1, 1, r > 0.93 ? [250, 250, 250] : bands[((Math.floor(t * 6) % 6) + 6) % 6])
    }
  }
  return pixelTexture(c)
}

/**
 * The corner of Tyler's after-school candy run: Ward's General Store ("OLD CANDY/TOYS"),
 * tucked into the end of Bobb Howard's service station. One red-brick building under a
 * white overhang — the candy store on the left with its sign boards, glass door, a display
 * window crammed with toys and a giant swirl lollipop out front; three garage bays on the
 * right under "BOBB HOWARDS", flanked by EMISSIONS and DIAGNOSTICS signs, cars inside.
 * Original geometry and pixel painting, laid out after Tyler's photos.
 */
function buildCandyShop(p: Prop, assets: Assets) {
  const w = p.w ?? 12
  const d = p.d ?? 4
  const H = 2.8
  const shopW = (p.opts?.shopW as number) ?? 4
  const group = new THREE.Group()
  const bayCount = 3
  const garageW = w - shopW
  const pillar = 0.4
  const bayW = (garageW - pillar * (bayCount + 1)) / bayCount
  const navy: RGB = [36, 52, 112]
  const fz = d / 2 + 0.02

  const front = paint(w, H, (g, W, Hp) => {
    turnersBrickPx(g, W, Hp)
    // ── candy store: glass door + display window full of toys and candy ──
    const doorX = 5
    rect(g, doorX, 21, 14, Hp - 21, navy)
    rect(g, doorX + 2, 23, 10, Hp - 23, [150, 188, 214])
    rect(g, doorX + 3, 24, 2, Hp - 26, [196, 222, 240])
    rect(g, doorX + 9, 33, 2, 2, [200, 200, 200])
    const winX = 23
    const winW = shopW * TP - winX - 4
    rect(g, winX, 21, winW, 19, navy)
    rect(g, winX + 2, 23, winW - 4, 15, [226, 232, 238])
    speckle(g, winX + 2, 27, winW - 4, 11, [[236, 64, 72], [252, 200, 60], [80, 160, 232], [120, 200, 96], [240, 120, 190], [255, 255, 255]], 0.55, rng(77))
    rect(g, winX + 4, 24, winW - 8, 3, [236, 64, 72]) // "SALE / CANDY" banner in the window
    rect(g, winX + 2, 30, winW - 4, 1, [150, 150, 156]) // shelf
    rect(g, winX + 2, 34, winW - 4, 1, [150, 150, 156])
    // ── garage: three open bays with cars and a lift, white headers, blue door tracks ──
    const x0 = shopW * TP
    for (let i = 0; i < bayCount; i++) {
      const bx = Math.round(x0 + (pillar + i * (bayW + pillar)) * TP)
      const bw = Math.round(bayW * TP)
      const top = 18
      rect(g, bx, top - 3, bw, 3, [236, 236, 232]) // header
      rect(g, bx, top, bw, Hp - top, [46, 48, 54]) // interior
      rect(g, bx + 3, top + 2, bw - 6, 1, [228, 236, 240]) // fluorescent tube
      rect(g, bx, top, 1, Hp - top, navy)
      rect(g, bx + bw - 1, top, 1, Hp - top, navy)
      rect(g, bx + 2, Hp - 16, bw - 4, 3, [70, 72, 80]) // tool chest along the back wall
      if (i === 1) {
        // silver SUV raised on the lift, a mechanic underneath
        rect(g, bx + 6, top + 6, 2, Hp - top - 6, [52, 84, 170])
        rect(g, bx + bw - 8, top + 6, 2, Hp - top - 6, [52, 84, 170])
        rect(g, bx + 7, top + 4, bw - 14, 8, [184, 186, 190])
        rect(g, bx + 9, top + 5, bw - 18, 3, [86, 90, 100])
        rect(g, bx + 8, top + 8, 2, 2, [200, 40, 40])
        rect(g, bx + bw - 10, top + 8, 2, 2, [200, 40, 40])
        rect(g, bx + Math.floor(bw / 2) - 2, Hp - 10, 4, 10, [30, 30, 34])
        rect(g, bx + Math.floor(bw / 2) - 2, Hp - 6, 4, 1, [220, 220, 120])
      } else {
        // a car parked nose-out in the bay
        const col: RGB = i === 0 ? [34, 36, 44] : [130, 140, 160]
        rect(g, bx + 3, Hp - 9, bw - 6, 6, col)
        rect(g, bx + 6, Hp - 12, bw - 12, 4, shade(col, 0.8))
        rect(g, bx + 7, Hp - 11, bw - 14, 2, [120, 150, 180])
        rect(g, bx + 4, Hp - 7, 3, 2, i === 0 ? [236, 60, 60] : [240, 236, 200])
        rect(g, bx + bw - 7, Hp - 7, 3, 2, i === 0 ? [236, 60, 60] : [240, 236, 200])
        rect(g, bx + 4, Hp - 3, 4, 3, [20, 20, 22])
        rect(g, bx + bw - 8, Hp - 3, 4, 3, [20, 20, 22])
      }
    }
  })
  const side = paint(d, H, (g, W, Hp) => turnersBrickPx(g, W, Hp))
  const roof = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [60, 60, 64])
    speckle(g, 0, 0, W, Hp, [[52, 52, 56], [70, 70, 74]], 0.35, rng(83))
  }))
  roof.repeat.set(w, d)
  group.add(boxMesh(w, H, d, [lambert(side), lambert(side), lambert(roof), lambert(roof), lambert(front), lambert(side)]))

  // white overhang / soffit running the length of the building
  const overhang = boxMesh(w + 0.2, 0.26, d + 0.3, lambert([236, 236, 232]))
  overhang.position.set(0, H - 0.06, 0.15)
  group.add(overhang)

  const shopCx = -w / 2 + shopW / 2
  const at = (m: THREE.Object3D, x: number, y: number, z = fz + 0.45) => {
    m.position.set(x, y, z)
    group.add(m)
    return m
  }
  // the candy store's blue awning band (the shop's name shows in the location banner)
  const band = boxMesh(shopW, 0.4, 0.14, lambert(navy))
  at(band, shopCx, 1.3, fz + 0.07)

  // giant swirl lollipop on a white stick at the corner of the display window
  const lx = -w / 2 + shopW - 0.4
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6), lambert([246, 246, 246]))
  at(stick, lx, 0.55, fz + 0.3)
  const pop = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24), new THREE.MeshLambertMaterial({ map: lollipopTexture(), transparent: true }))
  at(pop, lx, 1.05, fz + 0.32)

  // garage service signs
  const bayCx = (i: number) => -w / 2 + shopW + pillar + i * (bayW + pillar) + bayW / 2
  at(letteredSign(assets, ['EMISSIONS'], [255, 255, 255], [44, 84, 176], 34, 2), bayCx(0), 1.25, fz + 0.03)
  at(letteredSign(assets, ['DIAGNOSTICS'], [255, 255, 255], [44, 84, 176], 34, 2), bayCx(2), 1.25, fz + 0.03)

  // concrete sidewalk slab in front of the candy store
  return group
}

// ── Purdue: Lawson Computer Science Building and the Bell Tower (Route 3) ──

const LIMESTONE: RGB = [226, 218, 198]
const LAWSON_BRICK: RGB = [112, 70, 54]
const LAWSON_MORTAR: RGB = [138, 104, 88]

function lawsonBrickPx(g: CanvasRenderingContext2D, W: number, H: number) {
  rect(g, 0, 0, W, H, LAWSON_BRICK)
  for (let y = 2; y < H; y += 3) {
    rect(g, 0, y, W, 1, LAWSON_MORTAR)
    for (let x = (y / 3) % 2 ? 2 : 5; x < W; x += 6) rect(g, x, y - 2, 1, 2, shade(LAWSON_MORTAR, 0.95))
  }
  speckle(g, 0, 0, W, H, [shade(LAWSON_BRICK, 1.1), shade(LAWSON_BRICK, 0.9)], 0.08, rng(61))
}

/** Dark curtain-wall glass with a light mullion grid. */
function glassGridPx(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cellW = 5, cellH = 8) {
  rect(g, x, y, w, h, [34, 44, 62])
  speckle(g, x, y, w, h, [[52, 66, 92], [44, 56, 80]], 0.2, rng(63))
  for (let gx = x; gx <= x + w; gx += cellW) rect(g, gx, y, 1, h, [168, 176, 186])
  for (let gy = y; gy <= y + h; gy += cellH) rect(g, x, gy, w, 1, [168, 176, 186])
}

/**
 * Purdue's Lawson Computer Science Building, where Tyler did his CS degree: brown-brick
 * wings with punched windows over a limestone base, and a cream limestone entrance
 * pavilion out front — a curved band lettered LAWSON COMPUTER SCIENCE BUILDING over glass
 * doors, a ribbon window above, and a limestone stair tower rising behind it. A curved
 * dark-glass curtain wall wraps the right corner, a glass bay cantilevers off the left,
 * and wide limestone steps with handrails lead up to the doors. The prop's last row is the
 * pavilion, so the building's footprint covers it.
 */
function buildLawson(p: Prop, assets: Assets) {
  const w = p.w ?? 14
  const d = p.d ?? 7
  const H = 3.6
  const pavD = 1.2
  const mainD = d - pavD
  const group = new THREE.Group()
  const back = -d / 2
  const mainFront = back + mainD
  const pavW = 5.2

  const front = paint(w, H, (g, W, Hp) => {
    lawsonBrickPx(g, W, Hp)
    rect(g, 0, Hp - 7, W, 7, LIMESTONE) // limestone base
    rect(g, 0, 0, W, 2, LIMESTONE) // coping
    const pav0 = Math.round((w / 2 - pavW / 2 - 0.2) * TP)
    const pav1 = Math.round((w / 2 + pavW / 2 + 0.2) * TP)
    const glass0 = Math.round((w - 3.2) * TP)
    for (const fy of [6, 22, 38]) {
      for (let x = 8; x < W - 6; x += 14) {
        if ((x + 6 > pav0 && x < pav1) || x + 6 > glass0) continue
        rect(g, x - 1, fy - 1, 7, 13, LIMESTONE)
        rect(g, x, fy, 5, 11, [48, 62, 84])
        rect(g, x, fy, 5, 4, [86, 108, 136])
        rect(g, x + 2, fy, 1, 11, LIMESTONE)
      }
    }
  })
  const side = paint(mainD, H, (g, W, Hp) => {
    lawsonBrickPx(g, W, Hp)
    rect(g, 0, Hp - 7, W, 7, LIMESTONE)
    rect(g, 0, 0, W, 2, LIMESTONE)
    for (const fy of [6, 22, 38]) for (let x = 6; x < W - 6; x += 12) {
      rect(g, x - 1, fy - 1, 7, 13, LIMESTONE)
      rect(g, x, fy, 5, 11, [48, 62, 84])
    }
  })
  const roof = repeating(paint(1, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [178, 176, 170])
    speckle(g, 0, 0, W, Hp, [[166, 164, 158], [190, 188, 182]], 0.3, rng(67))
  }))
  roof.repeat.set(w, mainD)
  const body = boxMesh(w, H, mainD, [lambert(side), lambert(side), lambert(roof), lambert(roof), lambert(front), lambert(side)])
  body.position.z = back + mainD / 2
  group.add(body)
  const coping = boxMesh(w + 0.1, 0.1, mainD + 0.1, lambert(LIMESTONE))
  coping.position.set(0, H, back + mainD / 2)
  group.add(coping)

  // limestone stair tower rising behind the pavilion
  const tower = boxMesh(2.4, H + 1.3, 1.4, lambert(LIMESTONE))
  tower.position.set(0, 0, mainFront - 0.8)
  group.add(tower)
  const towerCap = boxMesh(2.6, 0.14, 1.6, lambert(shade(LIMESTONE, 1.04)))
  towerCap.position.set(0, H + 1.3, mainFront - 0.8)
  group.add(towerCap)

  // entrance pavilion: glass doors below, ribbon window above, shallow arch detail
  const pavH = 3.0
  const pavFront = paint(pavW, pavH, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, LIMESTONE)
    speckle(g, 0, 0, W, Hp, [shade(LIMESTONE, 0.96), shade(LIMESTONE, 1.03)], 0.15, rng(71))
    rect(g, 0, 0, W, 2, shade(LIMESTONE, 0.9)) // cornice shadow
    // ribbon window
    const rw = W - 20
    rect(g, 10, 8, rw, 8, [236, 236, 232])
    for (let i = 0; i < 8; i++) rect(g, 11 + i * Math.floor((rw - 2) / 8), 9, Math.floor((rw - 2) / 8) - 1, 6, [150, 176, 196])
    // shallow arch line over the ribbon window
    for (let x = 6; x < W - 6; x++) {
      const t = (x - W / 2) / (W / 2 - 6)
      rect(g, x, Math.round(6 - 3 * (1 - t * t)), 1, 1, shade(LIMESTONE, 0.84))
    }
    // four glass doors under the band
    const dw = 40
    const dx = Math.round(W / 2 - dw / 2)
    rect(g, dx - 3, Hp - 20, dw + 6, 20, [40, 44, 52])
    for (let i = 0; i < 4; i++) {
      const x = dx + i * 10
      rect(g, x, Hp - 18, 9, 18, [200, 206, 212])
      rect(g, x + 1, Hp - 17, 7, 17, [44, 56, 74])
      rect(g, x + (i % 2 ? 1 : 6), Hp - 10, 1, 3, [220, 224, 228])
    }
  })
  const lime = lambert(LIMESTONE)
  const pav = boxMesh(pavW, pavH, pavD + 0.3, [lime, lime, lime, lime, lambert(pavFront), lime])
  const pavZ = mainFront + pavD / 2 - 0.15
  pav.position.set(0, 0, pavZ)
  group.add(pav)
  const pavCap = boxMesh(pavW + 0.3, 0.14, pavD + 0.5, lambert(shade(LIMESTONE, 1.04)))
  pavCap.position.set(0, pavH, pavZ)
  group.add(pavCap)

  // the curved limestone band: a shallow cylinder sector bulging out over the doors
  // wide and shallow, so both ends land just proud of the pavilion face and the whole
  // name stays visible
  const R = 6
  const theta = 0.9
  const arc = R * theta
  const font = assets.font
  const bandTex = (() => {
    const ppu = 44
    const W = Math.round(arc * ppu)
    const Hp = font.height + 10
    const { c, g } = makeCanvas(W, Hp)
    rect(g, 0, 0, W, Hp, LIMESTONE)
    rect(g, 0, 0, W, 1, shade(LIMESTONE, 1.06))
    rect(g, 0, Hp - 2, W, 2, shade(LIMESTONE, 0.86))
    return pixelTexture(c)
  })()
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, 0.55, 28, 1, false, -theta / 2, theta),
    [lambert(bandTex), lambert(shade(LIMESTONE, 1.05)), lambert(shade(LIMESTONE, 0.8))],
  )
  const bulge = mainFront + pavD + R * (1 - Math.cos(theta / 2)) + 0.05
  band.position.set(0, 1.62, bulge - R)
  group.add(band)

  // curved dark-glass curtain wall on the right corner
  const glassTex = paint(1.8, H - 0.2, (g, W, Hp) => glassGridPx(g, 0, 0, W, Hp))
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, H - 0.2, 12, 1, false, 0, Math.PI / 2),
    [lambert(glassTex), lambert([178, 176, 170]), lambert([34, 44, 62])],
  )
  glass.position.set(w / 2 - 1.45, 0, mainFront - 1.4 + 0.05)
  glass.geometry.translate(0, (H - 0.2) / 2, 0)
  group.add(glass)

  // glass bay cantilevered off the upper left
  const bayTex = paint(2.6, 1.3, (g, W, Hp) => glassGridPx(g, 0, 0, W, Hp, 6, 10))
  const bay = boxMesh(2.6, 1.3, 0.55, [lime, lime, lime, lime, lambert(bayTex), lime])
  bay.position.set(-w / 2 + 2.2, 1.9, mainFront + 0.25)
  group.add(bay)

  // wide limestone steps up to the doors, handrails, and low planter walls either side
  const stepW = 3.8
  for (let i = 0; i < 3; i++) {
    const st = boxMesh(stepW, 0.06 * (3 - i), 0.3, lambert(shade(LIMESTONE, 1 - i * 0.03)))
    st.position.set(0, 0, mainFront + pavD + 0.15 + i * 0.3)
    group.add(st)
  }
  const rail = lambert([176, 182, 188])
  for (const x of [-0.7, 0.7]) {
    const r = boxMesh(0.05, 0.05, 1.0, rail)
    r.position.set(x, 0.55, mainFront + pavD + 0.45)
    group.add(r)
    for (const dz of [0.05, 0.85]) {
      const post = boxMesh(0.04, 0.55, 0.04, rail)
      post.position.set(x, 0, mainFront + pavD + dz)
      group.add(post)
    }
  }
  for (const sx of [-1, 1]) {
    const wall = boxMesh(1.5, 0.32, 0.9, lambert(LIMESTONE))
    wall.position.set(sx * (stepW / 2 + 0.8), 0, mainFront + pavD + 0.45)
    group.add(wall)
  }
  return group
}

/** A clock face: white dial, dark rim and hour ticks. */
function clockFaceTexture() {
  const N = 32
  const { c, g } = makeCanvas(N, N)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const r = Math.hypot(x + 0.5 - N / 2, y + 0.5 - N / 2) / (N / 2)
    if (r <= 1) rect(g, x, y, 1, 1, r > 0.86 ? [40, 40, 46] : [246, 246, 240])
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const tx = Math.round(N / 2 + Math.sin(a) * 11.5 - 0.5)
    const ty = Math.round(N / 2 - Math.cos(a) * 11.5 - 0.5)
    rect(g, tx, ty, i % 3 ? 1 : 2, i % 3 ? 1 : 2, [40, 40, 46])
  }
  return pixelTexture(c)
}

/**
 * Purdue's Bell Tower: a limestone base with an arched opening, a tall red-brick shaft
 * banded with limestone and ribbed with recessed panels, a white clock stage (the clocks
 * show the visitor's real local time), an open belfry with a bronze bell, a white cornice,
 * and a dark slate pyramid roof with a spire.
 */
function buildBellTower() {
  const group = new THREE.Group()
  // modelled at full height, then scaled a touch so it fits the overworld camera
  group.scale.setScalar(0.85)
  const baseW = 1.5
  const shaftW = 1.12
  const baseH = 1.4
  const shaftTop = 6.6
  const white = lambert([240, 238, 230])
  const lime = lambert(LIMESTONE)

  const baseTex = paint(baseW, baseH, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, LIMESTONE)
    speckle(g, 0, 0, W, Hp, [shade(LIMESTONE, 0.95)], 0.12, rng(73))
    // arched opening
    const aw = 10
    const ax = Math.round(W / 2 - aw / 2)
    rect(g, ax, 8, aw, Hp - 8, [52, 50, 48])
    for (let x = 0; x < aw; x++) {
      const t = (x + 0.5 - aw / 2) / (aw / 2)
      const top = Math.round(8 - 4 * Math.sqrt(Math.max(0, 1 - t * t)))
      rect(g, ax + x, top, 1, 8 - top, [52, 50, 48])
    }
    rect(g, 0, 0, W, 2, shade(LIMESTONE, 0.9))
  })
  const base = boxMesh(baseW, baseH, baseW, lambert(baseTex))
  group.add(base)

  const shaftTex = repeating(paint(shaftW, 1.5, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [104, 44, 40])
    for (let y = 1; y < Hp; y += 3) rect(g, 0, y, W, 1, [84, 34, 32])
    speckle(g, 0, 0, W, Hp, [[118, 52, 46], [92, 38, 36]], 0.12, rng(79))
    // recessed vertical panels
    for (const x of [3, W - 5]) rect(g, x, 0, 2, Hp, [70, 28, 26])
  }))
  shaftTex.repeat.set(1, (shaftTop - baseH) / 1.5)
  const shaft = boxMesh(shaftW, shaftTop - baseH, shaftW, lambert(shaftTex))
  shaft.position.y = baseH
  group.add(shaft)
  for (let y = baseH; y <= shaftTop; y += (shaftTop - baseH) / 4) {
    const bandMesh = boxMesh(shaftW + 0.08, 0.1, shaftW + 0.08, lime)
    bandMesh.position.y = y - 0.05
    group.add(bandMesh)
  }

  // clock stage with a live clock on each face
  const clockW = 1.3
  const clockH = 0.75
  const stage = boxMesh(clockW, clockH, clockW, white)
  stage.position.y = shaftTop
  group.add(stage)
  const faceTex = clockFaceTexture()
  const hands: { hour: THREE.Mesh; minute: THREE.Mesh }[] = []
  const handMat = new THREE.MeshBasicMaterial({ color: 0x28282e })
  const hand = (len: number, width: number) => {
    const geo = new THREE.BoxGeometry(width, len, 0.01)
    geo.translate(0, len / 2, 0)
    return new THREE.Mesh(geo, handMat)
  }
  for (let i = 0; i < 4; i++) {
    const faceGroup = new THREE.Group()
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }))
    faceGroup.add(face)
    const hour = hand(0.15, 0.04)
    const minute = hand(0.23, 0.028)
    hour.position.z = 0.005
    minute.position.z = 0.01
    faceGroup.add(hour, minute)
    hands.push({ hour, minute })
    faceGroup.rotation.y = (i * Math.PI) / 2
    const out = clockW / 2 + 0.01
    faceGroup.position.set(Math.sin(faceGroup.rotation.y) * out, shaftTop + clockH / 2, Math.cos(faceGroup.rotation.y) * out)
    group.add(faceGroup)
  }

  // open belfry: corner posts, floor and lintel slabs, and a bronze bell inside
  const belfryH = 0.95
  const b0 = shaftTop + clockH
  const post = 0.22
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const pm = boxMesh(post, belfryH, post, white)
    pm.position.set(sx * (clockW / 2 - post / 2), b0, sz * (clockW / 2 - post / 2))
    group.add(pm)
  }
  const inner = boxMesh(clockW - 0.3, 0.02, clockW - 0.3, lambert([70, 60, 52]))
  inner.position.y = b0
  group.add(inner)
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.42, 14), lambert([168, 122, 52]))
  bell.geometry.translate(0, -0.21, 0)
  bell.position.y = b0 + belfryH - 0.12
  group.add(bell)
  const lintel = boxMesh(clockW + 0.12, 0.2, clockW + 0.12, white)
  lintel.position.y = b0 + belfryH
  group.add(lintel)
  const cornice = boxMesh(clockW + 0.26, 0.1, clockW + 0.26, white)
  cornice.position.y = b0 + belfryH + 0.2
  group.add(cornice)

  // slate pyramid roof and spire
  const roofH = 1.05
  const roofY = b0 + belfryH + 0.3
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry((clockW + 0.26) / Math.SQRT2, roofH, 4), lambert([44, 48, 60]))
  roofMesh.rotation.y = Math.PI / 4
  roofMesh.position.y = roofY + roofH / 2
  group.add(roofMesh)
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.5, 6), white)
  spire.position.y = roofY + roofH + 0.2
  group.add(spire)

  // keep the clocks on the visitor's local time; a bell ring gently swings the bell
  let swing = 0
  group.userData.ring = () => (swing = 3)
  group.userData.animate = (dt: number) => {
    const now = new Date()
    const m = now.getMinutes() + now.getSeconds() / 60
    const h = (now.getHours() % 12) + m / 60
    for (const hd of hands) {
      hd.minute.rotation.z = -(m / 60) * Math.PI * 2
      hd.hour.rotation.z = -(h / 12) * Math.PI * 2
    }
    swing = Math.max(0, swing - dt)
    bell.rotation.x = Math.sin(swing * 9) * 0.35 * (swing / 3)
  }
  return group
}

// ── the village suspension bridge (crossed left→right, BW2 Village Bridge-style) ──

/** A box geometry sitting at (x, y0..y0+h, z) — for merging many small parts at once. */
function partAt(w: number, h: number, d: number, x: number, y0: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y0 + h / 2, z)
  return g
}

/**
 * Everything structural on the village suspension bridge in one prop spanning the deck:
 * timber balustrades along both edges, two tall timber towers per edge with a crossbeam
 * overhead, main cables sweeping between them in deep curves with ladder-like hangers down
 * to the rail, and double-headed iron lamp posts. The deck runs along x; the prop's `d`
 * rows are the deck plus its two curb rows. Original geometry, laid out to match how the
 * Village Bridge crossing plays (sideways, the near tower passing in front of the camera).
 */
function buildVillageBridge(p: Prop) {
  const group = new THREE.Group()
  const len = p.w ?? 40
  const half = len / 2
  const edgeZ = ((p.d ?? 7) - 1) / 2
  const inset = (p.opts?.endInset as number) ?? 3
  const from = -half + inset
  const to = half - inset
  const towers = (p.opts?.towers as number[]) ?? [-7, 7]
  const towerH = 8
  const railTop = 0.9
  const low = 1.15
  const top = towerH - 0.5
  const span = (towers[1] - towers[0]) / 2

  const timber = lambert([78, 52, 34])
  const timberDark = lambert([58, 38, 26])
  const iron = lambert([66, 68, 72])
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(255,236,172)') })

  // main-cable height along the deck: deep sag between the towers, sweeping down to the
  // rail beyond them, flat along the rail after that
  const cableY = (x: number) => {
    const [a, b] = towers
    const k = (u: number) => low + (top - low) * u * u
    if (x >= a && x <= b) return k((x - (a + b) / 2) / span)
    if (x < a && x >= a - span) return k((x - (a - span)) / span)
    if (x > b && x <= b + span) return k((x - (b + span)) / span)
    return low
  }

  const timberParts: THREE.BufferGeometry[] = []
  const darkParts: THREE.BufferGeometry[] = []
  for (const z of [-edgeZ, edgeZ]) {
    // balustrade: top and bottom rails, close-set balusters
    timberParts.push(partAt(to - from, 0.1, 0.12, (from + to) / 2, railTop - 0.1, z))
    timberParts.push(partAt(to - from, 0.08, 0.1, (from + to) / 2, 0.15, z))
    for (let x = from; x <= to; x += 0.34) darkParts.push(partAt(0.05, railTop - 0.2, 0.05, x, 0.2, z))
    // ladder-like hangers from the main cable down to the rail
    for (let x = from; x <= to; x += 0.45) {
      const h = cableY(x) - railTop
      if (h > 0.12) darkParts.push(partAt(0.05, h, 0.05, x, railTop, z))
    }
    // main cable
    const pts: THREE.Vector3[] = []
    for (let x = from; x <= to + 0.001; x += 0.25) pts.push(new THREE.Vector3(x, cableY(x), z))
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.08, 5), timberDark))

    // towers: a heavy post with raking legs down each way along the deck
    for (const tx of towers) {
      timberParts.push(partAt(0.5, towerH, 0.5, tx, 0, z))
      for (const dir of [-1, 1]) {
        group.add(strutBetween(new THREE.Vector3(tx, towerH - 0.8, z), new THREE.Vector3(tx + dir * 2.4, 0, z), timber, 0.14))
      }
      timberParts.push(partAt(1.4, 0.25, 0.4, tx, towerH - 1.6, z))
    }
  }
  // crossbeam over the deck joining each pair of towers
  for (const tx of towers) timberParts.push(partAt(0.4, 0.4, edgeZ * 2 + 0.5, tx, towerH - 0.4, 0))
  group.add(new THREE.Mesh(mergeGeometries(timberParts)!, timber))
  group.add(new THREE.Mesh(mergeGeometries(darkParts)!, timberDark))

  // double-headed iron lamp posts, alternating sides, clear of the towers
  const ironParts: THREE.BufferGeometry[] = []
  const glowParts: THREE.BufferGeometry[] = []
  let side = -1
  const L = 1.7 // lamps stand tall on the deck, as in the reference crossing
  for (let x = from + 2; x <= to - 1; x += 6) {
    if (towers.some((t) => Math.abs(t - x) < 2.8)) continue
    const z = side * (edgeZ - 0.35)
    ironParts.push(partAt(0.16, 0.18, 0.16, x, 0, z)) // plinth
    ironParts.push(partAt(0.09 * L, 1.55 * L, 0.09 * L, x, 0, z))
    ironParts.push(partAt(0.62 * L, 0.06 * L, 0.06 * L, x, 1.5 * L, z))
    for (const dx of [-0.3 * L, 0.3 * L]) {
      glowParts.push(partAt(0.18 * L, 0.22 * L, 0.18 * L, x + dx, 1.22 * L, z))
      ironParts.push(partAt(0.28 * L, 0.05 * L, 0.28 * L, x + dx, 1.46 * L, z))
      ironParts.push(partAt(0.26 * L, 0.03 * L, 0.26 * L, x + dx, 1.2 * L, z))
      ironParts.push(partAt(0.03 * L, 0.26 * L, 0.03 * L, x + dx, 1.2 * L, z))
    }
    side = -side
  }
  if (ironParts.length) group.add(new THREE.Mesh(mergeGeometries(ironParts)!, iron))
  if (glowParts.length) group.add(new THREE.Mesh(mergeGeometries(glowParts)!, glow))
  return group
}

// ── the Lugia cave (HGSS Whirl Islands-style chamber) ───────────────────────────

let caveWallGeo: THREE.BufferGeometry | null = null
/** One tile of dark cave cliff: a tall rock column with a lighter mossy cap. */
function getCaveWallGeometry() {
  if (caveWallGeo) return caveWallGeo
  const body = coloredPart(new THREE.BoxGeometry(1.02, 2.6, 1.02), [38, 64, 60], 1.3)
  const band = coloredPart(new THREE.BoxGeometry(1.04, 0.35, 1.04), [30, 52, 50], 0.6)
  const cap = coloredPart(new THREE.BoxGeometry(1.02, 0.18, 1.02), [58, 96, 84], 2.69)
  caveWallGeo = mergeGeometries([body, band, cap])!
  return caveWallGeo
}

/** All cave-wall tiles of a map (plus the ring around it) as one instanced mesh. */
export function buildCaveWalls(spots: { x: number; z: number }[], seed: number) {
  const mesh = new THREE.InstancedMesh(getCaveWallGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length)
  mesh.userData.sharedGeometry = true
  const rand = rng(seed)
  const m = new THREE.Matrix4()
  const tint = new THREE.Color()
  spots.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, 0, s.z), new THREE.Quaternion(), new THREE.Vector3(1, 0.85 + rand() * 0.4, 1))
    mesh.setMatrixAt(i, m)
    const v = 0.85 + rand() * 0.25
    mesh.setColorAt(i, tint.setRGB(v, v, v))
  })
  return mesh
}

let boulderGeo: THREE.BufferGeometry | null = null
/** A rounded blue-grey rock, like the ring of rocks around the Lugia pool. */
function getBoulderGeometry() {
  if (boulderGeo) return boulderGeo
  const lower = coloredPart(new THREE.IcosahedronGeometry(0.5, 1), [98, 128, 150], 0.36)
  lower.scale(1, 0.78, 1)
  const top = coloredPart(new THREE.IcosahedronGeometry(0.34, 1), [150, 182, 200], 0.66)
  top.scale(1, 0.6, 1)
  boulderGeo = mergeGeometries([lower, top])!
  return boulderGeo
}

export function buildBoulders(spots: { x: number; z: number }[], seed: number) {
  const mesh = new THREE.InstancedMesh(getBoulderGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), spots.length)
  mesh.userData.sharedGeometry = true
  const rand = rng(seed)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  spots.forEach((s, i) => {
    const k = 0.9 + rand() * 0.25
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2)
    m.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(k, k, k))
    mesh.setMatrixAt(i, m)
  })
  return mesh
}

/** A waterfall pouring down the back wall into a pool: a scrolling cascade sheet plus a
 *  churning foam band at its base. Its `surge` (0..1) speeds it up and whitens it — the
 *  cutscene drives that when the legendary rises. */
function buildWaterfall(p: Prop) {
  const group = new THREE.Group()
  const w = p.w ?? 6
  const h = (p.opts?.height as number) ?? 4
  const fallTex = repeating(paint(1, 1, (g, W, H) => {
    rect(g, 0, 0, W, H, [88, 140, 216])
    const r = rng(41)
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(r() * W)
      rect(g, x, 0, 1 + Math.floor(r() * 2), H, r() < 0.5 ? [196, 226, 250] : [144, 190, 240])
    }
    speckle(g, 0, 0, W, H, [[236, 248, 255]], 0.06, r)
  }))
  fallTex.repeat.set(w, h / 1.5)
  const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, side: THREE.DoubleSide })
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), fallMat)
  fall.position.set(0, h / 2 - 0.3, -0.45)
  group.add(fall)

  const foamTex = repeating(paint(1, 1, (g, W, H) => {
    rect(g, 0, 0, W, H, [178, 214, 246])
    speckle(g, 0, 0, W, H, [[255, 255, 255], [214, 236, 252]], 0.5, rng(43))
  }))
  foamTex.repeat.set(w, 1)
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.9 })
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.4, 1.1), foamMat)
  foam.rotation.x = -Math.PI / 2
  foam.position.set(0, -0.25, 0.2)
  group.add(foam)

  let surge = 0
  group.userData.setSurge = (v: number) => (surge = v)
  group.userData.animate = (dt: number) => {
    fallTex.offset.y = (fallTex.offset.y + dt * (1.4 + surge * 4)) % 1
    foamTex.offset.x = (foamTex.offset.x + dt * (0.3 + surge)) % 1
    fallMat.color.setScalar(1 + surge * 0.25)
    foam.scale.set(1, 1 + surge * 0.8, 1)
  }
  return group
}

/** A dark cave opening in a rock face. */
function buildCaveMouth(p: Prop) {
  const w = p.w ?? 4
  const d = p.d ?? 2
  const h = 3
  const face = paint(w, h, (g, W, H) => {
    rect(g, 0, 0, W, H, [60, 84, 78])
    speckle(g, 0, 0, W, H, [[48, 70, 66], [74, 100, 92]], 0.3, rng(47))
    for (let y = 6; y < H; y += 7) rect(g, 0, y, W, 1, [44, 64, 60])
    const cx = W / 2
    const r = W * 0.3
    const top = H * 0.25
    for (let y = Math.floor(top); y < H; y++) {
      const dy = top + r - y
      const half = dy > 0 ? Math.sqrt(Math.max(0, r * r - dy * dy)) : r
      rect(g, Math.round(cx - half), y, Math.round(half * 2), 1, [8, 12, 16])
    }
  })
  const rock = lambert([60, 84, 78])
  const top = lambert([80, 118, 96])
  return boxMesh(w, h, d, [rock, rock, top, rock, lambert(face), rock])
}

/** A swirling portal — used after the last legendary to reach the Hall of Fame. */
export function buildPortal() {
  const group = new THREE.Group()
  const disc = paint(2, 2, (g, W, H) => {
    const cx = W / 2
    const cy = H / 2
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - cx, y - cy) / (W / 2)
        if (d > 1) continue
        const a = Math.atan2(y - cy, x - cx)
        const swirl = Math.sin(a * 3 + d * 9)
        const col: RGB = swirl > 0.3 ? [236, 222, 255] : d < 0.35 ? [255, 250, 255] : [170, 128, 236]
        rect(g, x, y, 1, 1, col)
      }
    }
  })
  const discMat = new THREE.MeshBasicMaterial({ map: disc, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide })
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.85, 32), discMat)
  face.position.y = 1.1
  group.add(face)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(250,230,150)') }))
  ring.position.y = 1.1
  group.add(ring)
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color('rgb(190,150,255)'), transparent: true, opacity: 0.35 }))
  glow.rotation.x = -Math.PI / 2
  glow.position.y = 0.02
  group.add(glow)
  const light = new THREE.PointLight(0xc8a0ff, 1.2, 5)
  light.position.y = 1.1
  group.add(light)
  let t = 0
  group.userData.animate = (dt: number) => {
    t += dt
    face.rotation.z -= dt * 1.6
    face.position.y = 1.1 + Math.sin(t * 2) * 0.06
    ring.position.y = face.position.y
    glow.material.opacity = 0.25 + Math.sin(t * 3) * 0.12
  }
  return group
}

// ── Hall of Fame ────────────────────────────────────────────────────────────────

/** A tall fluted stone pillar with a gold-trimmed base and capital. */
function buildPillar() {
  const group = new THREE.Group()
  const stone = lambert([232, 222, 198])
  const gold = lambert([214, 172, 80])
  const base = boxMesh(0.9, 0.3, 0.9, stone)
  const baseTrim = boxMesh(0.95, 0.08, 0.95, gold)
  baseTrim.position.y = 0.3
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 3.6, 12), stone)
  shaft.position.y = 0.38 + 1.8
  const capTrim = boxMesh(0.8, 0.08, 0.8, gold)
  capTrim.position.y = 3.98
  const cap = boxMesh(0.95, 0.3, 0.95, stone)
  cap.position.y = 4.06
  group.add(base, baseTrim, shaft, capTrim, cap)
  return group
}

/** An exhibit pedestal: stone plinth, gold plaque on the front, a glowing trophy orb. */
function buildPedestal(p: Prop) {
  const group = new THREE.Group()
  const accent = (p.opts?.accent as RGB) ?? [120, 180, 255]
  const plaque = paint(0.8, 0.9, (g, W, H) => {
    rect(g, 0, 0, W, H, [220, 208, 184])
    rect(g, 2, 3, W - 4, H - 6, [196, 156, 70])
    rect(g, 3, 4, W - 6, H - 8, [236, 204, 118])
    for (let y = 6; y < H - 6; y += 2) rect(g, 4, y, W - 8, 1, [196, 156, 70])
  })
  const stone = lambert([220, 208, 184])
  const plinth = boxMesh(0.8, 0.9, 0.8, [stone, stone, stone, stone, lambert(plaque), stone])
  const top = boxMesh(0.9, 0.08, 0.9, lambert([214, 172, 80]))
  top.position.y = 0.9
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(`rgb(${accent.join(',')})`) }))
  orb.position.y = 1.25
  const light = new THREE.PointLight(new THREE.Color(`rgb(${accent.join(',')})`), 0.5, 2.5)
  light.position.y = 1.25
  group.add(plinth, top, orb, light)
  let t = rng(Math.round(p.x * 31 + p.y))() * 6
  group.userData.animate = (dt: number) => {
    t += dt
    orb.position.y = 1.25 + Math.sin(t * 1.8) * 0.06
    orb.rotation.y += dt
  }
  return group
}

/** The contact kiosk at the head of the hall: a wide lectern with a glowing screen. */
function buildKiosk(p: Prop) {
  const w = p.w ?? 2
  const group = new THREE.Group()
  const stone = lambert([220, 208, 184])
  group.add(boxMesh(w * 0.9, 0.95, 0.7, stone))
  const screenTex = paint(w * 0.8, 0.5, (g, W, H) => {
    rect(g, 0, 0, W, H, [30, 40, 70])
    rect(g, 2, 2, W - 4, H - 4, [70, 120, 200])
    for (let y = 4; y < H - 3; y += 2) rect(g, 4, y, Math.round((W - 8) * (0.5 + ((y * 7) % 5) / 10)), 1, [190, 220, 250])
  })
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.5), new THREE.MeshBasicMaterial({ map: screenTex }))
  screen.position.set(0, 1.2, 0.05)
  screen.rotation.x = -0.35
  group.add(screen)
  const trim = boxMesh(w * 0.95, 0.08, 0.75, lambert([214, 172, 80]))
  trim.position.y = 0.95
  group.add(trim)
  return group
}

// ── Hall of Fame project exhibits ───────────────────────────────────────────────

const CHROME: RGB = [200, 206, 214]

/**
 * Rolls-Royce Phantom on a display platform (the Data Synthesizer exhibit): white body,
 * black hood and roof, tall chrome grille, Spirit of Ecstasy, black disc wheels. Faces
 * south so the grille is toward the camera.
 */
function buildRollsRoyce(p: Prop) {
  const group = new THREE.Group()
  const L = 2.6
  const Wd = 1.2
  const white = lambert([238, 238, 234])
  const black = lambert([30, 30, 36])
  const chrome = lambert(CHROME)
  const front = L / 2

  // round showroom turntable with gold trim
  const R = 1.45
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.08, 28), lambert([44, 40, 52]))
  platform.position.y = 0.04
  const trim = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.03, 28), lambert([214, 172, 80]))
  trim.position.y = 0.015
  group.add(platform, trim)

  // angled three-quarter on the turntable so the camera sees the grille and the side
  const car = new THREE.Group()
  car.position.y = 0.08
  car.rotation.y = (p.opts?.angle as number) ?? 0.9
  group.add(car)

  // white lower body, a black sill under it
  const body = boxMesh(Wd, 0.42, L, white)
  body.position.y = 0.2
  const sill = boxMesh(Wd + 0.02, 0.06, L - 1.3, black)
  sill.position.y = 0.17
  car.add(body, sill)

  // black hood running back from the grille, white fenders either side of it
  const hood = boxMesh(0.62, 0.05, 0.9, black)
  hood.position.set(0, 0.62, front - 0.5)
  car.add(hood)

  // black cabin with tinted glass on the sides and both screens
  const glassSide = paint(1.4, 0.36, (g, W, H) => {
    rect(g, 0, 0, W, H, [30, 30, 36])
    rect(g, 1, 1, W - 2, H - 2, [70, 84, 100])
    rect(g, 1, 1, W - 2, 2, [118, 136, 156])
    rect(g, Math.floor(W * 0.48), 0, 2, H, [30, 30, 36])
  })
  const glassEnd = paint(1.0, 0.36, (g, W, H) => {
    rect(g, 0, 0, W, H, [30, 30, 36])
    rect(g, 2, 1, W - 4, H - 2, [70, 84, 100])
    rect(g, 2, 1, W - 4, 2, [118, 136, 156])
  })
  const side = lambert(glassSide)
  const end = lambert(glassEnd)
  const cabin = boxMesh(Wd - 0.12, 0.38, 1.35, [side, side, black, black, end, end])
  cabin.position.set(0, 0.62, -0.3)
  car.add(cabin)

  // tall chrome grille with vertical vanes, framed in black, and the RR badge below
  const grilleTex = paint(0.4, 0.36, (g, W, H) => {
    rect(g, 0, 0, W, H, [150, 156, 166])
    for (let x = 1; x < W - 1; x += 2) rect(g, x, 1, 1, H - 2, [228, 232, 238])
  })
  const frame = boxMesh(0.48, 0.44, 0.06, black)
  frame.position.set(0, 0.2, front + 0.01)
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.36), new THREE.MeshLambertMaterial({ map: grilleTex }))
  grille.position.set(0, 0.42, front + 0.045)
  const badge = boxMesh(0.1, 0.06, 0.02, black)
  badge.position.set(0, 0.12, front + 0.015)
  car.add(frame, grille, badge)

  // Spirit of Ecstasy on top of the grille
  const mascot = boxMesh(0.03, 0.1, 0.05, chrome)
  mascot.position.set(0, 0.64, front - 0.02)
  const wings = boxMesh(0.09, 0.02, 0.03, chrome)
  wings.position.set(0, 0.71, front - 0.04)
  car.add(mascot, wings)

  // slim headlights either side of the grille, a black lower bumper
  for (const s of [-1, 1]) {
    const lamp = boxMesh(0.24, 0.05, 0.02, new THREE.MeshBasicMaterial({ color: 0xeef4ff }))
    lamp.position.set(s * 0.4, 0.48, front + 0.005)
    car.add(lamp)
    const mirror = boxMesh(0.08, 0.06, 0.06, black)
    mirror.position.set(s * (Wd / 2 + 0.03), 0.62, 0.32)
    car.add(mirror)
    const handle = boxMesh(0.02, 0.02, 0.12, chrome)
    handle.position.set(s * (Wd / 2 + 0.005), 0.5, -0.1)
    car.add(handle)
  }
  const bumper = boxMesh(Wd, 0.07, 0.04, black)
  bumper.position.set(0, 0.06, front + 0.01)
  car.add(bumper)

  // black disc wheels with a chrome rim and a silver RR hub
  const tyre = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14)
  tyre.rotateZ(Math.PI / 2)
  const rim = new THREE.CylinderGeometry(0.19, 0.19, 0.15, 14)
  rim.rotateZ(Math.PI / 2)
  const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8)
  hub.rotateZ(Math.PI / 2)
  for (const s of [-1, 1]) {
    for (const z of [front - 0.5, -front + 0.5]) {
      const wheel = new THREE.Group()
      wheel.add(new THREE.Mesh(tyre, lambert([26, 26, 28])), new THREE.Mesh(rim, chrome), new THREE.Mesh(hub, lambert([236, 236, 240])))
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.152, 14).rotateZ(Math.PI / 2), lambert([44, 44, 50]))
      wheel.add(disc)
      wheel.position.set(s * (Wd / 2 - 0.02), 0.24, z)
      car.add(wheel)
    }
  }

  // a soft spotlight so it reads as the hall's centrepiece
  const light = new THREE.PointLight(0xfff2d8, 0.6, 3.5)
  light.position.set(0, 1.8, 0.6)
  group.add(light)
  return group
}

/**
 * Upright piano with two white robotic arms playing it (the Piano Hand exhibit). The arms
 * rise from stands at either end of the keyboard and reach in over the keys; their
 * fingers tap and the hands drift along the keyboard.
 */
function buildPianoHand() {
  const group = new THREE.Group()
  const gloss = lambert([24, 24, 30])
  const white = lambert([242, 242, 240])
  const chrome = lambert(CHROME)
  const joint = lambert([70, 74, 84])
  const KW = 2.3
  const keyTop = 0.82

  // case, keybed and cheek blocks
  const caseBody = boxMesh(KW + 0.1, 1.3, 0.5, gloss)
  caseBody.position.z = -0.55
  const lid = boxMesh(KW + 0.16, 0.05, 0.56, lambert([40, 40, 48]))
  lid.position.set(0, 1.3, -0.55)
  const keybed = boxMesh(KW + 0.1, 0.08, 0.45, gloss)
  keybed.position.set(0, 0.68, -0.08)
  group.add(caseBody, lid, keybed)
  for (const s of [-1, 1]) {
    const cheek = boxMesh(0.08, 0.16, 0.45, gloss)
    cheek.position.set(s * (KW / 2 + 0.01), 0.76, -0.08)
    const leg = boxMesh(0.08, 0.68, 0.08, gloss)
    leg.position.set(s * (KW / 2 - 0.05), 0, 0.1)
    group.add(cheek, leg)
  }

  // keyboard: white keys with grouped black keys (2s and 3s), painted on a thin slab
  const keysTex = paint(KW - 0.1, 0.34, (g, W, H) => {
    rect(g, 0, 0, W, H, [246, 246, 240])
    for (let x = 0; x < W; x += 2) rect(g, x, 0, 1, H, [176, 176, 172])
    let k = 0
    for (let x = 1; x < W - 1; x += 2, k++) {
      if ([0, 1, 3, 4, 5].includes(k % 7)) rect(g, x + 1, 0, 1, Math.round(H * 0.6), [20, 20, 24])
    }
  })
  const keys = boxMesh(KW - 0.1, 0.06, 0.34, [gloss, gloss, lambert(keysTex), gloss, white, gloss])
  keys.position.set(0, keyTop - 0.06, -0.07)
  group.add(keys)

  // sheet music on the stand
  const sheet = paint(0.5, 0.3, (g, W, H) => {
    rect(g, 0, 0, W, H, [244, 240, 226])
    for (let y = 2; y < H - 1; y += 3) rect(g, 1, y, W - 2, 1, [120, 116, 108])
  })
  const music = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshLambertMaterial({ map: sheet }))
  music.position.set(0, 1.0, -0.29)
  music.rotation.x = -0.15
  group.add(music)

  // two robotic arms, one from each end
  const hands: { hand: THREE.Group; fingers: THREE.Group[]; baseX: number; phase: number }[] = []
  for (const s of [-1, 1]) {
    const bx = s * (KW / 2 + 0.25)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.1, 10), joint)
    base.position.set(bx, 0.05, 0.25)
    const shoulder = new THREE.Vector3(bx, 1.15, 0.25)
    const elbow = new THREE.Vector3(s * 1.0, 1.36, 0.42)
    const wrist = new THREE.Vector3(s * 0.62, 0.95, 0.26)
    group.add(
      base,
      strutBetween(new THREE.Vector3(bx, 0.1, 0.25), shoulder, white, 0.09),
      strutBetween(shoulder, elbow, white, 0.08),
      strutBetween(elbow, wrist, white, 0.07),
    )
    for (const at of [shoulder, elbow, wrist]) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), chrome)
      ball.position.copy(at)
      group.add(ball)
    }

    // hand: white palm with a chrome back plate, four fingers and a thumb over the keys
    const hand = new THREE.Group()
    hand.position.set(wrist.x, 0.88, 0.16)
    const palm = boxMesh(0.32, 0.08, 0.26, white)
    const plateBack = boxMesh(0.2, 0.02, 0.14, chrome)
    plateBack.position.y = 0.08
    hand.add(palm, plateBack)
    const fingers: THREE.Group[] = []
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group()
      pivot.position.set(-0.12 + i * 0.08, 0.04, -0.13)
      const seg = boxMesh(0.05, 0.05, 0.16, white)
      seg.position.z = -0.08
      seg.rotation.x = -0.35
      const tip = new THREE.Mesh(new THREE.IcosahedronGeometry(0.032, 0), chrome)
      tip.position.set(0, -0.05, -0.16)
      pivot.add(seg, tip)
      hand.add(pivot)
      fingers.push(pivot)
    }
    const thumb = boxMesh(0.05, 0.05, 0.13, white)
    thumb.position.set(-s * 0.18, 0, -0.05)
    thumb.rotation.y = s * 0.5
    hand.add(thumb)
    group.add(hand)
    hands.push({ hand, fingers, baseX: hand.position.x, phase: s > 0 ? 0 : 1.7 })
  }

  let t = 0
  group.userData.animate = (dt: number) => {
    t += dt
    for (const h of hands) {
      h.hand.position.x = h.baseX + Math.sin(t * 0.7 + h.phase) * 0.05
      h.fingers.forEach((f, i) => {
        f.rotation.x = 0.15 - Math.max(0, Math.sin(t * 6 + i * 1.3 + h.phase)) * 0.35
      })
    }
  }
  return group
}

/**
 * Purdue Pete statue (the college graduation monument), painted like the mascot: black hard
 * hat, oversized tan head with a square jaw and heavy brows, black "PURDUE 00" jersey, leaning
 * on a sledgehammer, on a stone pedestal with gold trim.
 */
function buildPurduePete(_p: Prop, assets: Assets) {
  const group = new THREE.Group()
  const black = lambert([28, 28, 32])
  const skin: RGB = [228, 198, 142]
  const skinMat = lambert(skin)
  const gold: RGB = [206, 184, 124]

  // pedestal
  const stone = lambert([220, 208, 184])
  const base = boxMesh(1.25, 0.38, 1.0, stone)
  const trim = boxMesh(1.3, 0.06, 1.05, lambert([214, 172, 80]))
  trim.position.y = 0.38
  group.add(base, trim)
  const y0 = 0.44

  // legs and shoes
  for (const s of [-1, 1]) {
    const leg = boxMesh(0.2, 0.52, 0.22, black)
    leg.position.set(s * 0.13, y0 + 0.06, 0)
    const shoe = boxMesh(0.22, 0.08, 0.3, lambert([16, 16, 18]))
    shoe.position.set(s * 0.13, y0, 0.04)
    group.add(leg, shoe)
  }

  // torso with the gold PURDUE / 00 lettering
  const torso = boxMesh(0.62, 0.62, 0.36, black)
  torso.position.y = y0 + 0.58
  group.add(torso)
  const word = letteredSign(assets, ['PURDUE'], gold, null, 80, 1)
  word.position.set(0, y0 + 1.06, 0.185)
  const num = letteredSign(assets, ['00'], gold, null, 34, 1)
  num.position.set(0, y0 + 0.82, 0.185)
  group.add(word, num)

  // arms: left hangs at his side, right grips the sledgehammer
  for (const s of [-1, 1]) {
    const arm = boxMesh(0.16, 0.5, 0.18, black)
    arm.position.set(s * 0.4, y0 + 0.66, 0)
    arm.rotation.z = s * 0.12
    const glove = boxMesh(0.18, 0.17, 0.18, lambert([20, 20, 24]))
    glove.position.set(s * 0.45, y0 + 0.5, 0.02)
    group.add(arm, glove)
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6), lambert([150, 110, 62]))
  handle.position.set(0.58, y0 + 0.4, 0.06)
  const hammer = boxMesh(0.32, 0.16, 0.16, lambert([70, 72, 78]))
  hammer.position.set(0.58, y0, 0.06)
  group.add(handle, hammer)

  // the big head: painted face on the front, a square jaw jutting out below it
  const faceTex = (() => {
    const { c, g } = makeCanvas(48, 56)
    rect(g, 0, 0, 48, 56, skin)
    rect(g, 0, 0, 4, 56, [206, 172, 118])
    rect(g, 44, 0, 4, 56, [206, 172, 118])
    // heavy angled brows
    for (let i = 0; i < 12; i++) {
      rect(g, 7 + i, 13 - Math.floor(i / 4), 1, 4, [24, 22, 22])
      rect(g, 40 - i, 13 - Math.floor(i / 4), 1, 4, [24, 22, 22])
    }
    // eyes
    for (const ex of [9, 28]) {
      rect(g, ex, 18, 11, 9, [244, 240, 232])
      rect(g, ex + 3, 19, 6, 7, [126, 76, 42])
      rect(g, ex + 5, 21, 3, 3, [20, 16, 14])
      rect(g, ex + 4, 20, 1, 1, [255, 255, 255])
    }
    // nose and its shadow, a firm flat mouth, chin shading
    rect(g, 22, 24, 4, 12, [214, 182, 126])
    rect(g, 20, 35, 8, 2, [186, 150, 98])
    rect(g, 15, 44, 18, 2, [120, 70, 50])
    rect(g, 31, 43, 3, 1, [120, 70, 50])
    rect(g, 23, 50, 2, 6, [206, 172, 118])
    return pixelTexture(c)
  })()
  const head = boxMesh(0.52, 0.6, 0.5, [skinMat, skinMat, skinMat, skinMat, lambert(faceTex), skinMat])
  head.position.y = y0 + 1.22
  const jaw = boxMesh(0.44, 0.16, 0.1, skinMat)
  jaw.position.set(0, y0 + 1.22, 0.27)
  group.add(head, jaw)
  for (const s of [-1, 1]) {
    const ear = boxMesh(0.06, 0.14, 0.1, skinMat)
    ear.position.set(s * 0.29, y0 + 1.46, 0)
    group.add(ear)
  }

  // black hard hat with a brim and a gold P on the front
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.33, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert([22, 22, 26]))
  dome.scale.set(1, 0.75, 1)
  dome.position.y = y0 + 1.8
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 20), lambert([22, 22, 26]))
  brim.position.y = y0 + 1.82
  const ridge = boxMesh(0.06, 0.08, 0.62, lambert([40, 40, 46]))
  ridge.position.y = y0 + 1.97
  const pBadge = letteredSign(assets, ['P'], gold, null, 40, 1)
  pBadge.position.set(0, y0 + 1.92, 0.3)
  pBadge.rotation.x = -0.35
  group.add(dome, brim, ridge, pBadge)
  return group
}

/**
 * The 2022 AAU Nationals monument: a red, white and blue winners' podium with an oversized
 * gold medal floating over first place, a volleyball on second and a plaque on third.
 */
function buildAauPodium(_p: Prop, assets: Assets) {
  const group = new THREE.Group()
  const body = lambert([240, 240, 236])
  const blue = lambert([40, 70, 160])
  const red = lambert([200, 40, 40])
  const steps: [number, number, number, RGB][] = [
    // x, height, place, cap colour
    [-0.85, 0.5, 2, [190, 196, 206]],
    [0, 0.78, 1, [214, 172, 80]],
    [0.85, 0.36, 3, [184, 120, 70]],
  ]
  for (const [x, h, place, cap] of steps) {
    const block = boxMesh(0.82, h, 0.8, body)
    block.position.x = x
    const band = boxMesh(0.84, 0.07, 0.82, blue)
    band.position.set(x, h - 0.16, 0)
    const band2 = boxMesh(0.84, 0.05, 0.82, red)
    band2.position.set(x, h - 0.23, 0)
    const top = boxMesh(0.86, 0.05, 0.84, lambert(cap))
    top.position.set(x, h, 0)
    const num = letteredSign(assets, [String(place)], [40, 70, 160], null, 18, 1)
    num.position.set(x, Math.max(0.12, (h - 0.25) / 2), 0.41)
    group.add(block, band, band2, top, num)
  }

  // oversized gold medal on a red/white/blue ribbon, slowly turning over first place
  const ribbonTex = paint(0.24, 0.6, (g, W, H) => {
    const third = Math.round(W / 3)
    rect(g, 0, 0, third, H, [200, 40, 40])
    rect(g, third, 0, third, H, [244, 244, 240])
    rect(g, third * 2, 0, W - third * 2, H, [40, 70, 160])
  })
  const ribbonMat = new THREE.MeshLambertMaterial({ map: ribbonTex, side: THREE.DoubleSide })
  const medal = new THREE.Group()
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 24).rotateX(Math.PI / 2), lambert([226, 182, 70]))
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 24).rotateX(Math.PI / 2), lambert([246, 210, 110]))
  medal.add(disc, inner)
  for (const s of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.6), ribbonMat)
    strap.position.set(s * 0.12, 0.5, 0)
    strap.rotation.z = s * 0.35
    medal.add(strap)
  }
  medal.position.set(0, 1.35, 0)
  group.add(medal)
  const glow = new THREE.PointLight(0xffd88a, 0.6, 2.5)
  glow.position.set(0, 1.4, 0.4)
  group.add(glow)

  // volleyball (blue, yellow and white panels) resting on second place
  const ballTex = paint(2, 1, (g, W, H) => {
    rect(g, 0, 0, W, H, [246, 246, 240])
    const band = Math.round(H / 6)
    for (let i = 0; i < 6; i++) rect(g, 0, i * band, W, Math.max(1, band - 1), i % 3 === 0 ? [40, 80, 170] : i % 3 === 1 ? [240, 200, 50] : [246, 246, 240])
  })
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), lambert(ballTex))
  ball.position.set(-0.85, 0.5 + 0.05 + 0.19, 0)
  ball.rotation.z = 0.5
  group.add(ball)

  // wooden plaque with a gold plate, propped up on third place
  const plaque = boxMesh(0.32, 0.4, 0.05, lambert([118, 74, 44]))
  plaque.position.set(0.85, 0.41, -0.05)
  plaque.rotation.x = -0.15
  const plate = boxMesh(0.22, 0.26, 0.01, lambert([226, 190, 96]))
  plate.position.set(0.85, 0.48, -0.02)
  plate.rotation.x = -0.15
  group.add(plaque, plate)

  let t = 0
  group.userData.animate = (dt: number) => {
    t += dt
    medal.rotation.y = Math.sin(t * 0.8) * 0.6
    medal.position.y = 1.35 + Math.sin(t * 1.6) * 0.05
  }
  return group
}

// ── Main Street, Flushing ───────────────────────────────────────────────────────

/** A made-up Chinese-style character: a few strokes and boxes in an s×s cell. Reads as
 *  hanzi signage at pixel scale without needing a CJK font. */
function hanzi(g: CanvasRenderingContext2D, x: number, y: number, s: number, c: RGB, rand: () => number) {
  const t = Math.max(1, Math.round(s / 7))
  const kind = Math.floor(rand() * 4)
  if (kind === 0) {
    // 口-like box with a stroke inside
    rect(g, x + 1, y + 1, s - 2, t, c); rect(g, x + 1, y + s - 1 - t, s - 2, t, c)
    rect(g, x + 1, y + 1, t, s - 2, c); rect(g, x + s - 1 - t, y + 1, t, s - 2, c)
    rect(g, x + 2, y + Math.floor(s / 2), s - 4, t, c)
  } else if (kind === 1) {
    // radical on the left, stacked strokes on the right
    rect(g, x + 1, y + 1, t, s - 2, c)
    rect(g, x, y + Math.floor(s / 3), Math.floor(s / 3), t, c)
    for (let i = 0; i < 3; i++) rect(g, x + Math.floor(s / 2), y + 1 + i * Math.floor((s - 2) / 3), Math.ceil(s / 2) - 1, t, c)
    rect(g, x + Math.floor(s * 0.7), y + 1, t, s - 2, c)
  } else if (kind === 2) {
    // cross with a roof
    rect(g, x + 1, y + 1, s - 2, t, c)
    rect(g, x + Math.floor(s / 2), y + 1, t, s - 2, c)
    rect(g, x + 2, y + Math.floor(s * 0.55), s - 4, t, c)
    for (let i = 0; i < Math.floor(s / 3); i++) rect(g, x + Math.floor(s / 2) - i - 1, y + Math.floor(s * 0.6) + i, t, t, c)
  } else {
    // three horizontals over a frame
    for (let i = 0; i < 3; i++) rect(g, x + 1 + i, y + 1 + i * Math.floor(s / 4), s - 2 - i * 2, t, c)
    rect(g, x + 2, y + Math.floor(s * 0.6), t, Math.ceil(s * 0.4) - 1, c)
    rect(g, x + s - 2 - t, y + Math.floor(s * 0.6), t, Math.ceil(s * 0.4) - 1, c)
    rect(g, x + 2, y + s - 1 - t, s - 4, t, c)
  }
}

interface CitySign {
  /** position and size on the face, in DS pixels from its top-left (16 px per tile) */
  x: number; y: number; w: number; h: number
  bg: RGB; fg: RGB
  text?: string
  /** that many made-up hanzi, instead of / as well as text */
  hanzi?: number
}

type Facade = 'brick' | 'tan' | 'glass' | 'stucco' | 'red' | 'grey'

const FACADE: Record<Facade, { wall: RGB; line: RGB; win: RGB; winLit: RGB }> = {
  brick: { wall: [156, 84, 64], line: [128, 66, 50], win: [70, 92, 116], winLit: [240, 214, 150] },
  tan: { wall: [206, 176, 132], line: [184, 154, 112], win: [74, 90, 108], winLit: [240, 214, 150] },
  glass: { wall: [118, 172, 176], line: [92, 140, 146], win: [150, 200, 204], winLit: [190, 226, 228] },
  stucco: { wall: [222, 220, 212], line: [196, 194, 186], win: [74, 92, 112], winLit: [240, 214, 150] },
  red: { wall: [178, 52, 46], line: [150, 40, 36], win: [70, 80, 96], winLit: [250, 220, 160] },
  grey: { wall: [96, 100, 108], line: [78, 82, 90], win: [60, 70, 84], winLit: [210, 220, 230] },
}

/** Paint a building face: floors of windows over a lit ground-floor shopfront, plus signs. */
function facadeTexture(assets: Assets, wTiles: number, hUnits: number, style: Facade, signs: CitySign[], seed: number, shop = true) {
  const f = FACADE[style]
  const W = Math.round(wTiles * TP)
  const H = Math.round(hUnits * TP)
  const { c, g } = makeCanvas(W, H)
  const rand = rng(seed)
  rect(g, 0, 0, W, H, f.wall)
  const shopH = shop ? 22 : 0
  if (style === 'glass') {
    for (let y = 0; y < H - shopH; y += 6) rect(g, 0, y, W, 1, f.line)
    for (let x = 0; x < W; x += 8) rect(g, x, 0, 1, H - shopH, f.line)
    for (let y = 2; y < H - shopH; y += 12) rect(g, 0, y, W, 2, f.win)
  } else {
    if (style === 'brick' || style === 'tan') speckle(g, 0, 0, W, H, [f.line], 0.12, rand)
    for (let fy = 4; fy + 9 < H - shopH; fy += 14) {
      for (let x = 3; x + 5 < W; x += 9) {
        rect(g, x - 1, fy - 1, 7, 10, f.line)
        rect(g, x, fy, 5, 8, rand() < 0.25 ? f.winLit : f.win)
        rect(g, x, fy, 5, 2, shade(f.win, 1.25))
        if (rand() < 0.3) rect(g, x + 1, fy + 6, 3, 2, [220, 220, 216]) // window AC unit
      }
    }
  }
  if (shop) {
    // lit shop windows with mullions, a dark door
    rect(g, 0, H - shopH, W, shopH, [60, 56, 54])
    rect(g, 1, H - shopH + 6, W - 2, shopH - 7, [246, 222, 168])
    for (let x = 1; x < W; x += 10) rect(g, x, H - shopH + 6, 1, shopH - 7, [60, 56, 54])
    speckle(g, 1, H - shopH + 9, W - 2, shopH - 11, [[220, 90, 80], [90, 150, 210], [240, 200, 80], [120, 180, 110]], 0.18, rand)
    const door = Math.floor(W * (0.2 + rand() * 0.5))
    rect(g, door, H - shopH + 7, 7, shopH - 7, [40, 40, 44])
  }
  for (const sg of signs) {
    rect(g, sg.x, sg.y, sg.w, sg.h, sg.bg)
    rect(g, sg.x, sg.y + sg.h - 1, sg.w, 1, shade(sg.bg, 0.7))
    let cx = sg.x + 2
    if (sg.hanzi) {
      const s = Math.min(sg.h - 2, 14)
      for (let i = 0; i < sg.hanzi; i++) {
        hanzi(g, cx, sg.y + Math.floor((sg.h - s) / 2), s, sg.fg, rand)
        cx += s + 1
      }
    }
    if (sg.text) {
      const font = assets.font
      const tw = font.width(sg.text)
      const tx = sg.hanzi ? cx + 2 : sg.x + Math.round((sg.w - tw) / 2)
      font.draw(g, sg.text, tx, sg.y + Math.round((sg.h - font.height) / 2), sg.fg, false)
    }
  }
  return pixelTexture(c)
}

/** A rooftop water tank on stilts, the New York kind. */
function waterTower() {
  const group = new THREE.Group()
  const wood = lambert([122, 86, 60])
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
    const leg = boxMesh(0.06, 0.5, 0.06, lambert([60, 60, 64]))
    leg.position.set(x, 0, z)
    group.add(leg)
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 12), wood)
  tank.position.y = 0.9
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.4, 12), lambert([70, 66, 64]))
  roof.position.y = 1.5
  group.add(tank, roof)
  return group
}

/**
 * A Main Street building: a box whose street face (`face`: 'east' or 'west') and south face
 * carry painted facades and signs, with optional blade signs sticking out over the sidewalk
 * (facing the camera) and a rooftop water tank.
 * opts: { h, face, style, signs, southSigns, blades: [{ z, y, h, bg, fg, n }], tank, shop }
 */
function buildCityBuilding(p: Prop, assets: Assets) {
  const o = p.opts ?? {}
  const w = p.w ?? 4
  const d = p.d ?? 4
  const h = (o.h as number) ?? 4
  const face = (o.face as 'east' | 'west') ?? 'east'
  const style = (o.style as Facade) ?? 'stucco'
  const seed = Math.round(p.x * 97 + p.y * 13)
  const group = new THREE.Group()
  const street = lambert(facadeTexture(assets, d, h, style, (o.signs as CitySign[]) ?? [], seed, o.shop !== false))
  const south = lambert(facadeTexture(assets, w, h, style, (o.southSigns as CitySign[]) ?? [], seed + 7, false))
  const plain = lambert(facadeTexture(assets, w, h, style, [], seed + 3, false))
  const side = lambert(facadeTexture(assets, d, h, style, [], seed + 5, false))
  const roof = lambert(shade(FACADE[style].wall, 0.75))
  // BoxGeometry faces: +x, -x, +y, -y, +z (south), -z
  const mats = face === 'east' ? [street, side, roof, roof, south, plain] : [side, street, roof, roof, south, plain]
  group.add(boxMesh(w, h, d, mats))
  // parapet
  const cap = boxMesh(w + 0.06, 0.12, d + 0.06, lambert(shade(FACADE[style].wall, 0.6)))
  cap.position.y = h
  group.add(cap)

  const sx = face === 'east' ? w / 2 : -w / 2
  const dir = face === 'east' ? 1 : -1
  // a striped awning over the shopfront
  if (o.awning) {
    const [a, b] = o.awning as [RGB, RGB]
    const tex = paint(d, 0.5, (g, W, H) => {
      for (let x = 0; x < W; x += 4) rect(g, x, 0, 2, H, a)
      for (let x = 2; x < W; x += 4) rect(g, x, 0, 2, H, b)
    })
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.9, 0.7), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }))
    awn.rotation.y = dir * Math.PI / 2
    awn.rotation.x = 0
    awn.rotateX(-0.6)
    awn.position.set(sx + dir * 0.3, 1.45, 0)
    group.add(awn)
  }
  // blade signs sticking out from the street face toward the sidewalk, readable from the south
  for (const bl of (o.blades as { z: number; y: number; h: number; bg: RGB; fg: RGB; n: number }[]) ?? []) {
    const tex = (() => {
      const W = 12
      const H = Math.round(bl.h * TP)
      const { c, g } = makeCanvas(W, H)
      rect(g, 0, 0, W, H, bl.bg)
      rect(g, 0, 0, W, 1, shade(bl.bg, 0.7)); rect(g, 0, H - 1, W, 1, shade(bl.bg, 0.7))
      const r = rng(seed + Math.round(bl.z * 31))
      for (let i = 0; i < bl.n; i++) hanzi(g, 1, 2 + i * 11, 10, bl.fg, r)
      return pixelTexture(c)
    })()
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.72, bl.h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
    blade.position.set(sx + dir * 0.4, bl.y, bl.z)
    group.add(blade)
  }
  if (o.tank) {
    const t = waterTower()
    t.position.set(0, h + 0.12, -d / 4)
    group.add(t)
  }
  return group
}

/** St. George's on Main Street: a brick church with a tall dark spire. */
function buildChurch(p: Prop) {
  const w = p.w ?? 4
  const d = p.d ?? 5
  const group = new THREE.Group()
  const brick = lambert(paint(1, 1, (g, W, H) => brickPx(g, W, H)))
  const body = boxMesh(w, 2.8, d, brick)
  group.add(body)
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, w * 0.62, 1.1, 4, 1).rotateY(Math.PI / 4), lambert([70, 62, 60]))
  roof.scale.set(1, 1, d / w)
  roof.position.y = 2.8 + 0.55
  group.add(roof)
  // square tower at the front, then the spire
  const tower = boxMesh(1.3, 4.4, 1.3, brick)
  tower.position.set(w / 2 - 0.7, 0, d / 2 - 0.7)
  const belfry = boxMesh(1.36, 0.5, 1.36, lambert([120, 66, 52]))
  belfry.position.set(w / 2 - 0.7, 3.7, d / 2 - 0.7)
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.2, 4).rotateY(Math.PI / 4), lambert([62, 64, 70]))
  spire.position.set(w / 2 - 0.7, 4.4 + 2.1, d / 2 - 0.7)
  group.add(tower, belfry, spire)
  return group
}

/** A Queens traffic signal on the corner, its arm reaching out over the street. */
function buildTrafficLight(p: Prop) {
  const dir = p.opts?.face === 'west' ? -1 : 1
  const group = new THREE.Group()
  const metal = lambert([58, 60, 66])
  group.add(boxMesh(0.12, 3.0, 0.12, metal))
  const arm = boxMesh(2.4, 0.08, 0.08, metal)
  arm.position.set(dir * 1.2, 2.85, 0)
  group.add(arm)
  const housing = boxMesh(0.24, 0.66, 0.22, lambert([226, 184, 46]))
  housing.position.set(dir * 2.1, 2.2, 0.02)
  group.add(housing)
  const colors = [0xff4030, 0x4a3a10, 0x14402a]
  colors.forEach((col, i) => {
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), new THREE.MeshBasicMaterial({ color: col }))
    lamp.position.set(dir * 2.1, 2.7 - i * 0.2, 0.135)
    group.add(lamp)
  })
  // pedestrian signal box on the pole
  const walk = boxMesh(0.22, 0.24, 0.18, metal)
  walk.position.set(0, 1.5, 0.12)
  const man = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.16), new THREE.MeshBasicMaterial({ color: 0xf2f2ea }))
  man.position.set(0, 1.62, 0.215)
  group.add(walk, man)
  return group
}

/** An MTA-style city bus in the southbound lane, its orange LED sign on the front. */
function buildCityBus(p: Prop, assets: Assets) {
  const L = (p.d ?? 6) - 0.4
  const group = new THREE.Group()
  const side = paint(L, 1.5, (g, W, H) => {
    rect(g, 0, 0, W, H, [236, 238, 240])
    rect(g, 0, 4, W, 9, [40, 46, 56]) // window band
    for (let x = 6; x < W; x += 12) rect(g, x, 4, 1, 9, [200, 204, 210])
    rect(g, 0, 15, W, 3, [36, 92, 176]) // blue stripe
    rect(g, 0, H - 3, W, 3, [60, 62, 68])
  })
  const front = (() => {
    const { c, g } = makeCanvas(26, 24)
    rect(g, 0, 0, 26, 24, [236, 238, 240])
    rect(g, 2, 1, 22, 6, [16, 16, 18])
    const font = assets.hudFont
    const txt = 'Q25 JAMAICA'
    // the LED strip is tiny: squash the text into it
    const { c: tc, g: tg } = makeCanvas(font.width(txt) + 2, font.height)
    font.draw(tg, txt, 1, 0, [255, 150, 40], false)
    g.imageSmoothingEnabled = false
    g.drawImage(tc, 3, 2, 20, 4)
    rect(g, 2, 8, 22, 9, [40, 46, 56]) // windshield
    rect(g, 3, 20, 4, 2, [250, 240, 200]); rect(g, 19, 20, 4, 2, [250, 240, 200])
    return pixelTexture(c)
  })()
  const s = lambert(side)
  const roof = lambert([226, 228, 232])
  const body = boxMesh(1.5, 1.5, L, [s, s, roof, roof, lambert(front), s])
  body.position.y = 0.22
  group.add(body)
  const tyre = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10).rotateZ(Math.PI / 2)
  for (const x of [-0.72, 0.72]) for (const z of [L / 2 - 0.8, -L / 2 + 0.9]) {
    const t = new THREE.Mesh(tyre, lambert([24, 24, 26]))
    t.position.set(x, 0.22, z)
    group.add(t)
  }
  return group
}

/** The flower stand outside the ginseng shop: green crates heaped with bouquets. */
function buildFlowerStand(p: Prop) {
  const d = p.d ?? 2
  const group = new THREE.Group()
  const top = paint(0.9, d, (g, W, H) => {
    rect(g, 0, 0, W, H, [70, 120, 70])
    speckle(g, 0, 0, W, H, [[230, 60, 80], [250, 200, 60], [240, 240, 240], [180, 90, 200], [250, 130, 160], [90, 170, 90]], 0.75, rng(p.y * 7 + 3))
  })
  const crate = lambert([60, 104, 70])
  const stand = boxMesh(0.9, 0.55, d - 0.1, [crate, crate, lambert(top), crate, crate, crate])
  group.add(stand)
  const bunches = new THREE.Group()
  const cols = [[230, 60, 80], [250, 200, 60], [180, 90, 200], [250, 130, 160]] as RGB[]
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), lambert(cols[i % cols.length]))
    b.position.set(((i % 2) - 0.5) * 0.4, 0.66, -d / 2 + 0.3 + Math.floor(i / 2) * ((d - 0.6) / 2))
    bunches.add(b)
  }
  group.add(bunches)
  return group
}

/** Blocky city skyline around a city map's edges (instead of the forest ring), with the
 *  street's columns left open where Main Street runs on past the map. */
export function buildSkyline(W: number, H: number, street: [number, number], ring: number) {
  const group = new THREE.Group()
  const rand = rng(W * 7 + H)
  const styles: Facade[] = ['tan', 'brick', 'stucco', 'grey', 'glass']
  const mats = styles.map((st) => {
    const tex = paint(2, 2, (g, Wp, Hp) => {
      const f = FACADE[st]
      rect(g, 0, 0, Wp, Hp, f.wall)
      for (let y = 3; y < Hp; y += 8) for (let x = 3; x < Wp; x += 8) rect(g, x, y, 4, 5, f.win)
    })
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    return { tex, wall: FACADE[st].wall }
  })
  const B = 3
  for (let by = -ring; by < H + ring; by += B) {
    for (let bx = -ring; bx < W + ring; bx += B) {
      const inside = bx + B > 0 && by + B > 0 && bx < W && by < H
      if (inside) continue
      const offEnds = by + B <= 0 || by >= H
      if (offEnds && bx + B > street[0] && bx <= street[1]) continue
      const h = 3 + Math.floor(rand() * 6)
      const m = mats[Math.floor(rand() * mats.length)]
      const t = m.tex.clone()
      t.repeat.set(B / 2, h / 2)
      t.needsUpdate = true
      const mesh = boxMesh(B - 0.1, h, B - 0.1, [lambert(t), lambert(t), lambert(shade(m.wall, 0.7)), lambert(t), lambert(t), lambert(t)])
      mesh.position.set(bx + B / 2, 0, by + B / 2)
      group.add(mesh)
    }
  }
  return group
}

/** The red "Lilly" script wordmark on a transparent canvas, drawn at high resolution with
 *  smooth filtering (a script face breaks up at pixel scale). */
function lillyWordmark() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = 'rgb(215,25,32)'
  g.font = '700 190px "Dancing Script", "Snell Roundhand", "Brush Script MT", cursive'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('Lilly', 256, 136)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/**
 * Eli Lilly logo statue: a white marble slab carrying the red "Lilly" script wordmark, on a
 * stone pedestal with gold trim. Purely decorative.
 */
function buildLillyLogo() {
  const group = new THREE.Group()
  const stone = lambert([220, 208, 184])
  const base = boxMesh(1.9, 0.4, 0.9, stone)
  const trim = boxMesh(1.96, 0.06, 0.96, lambert([214, 172, 80]))
  trim.position.y = 0.4
  group.add(base, trim)
  // the slab leans back a little so the wordmark faces the overhead camera
  const face = new THREE.Group()
  face.position.set(0, 0.46, 0.1)
  face.rotation.x = -0.35
  const slab = boxMesh(1.9, 1.3, 0.16, lambert([244, 242, 238]))
  face.add(slab)
  const word = lillyWordmark()
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), new THREE.MeshBasicMaterial({ map: word, transparent: true }))
  logo.position.set(0, 0.65, 0.085)
  face.add(logo)
  group.add(face)
  const light = new THREE.PointLight(0xfff0e0, 0.5, 3)
  light.position.set(0, 1.4, 0.8)
  group.add(light)
  return group
}

/**
 * The Eli Lilly exhibit: a console desk whose monitor shows a live agent graph, with a
 * holographic network of agent nodes and their data connections turning slowly above it.
 */
function buildAgentGraph() {
  const group = new THREE.Group()
  const desk = boxMesh(2.2, 0.7, 0.9, lambert([58, 62, 72]))
  const top = boxMesh(2.3, 0.05, 1.0, lambert([200, 200, 206]))
  top.position.y = 0.7
  group.add(desk, top)
  // white plaque with the Lilly wordmark across the front of the desk
  const plaque = boxMesh(1.5, 0.5, 0.03, lambert([244, 242, 238]))
  plaque.position.set(0, 0.1, 0.46)
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: lillyWordmark(), transparent: true }))
  logo.position.set(0, 0.35, 0.48)
  group.add(plaque, logo)
  const screenTex = (() => {
    const { c, g } = makeCanvas(56, 34)
    rect(g, 0, 0, 56, 34, [16, 24, 44])
    const r = rng(42)
    const nodes = Array.from({ length: 9 }, () => [4 + Math.floor(r() * 48), 4 + Math.floor(r() * 24)])
    g.strokeStyle = 'rgb(70,170,190)'
    g.lineWidth = 1
    for (let i = 1; i < nodes.length; i++) {
      const [ax, ay] = nodes[i]
      const [bx, by] = nodes[Math.floor(r() * i)]
      g.beginPath(); g.moveTo(ax + 0.5, ay + 0.5); g.lineTo(bx + 0.5, by + 0.5); g.stroke()
    }
    nodes.forEach(([x, y], i) => rect(g, x - 1, y - 1, 3, 3, i % 3 === 0 ? [230, 60, 60] : [230, 236, 240]))
    rect(g, 2, 30, 20, 2, [70, 170, 190]); rect(g, 26, 30, 12, 2, [230, 60, 60])
    return pixelTexture(c)
  })()
  const dark = lambert([30, 30, 34])
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.92, 0.06), [dark, dark, dark, dark, new THREE.MeshBasicMaterial({ map: screenTex }), dark])
  monitor.position.set(0, 1.3, -0.25)
  const stand = boxMesh(0.1, 0.4, 0.1, dark)
  stand.position.set(0, 0.72, -0.25)
  group.add(monitor, stand)

  // floating agent network
  const net = new THREE.Group()
  net.position.set(0, 2.35, 0)
  const pts = [
    [0, 0, 0], [0.5, 0.25, 0.1], [-0.5, 0.2, -0.1], [0.3, -0.3, 0.3], [-0.35, -0.25, 0.3],
    [0.1, 0.45, -0.3], [-0.2, 0.05, 0.45], [0.55, -0.1, -0.35],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z))
  const edges = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 5], [2, 5], [3, 7], [4, 6], [1, 7], [6, 3]]
  const line = new THREE.MeshBasicMaterial({ color: 0x5fc4d4, transparent: true, opacity: 0.8 })
  for (const [a, b] of edges) net.add(strutBetween(pts[a], pts[b], line, 0.012))
  pts.forEach((pt, i) => {
    const n = new THREE.Mesh(new THREE.IcosahedronGeometry(i === 0 ? 0.12 : 0.075, 1), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xe23c3c : i % 2 ? 0xf2f4f6 : 0x5fc4d4 }))
    n.position.copy(pt)
    net.add(n)
  })
  group.add(net)
  const glow = new THREE.PointLight(0x7fd8e8, 0.6, 3)
  glow.position.set(0, 2.3, 0.4)
  group.add(glow)
  let t = 0
  group.userData.animate = (dt: number) => {
    t += dt
    net.rotation.y += dt * 0.5
    net.position.y = 2.35 + Math.sin(t * 1.4) * 0.06
  }
  return group
}

/**
 * The "How I built this" exhibit: a giant open DS handheld on a pedestal, the game itself on
 * its top screen and the touch-screen menu on the bottom.
 */
function buildDsConsole() {
  const group = new THREE.Group()
  const stone = lambert([220, 208, 184])
  const base = boxMesh(1.7, 0.4, 1.1, stone)
  const trim = boxMesh(1.76, 0.06, 1.16, lambert([214, 172, 80]))
  trim.position.y = 0.4
  group.add(base, trim)
  const body = lambert([236, 236, 240])

  const topScreen = (() => {
    const { c, g } = makeCanvas(40, 30)
    rect(g, 0, 0, 40, 30, [150, 200, 240]) // sky
    rect(g, 0, 16, 40, 14, [140, 196, 110]) // grass
    rect(g, 16, 16, 8, 14, [222, 206, 170]) // path
    rect(g, 4, 8, 8, 10, [236, 236, 230]); rect(g, 3, 6, 10, 3, [200, 70, 60]) // house
    rect(g, 28, 10, 6, 8, [40, 110, 70]); rect(g, 30, 18, 2, 3, [110, 80, 50]) // tree
    rect(g, 18, 20, 4, 6, [40, 50, 90]); rect(g, 18, 19, 4, 2, [220, 50, 50]) // trainer
    return pixelTexture(c)
  })()
  const bottomScreen = (() => {
    const { c, g } = makeCanvas(40, 30)
    rect(g, 0, 0, 40, 30, [40, 60, 100])
    const tiles: RGB[] = [[200, 67, 58], [178, 34, 34], [47, 138, 76], [196, 106, 18]]
    tiles.forEach((col, i) => rect(g, 4 + (i % 2) * 17, 4 + Math.floor(i / 2) * 13, 15, 10, col))
    return pixelTexture(c)
  })()
  const black = lambert([24, 24, 28])

  // bottom half, lying on the pedestal tilted toward the viewer
  const lower = new THREE.Group()
  lower.add(boxMesh(1.4, 0.12, 0.9, body))
  const bs = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshBasicMaterial({ map: bottomScreen }))
  bs.rotation.x = -Math.PI / 2
  bs.position.set(0, 0.125, 0)
  const pad = boxMesh(0.16, 0.03, 0.05, black); pad.position.set(-0.5, 0.12, 0.05)
  const pad2 = boxMesh(0.05, 0.03, 0.16, black); pad2.position.set(-0.5, 0.12, 0.05)
  lower.add(bs, pad, pad2)
  for (const [x, z] of [[0.5, -0.04], [0.58, 0.04], [0.42, 0.04], [0.5, 0.12]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), black)
    b.position.set(x, 0.135, z)
    lower.add(b)
  }
  lower.position.set(0, 0.46, 0.1)
  lower.rotation.x = 0.12
  group.add(lower)

  // top half, hinged up at the back
  const upper = new THREE.Group()
  const lid = boxMesh(1.4, 0.9, 0.1, body)
  const ts = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ map: topScreen }))
  ts.position.set(0, 0.45, 0.051)
  const bezel = boxMesh(0.9, 0.7, 0.02, black)
  bezel.position.set(0, 0.1, 0.045)
  upper.add(lid, bezel, ts)
  upper.position.set(0, 0.5, -0.38)
  upper.rotation.x = -0.25
  group.add(upper)
  const glow = new THREE.PointLight(0xbfe0ff, 0.5, 2.5)
  glow.position.set(0, 1.0, 0.4)
  group.add(glow)
  return group
}

const BUILDERS: Record<string, (p: Prop, assets: Assets) => THREE.Object3D> = {
  house: buildHouse,
  school: buildSchool,
  net: buildNet,
  sign: buildSign,
  mailbox: buildMailbox,
  monument: buildMonument,
  gradeschool: buildGradeSchool,
  hoop: buildHoop,
  fence: buildFence,
  bed: buildBed,
  tv: buildTV,
  desk: buildDesk,
  shelf: buildShelf,
  plant: buildPlant,
  table: buildTable,
  chair: buildChair,
  counter: buildCounter,
  fridge: buildFridge,
  sofa: buildSofa,
  stairsDown: buildStairsDown,
  stairsUp: buildStairsUp,
  gardenApartment: buildGardenApartment,
  topiary: buildTopiary,
  flowerbed: buildFlowerbed,
  bench: buildBench,
  lilypad: buildLilyPad,
  bridgeTower: buildBridgeTower,
  latticeArch: buildLatticeArch,
  railing: buildRailing,
  woodTruss: buildWoodTruss,
  villageBridge: buildVillageBridge,
  waterfall: buildWaterfall,
  caveMouth: buildCaveMouth,
  pillar: buildPillar,
  pedestal: buildPedestal,
  kiosk: buildKiosk,
  rollsRoyce: buildRollsRoyce,
  pianoHand: buildPianoHand,
  purduePete: buildPurduePete,
  aauPodium: buildAauPodium,
  cityBuilding: buildCityBuilding,
  church: buildChurch,
  trafficLight: buildTrafficLight,
  cityBus: buildCityBus,
  flowerStand: buildFlowerStand,
  lillyLogo: buildLillyLogo,
  agentGraph: buildAgentGraph,
  dsConsole: buildDsConsole,
  lampPost: buildLampPost,
  turnersHall: buildTurnersHall,
  candyShop: buildCandyShop,
  lawson: buildLawson,
  bellTower: buildBellTower,
}

/** Build a prop and centre it on its tile footprint. */
export function buildProp(p: Prop, assets: Assets): THREE.Object3D {
  const build = BUILDERS[p.kind]
  if (!build) throw new Error(`unknown prop kind "${p.kind}"`)
  const obj = build(p, assets)
  obj.position.set(p.x + (p.w ?? 1) / 2, 0, p.y + (p.d ?? 1) / 2)
  return obj
}

/** Window decal for the back wall of a room. */
export function buildWallWindow() {
  const tex = paint(1.4, 1, (g, W, Hp) => {
    rect(g, 0, 0, W, Hp, [250, 250, 248])
    rect(g, 2, 2, W - 4, Hp - 4, [120, 176, 224])
    rect(g, 2, 2, W - 4, 5, [168, 208, 240])
    rect(g, Math.floor(W / 2), 2, 1, Hp - 4, [250, 250, 248])
    rect(g, 0, 0, W, 2, [60, 110, 180])
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), new THREE.MeshBasicMaterial({ map: tex }))
}

/** Twinkling sparkle left where a legendary was defeated. */
export function buildSparkle() {
  const frames = [0, 1].map((f) => {
    const { c, g } = makeCanvas(16, 16)
    const col: RGB = [255, 248, 200]
    const len = f ? 7 : 5
    rect(g, 8 - 1, 8 - len, 2, len * 2, col)
    rect(g, 8 - len, 8 - 1, len * 2, 2, col)
    rect(g, 6, 6, 4, 4, [255, 255, 255])
    if (f) for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) rect(g, x, y, 1, 1, col)
    return pixelTexture(c)
  })
  const mat = new THREE.SpriteMaterial({ map: frames[0], transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.setScalar(0.7)
  let t = 0
  sprite.userData.animate = (dt: number) => {
    t += dt
    mat.map = frames[Math.floor(t * 3) % 2]
    sprite.position.y = 0.8 + Math.sin(t * 2) * 0.1
    mat.opacity = 0.6 + Math.sin(t * 5) * 0.4
  }
  return sprite
}
