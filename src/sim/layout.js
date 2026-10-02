// Roads + seed -> where things stand in a district: the street-wall rows along
// each avenue side, and the zonable lots set into them. One derivation that the
// street wall (render/block.js), zoning and the overlap checker all read, so
// nothing is tuned to one map (docs/PROCGEN.md stages 3 and 5).
//
// It serves generated districts. The hand preset keeps its own tables (ROW_RUNS,
// KEEP_OUT, LOTS) until stage 7 deletes it, so the gate's numbers do not move.
//
// Milestone 2 skeleton: the constants are final, the bodies are stubs that each
// fail their test. tests/layout-*.spec.js define done; docs/tasks/m2-layout.json
// hands them out.
//
// Pure sim (law 5): no three.js, no DOM.
import { DISTRICTS, ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';
import { worldSeed } from './seedstore.js';
import { BUILD_LINE, PINNED_TOWERS } from './landmarks.js';

// A crossing's carriageway and both its walkways, from its centre-line.
export const CROSSING_BAND = ROAD_HALF_WIDTH + WALKWAY_WIDTH;
// Rows stop this far short of a crossing band and of an avenue's ends; a
// crossing that comes this close to a row's band cuts it.
export const ROW_END_GAP = 2;
// Deepest a row building may run back from the building line (its x size).
export const ROW_DEPTH_MAX = 12;
// Between two avenues each row stops this short of the halfway line, so the
// backs of facing rows never touch, cornices included.
export const BACK_GAP = 1.5;
// Shallowest a row may be: the narrowest avenue gap citygen makes still allows it.
export const ROW_DEPTH_MIN = 8;
// A row stretch shorter than this stays open: narrower than any real building.
export const MIN_RUN = 6;

// How many lots a district offers, how long each runs along its avenue, and the
// clear strip left between a lot and the row buildings either side of it.
export const LOTS_MIN = 6;
export const LOTS_MAX = 12;
export const LOT_FRONT = [8, 14];
export const LOT_CLEAR = 1;
// Total clearance a pinned tower keeps along its row, as block.js has always cut it.
export const PIN_CLEAR = 1.2;

// How deep the buildings on one avenue side may be: ROW_DEPTH_MAX on a side
// that faces no other avenue; between two avenues, half the gap minus the
// building line and BACK_GAP, capped at ROW_DEPTH_MAX.
export function rowDepth(district, ax, side) {
  const xs = district.avenues.map((a) => a.x).sort((p, q) => p - q);
  const neighbour = xs[xs.indexOf(ax) + side];
  if (neighbour === undefined) return ROW_DEPTH_MAX;
  const fair = Math.abs(neighbour - ax) / 2 - BUILD_LINE - BACK_GAP;
  return Math.min(ROW_DEPTH_MAX, fair);
}

// Where a row may stand on one avenue side, as sorted [z0, z1] runs: the
// avenue's length less ROW_END_GAP at each end, less every crossing that comes
// within ROW_END_GAP of the row's band (x from the building line back by
// rowDepth), cut ROW_END_GAP wider than its CROSSING_BAND. Runs shorter than
// MIN_RUN are dropped.
export function rowRuns(district, ax, side) {
  const depth = rowDepth(district, ax, side);
  const near = ax + side * BUILD_LINE;
  const far = ax + side * (BUILD_LINE + depth);
  const bx0 = Math.min(near, far);
  const bx1 = Math.max(near, far);
  const clear = CROSSING_BAND + ROW_END_GAP;
  const cuts = district.crossings
    .filter((c) => c.x0 < bx1 + ROW_END_GAP && c.x1 > bx0 - ROW_END_GAP)
    .map((c) => [c.z - clear, c.z + clear])
    .sort((p, q) => p[0] - q[0]);
  const avenue = district.avenues.find((a) => a.x === ax);
  const end = avenue.z1 - ROW_END_GAP;
  const runs = [];
  let cursor = avenue.z0 + ROW_END_GAP;
  for (const [cz0, cz1] of cuts) {
    const stop = Math.min(cz0, end);
    if (stop - cursor >= MIN_RUN) runs.push([cursor, stop]);
    cursor = Math.max(cursor, cz1);
  }
  if (end - cursor >= MIN_RUN) runs.push([cursor, end]);
  return runs;
}

// The district's lots, as [x, z, w, d] like zoning's LOTS: LOTS_MIN..LOTS_MAX of
// them from the seed, each on one avenue side's building line, rowDepth deep,
// a LOT_FRONT long inside one of that side's rowRuns, wholly inside the
// district's drive bounds in z, clear of the pinned towers, and never
// overlapping another lot. The same seed always gives the same lots.
export function deriveLots(district, seed) {
  return [];
}

// Everything the street wall and zoning need: { lots, rows }. lots is
// deriveLots. rows has one { ax, side, depth, runs } per avenue side, where runs
// are that side's rowRuns less each of its lots widened by LOT_CLEAR, less the
// pinned towers (on the district's first avenue) widened by PIN_CLEAR, with
// runs shorter than MIN_RUN dropped.
export function planLayout(district, seed) {
  return { lots: [], rows: [] };
}

// The plan of the world this game booted, which the street wall, zoning and the
// checker all read so they can never disagree: generated games only, null on the
// hand preset. Keyed on the world seed, never on a caller's.
export const WORLD_PLAN = worldSeed().generate ? planLayout(DISTRICTS[0], worldSeed().seed) : null;

// Re-exported so tests and the checker reason in the same units as the plan.
export { BUILD_LINE, PINNED_TOWERS };
