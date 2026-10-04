import type { RGB } from '../engine/pixel'
import { groundGrid, type MapDef, type Prop } from './types'

const W = 24
const H = 30
// Columns, west → east: buildings | sidewalk (you walk here) | Main Street | sidewalk | buildings
const WEST = { x: 0, w: 5 }
const STREET = { x: 9, w: 6 }
const EAST = { x: 19, w: 5 }
const CROSSWALKS = [10, 21]

const RED: RGB = [210, 34, 40]
const GOLD: RGB = [250, 214, 40]
const WHITE: RGB = [255, 255, 255]
const CREAM: RGB = [255, 236, 200]

/** One Main Street building along the west side (street face east) or the east side (west). */
function west(y: number, d: number, opts: Record<string, unknown>): Prop {
  return { kind: 'cityBuilding', x: WEST.x, y, w: WEST.w, d, opts: { face: 'east', ...opts } }
}
function east(y: number, d: number, opts: Record<string, unknown>): Prop {
  return { kind: 'cityBuilding', x: EAST.x, y, w: EAST.w, d, opts: { face: 'west', ...opts } }
}

/**
 * Main Street, Flushing: the busy Queens strip between the Hidden Grove and the bridge to
 * American Turners. A north–south avenue of storefronts stacked with bright signs and
 * hanging blade signs, the Main St Food Court, a glass tower, tan brick apartment blocks
 * with rooftop water tanks, St. George's spire, a city bus at the curb, crosswalks with
 * traffic lights, and a flower stand outside the ginseng shop. You walk up the west
 * sidewalk; the skyline closes in around it instead of the usual forest.
 */
