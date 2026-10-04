import { groundGrid, onTiles, type MapDef, type Prop } from './types'

const W = 44
const H = 26
/** Rows of the main campus walk, in from American Turners on the west. */
const WALK = 18
/** Columns of the path north to the cave mouth. */
const NORTH = 37
const LAWSON = { x: 5, y: 6, w: 14, d: 7 }
const TOWER = { x: 27, y: 9 }

const lamps: Prop[] = [
  ...[6, 12, 18, 24, 30].map((x) => ({ kind: 'lampPost', x, y: WALK + 2, solid: false })),
  ...[22, 33].map((x) => ({ kind: 'lampPost', x, y: WALK - 1, solid: false })),
  ...[6, 11, 15].map((y) => ({ kind: 'lampPost', x: NORTH - 1, y, solid: false })),
]

/**
 * Route 3 — a walk through Purdue's campus between American Turners and the sea cave.
 * The campus walk comes in from the west past the Lawson Computer Science Building (where
 * Tyler studied) on its limestone plaza, loops around the Bell Tower among red maples, and
 * turns north to the rocky cliff where the cave mouth leads down to Lugia.
 */
export const route3: MapDef = {
  id: 'route3',
  name: 'Purdue University',
  kind: 'outdoor',
  width: W,
  height: H,
  // a lower, longer look than other routes so the Bell Tower and Lawson read at full height
  camera: { pitch: 46, dist: 22, fov: 36 },
  sky: 'rgb(132,184,232)',
  // walking up to one of these flashes its name in the top-left location banner
  areas: [
    { x: LAWSON.x - 1, y: LAWSON.y - 1, w: LAWSON.w + 2, h: WALK - LAWSON.y + 1, name: 'Lawson Computer Science Building' },
    { x: TOWER.x - 5, y: TOWER.y - 4, w: 13, h: WALK - TOWER.y + 4, name: 'Purdue Bell Tower' },
  ],
  // around the Bell Tower the camera tilts lower and pulls back to take in its full height
  cameraZones: [{ x: TOWER.x - 5, y: TOWER.y - 2, w: 12, h: 9, pitch: 30, dist: 26, lift: 2.6 }],
  ground: groundGrid(W, H, 'g', [
    ['T', 0, 0, 2, H], ['T', W - 2, 0, 2, H], ['T', 0, H - 2, W, 2],
    // rock cliff along the top with the cave mouth cut into it
    ['X', 0, 0, W, 3],
    ['z', NORTH - 1, 1, 4, 2],
    // campus walk: in from the west, then north up to the cave
    ['s', 0, WALK, NORTH + 2, 2],
    ['s', NORTH, 3, 2, WALK - 3],
    // Lawson's limestone plaza, out front of the building down to the walk
    ['q', LAWSON.x - 1, LAWSON.y + LAWSON.d, LAWSON.w + 2, WALK - LAWSON.y - LAWSON.d],
    // the path ringing the Bell Tower, and its spur down to the walk
    ['s', TOWER.x - 2, TOWER.y - 2, 6, 1], ['s', TOWER.x - 2, TOWER.y + 3, 6, 1],
    ['s', TOWER.x - 2, TOWER.y - 2, 1, 6], ['s', TOWER.x + 3, TOWER.y - 2, 1, 6],
    ['s', TOWER.x, TOWER.y + 4, 2, WALK - TOWER.y - 4],
    ['f', TOWER.x - 1, TOWER.y - 1, 1, 1], ['f', TOWER.x + 2, TOWER.y + 2, 1, 1],
    // red maples around the Bell Tower, autumn trees across the lawns
    ['r', TOWER.x - 3, TOWER.y - 3, 1, 1], ['r', TOWER.x + 4, TOWER.y - 3, 1, 1],
    ['r', TOWER.x - 4, TOWER.y + 1, 1, 1], ['r', TOWER.x + 5, TOWER.y + 1, 1, 1],
    ['r', TOWER.x - 3, TOWER.y + 4, 1, 1], ['r', TOWER.x + 4, TOWER.y + 4, 1, 1],
    ['Y', 21, 4, 1, 1], ['Y', 23, 5, 1, 1], ['Y', 33, 5, 1, 1], ['Y', 34, 9, 1, 1],
    ['Y', 21, 11, 1, 1], ['Y', 33, 14, 1, 1], ['Y', 3, 4, 1, 1],
    ['R', 31, 3, 1, 1], ['R', 40, 5, 1, 1],
  ]),
  props: [
    { kind: 'caveMouth', x: NORTH - 1, y: 1, w: 4, d: 2 },
    { kind: 'lawson', ...LAWSON },
    { kind: 'bellTower', x: TOWER.x, y: TOWER.y, w: 2, d: 2 },
    { kind: 'bench', x: TOWER.x - 1, y: TOWER.y + 5 },
    { kind: 'bench', x: TOWER.x + 2, y: TOWER.y + 5 },
    ...lamps,
  ],
  warps: [
    { x: -1, y: WALK, to: 'turners', tx: 15, ty: 8, dir: 'left' },
    { x: -1, y: WALK + 1, to: 'turners', tx: 15, ty: 9, dir: 'left' },
    // stepping into the mouth leads into the cave
    { x: NORTH, y: 2, to: 'lugiaCave', tx: 10, ty: 24, dir: 'up' },
    { x: NORTH + 1, y: 2, to: 'lugiaCave', tx: 11, ty: 24, dir: 'up' },
  ],
  interactions: [
  ],
}
