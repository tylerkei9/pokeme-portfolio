import type { ScriptContext } from '../engine/engine'

export type Dir = 'up' | 'down' | 'left' | 'right'

/**
 * Ground characters (one per tile, rows north → south):
 *   g grass   p path   d concrete   b brick   f flowers   v court sand   T tree (solid)
 *   w wood floor   c carpet   k kitchen tile   m door mat   ' ' void (solid, black)
 *   z mossy cave floor   X cave rock wall (solid)   R boulder (solid)   h hall mosaic
 */
export type GroundChar = string

export interface Prop {
  /** Builder key in engine/props.ts */
  kind: string
  x: number
  y: number
  w?: number
  d?: number
  /** Blocks movement over its footprint (default true). */
  solid?: boolean
  opts?: Record<string, unknown>
}

/** Moving into (x, y) — even a solid or off-map tile — sends the player elsewhere. */
export interface Warp {
  x: number
  y: number
  to: string
  tx: number
  ty: number
  dir: Dir
}

/** Facing (x, y) and pressing A runs the script. */
export interface Interaction {
  x: number
  y: number
  run: (ctx: ScriptContext) => Promise<void>
}

/** Trying to move into (x, y) runs the script instead of moving. */
export interface BumpTrigger {
  x: number
  y: number
  run: (ctx: ScriptContext) => Promise<void>
}

export interface CameraConfig {
  /** Degrees below horizontal. */
  pitch: number
  /** Distance from the followed point, in tiles. */
  dist: number
  /** Vertical field of view, degrees. */
  fov: number
}

export interface MapDef {
  id: string
  /** Shown in the location banner when entering (outdoor areas). */
  name?: string
  kind: 'outdoor' | 'indoor'
  width: number
  height: number
  ground: GroundChar[]
  props: Prop[]
  warps: Warp[]
  interactions: Interaction[]
  bumps?: BumpTrigger[]
  camera?: Partial<CameraConfig>
  /** Indoor only: x-centres of windows on the back wall. */
  windows?: number[]
  /** A legendary waiting on this map (despawns for good once defeated). */
  legendary?: { id: 'lake' | 'seacave'; x: number; y: number }
  /** Land the legendary exactly at `legendary.x/y` (e.g. hovering over a pool) instead of
   *  on a free tile beside the player. */
  legendaryFixed?: boolean
  /** A longer arrival cutscene: 'waterfall' = a light rises, the camera pans to the pool,
   *  the waterfall surges and the legendary descends from above (the HGSS Lugia event). */
  legendaryIntro?: 'waterfall'
  /** Once `after` is defeated, a portal stands at (x, y); stepping into it warps onward. */
  portal?: { after: 'lake' | 'seacave'; x: number; y: number; to: string; tx: number; ty: number; dir: Dir }
  /** Cave maps: rock walls instead of the forest ring, deep blue water, dim light. */
  cave?: boolean
  /** Indoor wall style. 'hall' = cream stone with gold trim and an arched doorway. */
  wallStyle?: 'home' | 'hall'
  /** Override the scene's ambient/sun light intensities. */
  lighting?: { ambient: number; sun: number }
  /** The legendary stays hidden until the player steps anywhere in this zone, then flies
   *  in and lands on an open tile facing them (never their own tile). Defaults to a 1×1
   *  zone at the legendary's own position. */
  legendaryZone?: { x: number; y: number; w: number; h: number }
  /** Forest border + any interior 'T' tiles use this tree style. Default 'teal'. */
  treePalette?: 'teal' | 'autumn' | 'cherry'
  /** For a bridge/open-water scene: skip the automatic forest ring and use a sky/sea
   *  background instead of the usual green tree wall. */
  skyBridge?: boolean
  /** How many wandering trainers / wild Pokémon to spawn. Outdoor maps default to a
   *  density based on their walkable area; indoor maps default to none. */
  crowd?: { npcs?: number; pokemon?: number }
  /** Named spots within the map (a building and its forecourt): entering one shows its
   *  name in the top-left location banner. */
  areas?: { x: number; y: number; w: number; h: number; name: string }[]
  /** Walking into one of these rectangles runs its script once (e.g. a Hall of Fame exhibit
   *  opening as you pass it). It re-arms after the player leaves the rectangle. */
  triggers?: { x: number; y: number; w: number; h: number; run: (ctx: ScriptContext) => Promise<void> }[]
  /** A city scene: no forest ring; the surroundings are a skyline of blocky buildings, with
   *  the columns in `cityStreet` (inclusive x range) left open where the street runs on. */
  city?: boolean
  cityStreet?: [number, number]
  /** Background colour where the sky shows (CSS colour); outdoor maps default to haze. */
  sky?: string
  /**
   * Areas where the camera eases into a different framing — e.g. tilting lower and pulling
   * back beside a tall landmark so its top stays in view. Blends in over `fade` tiles
   * (default 3) outside the rectangle; `lift` raises the look-at point, in world units.
   */
  cameraZones?: { x: number; y: number; w: number; h: number; pitch?: number; dist?: number; lift?: number; fade?: number }[]
  /** Extra painting on the ground texture (16 px per tile). */
  paintGround?: (g: CanvasRenderingContext2D) => void
}

/** The same script on several tiles (e.g. every tile of a bed). */
export function onTiles(tiles: [number, number][], run: Interaction['run']): Interaction[] {
  return tiles.map(([x, y]) => ({ x, y, run }))
}

/** Build a ground grid from a fill char plus rectangles, so maps stay easy to edit. */
export function groundGrid(w: number, h: number, fill: string, rects: [string, number, number, number, number][]) {
  const rows = Array.from({ length: h }, () => Array.from({ length: w }, () => fill))
  for (const [ch, x, y, rw, rh] of rects) {
    for (let yy = y; yy < y + rh; yy++) {
      for (let xx = x; xx < x + rw; xx++) {
        if (yy >= 0 && yy < h && xx >= 0 && xx < w) rows[yy][xx] = ch
      }
    }
  }
  return rows.map((r) => r.join(''))
}
