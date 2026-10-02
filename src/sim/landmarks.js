// The hand-placed landmarks the interiors hang off: the two main-avenue towers
// the noodle bar and the roof are built into. A generated city derives these
// from world data and the seed (docs/PROCGEN.md stage 6); until then this is the
// one table both the street wall and the interior frames read, so no coordinate
// a placement change would invalidate is hand-copied anywhere else.
//
// Pure sim (law 5): no three.js, no DOM.
import { AVENUES, AVENUE_X, CROSSINGS, ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';
import { worldSeed } from './seedstore.js';

// Shaft face of every avenue row, metres from the avenue centre-line. The
// podium stands 0.6 m proud of it, so the shopfronts meet the walkway edge.
export const BUILD_LINE = 7.5;

// The two main-avenue towers the interiors are built into. The roof is idx 0
// and the noodle bar idx 1, as before, so their facades and shopfronts do not
// change. All stand on AVENUE_X[0]; side -1 is west. This is where they stand
// on the hand preset, and where a generated world tries them first.
export const HAND_PINNED = [
  { id: 'roof', side: -1, z: -48, w: 12, h: 34, d: 10 },
  { id: 'ramen', side: -1, z: -14, w: 14, h: 44, d: 11 },
];

// A pinned tower keeps this much clear of a crossing's road-and-walkway band, of
// its avenue's ends, and of the other pinned tower.
export const PIN_GAP = 1.2;
export const PIN_BAND = ROAD_HALF_WIDTH + WALKWAY_WIDTH;

// Where the pinned towers stand on a generated world: the same towers, only z
// may change. Towers are placed in table order. A tower keeps its hand z when its
// footprint (z - d / 2 to z + d / 2) stays PIN_GAP clear of every crossing band
// (c.z +- PIN_BAND), of the avenue's z0 and z1, and of every tower already
// placed; otherwise it takes the nearest z on the half-metre grid that does,
// trying hand z - 0.5, hand z + 0.5, hand z - 1, ... in that order.
// Milestone 2 skeleton: a stub with its test in tests/pinned-place.todo.js.
export function placePinned(hand, avenue, crossings) {
  void avenue;
  void crossings;
  return hand.map((t) => ({ ...t }));
}

export const PINNED_TOWERS = worldSeed().generate ? placePinned(HAND_PINNED, AVENUES[0], CROSSINGS) : HAND_PINNED;

// Where a tower's shaft centre stands: out from the avenue centre-line by the
// building line plus half the shaft width, on the tower's own side.
export function towerCentreX(t) {
  return AVENUE_X[0] + t.side * (BUILD_LINE + t.w / 2);
}
