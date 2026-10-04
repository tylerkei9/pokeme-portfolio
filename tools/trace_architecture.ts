/**
 * Traces the real architecture for the "How I built PokéMe" dashboard
 * (public/pokeme-architecture/): every source file, its size, what it exports, and which
 * files it imports. The walkthroughs below are checked against the code: each step names a
 * file and a symbol, and the script fails if that symbol isn't in that file, so the
 * dashboard can never describe code that doesn't exist.
 *
 *   npx tsx tools/trace_architecture.ts
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, relative, normalize } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const files = walk(SRC).filter((f) => /\.(tsx?|json)$/.test(f) && !f.endsWith('vite-env.d.ts'))
const rel = (p: string) => relative(SRC, p)

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  const base = normalize(join(dirname(from), spec))
  for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts')]) {
    if (existsSync(c) && statSync(c).isFile()) return rel(c)
  }
  return null
}

const modules = files.map((f) => {
  const text = readFileSync(f, 'utf8')
  const isJson = f.endsWith('.json')
  const imports = new Set<string>()
  const externals = new Set<string>()
  if (!isJson) {
    for (const m of text.matchAll(/(?:import|export)[^'"]*?from\s+'([^']+)'/g)) {
      const r = resolveImport(f, m[1])
      if (r) imports.add(r)
      else if (!m[1].startsWith('.')) externals.add(m[1].split('/')[0])
    }
  }
  const exports = isJson ? [] : [...text.matchAll(/^export (?:async )?(?:function|class|const|interface|type) (\w+)/gm)].map((m) => m[1])
  return {
    id: rel(f),
    lines: text.split('\n').length,
    bytes: Buffer.byteLength(text),
    imports: [...imports].filter((i) => i !== rel(f)),
    externals: [...externals],
    exports,
  }
})

type Step = { file: string; symbol: string; text: string }
const WALKTHROUGHS: { id: string; title: string; blurb: string; steps: Step[] }[] = [
  {
    id: 'load', title: 'Opening the site', blurb: 'What happens between typing the address and seeing the profile.',
    steps: [
      { file: 'main.tsx', symbol: 'createRoot', text: 'The browser runs main.tsx, which mounts the React app.' },
      { file: 'ui/App.tsx', symbol: 'startWithAbout', text: 'The app starts the game and puts the Trainer Profile on top of it.' },
      { file: 'engine/engine.ts', symbol: 'start', text: 'The engine boots: it creates the player, Typhlosion, and the crowd.' },
      { file: 'engine/assets.ts', symbol: 'loadAssets', text: 'Sprite sheets and fonts download in parallel with Promise.all.' },
      { file: 'engine/engine.ts', symbol: 'loadMap', text: 'The starting area is looked up by name.' },
      { file: 'maps/index.ts', symbol: 'MAPS', text: 'All 12 areas are registered in one table.' },
      { file: 'maps/town.ts', symbol: 'groundGrid', text: 'An area is just data: rows of ground letters plus a list of objects.' },
      { file: 'engine/world.ts', symbol: 'World', text: 'World turns that data into a 3D scene and a map of blocked squares.' },
      { file: 'engine/ground.ts', symbol: 'paintGround', text: 'Every ground letter is painted into one pixel-art texture.' },
      { file: 'engine/props.ts', symbol: 'buildProp', text: 'Each building and object is built from boxes and cylinders, its textures painted in code.' },
      { file: 'engine/engine.ts', symbol: 'requestAnimationFrame', text: 'The game loop starts and redraws about 60 times a second.' },
      { file: 'ui/AboutScreen.tsx', symbol: 'AboutScreen', text: 'The profile window appears over the running game.' },
    ],
  },
  {
    id: 'step', title: 'Taking a step', blurb: 'One press of W, from the keyboard to the screen.',
    steps: [
      { file: 'engine/engine.ts', symbol: 'KEY_DIR', text: 'The key press (W A S D or an arrow) becomes a direction.' },
      { file: 'engine/engine.ts', symbol: 'handleExplore', text: 'The engine works out what moving that way means.' },
      { file: 'engine/engine.ts', symbol: 'blocked', text: 'It asks whether the square ahead is free.' },
      { file: 'engine/world.ts', symbol: 'isSolid', text: 'The world answers from the blocked-square map it built when the area loaded.' },
      { file: 'engine/crowd.ts', symbol: 'occupies', text: 'The crowd answers whether a pedestrian is standing there.' },
      { file: 'engine/actor.ts', symbol: 'update', text: 'The player sprite glides to the next square, frame by frame.' },
      { file: 'engine/engine.ts', symbol: 'triggerAt', text: 'On arrival it checks for exits and walk-up exhibit spots.' },
      { file: 'engine/engine.ts', symbol: 'renderer.render', text: 'Three.js draws the new frame with WebGL.' },
    ],
  },
  {
    id: 'exhibit', title: 'Opening an exhibit', blurb: 'How stepping beside a Hall of Fame exhibit opens its window.',
    steps: [
      { file: 'maps/hallOfFame.ts', symbol: 'triggers', text: 'The Hall of Fame map lists walk-up spots beside each exhibit.' },
      { file: 'engine/engine.ts', symbol: 'runScript', text: 'Stepping onto one runs that exhibit\'s script as an async function.' },
      { file: 'engine/engine.ts', symbol: 'openContent', text: 'The script asks for a window to open, then waits until it closes.' },
      { file: 'ui/App.tsx', symbol: 'openContent', text: 'The app passes the request across from the engine to the interface.' },
      { file: 'systems/GameState.ts', symbol: 'activeContentId', text: 'It lands in the shared game state, a Zustand store.' },
      { file: 'ui/ContentModal.tsx', symbol: 'ContentModal', text: 'The window component sees the change and eases in.' },
      { file: 'data/exhibits.ts', symbol: 'EXHIBIT_CARDS', text: 'Its text comes from an editable data file, not from code.' },
      { file: 'engine/engine.ts', symbol: 'isPaused', text: 'The game holds still until the window closes.' },
    ],
  },
  {
    id: 'battle', title: 'Battling a legendary', blurb: 'From walking into the grove to winning the music player.',
    steps: [
      { file: 'maps/lake.ts', symbol: 'legendary', text: 'The grove\'s map file marks where Latias is waiting.' },
      { file: 'engine/engine.ts', symbol: 'inLegendaryZone', text: 'Every step checks whether you have walked into its zone.' },
      { file: 'engine/engine.ts', symbol: 'spawnAndEncounter', text: 'Latias flies in beside you and the encounter starts.' },
      { file: 'systems/BattleSystem.ts', symbol: 'LEGENDARIES', text: 'Its level, health, and lines come from a JSON file.' },
      { file: 'engine/battle.ts', symbol: 'Battle', text: 'The battle plays in its own 3D scene with animated sprites.' },
      { file: 'systems/BottomState.ts', symbol: 'useBottom', text: 'The battle menu\'s state lives in a second Zustand store.' },
      { file: 'ui/BattleBar.tsx', symbol: 'BattleBar', text: 'The React battle menu (Fight, Bag, Run) reads that store.' },
      { file: 'systems/GameState.ts', symbol: 'unlockMusic', text: 'Winning unlocks the music player.' },
    ],
  },
]

for (const w of WALKTHROUGHS) {
  for (const s of w.steps) {
    const path = join(SRC, s.file)
    if (!existsSync(path)) throw new Error(`walkthrough "${w.id}": no file ${s.file}`)
    if (!readFileSync(path, 'utf8').includes(s.symbol)) throw new Error(`walkthrough "${w.id}": "${s.symbol}" not found in ${s.file}`)
  }
}

const out = { generatedAt: new Date().toISOString().slice(0, 10), modules, walkthroughs: WALKTHROUGHS }
mkdirSync(join(ROOT, 'public/pokeme-architecture'), { recursive: true })
writeFileSync(join(ROOT, 'public/pokeme-architecture/data.json'), JSON.stringify(out, null, 1))
const code = modules.filter((m) => !m.id.endsWith('.json'))
console.log(`modules ${modules.length} (${code.length} code), import edges ${modules.reduce((s, m) => s + m.imports.length, 0)}, lines ${code.reduce((s, m) => s + m.lines, 0)}, walkthrough steps ${WALKTHROUGHS.reduce((s, w) => s + w.steps.length, 0)} verified`)
