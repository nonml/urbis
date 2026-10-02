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
import { mulberry32 } from './rng.js';

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

const EPS = 1e-6;
// The pinned towers that stand on one avenue side, widened by PIN_CLEAR into
// the z spans a lot may not cross. Only the district's first avenue carries
// them, as the hand layout's two interiors do.
function pinsOn(district, ax, side) {
  if (ax !== district.avenues[0].x) return [];
  return PINNED_TOWERS.filter((t) => t.side === side)
    .map((t) => [t.z - (t.d + PIN_CLEAR) / 2, t.z + (t.d + PIN_CLEAR) / 2]);
}

// Sorted [z0, z1] runs less every hole, so the two never overlap by more than EPS.
function subtractRuns(runs, holes) {
  let out = runs.map(([z0, z1]) => [z0, z1]);
  for (const [h0, h1] of holes) {
    const next = [];
    for (const [r0, r1] of out) {
      if (h1 <= r0 + EPS || h0 >= r1 - EPS) { next.push([r0, r1]); continue; }
      if (h0 > r0 + EPS) next.push([r0, h0]);
      if (h1 < r1 - EPS) next.push([h1, r1]);
    }
    out = next;
  }
  return out;
}

// The gap a lot keeps to the next lot on its row: room for a building's
// MIN_RUN between them, plus each lot's own clear strip.
const LOT_GAP = MIN_RUN + 2 * LOT_CLEAR;

// The z bands the lots aim for: one equal slice of the drive per lot, so they
// reach across the whole district instead of packing into the south end.
function lotBands(lo, hi, count) {
  const span = hi - lo;
  return Array.from({ length: count }, (_, k) => [lo + (k * span) / count, lo + ((k + 1) * span) / count]);
}

// The [z0, z1] centre ranges a lot of front d may take inside [w0, w1] on one
// side: inside a single row run, and LOT_GAP from every lot already on that row.
function lotRanges(side, d, w0, w1) {
  const ranges = [];
  for (const [r0, r1] of side.runs) {
    let segs = [[Math.max(r0 + d / 2, w0), Math.min(r1 - d / 2, w1)]];
    for (const p of side.placed) {
      const away = (d + p.d) / 2 + LOT_GAP - EPS;
      const next = [];
      for (const [a, b] of segs) {
        if (a > b + EPS) continue;
        if (p.z + away <= a + EPS || p.z - away >= b - EPS) { next.push([a, b]); continue; }
        if (p.z - away > a + EPS) next.push([a, p.z - away]);
        if (p.z + away < b - EPS) next.push([p.z + away, b]);
      }
      segs = next;
    }
    for (const [a, b] of segs) if (b >= a - EPS) ranges.push([a, b]);
  }
  return ranges;
}

// Place one lot with its centre inside [w0, w1]: a random avenue side, a random
// front, then a random z inside the ranges that side still offers. Null when no
// side has room there.
function placeLot(sides, [w0, w1], rand) {
  const order = sides.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const spots = [];
  for (const side of order) {
    const d = LOT_FRONT[0] + rand() * (LOT_FRONT[1] - LOT_FRONT[0]);
    for (const [a, b] of lotRanges(side, d, w0, w1)) spots.push({ side, d, a, b });
  }
  if (!spots.length) return null;
  const spot = spots[Math.floor(rand() * spots.length)];
  const z = spot.a + rand() * (spot.b - spot.a);
  const { ax, side, depth } = spot.side;
  const lot = [ax + side * (BUILD_LINE + depth / 2), z, depth, spot.d];
  spot.side.placed.push({ z, d: spot.d });
  return { lot, ax, side, depth };
}

// One pass over every avenue side: the side's free z runs, then one lot per
// band so the lots spread across the district. A band with no room on any side
// falls back to anywhere in the drive. Tagged with avenue and side for planLayout.
function districtLots(district, seed) {
  const rand = mulberry32(seed);
  const lo = district.drive.minZ;
  const hi = district.drive.maxZ;
  const count = LOTS_MIN + Math.floor(rand() * (LOTS_MAX - LOTS_MIN + 1));
  const sides = district.avenues.flatMap((a) => [-1, 1].map((side) => {
    const depth = rowDepth(district, a.x, side);
    const runs = subtractRuns(rowRuns(district, a.x, side), pinsOn(district, a.x, side))
      .map(([f0, f1]) => [Math.max(f0, lo), Math.min(f1, hi)])
      .filter(([f0, f1]) => f1 - f0 > EPS);
    return { ax: a.x, side, depth, runs, placed: [] };
  }));
  const picked = [];
  for (const band of lotBands(lo, hi, count)) {
    const spot = placeLot(sides, band, rand) || placeLot(sides, [lo, hi], rand);
    if (spot) picked.push(spot);
  }
  return picked;
}

// The district's lots, as [x, z, w, d] like zoning's LOTS: LOTS_MIN..LOTS_MAX of
// them from the seed, each on one avenue side's building line, rowDepth deep,
// a LOT_FRONT long inside one of that side's rowRuns, wholly inside the
// district's drive bounds in z, clear of the pinned towers, and never
// overlapping another lot. The same seed always gives the same lots.
export function deriveLots(district, seed) {
  return districtLots(district, seed).map((p) => p.lot);
}

// Everything the street wall and zoning need: { lots, rows }. lots is
// deriveLots. rows has one { ax, side, depth, runs } per avenue side, where runs
// are that side's rowRuns less each of its lots widened by LOT_CLEAR, less the
// pinned towers (on the district's first avenue) widened by PIN_CLEAR, with
// runs shorter than MIN_RUN dropped.
export function planLayout(district, seed) {
  const picked = districtLots(district, seed);
  const rows = district.avenues.flatMap((a) => [-1, 1].map((side) => {
    const holes = picked.filter((p) => p.ax === a.x && p.side === side)
      .map((p) => [p.lot[1] - p.lot[3] / 2 - LOT_CLEAR, p.lot[1] + p.lot[3] / 2 + LOT_CLEAR])
      .concat(pinsOn(district, a.x, side));
    const runs = subtractRuns(rowRuns(district, a.x, side), holes)
      .filter(([z0, z1]) => z1 - z0 >= MIN_RUN - EPS);
    return { ax: a.x, side, depth: rowDepth(district, a.x, side), runs };
  }));
  return { lots: picked.map((p) => p.lot), rows };
}

// The plan of the world this game booted, which the street wall, zoning and the
// checker all read so they can never disagree: generated games only, null on the
// hand preset. Keyed on the world seed, never on a caller's.
export const WORLD_PLAN = worldSeed().generate ? planLayout(DISTRICTS[0], worldSeed().seed) : null;

// Re-exported so tests and the checker reason in the same units as the plan.
export { BUILD_LINE, PINNED_TOWERS };
