import type { Warp } from './types'
import { groundGrid, onTiles, type MapDef } from './types'

const W = 40
const H = 14
const DECK_TOP = 5
const DECK_ROWS = 5

/** Both ends of the deck warp onward (west to Route 2, east to American Turners). */
const endWarps: Warp[] = []
for (let y = DECK_TOP; y < DECK_TOP + DECK_ROWS; y++) {
  endWarps.push({ x: -1, y, to: 'route2', tx: y % 2 ? 6 : 7, ty: 1, dir: 'down' })
  endWarps.push({ x: W, y, to: 'turners', tx: y % 2 ? 8 : 9, ty: 12, dir: 'up' })
}

/**
 * The crossing out to American Turners, laid out like Black & White's Village Bridge:
 * you walk it left to right with the normal overhead camera following, over a wide
 * flagstone deck raised high above teal water on stone arches, past two tall timber towers
 * whose cables sweep down in deep curves — the near tower passing in front of the camera
 * as you go. Named for the Throgs Neck Bridge Tyler rode over to volleyball practice.
 */
export const bridge: MapDef = {
  id: 'bridge',
  name: 'The Throgs Neck Crossing',
  kind: 'outdoor',
  width: W,
  height: H,
  skyBridge: true,
  // the reference crossing is framed much closer than the rest of the overworld
  camera: { pitch: 58, dist: 15, fov: 34 },
  ground: groundGrid(W, H, 'W', [
    ['u', 0, DECK_TOP - 1, W, 1],
    ['u', 0, DECK_TOP + DECK_ROWS, W, 1],
    ['q', 0, DECK_TOP, W, DECK_ROWS],
    // landing plazas at each end
    ['q', 0, 2, 3, H - 4],
    ['q', W - 3, 2, 3, H - 4],
  ]),
  props: [
    {
      kind: 'villageBridge', x: 0, y: DECK_TOP - 1, w: W, d: DECK_ROWS + 2, solid: false,
      opts: { towers: [-7, 7], endInset: 3 },
    },
  ],
  warps: endWarps,
  interactions: [
  ],
}
