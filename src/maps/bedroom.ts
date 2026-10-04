import { groundGrid, onTiles, type MapDef } from './types'

/** Upstairs bedroom — where the game starts, like Hilbert's room in BW. */
export const bedroom: MapDef = {
  id: 'bedroom',
  kind: 'indoor',
  width: 10,
  height: 8,
  ground: groundGrid(10, 8, 'w', [
    ['c', 2, 3, 4, 3],
    [' ', 9, 0, 1, 2], // stairwell
  ]),
  windows: [3.6, 6],
  props: [
    { kind: 'shelf', x: 0, y: 0 },
    { kind: 'tv', x: 1, y: 0, w: 2 },
    { kind: 'desk', x: 5, y: 0, w: 2 },
    { kind: 'plant', x: 7, y: 0 },
    { kind: 'stairsDown', x: 9, y: 0, d: 2 },
    { kind: 'bed', x: 8, y: 5, w: 2, d: 2 },
    { kind: 'plant', x: 0, y: 7 },
  ],
  warps: [
    { x: 9, y: 0, to: 'house1f', tx: 1, ty: 1, dir: 'down' },
    { x: 9, y: 1, to: 'house1f', tx: 1, ty: 1, dir: 'down' },
  ],
  interactions: [
  ],
}
