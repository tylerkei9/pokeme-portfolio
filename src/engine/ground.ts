import type { MapDef } from '../maps/types'
import { makeCanvas, rect, rng, speckle, css, shade, type RGB } from './pixel'

/** DS pixels per tile. */
export const TP = 16

// Palette sampled from the Nuvema Town / Route 1 / bedroom frames of the reference video.
const GRASS: RGB = [201, 207, 179]
const GRASS_VAR: RGB[] = [[194, 202, 175], [186, 196, 168], [212, 216, 190]]
const GRASS_TUFT: RGB = [158, 174, 140]
const FOREST_FLOOR: RGB = [168, 180, 158]
const PATH: RGB = [217, 208, 185]
const PATH_VAR: RGB[] = [[210, 200, 176], [224, 217, 196], [204, 194, 170]]
const STONE: RGB = [176, 178, 174]
const STONE_LINE: RGB = [148, 150, 146]
// Black 2/White 2 flagstone paving: warm beige stones laid in offset courses
const COBBLE: RGB[] = [[214, 202, 176], [204, 192, 166], [222, 212, 188]]
const COBBLE_MORTAR: RGB = [158, 146, 122]
const CURB: RGB = [230, 224, 206]
const CURB_SEAM: RGB = [198, 192, 172]
const CONCRETE: RGB = [196, 196, 190]
const BRICK: RGB = [168, 86, 64]
const MORTAR: RGB = [206, 176, 156]
const COURT: RGB = [226, 200, 156]
const BBALL_COURT: RGB = [150, 176, 138]
const BBALL_PAINT: RGB = [196, 88, 84]
const BBALL_LINE: RGB = [248, 248, 244]
const WOOD: RGB[] = [[246, 208, 150], [238, 200, 142], [250, 214, 158]]
const WOOD_SEAM: RGB = [214, 170, 112]
const CARPET: RGB = [176, 48, 92]
const CARPET_EDGE: RGB = [212, 104, 144]
const KITCHEN: [RGB, RGB] = [[234, 234, 228], [206, 214, 216]]
const MAT: RGB = [72, 130, 112]

const GRASSY = new Set(['g', 'T', 'Y', 'r', 'f', 'o', 'G'])

function hash(s: string) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

