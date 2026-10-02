// What the player calls a generated world's streets. The hand preset's ways are
// named by their ids (Main, East, West, Plaza, South); a generated world's ids are
// av0, cr1 and so on, which must never reach the screen. Its main avenue is Main,
// the avenues that play the hand map's east and west avenues (sim/anchors.js) are
// East or West by which side of Main they lie on, and every other avenue and
// every crossing takes a name from the pools below, by the seed.
// Pure (law 5): sim/decline.js reads streetName for lot addresses.
//
// Milestone 2 skeleton: the pools and the salt are final; nameStreets is a stub
// with its test in tests/streetnames.todo.js.
import { DISTRICTS } from './world.js';
import { worldSeed } from './seedstore.js';
import { counterpartX } from './anchors.js';
import { mulberry32 } from './rng.js';

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
  void district;
  void seed;
  return {};
}

const NAMES = worldSeed().generate ? nameStreets(DISTRICTS[0], worldSeed().seed) : {};

// The name the player reads for way `w` (an avenue or a crossing): its generated
// name, else its id in title case.
export function streetName(w) {
  return NAMES[w.id] ?? w.id[0].toUpperCase() + w.id.slice(1);
}
