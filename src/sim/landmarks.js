// The hand-placed landmarks the interiors hang off: the two main-avenue towers
// the noodle bar and the roof are built into. A generated city derives these
// from world data and the seed (docs/PROCGEN.md stage 6); until then this is the
// one table both the street wall and the interior frames read, so no coordinate
// a placement change would invalidate is hand-copied anywhere else.
//
// Pure sim (law 5): no three.js, no DOM.
import { AVENUE_X } from './world.js';

// Shaft face of every avenue row, metres from the avenue centre-line. The
// podium stands 0.6 m proud of it, so the shopfronts meet the walkway edge.
export const BUILD_LINE = 7.5;

// The two main-avenue towers the interiors are built into. The roof is idx 0
// and the noodle bar idx 1, as before, so their facades and shopfronts do not
// change. All stand on AVENUE_X[0]; side -1 is west.
export const PINNED_TOWERS = [
  { id: 'roof', side: -1, z: -48, w: 12, h: 34, d: 10 },
  { id: 'ramen', side: -1, z: -14, w: 14, h: 44, d: 11 },
];

// Where a tower's shaft centre stands: out from the avenue centre-line by the
// building line plus half the shaft width, on the tower's own side.
export function towerCentreX(t) {
  return AVENUE_X[0] + t.side * (BUILD_LINE + t.w / 2);
}
