import { groundGrid, onTiles, type MapDef } from './types'
import { rng } from '../engine/pixel'

const W = 24
const H = 22
const TP = 16

/**
 * The lake shrine — a secluded grove, styled after Pokémon's cherry-blossom-garden maps:
 * a horseshoe-shaped pond ringed entirely by dense pink blossom trees, cobblestone paths
 * dusted with fallen petals, and lily pads/lotus on the water. Latias stays hidden until
 * the player reaches the clearing at the centre, then flies in and challenges them.
 */
export const lake: MapDef = {
  id: 'lake',
  name: 'Hidden Grove',
  kind: 'outdoor',
  width: W,
  height: H,
  treePalette: 'cherry',
  ground: groundGrid(W, H, 'g', [
    ['T', 0, 0, W, 3], ['T', 0, 0, 3, H], ['T', W - 3, 0, 3, H], ['T', 0, H - 1, W, 1],
    ['T', 3, 3, 2, 2], ['T', 19, 18, 2, 2],
    // the pond, with a clearing in the middle and an opening to the south
    ['W', 6, 4, 12, 12],
    ['g', 9, 7, 6, 6],
    ['g', 11, 13, 2, 3],
    ['o', 9, 7, 1, 1], ['o', 14, 7, 1, 1], ['o', 9, 12, 1, 1], ['o', 14, 12, 1, 1],
    ['o', 4, 16, 3, 2], ['o', 18, 5, 2, 2], ['o', 3, 9, 2, 2],
    // cobblestone paths: entrance from Oakland Gardens, and on toward the ruins
    ['s', 11, 16, 2, H - 16],
    ['s', 13, 16, 7, 2],
    ['s', 18, 0, 2, 18],
  ]),
  // Fallen cherry petals dusting the grass and stone alike.
  paintGround: (g) => {
    const rand = rng(4177)
    const petals: [number, number, number][] = [[236, 140, 172], [248, 200, 216], [255, 255, 255]]
    for (let i = 0; i < (W * H) * 3.2; i++) {
      const x = Math.floor(rand() * W * TP)
      const y = Math.floor(rand() * H * TP)
      const [r, gr, b] = petals[Math.floor(rand() * petals.length)]
      g.fillStyle = `rgb(${r},${gr},${b})`
      g.fillRect(x, y, 2, 1)
      if (rand() < 0.4) g.fillRect(x, y + 1, 1, 1)
    }
  },
  // the legendary's grove stays empty, no crowd
  crowd: { npcs: 0, pokemon: 0 },
  legendary: { id: 'lake', x: 11, y: 9 },
  // The inner clearing — reaching anywhere in here (not one exact tile) triggers Latias.
  legendaryZone: { x: 10, y: 8, w: 4, h: 4 },
  props: [
    { kind: 'lilypad', x: 7, y: 5, solid: false, opts: { flower: true } },
    { kind: 'lilypad', x: 15, y: 5, solid: false },
    { kind: 'lilypad', x: 7, y: 11, solid: false },
    { kind: 'lilypad', x: 16, y: 11, solid: false, opts: { flower: true } },
    { kind: 'lilypad', x: 9, y: 14, solid: false },
    { kind: 'lilypad', x: 15, y: 14, solid: false, opts: { flower: true } },
  ],
  warps: [
    { x: 11, y: H, to: 'route1', tx: 12, ty: 0, dir: 'down' },
    { x: 12, y: H, to: 'route1', tx: 13, ty: 0, dir: 'down' },
    { x: 18, y: -1, to: 'route2', tx: 6, ty: 28, dir: 'up' },
    { x: 19, y: -1, to: 'route2', tx: 7, ty: 28, dir: 'up' },
  ],
  interactions: [
  ],
}
