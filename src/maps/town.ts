import { groundGrid, onTiles, type MapDef } from './types'
import { paintBasketballCourt } from '../engine/ground'

const W = 48
const H = 41
/** The main north–south road (2 tiles wide, starting at this column). */
const SPINE = 25

// Memorial Park's basketball court footprint (tile units). Open-air — no fence.
const COURT = { x: 31, y: 27, w: 10, h: 5 }

/**
 * New Hyde Park — the starting town: Tyler's childhood home, New Hyde Park Memorial High
 * School, his elementary school (Hillside Grade School), and Memorial Park's basketball
 * court, plus Bob Howard's candy shop at the end of Bob Howard's garage. Three bands — home/
 * high school up north, the candy store mid-town, grade school/park down south — with wide
 * grass and road gaps between everything so the town doesn't feel packed.
 */
export const town: MapDef = {
  id: 'town',
  name: 'New Hyde Park',
  kind: 'outdoor',
  width: W,
  height: H,
  ground: groundGrid(W, H, 'g', [
    // forest border
    ['T', 0, 0, W, 3], ['T', 0, H - 3, W, 3], ['T', 0, 0, 3, H], ['T', W - 3, 0, 3, H],
    // spine road: Route 1 exit (north) down through both cross streets
    ['p', SPINE, 0, 2, 36],
    // north cross street: house ↔ high school
    ['p', 11, 14, 32, 2],
    ['b', 11, 11, 1, 1],
    ['p', 11, 12, 1, 2],
    ['p', 35, 12, 2, 2],
    // south cross street: grade school ↔ park
    ['p', 11, 34, 32, 2],
    ['p', 12, 32, 2, 2],
    // driveway and flower beds by the house
    ['d', 15, 7, 2, 7],
    ['f', 17, 8, 2, 2],
    ['f', SPINE + 2, 8, 2, 2],
    // Memorial Park basketball court
    ['j', COURT.x, COURT.y, COURT.w, COURT.h],
    // Bob Howard's candy shop / Bob Howard's: sidewalk and garage apron out to the main road
    ['s', SPINE + 2, 22, 7, 1],
    ['p', SPINE + 9, 22, 8, 1],
    ['p', SPINE + 2, 23, 15, 1],
  ]),
  // walking up to one of these flashes its name in the top-left location banner
  areas: [
    { x: 29, y: 6, w: 15, h: 8, name: 'NHP Memorial' },
    { x: 29, y: 18, w: 5, h: 6, name: "Bob Howard's Candy Shop" },
    { x: 34, y: 18, w: 9, h: 6, name: "Bob Howard's Service Station" },
    { x: 7, y: 26, w: 13, h: 8, name: 'HGS' },
    { x: 30, y: 26, w: 12, h: 7, name: 'Memorial Park' },
  ],
  paintGround: (g) => paintBasketballCourt(g, COURT.x, COURT.y, COURT.w, COURT.h, 'top'),
  props: [
    { kind: 'house', x: 8, y: 7, w: 6, d: 4, opts: { doorCol: 3 } },
    { kind: 'mailbox', x: 15, y: 11 },
    { kind: 'school', x: 30, y: 7, w: 13, d: 5, opts: { doorCol: 6 } },
    { kind: 'gradeschool', x: 8, y: 27, w: 11, d: 5, opts: { doorCol: 5 } },
    // Bob Howard's candy shop at the end of Bob Howard's service station — Tyler's after-school stop
    { kind: 'candyShop', x: SPINE + 5, y: 19, w: 12, d: 3, opts: { shopW: 4 } },
    { kind: 'hoop', x: COURT.x + 4, y: COURT.y, opts: { rotation: 0 } },
  ],
  warps: [
    { x: 11, y: 10, to: 'house1f', tx: 5, ty: 8, dir: 'up' },
    { x: SPINE, y: -1, to: 'route1', tx: 12, ty: 29, dir: 'up' },
    { x: SPINE + 1, y: -1, to: 'route1', tx: 13, ty: 29, dir: 'up' },
  ],
  interactions: [
  ],
}
