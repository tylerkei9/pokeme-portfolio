import { groundGrid, onTiles, type MapDef } from './types'

/** Ground floor of Tyler's house: stairs, kitchen, living room, front door. */
export const house1f: MapDef = {
  id: 'house1f',
  kind: 'indoor',
  width: 12,
  height: 9,
  ground: groundGrid(12, 9, 'w', [
    ['k', 6, 0, 6, 3],
    ['m', 5, 8, 2, 1],
  ]),
  windows: [4.8],
  props: [
    { kind: 'stairsUp', x: 0, y: 0, d: 2 },
    { kind: 'tv', x: 2, y: 0, w: 2 },
    { kind: 'counter', x: 6, y: 0, w: 4 },
    { kind: 'fridge', x: 10, y: 0 },
    { kind: 'plant', x: 11, y: 0 },
    { kind: 'sofa', x: 1, y: 3, w: 3 },
    { kind: 'table', x: 7, y: 4, w: 2, d: 2 },
    { kind: 'chair', x: 6, y: 4 },
    { kind: 'chair', x: 9, y: 5 },
    { kind: 'plant', x: 0, y: 8 },
    { kind: 'plant', x: 11, y: 8 },
  ],
  warps: [
    { x: 0, y: 0, to: 'bedroom', tx: 8, ty: 1, dir: 'left' },
    { x: 0, y: 1, to: 'bedroom', tx: 8, ty: 1, dir: 'left' },
    { x: 5, y: 9, to: 'town', tx: 11, ty: 11, dir: 'down' },
    { x: 6, y: 9, to: 'town', tx: 11, ty: 11, dir: 'down' },
  ],
  interactions: [
  ],
}
