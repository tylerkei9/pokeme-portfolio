import { groundGrid, onTiles, type MapDef } from './types'

const W = 26
const H = 30

/**
 * Oakland Gardens, Queens — replaces the old wild "Route 1" crossing. Styled after Windsor
 * Oaks, where Tyler's grandparents live: red-brick garden-apartment blocks with paired
 * cream-porticoed front doors, set around a lawn courtyard with concrete walks, topiary
 * and a flower bed at the entrance. Holds the résumé monument, same as before.
 */
export const route1: MapDef = {
  id: 'route1',
  name: 'Oakland Gardens',
  kind: 'outdoor',
  width: W,
  height: H,
  ground: groundGrid(W, H, 'g', [
    ['T', 0, 0, W, 1], ['T', 0, H - 1, W, 1], ['T', 0, 0, 3, H], ['T', W - 3, 0, 3, H],
    // spine walk connecting the town and lake exits
    ['d', 12, 0, 2, H],
    // small flower accents by each building's front walk
    ['f', 4, 21, 2, 1], ['f', 16, 21, 2, 1], ['f', 4, 9, 2, 1], ['f', 16, 9, 2, 1],
  ]),
  props: [
    // south courtyard, by the town entrance
    { kind: 'gardenApartment', x: 3, y: 22, w: 6, d: 5, opts: { doorPairs: [3] } },
    { kind: 'gardenApartment', x: 15, y: 22, w: 6, d: 5, opts: { doorPairs: [3] } },
    { kind: 'topiary', x: 9, y: 24, opts: { tall: true } },
    { kind: 'topiary', x: 11, y: 27 },
    // north courtyard, toward the lake
    { kind: 'gardenApartment', x: 3, y: 10, w: 6, d: 5, opts: { doorPairs: [3] } },
    { kind: 'gardenApartment', x: 15, y: 10, w: 6, d: 5, opts: { doorPairs: [3] } },
    { kind: 'bench', x: 9, y: 16 },
    { kind: 'topiary', x: 6, y: 8 },
    { kind: 'topiary', x: 18, y: 20 },
  ],
  warps: [
    { x: 12, y: H, to: 'town', tx: 25, ty: 0, dir: 'down' },
    { x: 13, y: H, to: 'town', tx: 26, ty: 0, dir: 'down' },
    { x: 12, y: -1, to: 'lake', tx: 11, ty: 21, dir: 'up' },
    { x: 13, y: -1, to: 'lake', tx: 12, ty: 21, dir: 'up' },
  ],
  interactions: [
  ],
}
