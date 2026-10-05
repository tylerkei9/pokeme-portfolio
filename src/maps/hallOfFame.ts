import type { ScriptContext } from '../engine/engine'
import type { Interaction, Prop } from './types'
import { groundGrid, onTiles, type MapDef } from './types'

const W = 14
const H = 24

// The 'pedestal' prop design is kept in engine/props.ts (buildPedestal) for later exhibits:
// props.push({ kind: 'pedestal', x, y, opts: { accent: [r, g, b] } })

// Project exhibits: each opens that project's dashboard full-screen.
const RR_DASHBOARD = '/rolls%20royce%20data%20synthesizer%20project/index.html'
const PIANO_DASHBOARD = '/piano-hand-project/index.html'
// built with Archify from a validated JSON graph: public/architecture/pokeme-world.archify.json
const ARCH_DIAGRAM = '/architecture/index.html'
// Exhibits are staggered up the carpet, alternating sides, so a visitor walking in from the
// cave passes one at a time, ending at Eli Lilly beside the kiosk:
//   AAU podium (R) → Purdue Pete (L) → piano hand (R) → Rolls-Royce (L) → PokéMe (R) → Eli Lilly (L)
const PODIUM = { x: 9, y: 18, w: 3, d: 2 }
const PETE = { x: 2, y: 15, w: 3, d: 2 }
const PIANO = { x: 9, y: 12, w: 3, d: 2 }
const CAR = { x: 2, y: 8, w: 3, d: 3 }
const DS = { x: 9, y: 5, w: 3, d: 2 }
const LILLY = { x: 2, y: 2, w: 3, d: 2 }
const footprint = (r: { x: number; y: number; w: number; d: number }) =>
  Array.from({ length: r.w * r.d }, (_, i) => [r.x + (i % r.w), r.y + Math.floor(i / r.w)] as [number, number])

const props: Prop[] = [
  { kind: 'aauPodium', ...PODIUM },
  { kind: 'purduePete', ...PETE },
  // swap 'agentGraph' for 'lillyLogo' to show the plain logo statue instead (and drop its exhibit below)
  { kind: 'agentGraph', ...LILLY },
  { kind: 'pianoHand', ...PIANO },
  { kind: 'rollsRoyce', ...CAR },
  { kind: 'dsConsole', ...DS },
]

const EXHIBITS: { at: typeof CAR; open: (ctx: ScriptContext) => Promise<void> }[] = [
  { at: PODIUM, open: (ctx) => ctx.openContent('photo:/material/about/volleyball.jpg') },
  { at: PETE, open: (ctx) => ctx.openContent('photo:/material/halloffame/purdue-graduation.jpg') },
  { at: PIANO, open: (ctx) => ctx.openContent(`dashboard:${PIANO_DASHBOARD}`) },
  { at: CAR, open: (ctx) => ctx.openContent(`dashboard:${RR_DASHBOARD}`) },
  { at: DS, open: (ctx) => ctx.openContent(`dashboard:${ARCH_DIAGRAM}`) },
  { at: LILLY, open: (ctx) => ctx.openContent('exhibit:lilly') },
]

// Each exhibit opens on its own when you step onto a tile right beside it (the ring of tiles
// touching its sides), and pressing A while facing it opens it again.
const beside = (r: typeof CAR) => [
  { x: r.x - 1, y: r.y, w: 1, h: r.d },
  { x: r.x + r.w, y: r.y, w: 1, h: r.d },
  { x: r.x, y: r.y - 1, w: r.w, h: 1 },
  { x: r.x, y: r.y + r.d, w: r.w, h: 1 },
]
const triggers: NonNullable<MapDef['triggers']> = EXHIBITS.flatMap(({ at, open }) => beside(at).map((r) => ({ ...r, run: open })))
const interactions: Interaction[] = EXHIBITS.flatMap(({ at, open }) => onTiles(footprint(at), open))
for (let y = 3; y < H - 2; y += 4) {
  props.push({ kind: 'pillar', x: 1, y }, { kind: 'pillar', x: 12, y })
}

/**
 * The Hall of Fame — the end of the journey. A grand ceremonial hall: gold diamond-mosaic
 * floor, tall stone pillars, a red carpet up the middle to an arched doorway, and Tyler's
 * exhibits staggered up the carpet (AAU podium, Purdue Pete, the piano hand, the Rolls-Royce,
 * the PokéMe console, Eli Lilly), each opening as you step beside it, and a contact kiosk
 * at the head of the hall.
 */
export const hallOfFame: MapDef = {
  id: 'hallOfFame',
  name: 'Hall of Fame',
  kind: 'indoor',
  wallStyle: 'hall',
  crowd: { npcs: 0, pokemon: 0 },
  width: W,
  height: H,
  ground: groundGrid(W, H, 'h', [
    ['c', 6, 0, 2, H],
  ]),
  props: [
    ...props,
    { kind: 'kiosk', x: 6, y: 1, w: 2 },
  ],
  warps: [
    { x: 6, y: H, to: 'lugiaCave', tx: 10, ty: 17, dir: 'down' },
    { x: 7, y: H, to: 'lugiaCave', tx: 11, ty: 17, dir: 'down' },
  ],
  triggers,
  interactions: [
    ...interactions,
  ],
}