export function paintGround(def: MapDef): HTMLCanvasElement {
  const { width: W, height: H, ground } = def
  const { c, g } = makeCanvas(W * TP, H * TP)
  const rand = rng(hash(def.id))
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? '' : ground[y][x])

  // Flagstone courses are laid out across the whole map in pixel space, so stones run
  // continuously over tile boundaries instead of repeating a visible 16px tile.
  const cobbleRows = new Map<number, [number, number, number][]>()
  const cobbleRow = (row: number) => {
    let stones = cobbleRows.get(row)
    if (stones) return stones
    stones = []
    const r = rng(row * 7919 + 13)
    let xx = -Math.floor(r() * 10)
    while (xx < W * TP) {
      const w = 9 + Math.floor(r() * 5)
      stones.push([xx, w, Math.floor(r() * COBBLE.length)])
      xx += w
    }
    cobbleRows.set(row, stones)
    return stones
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * TP
      const py = y * TP
      const ch = ground[y][x]
      switch (ch) {
        case 'g':
        case 'f':
          rect(g, px, py, TP, TP, GRASS)
          speckle(g, px, py, TP, TP, GRASS_VAR, 0.3, rand)
          if (rand() < 0.35) {
            // little two-blade tuft
            const tx = px + 2 + Math.floor(rand() * 11)
            const ty = py + 3 + Math.floor(rand() * 10)
            rect(g, tx, ty, 1, 2, GRASS_TUFT)
            rect(g, tx + 2, ty - 1, 1, 3, GRASS_TUFT)
          }
          if (ch === 'f') paintFlowers(g, px, py, rand)
          break
        case 'G':
          // under the tall-grass tufts
          rect(g, px, py, TP, TP, [108, 164, 96])
          speckle(g, px, py, TP, TP, [[92, 150, 84], [124, 178, 108]], 0.4, rand)
          break
        case 'o':
          rect(g, px, py, TP, TP, GRASS)
          speckle(g, px, py, TP, TP, GRASS_VAR, 0.3, rand)
          paintOrangeClusters(g, px, py, rand)
          break
        case 'W':
          // water is its own animated mesh below the ground; leave a hole
          break
        case 'T':
        case 'Y':
        case 'r':
          rect(g, px, py, TP, TP, FOREST_FLOOR)
          speckle(g, px, py, TP, TP, [GRASS_TUFT, [176, 188, 166]], 0.25, rand)
          break
        case 'p':
          rect(g, px, py, TP, TP, PATH)
          speckle(g, px, py, TP, TP, PATH_VAR, 0.35, rand)
          break
        case 's':
          // grey cobblestone, cherry-garden style
          rect(g, px, py, TP, TP, STONE)
          for (let r = 0; r < 4; r++) {
            const off = r % 2 ? 4 : 0
            for (let b = -1; b < 2; b++) rect(g, px + off + b * 8, py + r * 4, 7, 3, shade(STONE, 1.05 + (b === 0 ? 0.05 : 0)))
          }
          speckle(g, px, py, TP, TP, [STONE_LINE], 0.05, rand)
          break
        case 'q': {
          // two courses of rounded flagstones per tile, lit from the top-left
          rect(g, px, py, TP, TP, COBBLE_MORTAR)
          for (let r = 0; r < 2; r++) {
            const yy = py + r * 8
            for (const [sx, sw, ci] of cobbleRow(y * 2 + r)) {
              const x0 = Math.max(sx, px)
              const x1 = Math.min(sx + sw - 1, px + TP)
              if (x1 <= x0) continue
              const col = COBBLE[ci]
              rect(g, x0, yy + 1, x1 - x0, 6, col)
              // rounded ends: trim the corner pixels where the stone's own edge falls here
              const lEdge = sx >= px
              const rEdge = sx + sw - 1 <= px + TP
              rect(g, lEdge ? x0 + 1 : x0, yy, x1 - x0 - (lEdge ? 1 : 0) - (rEdge ? 1 : 0), 1, shade(col, 1.06))
              rect(g, lEdge ? x0 + 1 : x0, yy + 7, x1 - x0 - (lEdge ? 1 : 0) - (rEdge ? 1 : 0), 1, shade(col, 0.86))
              if (lEdge) rect(g, x0, yy + 1, 1, 6, shade(col, 1.04))
            }
          }
          break
        }
        case 'z':
          // dark mossy cave floor, like the raised platform in the HGSS Lugia chamber
          rect(g, px, py, TP, TP, [52, 92, 80])
          speckle(g, px, py, TP, TP, [[44, 80, 70], [64, 108, 92], [40, 72, 64]], 0.35, rand)
          if (rand() < 0.4) {
            const tx = px + 2 + Math.floor(rand() * 11)
            const ty = py + 3 + Math.floor(rand() * 10)
            rect(g, tx, ty, 2, 1, [84, 132, 104])
            rect(g, tx + 1, ty - 1, 1, 1, [84, 132, 104])
          }
          break
        case 'X':
        case 'R':
          // under cave walls / boulders
          rect(g, px, py, TP, TP, [34, 52, 50])
          speckle(g, px, py, TP, TP, [[28, 44, 42], [42, 62, 58]], 0.3, rand)
          break
        case 'h': {
          // Hall of Fame: tan and gold diamond mosaic, one diamond per tile
          rect(g, px, py, TP, TP, [206, 176, 118])
          const c = TP / 2
          for (let i = 0; i < TP; i++) {
            const half = i < c ? i : TP - 1 - i
            rect(g, px + c - half - 1, py + i, half * 2 + 2, 1, (x + y) % 2 ? [226, 196, 128] : [236, 212, 150])
            rect(g, px + c - half - 1, py + i, 1, 1, [168, 132, 78])
            rect(g, px + c + half, py + i, 1, 1, [168, 132, 78])
          }
          rect(g, px + c - 1, py + c - 1, 2, 2, [252, 232, 170])
          break
        }
        case 'u':
          // smooth pale stone curb slabs along a bridge edge
          rect(g, px, py, TP, TP, CURB)
          rect(g, px, py, 1, TP, CURB_SEAM)
          rect(g, px + 8, py, 1, TP, CURB_SEAM)
          rect(g, px, py, TP, 1, [242, 238, 224])
          break
        case 'a':
          // city street asphalt (lane lines and crosswalks are painted by the map)
          rect(g, px, py, TP, TP, [92, 94, 100])
          speckle(g, px, py, TP, TP, [[80, 82, 88], [104, 106, 112]], 0.35, rand)
          break
        case 'd':
          rect(g, px, py, TP, TP, CONCRETE)
          speckle(g, px, py, TP, TP, [[188, 188, 182], [204, 204, 198]], 0.3, rand)
          if (y % 2 === 0) rect(g, px, py, TP, 1, [172, 172, 166])
          break
        case 'b':
          rect(g, px, py, TP, TP, MORTAR)
          for (let r = 0; r < 4; r++) {
            const off = r % 2 ? 4 : 0
            for (let b = -1; b < 2; b++) rect(g, px + off + b * 8 + 1, py + r * 4, 7, 3, BRICK)
          }
          break
        case 'v':
          rect(g, px, py, TP, TP, COURT)
          speckle(g, px, py, TP, TP, [[218, 190, 146], [234, 210, 168]], 0.4, rand)
          break
        case 'j':
          rect(g, px, py, TP, TP, BBALL_COURT)
          speckle(g, px, py, TP, TP, [[140, 166, 128], [162, 186, 148]], 0.35, rand)
          break
        case 'w':
          // BW-style square floor panels
          rect(g, px, py, TP, TP, WOOD[(x + y) % 2 ? 0 : 2])
          speckle(g, px, py, TP, TP, [WOOD[1]], 0.12, rand)
          rect(g, px, py, TP, 1, WOOD_SEAM)
          rect(g, px, py, 1, TP, WOOD_SEAM)
          rect(g, px + 1, py + 1, TP - 1, 1, [252, 224, 172])
          break
        case 'c':
          rect(g, px, py, TP, TP, CARPET)
          // diamond lattice
          for (let i = 0; i < TP; i++) {
            rect(g, px + i, py + ((i + 8) % TP), 1, 1, [196, 72, 116])
            rect(g, px + i, py + ((TP - i + 8) % TP), 1, 1, [196, 72, 116])
          }
          break
        case 'k':
          for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) rect(g, px + q * 8, py + r * 8, 8, 8, KITCHEN[(r + q) % 2])
          break
        case 'm':
          rect(g, px, py, TP, TP, MAT)
          for (let r = 2; r < TP; r += 3) rect(g, px + 1, py + r, TP - 2, 1, [92, 150, 130])
          break
        default:
          // void: left transparent so anything below floor level (stairwells) shows through
      }
    }
  }

  // Ragged grass bleeding into path edges, like BW's soft dirt roads.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[y][x] !== 'p' && ground[y][x] !== 's') continue
      const sides: [number, number, (i: number, d: number) => [number, number]][] = [
        [0, -1, (i, d) => [i, d]],
        [0, 1, (i, d) => [i, TP - 1 - d]],
        [-1, 0, (i, d) => [d, i]],
        [1, 0, (i, d) => [TP - 1 - d, i]],
      ]
      for (const [dx, dy, pos] of sides) {
        if (!GRASSY.has(at(x + dx, y + dy))) continue
        for (let i = 0; i < TP; i++) {
          for (let d = 0; d < 3; d++) {
            if (rand() < [0.75, 0.4, 0.12][d]) {
              const [ox, oy] = pos(i, d)
              g.fillStyle = css(rand() < 0.5 ? GRASS : GRASS_VAR[0])
              g.fillRect(x * TP + ox, y * TP + oy, 1, 1)
            }
          }
        }
      }
    }
  }

  // Grey-green pebbles along the path edge, as on Nuvema's roads
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[y][x] !== 'p' && ground[y][x] !== 's') continue
      const edges: [number, number, boolean][] = [[0, -1, true], [0, 1, true], [-1, 0, false], [1, 0, false]]
      for (const [dx, dy, horiz] of edges) {
        if (!GRASSY.has(at(x + dx, y + dy))) continue
        for (let i = 1; i < TP; i += 3) {
          const jitter = Math.floor(rand() * 2)
          const along = i + Math.floor(rand() * 2)
          const off = dx === 1 || dy === 1 ? TP - 3 + jitter : 1 + jitter
          const [ox, oy] = horiz ? [along, off] : [off, along]
          if (ox < TP && oy < TP) rect(g, x * TP + ox, y * TP + oy, 2, 1, rand() < 0.5 ? [150, 160, 140] : [172, 178, 160])
        }
      }
    }
  }

  // Shoreline: a dark earth lip with a pale sand line where land meets water
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ch = ground[y][x]
      if (ch === 'W' || ch === ' ') continue
      const px = x * TP
      const py = y * TP
      if (at(x, y - 1) === 'W') { rect(g, px, py, TP, 2, [112, 96, 70]); rect(g, px, py + 2, TP, 1, [214, 204, 170]) }
      if (at(x, y + 1) === 'W') { rect(g, px, py + TP - 2, TP, 2, [112, 96, 70]); rect(g, px, py + TP - 3, TP, 1, [214, 204, 170]) }
      if (at(x - 1, y) === 'W') { rect(g, px, py, 2, TP, [112, 96, 70]); rect(g, px + 2, py, 1, TP, [214, 204, 170]) }
      if (at(x + 1, y) === 'W') { rect(g, px + TP - 2, py, 2, TP, [112, 96, 70]); rect(g, px + TP - 3, py, 1, TP, [214, 204, 170]) }
    }
  }

  // Carpet border
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (ground[y][x] !== 'c') continue
      const px = x * TP
      const py = y * TP
      if (at(x, y - 1) !== 'c') rect(g, px, py + 1, TP, 2, CARPET_EDGE)
      if (at(x, y + 1) !== 'c') rect(g, px, py + TP - 3, TP, 2, CARPET_EDGE)
      if (at(x - 1, y) !== 'c') rect(g, px + 1, py, 2, TP, CARPET_EDGE)
      if (at(x + 1, y) !== 'c') rect(g, px + TP - 3, py, 2, TP, CARPET_EDGE)
    }
  }

  def.paintGround?.(g)
  return c
}

