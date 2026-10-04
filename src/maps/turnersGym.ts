import { groundGrid, onTiles, type MapDef } from './types'

const W = 18
const H = 12
const TP = 16

/** One painted volleyball-court outline, `tw` tiles wide starting at `tx`, full room depth,
 *  with a line under each net row (in map tile coordinates). */
function paintCourt(g: CanvasRenderingContext2D, tx: number, ty: number, tw: number, th: number, netRows: number[]) {
  const x0 = tx * TP + 3
  const y0 = ty * TP + 3
  const w = tw * TP - 6
  const h = th * TP - 6
  g.strokeStyle = 'rgb(244,244,240)'
  g.lineWidth = 2
  g.strokeRect(x0, y0, w, h)
  for (const row of netRows) {
    const y = row * TP
    g.beginPath()
    g.moveTo(x0, y)
    g.lineTo(x0 + w, y)
    g.stroke()
  }
}

/**
 * Inside American Turners: two side-by-side volleyball courts on a wood floor, matching
 * the real gym Tyler grew up practicing in.
 */
export const turnersGym: MapDef = {
  id: 'turnersGym',
  kind: 'indoor',
  width: W,
  height: H,
  ground: groundGrid(W, H, 'w', [['m', 5, H - 1, 2, 1]]),
  paintGround: (g) => {
    paintCourt(g, 1, 1, 7, H - 2, [5])
    paintCourt(g, 10, 1, 7, H - 2, [5])
  },
  windows: [4.5, 13.5],
  // a pickup game's worth of players hanging around the courts
  crowd: { npcs: 2, pokemon: 0 },
  props: [
    // one net per court, running horizontally across the width — a real volleyball layout
    { kind: 'net', x: 1, y: 5, w: 7, d: 1 },
    { kind: 'net', x: 10, y: 5, w: 7, d: 1 },
    { kind: 'bench', x: 8, y: 1 },
    { kind: 'bench', x: 8, y: H - 3 },
    // a TV in the aisle between the two courts, playing Tyler's old highlights
    { kind: 'tv', x: 8, y: 5, w: 2 },
  ],
  // the whole front wall lets you out (the mat marks the doors), so walking down anywhere
  // along the bottom of the gym takes you back outside
  warps: Array.from({ length: W }, (_, x) => ({ x, y: H, to: 'turners', tx: x <= 5 ? 8 : 9, ty: 8, dir: 'down' as const })),
  interactions: [
    ...onTiles([[8, 5], [9, 5]], async (ctx) => {
      await ctx.say('An old TV, looping highlights on a shelf.')
      await ctx.openContent('highlights')
    }),
  ],
}
