import { groundGrid, onTiles, type MapDef } from './types'

const W = 16
const H = 14

/**
 * American Turners, right where the bridge meets land — the volleyball club Tyler grew up
 * playing at. The bay the bridge crosses continues along the south edge, with a short pier
 * carrying the path back to the bridge; a road heads east toward Route 3 and the cave.
 */
export const turners: MapDef = {
  id: 'turners',
  name: 'American Turners',
  kind: 'outdoor',
  width: W,
  height: H,
  ground: groundGrid(W, H, 'g', [
    ['T', 0, 0, W, 2], ['T', 0, 0, 2, H], ['T', W - 2, 0, 2, H],
    ['W', 0, H - 3, W, 3],
    ['d', 8, H - 4, 2, 4],
    ['d', 8, 7, 2, 6],
    ['f', 5, 10, 2, 1],
    // east road out toward the coast and the cave
    ['d', 10, 8, 6, 2],
  ]),
  props: [
    { kind: 'turnersHall', x: 3, y: 2, w: 10, d: 6, opts: { doorCol: 5 } },
    { kind: 'fence', x: 2, y: 2, w: 1, d: 5 },
  ],
  warps: [
    { x: 8, y: 7, to: 'turnersGym', tx: 5, ty: 9, dir: 'up' },
    { x: 9, y: 7, to: 'turnersGym', tx: 6, ty: 9, dir: 'up' },
    { x: 8, y: H, to: 'bridge', tx: 38, ty: 7, dir: 'left' },
    { x: 9, y: H, to: 'bridge', tx: 38, ty: 7, dir: 'left' },
    { x: W, y: 8, to: 'route3', tx: 1, ty: 18, dir: 'right' },
    { x: W, y: 9, to: 'route3', tx: 1, ty: 19, dir: 'right' },
  ],
  interactions: [
  ],
}
