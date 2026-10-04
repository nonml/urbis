// What the player calls a generated world's streets. The hand preset's ways are
// named by their ids (Main, East, West, Plaza, South); a generated world's ids are
// av0, cr1 and so on, which must never reach the screen. Its main avenue is Main,
// the avenues that play the hand map's east and west avenues (sim/anchors.js) are
// East or West by which side of Main they lie on, and every other avenue and
// every crossing takes a name from the pools below, by the seed.
// Pure (law 5): sim/decline.js reads streetName for lot addresses. It takes the
// map last and names the world that map is; the load-time NAMES is the hand
// map's fallback until M3.T14 deletes it (M3-2).
//
// Milestone 2 skeleton: the pools and the salt are final; nameStreets is a stub
// with its test in tests/streetnames.todo.js.
import { DISTRICTS } from './world.js';
import { worldSeed } from './seedstore.js';
import { counterpartX } from './anchors.js';
import { mulberry32 } from './rng.js';
import { worldMap } from './patrol.js';

// Its own random stream, so naming never moves a lot, a sign or a person.
export const NAME_SALT = 0x5717;
export const AVENUE_NAMES = ['Harbor', 'Mercer', 'Linden', 'Kessler', 'Orchard', 'Vale'];
export const CROSSING_NAMES = ['Canal', 'Market', 'Foundry', 'Union', 'Bridge', 'Quay', 'Tannery', 'Chapel'];

// { [way id]: name } for a generated district, built in this order:
// 1. district.avenues[0] is 'Main'.
// 2. The avenue whose x is counterpartX(44, district), then the avenue whose x is
//    counterpartX(-44, district): each one not yet named is 'East' when its x is
//    greater than avenues[0].x, else 'West'.
// 3. rand = mulberry32((seed ^ NAME_SALT) >>> 0). Every avenue still unnamed, in
//    district.avenues order, then every crossing in district.crossings order,
//    takes pool.splice(Math.floor(rand() * pool.length), 1)[0], where pool is a
//    copy of AVENUE_NAMES for avenues and a copy of CROSSING_NAMES for crossings
//    (one copy each, so no name repeats; one rand stream for both).
export function nameStreets(district, seed) {
  const main = district.avenues[0];
  const names = { [main.id]: 'Main' };
  for (const hand of [44, -44]) {
    const x = counterpartX(hand, district);
    const a = district.avenues.find((v) => v.x === x);
    if (!(a.id in names)) names[a.id] = a.x > main.x ? 'East' : 'West';
  }
  const rand = mulberry32((seed ^ NAME_SALT) >>> 0);
  const avenues = AVENUE_NAMES.slice();
  const crossings = CROSSING_NAMES.slice();
  for (const a of district.avenues) {
    if (!(a.id in names)) names[a.id] = avenues.splice(Math.floor(rand() * avenues.length), 1)[0];
  }
  for (const c of district.crossings) names[c.id] = crossings.splice(Math.floor(rand() * crossings.length), 1)[0];
  return names;
}

const NAMES = worldSeed().generate ? nameStreets(DISTRICTS[0], worldSeed().seed) : {};

// A map's own names, derived once from its district and seed. nameStreets is
// pure but not free, and every lot note asks for a name.
const NAMES_OF = new WeakMap();
function namesOf(map) {
  let names = NAMES_OF.get(map);
  if (!names) {
    names = nameStreets(map.district, map.seed);
    NAMES_OF.set(map, names);
  }
  return names;
}

// The name the player reads for way `w` (an avenue or a crossing): the name the
// map gives it, else its id in title case. A map with lots is a generated plan
// and names its own streets; a map without them is the hand preset, whose ids
// (main, east, west, plaza, south) are already the names on the signs.
export function streetName(w, map = worldMap()) {
  const names = map.lots ? namesOf(map) : NAMES;
  return names[w.id] ?? w.id[0].toUpperCase() + w.id.slice(1);
}