export const route2: MapDef = {
  id: 'route2',
  name: 'Main Street Flushing',
  kind: 'outdoor',
  city: true,
  // tilted lower than the usual overworld so the storefronts and their signs face the camera
  camera: { pitch: 42, dist: 18, fov: 38 },
  cityStreet: [WEST.x + WEST.w, EAST.x - 1],
  crowd: { npcs: 7, pokemon: 0 },
  width: W,
  height: H,
  ground: groundGrid(W, H, 'd', [
    ['a', STREET.x, 0, STREET.w, H],
  ]),
  paintGround: (g) => {
    const T = 16
    const x0 = STREET.x * T
    const x1 = (STREET.x + STREET.w) * T
    // curbs
    g.fillStyle = 'rgb(214,212,204)'
    g.fillRect(x0 - 2, 0, 2, H * T)
    g.fillRect(x1, 0, 2, H * T)
    const inCrosswalk = (y: number) => CROSSWALKS.some((r) => y >= r * T && y < (r + 2) * T)
    for (let y = 0; y < H * T; y++) {
      if (inCrosswalk(y)) continue
      // double yellow down the middle, dashed white lane lines either side
      g.fillStyle = 'rgb(236,196,52)'
      g.fillRect(x0 + 3 * T - 2, y, 1, 1)
      g.fillRect(x0 + 3 * T + 1, y, 1, 1)
      if (y % 16 < 8) {
        g.fillStyle = 'rgb(232,232,226)'
        g.fillRect(x0 + 1.5 * T, y, 1, 1)
        g.fillRect(x0 + 4.5 * T, y, 1, 1)
      }
    }
    // zebra crosswalks
    g.fillStyle = 'rgb(236,236,230)'
    for (const r of CROSSWALKS) {
      for (let x = x0 + 2; x < x1 - 2; x += 8) g.fillRect(x, r * T + 3, 4, 2 * T - 6)
    }
  },
  props: [
    // ── west side, north → south ──
    { kind: 'church', x: WEST.x, y: 0, w: WEST.w, d: 6 },
    west(6, 7, {
      h: 5, style: 'red',
      signs: [
        { x: 30, y: 4, w: 52, h: 18, bg: [236, 236, 240], fg: RED, hanzi: 3 },
        { x: 18, y: 28, w: 76, h: 14, bg: [176, 40, 44], fg: [255, 210, 236], text: 'FOOD COURT' },
        { x: 6, y: 46, w: 40, h: 10, bg: [250, 240, 220], fg: RED, hanzi: 3 },
      ],
      blades: [{ z: 2.2, y: 2.4, h: 1.5, bg: RED, fg: GOLD, n: 4 }],
      awning: [[150, 40, 36], [96, 28, 26]],
    }),
    west(13, 6, {
      h: 3.5, style: 'stucco',
      signs: [
        { x: 4, y: 4, w: 82, h: 14, bg: [40, 90, 180], fg: WHITE, hanzi: 3, text: 'SPA' },
        { x: 4, y: 28, w: 86, h: 14, bg: [30, 120, 80], fg: [250, 230, 120], hanzi: 2, text: 'TEA HOUSE' },
      ],
      blades: [{ z: 1.6, y: 2.2, h: 1.3, bg: GOLD, fg: RED, n: 3 }],
    }),
    west(19, 5, {
      h: 7, style: 'tan', tank: true,
      signs: [{ x: 6, y: 70, w: 66, h: 14, bg: [230, 60, 60], fg: CREAM, hanzi: 4 }],
      blades: [{ z: 1.2, y: 2.3, h: 1.4, bg: [40, 160, 200], fg: WHITE, n: 3 }],
    }),
    west(24, 6, {
      h: 3, style: 'stucco',
      signs: [{ x: 4, y: 2, w: 88, h: 20, bg: GOLD, fg: RED, hanzi: 2, text: 'GINSENG' }],
      southSigns: [{ x: 4, y: 6, w: 72, h: 18, bg: GOLD, fg: RED, hanzi: 2, text: 'GINSENG' }],
      awning: [[200, 40, 40], [244, 244, 240]],
    }),
    // ── east side, north → south ──
    east(0, 9, {
      h: 6, style: 'glass',
      signs: [
        { x: 12, y: 8, w: 118, h: 14, bg: [40, 60, 120], fg: [220, 230, 255], hanzi: 7 },
        { x: 14, y: 56, w: 90, h: 16, bg: GOLD, fg: RED, hanzi: 2, text: 'GINSENG' },
      ],
      blades: [{ z: 2.5, y: 2.4, h: 1.5, bg: WHITE, fg: [40, 60, 160], n: 4 }],
    }),
    east(9, 6, {
      h: 7, style: 'tan', tank: true,
      signs: [{ x: 6, y: 68, w: 84, h: 16, bg: [28, 28, 34], fg: [80, 210, 250], text: 'BUBBLE TEA' }],
      blades: [{ z: -1.5, y: 2.2, h: 1.3, bg: [230, 60, 140], fg: WHITE, n: 3 }],
    }),
    east(15, 7, {
      h: 3.5, style: 'grey',
      signs: [
        { x: 4, y: 6, w: 50, h: 14, bg: [230, 50, 120], fg: WHITE, hanzi: 3 },
        { x: 58, y: 6, w: 50, h: 14, bg: [60, 140, 220], fg: WHITE, text: 'EYE CARE' },
      ],
      blades: [
        { z: 2.4, y: 2.1, h: 1.2, bg: RED, fg: GOLD, n: 3 },
        { z: -1.6, y: 2.1, h: 1.2, bg: [40, 150, 90], fg: WHITE, n: 3 },
      ],
    }),
    east(22, 8, {
      h: 4.5, style: 'grey',
      signs: [{ x: 18, y: 30, w: 92, h: 14, bg: [40, 44, 54], fg: [240, 240, 240], text: 'PHARMACY 24HRS' }],
      southSigns: [{ x: 4, y: 8, w: 72, h: 14, bg: [40, 90, 180], fg: WHITE, text: 'PHARMACY' }],
    }),
    // ── the street ──
    { kind: 'cityBus', x: 10, y: 13, w: 2, d: 6 },
    { kind: 'trafficLight', x: 8, y: CROSSWALKS[0] - 1, solid: false, opts: { face: 'east' } },
    { kind: 'trafficLight', x: 15, y: CROSSWALKS[0] + 2, solid: false, opts: { face: 'west' } },
    { kind: 'trafficLight', x: 8, y: CROSSWALKS[1] - 1, solid: false, opts: { face: 'east' } },
    { kind: 'trafficLight', x: 15, y: CROSSWALKS[1] + 2, solid: false, opts: { face: 'west' } },
    ...[3, 15, 27].map((y) => ({ kind: 'lampPost', x: 8, y, solid: false })),
    ...[6, 17, 27].map((y) => ({ kind: 'lampPost', x: 15, y, solid: false })),
    { kind: 'flowerStand', x: 5, y: 25, w: 1, d: 2 },
  ],
  // the whole width between the buildings (both sidewalks and the street) runs on: north to
  // the bridge, south back to the grove
  warps: Array.from({ length: EAST.x - (WEST.x + WEST.w) }, (_, i) => WEST.x + WEST.w + i).flatMap((x) => [
    { x, y: H, to: 'lake', tx: x % 2 ? 19 : 18, ty: 0, dir: 'down' as const },
    { x, y: -1, to: 'bridge', tx: 1, ty: 7, dir: 'right' as const },
  ]),
  interactions: [],
}