/** Little orange flower / mushroom clusters dotting the lake grove. */
function paintOrangeClusters(g: CanvasRenderingContext2D, px: number, py: number, rand: () => number) {
  for (let i = 0; i < 2; i++) {
    const fx = px + 3 + Math.floor(rand() * 9)
    const fy = py + 4 + Math.floor(rand() * 8)
    rect(g, fx, fy, 3, 2, [238, 128, 44])
    rect(g, fx + 1, fy - 1, 1, 1, [252, 184, 96])
    rect(g, fx + 1, fy + 2, 1, 2, [236, 226, 196])
    rect(g, fx + 4, fy + 1, 2, 2, [224, 104, 36])
  }
}

/**
 * Full-court key/circle/sideline paint for one basketball hoop, matching the Memorial Park
 * reference photo: a red free-throw key and center-circle-style arc under the hoop, white
 * sidelines around the court's footprint. Call from a map's `paintGround`, in tile units
 * with `hoopEnd` set to the baseline the hoop stands at ('top' or 'bottom').
 */
export function paintBasketballCourt(
  g: CanvasRenderingContext2D, tx: number, ty: number, tw: number, th: number, hoopEnd: 'top' | 'bottom' = 'top',
) {
  const x0 = tx * TP
  const y0 = ty * TP
  const w = tw * TP
  const h = th * TP
  const keyW = Math.round(w * 0.42)
  const keyH = Math.round(h * 0.4)
  const keyX = x0 + Math.round((w - keyW) / 2)
  const keyY = hoopEnd === 'top' ? y0 : y0 + h - keyH
  rect(g, keyX, keyY, keyW, keyH, BBALL_PAINT)

  const cx = x0 + w / 2
  const cy = hoopEnd === 'top' ? keyY + keyH : keyY
  const r = Math.round(w * 0.22)
  g.fillStyle = css(BBALL_PAINT)
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fill()

  g.strokeStyle = css(BBALL_LINE)
  g.lineWidth = 2
  g.strokeRect(x0 + 3, y0 + 3, w - 6, h - 6)
  g.strokeRect(keyX, keyY, keyW, keyH)
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.stroke()
}

function paintFlowers(g: CanvasRenderingContext2D, px: number, py: number, rand: () => number) {
  const petals: RGB[] = [[232, 88, 80], [248, 216, 96], [248, 248, 240]]
  for (let i = 0; i < 3; i++) {
    const fx = px + 2 + Math.floor(rand() * 11)
    const fy = py + 2 + Math.floor(rand() * 11)
    const col = petals[Math.floor(rand() * petals.length)]
    rect(g, fx - 1, fy, 3, 1, col)
    rect(g, fx, fy - 1, 1, 3, col)
    rect(g, fx, fy, 1, 1, [248, 200, 64])
  }
}
