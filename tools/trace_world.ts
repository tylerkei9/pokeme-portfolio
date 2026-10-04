/**
 * Traces the real game data for the "How I built this" dashboard
 * (public/pokeme-engine/). Imports the actual map definitions the engine runs on, computes
 * which tiles are solid with the same rule as engine/world.ts, and counts the engine's own
 * source, so the dashboard shows the real world rather than a hand-made mock-up.
 *
 *   npx tsx tools/trace_world.ts
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { MAPS, START, HALL_START } from '../src/maps'

const ROOT = join(import.meta.dirname, '..')

// Mirrors engine/world.ts: these ground characters block movement, as do prop footprints
// unless the prop says `solid: false`.
const worldSrc = readFileSync(join(ROOT, 'src/engine/world.ts'), 'utf8')
const solidMatch = worldSrc.match(/const SOLID_GROUND = new Set\(\[([^\]]*)\]\)/)
if (!solidMatch) throw new Error('SOLID_GROUND not found in engine/world.ts')
const SOLID_GROUND = new Set([...solidMatch[1].matchAll(/'(.)'/g)].map((m) => m[1]))

// Every prop kind the engine can build, read from the BUILDERS table in engine/props.ts.
const propsSrc = readFileSync(join(ROOT, 'src/engine/props.ts'), 'utf8')
const buildersBlock = propsSrc.slice(propsSrc.indexOf('const BUILDERS'), propsSrc.indexOf('\n}\n', propsSrc.indexOf('const BUILDERS')))
const propKinds = [...buildersBlock.matchAll(/^\s+(\w+): build(\w+),/gm)].map((m) => ({ kind: m[1], builder: 'build' + m[2] }))
// Lines in each builder function, so the inspector can say how much code paints a prop.
const builderLines: Record<string, number> = {}
for (const { builder } of propKinds) {
  const start = propsSrc.indexOf(`function ${builder}(`)
  if (start < 0) continue
  const end = propsSrc.indexOf('\n}\n', start)
  builderLines[builder] = propsSrc.slice(start, end).split('\n').length + 1
}

// Terrain characters handled by engine/ground.ts.
const groundSrc = readFileSync(join(ROOT, 'src/engine/ground.ts'), 'utf8')
const terrainChars = [...new Set([...groundSrc.matchAll(/case '(.)'/g)].map((m) => m[1]))]

const maps = Object.values(MAPS).map((def) => {
  const W = def.width
  const H = def.height
  const solid: number[][] = def.ground.map((row) => [...row].map((ch) => (SOLID_GROUND.has(ch) ? 1 : 0)))
  for (const p of def.props) {
    if (p.solid === false) continue
    for (let y = p.y; y < p.y + (p.d ?? 1); y++) {
      for (let x = p.x; x < p.x + (p.w ?? 1); x++) if (y >= 0 && y < H && x >= 0 && x < W) solid[y][x] = 1
    }
  }
  return {
    id: def.id,
    name: def.name || def.id,
    kind: def.kind,
    width: W,
    height: H,
    city: !!def.city,
    camera: def.camera ?? null,
    ground: def.ground,
    solid: solid.map((r) => r.join('')),
    props: def.props.map((p) => ({ kind: p.kind, x: p.x, y: p.y, w: p.w ?? 1, d: p.d ?? 1, solid: p.solid !== false })),
    warps: def.warps.map((w) => ({ x: w.x, y: w.y, to: w.to })),
    interactions: (def.interactions ?? []).map((i) => ({ x: i.x, y: i.y })),
    triggers: (def.triggers ?? []).map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h })),
    areas: (def.areas ?? []).map((a) => ({ x: a.x, y: a.y, w: a.w, h: a.h, name: a.name })),
    legendary: def.legendary ?? null,
    crowd: def.crowd ?? null,
  }
})

// The journey graph: one edge per pair of maps joined by at least one warp.
const edgeSet = new Map<string, { a: string; b: string; count: number }>()
for (const m of maps) {
  for (const w of m.warps) {
    const [a, b] = [m.id, w.to].sort()
    const key = `${a}|${b}`
    const e = edgeSet.get(key) ?? { a, b, count: 0 }
    e.count++
    edgeSet.set(key, e)
  }
}

const countLines = (dir: string) =>
  readdirSync(join(ROOT, dir))
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({ file: `${dir}/${f}`, lines: readFileSync(join(ROOT, dir, f), 'utf8').split('\n').length }))
const code = [...countLines('src/engine'), ...countLines('src/maps'), ...countLines('src/ui'), ...countLines('src/systems')]

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  start: START,
  hallStart: HALL_START,
  solidGround: [...SOLID_GROUND],
  terrainChars,
  propKinds: propKinds.map((p) => ({ ...p, lines: builderLines[p.builder] ?? null })),
  maps,
  edges: [...edgeSet.values()],
  code,
}

mkdirSync(join(ROOT, 'public/pokeme-engine'), { recursive: true })
writeFileSync(join(ROOT, 'public/pokeme-engine/data.json'), JSON.stringify(out))
console.log(`maps ${maps.length}, edges ${out.edges.length}, prop kinds ${propKinds.length}, terrain ${terrainChars.length}, engine lines ${code.filter((c) => c.file.startsWith('src/engine')).reduce((s, c) => s + c.lines, 0)}`)
