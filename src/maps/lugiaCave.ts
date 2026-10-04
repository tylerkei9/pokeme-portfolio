import { groundGrid, type MapDef } from './types'

const W = 22
const H = 26

/**
 * The deepest chamber of the sea cave, laid out after HGSS's Lugia event: a dark mossy
 * platform raised over deep water, leading up to a round pool ringed with boulders and fed
 * by a waterfall. Walking to the platform's edge sets off the cutscene — a light rises, the
 * falls surge, and Lugia descends to hover over the pool. Beating
 * it opens a portal to the Hall of Fame.
 */
export const lugiaCave: MapDef = {
  id: 'lugiaCave',
  name: 'Whirlpool Cave',
  kind: 'outdoor',
  cave: true,
  // the Lugia chamber stays empty and eerie — no crowd
  crowd: { npcs: 0, pokemon: 0 },
  width: W,
  height: H,
  camera: { pitch: 44, dist: 19, fov: 36 },
  ground: groundGrid(W, H, 'W', [
    // back wall sits close behind the pool so the falls stay in frame from the platform
    ['X', 0, 0, W, 5], ['X', 0, 0, 2, H], ['X', W - 2, 0, 2, H], ['X', 0, H - 2, W, 2],
    // boulders ringing the pool
    ['R', 5, 6, 1, 1], ['R', 16, 6, 1, 1],
    ['R', 3, 7, 1, 1], ['R', 2, 9, 1, 1], ['R', 3, 11, 1, 1],
    ['R', 18, 7, 1, 1], ['R', 19, 9, 1, 1], ['R', 18, 11, 1, 1],
    ['R', 5, 12, 1, 1], ['R', 16, 12, 1, 1],
    // the raised mossy platform, and the corridor in from the cave mouth
    ['z', 7, 12, 8, 8],
    ['z', 10, 20, 2, H - 20],
  ]),
  legendary: { id: 'seacave', x: 10, y: 11 },
  legendaryFixed: true,
  legendaryIntro: 'waterfall',
  // the platform's edge, overlooking the pool
  legendaryZone: { x: 8, y: 12, w: 6, h: 2 },
  portal: { after: 'seacave', x: 10, y: 16, to: 'hallOfFame', tx: 6, ty: 21, dir: 'up' },
  props: [
    { kind: 'waterfall', x: 7, y: 5, w: 8, d: 1, solid: false, opts: { height: 4.2 } },
  ],
  warps: [
    { x: 10, y: H, to: 'route3', tx: 37, ty: 3, dir: 'down' },
    { x: 11, y: H, to: 'route3', tx: 38, ty: 3, dir: 'down' },
  ],
  interactions: [],
}
