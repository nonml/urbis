// The hand-placed landmarks the interiors hang off: the two main-avenue towers
// the noodle bar and the roof are built into. A generated city derives these
// from world data and the seed (docs/PROCGEN.md stage 6); until then this is the
// one table both the street wall and the interior frames read, so no coordinate
// a placement change would invalidate is hand-copied anywhere else.
//
// Pure sim (law 5): no three.js, no DOM.
import { AVENUES, AVENUE_X, CROSSINGS, ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';
import { worldSeed } from './seedstore.js';
import { planTown } from './townplan.js';
import { waterBlocked } from './terrain.js';

// The town's water for a seed, as terrain's [cx, cz, hw, hd] rects: map.water,
// derived without building the map, so a plan that runs before it (layout,
// dressing, the pinned towers) keeps off the same river the map carries (M4-2).
export function riverWater(seed) {
  return planTown(seed).river.rects;
}

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
// trying hand z - 0.5, hand z + 0.5, hand z - 1, ... in that order. A tower
// never stands on water or in its setback (M4.T8c): a z the river reaches is
// not free.
// A tower at z clears the span z0..z1 (already widened by whatever gap the
// caller owes) when its footprint sits entirely outside it.
function clearOf(t, z, z0, z1) {
  return z + t.d / 2 <= z0 || z - t.d / 2 >= z1;
}

function isFree(t, z, placed, avenue, crossings, water) {
  if (z - t.d / 2 < avenue.z0 + PIN_GAP) return false;
  if (z + t.d / 2 > avenue.z1 - PIN_GAP) return false;
  for (const c of crossings) {
    if (!clearOf(t, z, c.z - PIN_BAND - PIN_GAP, c.z + PIN_BAND + PIN_GAP)) return false;
  }
  for (const u of placed) {
    if (!clearOf(t, z, u.z - u.d / 2 - PIN_GAP, u.z + u.d / 2 + PIN_GAP)) return false;
  }
  return !waterBlocked(water, towerCentreX(t, avenue.x), z, t.w, t.d);
}

// hand z first, then hand z - 0.5, hand z + 0.5, hand z - 1, ... — nearest first.
function nearestFreeZ(t, placed, avenue, crossings, water) {
  if (isFree(t, t.z, placed, avenue, crossings, water)) return t.z;
  const span = avenue.z1 - avenue.z0;
  for (let n = 1; n <= span * 2; n++) {
    const step = Math.ceil(n / 2) * 0.5;
    const z = t.z + (n % 2 === 1 ? -step : step);
    if (isFree(t, z, placed, avenue, crossings, water)) return z;
  }
  throw new Error(`landmarks: no free z for ${t.id}`);
}

export function placePinned(hand, avenue, crossings, water = []) {
  const placed = [];
  for (const t of hand) {
    placed.push({ ...t, z: nearestFreeZ(t, placed, avenue, crossings, water) });
  }
  return placed;
}

export const PINNED_TOWERS = worldSeed().generate
  ? placePinned(HAND_PINNED, AVENUES[0], CROSSINGS, riverWater(worldSeed().seed))
  : HAND_PINNED;

// Where a tower's shaft centre stands: out from its avenue centre-line by the
// building line plus half the shaft width. `ax` lets a generated map use its own.
export function towerCentreX(t, ax = AVENUE_X[0]) {
  return ax + t.side * (BUILD_LINE + t.w / 2);
}

// The pinned towers in buildingsOf's shape (layout.js): id from the interior
// they carry, x from their avenue, the front facing it. style is null — they
// have no district style; facade is the architecture block.js draws them at.
// The towers default to the district's own placement, so a map built for
// another district never reads the booted world's PINNED_TOWERS table (M3-2).
export function pinnedBuildings(district, towers = placePinned(HAND_PINNED, district.avenues[0], district.crossings)) {
  const ax = district.avenues[0].x;
  return towers.map((t, i) => ({
    id: `tower:${t.id}`, kind: 'tower', style: null, facade: i % 6,
    x: towerCentreX(t, ax), z: t.z, w: t.w, d: t.d, h: t.h, face: [-t.side, 0],
  }));
}
