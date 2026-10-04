import type { MapDef } from './types'
import { bedroom } from './bedroom'
import { house1f } from './house1f'
import { town } from './town'
import { route1 } from './route1'
import { lake } from './lake'
import { route2 } from './route2'
import { bridge } from './bridge'
import { turners } from './turners'
import { turnersGym } from './turnersGym'
import { route3 } from './route3'
import { lugiaCave } from './lugiaCave'
import { hallOfFame } from './hallOfFame'

export const MAPS: Record<string, MapDef> = {
  bedroom,
  house1f,
  town,
  route1,
  lake,
  route2,
  bridge,
  turners,
  turnersGym,
  route3,
  lugiaCave,
  hallOfFame,
}

/** Where a new game starts — just outside the house, in the starting town. */
export const START = { map: 'town', x: 11, y: 12, dir: 'up' as const }

/** Where Skip Ahead lands you — the Hall of Fame entrance. */
export const HALL_START = { map: 'hallOfFame', x: 6, y: 21, dir: 'up' as const }
