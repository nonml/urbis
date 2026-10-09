// Roads + seed -> where things stand in a district: the street-wall rows along
// each avenue side, and the zonable lots set into them. One derivation that the
// street wall (render/block.js), zoning and the overlap checker all read, so
// nothing is tuned to one map (docs/PROCGEN.md stages 3 and 5).
//
// It serves generated districts. The hand preset keeps its own tables (ROW_RUNS,
// KEEP_OUT, LOTS) until stage 7 deletes it, so the gate's numbers do not move.
//
// Milestone 2 skeleton: the constants are final, the bodies are stubs that each
// fail their test. tests/layout-*.spec.js define done; docs/tasks/old/m2-layout.json
// hands them out.
//
// Pure sim (law 5): no three.js, no DOM.
import { DISTRICTS, ROAD_HALF_WIDTH, WALKWAY_WIDTH, buildable } from './world.js';
import { worldSeed } from './seedstore.js';
import { BUILD_LINE, PINNED_TOWERS, pinnedBuildings } from './landmarks.js';
import { capsFor } from './vistas.js';
import { mulberry32 } from './rng.js';

// A crossing's carriageway and both its walkways, from its centre-line.
export const CROSSING_BAND = ROAD_HALF_WIDTH + WALKWAY_WIDTH;
// Rows stop this far short of a crossing band and of an avenue's ends; a
// crossing that comes this close to a row's band cuts it.
export const ROW_END_GAP = 2;
// Deepest a row building may run back from the building line (its x size).
export const ROW_DEPTH_MAX = 12;
// The deepest plot a kind may reach back (M4.T5): a yard behind a works shed
// and a back garden behind a suburb house want more room than a row of homes,
// so those kinds take a deeper plot, while the fair share between two avenues
// and the default cap still win. towers and housing keep ROW_DEPTH_MAX.
export const ROW_DEPTH_KIND = { works: 32, suburb: 20 };
// Between two avenues each row stops this short of the halfway line, so the
// backs of facing rows never touch, cornices included.
export const BACK_GAP = 1.5;
// Shallowest a row may be: the narrowest avenue gap citygen makes still allows it.
export const ROW_DEPTH_MIN = 8;
// A row stretch shorter than this stays open: narrower than any real building.
export const MIN_RUN = 6;

// How many lots a district offers, how long each runs along its avenue, and the
// clear strip left between a lot and the row buildings either side of it.
export const LOTS_MIN = 16;
export const LOTS_MAX = 28;
export const LOT_FRONT = [8, 14];
export const LOT_CLEAR = 1;
// Total clearance a pinned tower keeps along its row, as block.js has always cut it.
export const PIN_CLEAR = 1.2;

// How deep the buildings on one avenue side may be: ROW_DEPTH_MAX on a side
// that faces no other avenue; between two avenues, half the gap minus the
// building line and BACK_GAP, capped at ROW_DEPTH_MAX. A kind that keeps a
// yard or a garden behind its building (M4.T5) has its own, deeper cap.
export function rowDepth(district, ax, side) {
  const max = ROW_DEPTH_KIND[district.kind] ?? ROW_DEPTH_MAX;
  const xs = district.avenues.map((a) => a.x).sort((p, q) => p - q);
  const neighbour = xs[xs.indexOf(ax) + side];
  if (neighbour === undefined) return max;
  const fair = Math.abs(neighbour - ax) / 2 - BUILD_LINE - BACK_GAP;
  return Math.min(max, fair);
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
// them, as the hand layout's two interiors do. `pinned` is the map's own table
// (map.pinned); the load-time PINNED_TOWERS is the hand map's fallback until
// M3.T14 deletes it (M3-2).
function pinsOn(district, ax, side, pinned) {
  if (ax !== district.avenues[0].x) return [];
  return pinned.filter((t) => t.side === side)
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

// The box the plan is laid across in z: the box a person may go, never the box a
// car may go. A road op settles the drive box on the graph it leaves (map.js
// M5.T3b, ops.js roadEdit), so a plan read off it would move the moment the
// player builds — the wall the map carries has to stay the one
// planBuildings(map.district, seed) derives from that district, whatever the
// drivable box has grown to since. A generated district and the hand preset
// both give the walk box the drive's own z, so nothing moves today.
function planBox(district) {
  return district.walk ?? district.drive;
}

// The z bands the lots aim for: one equal slice of the plan per lot, so they
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
// falls back to anywhere in the plan box. Tagged with avenue and side for planLayout.
function districtLots(district, seed, pinned) {
  const rand = mulberry32(seed);
  const lo = planBox(district).minZ;
  const hi = planBox(district).maxZ;
  const count = LOTS_MIN + Math.floor(rand() * (LOTS_MAX - LOTS_MIN + 1));
  const sides = district.avenues.flatMap((a) => [-1, 1].map((side) => {
    const depth = rowDepth(district, a.x, side);
    const runs = subtractRuns(rowRuns(district, a.x, side), pinsOn(district, a.x, side, pinned))
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
// district's walk bounds in z, clear of the pinned towers, and never
// overlapping another lot. The same seed always gives the same lots. `pinned`
// is the map's own tower table; omitted, the hand map's PINNED_TOWERS.
export function deriveLots(district, seed, pinned = PINNED_TOWERS) {
  return districtLots(district, seed, pinned).map((p) => p.lot);
}

// Everything the street wall and zoning need: { district, seed, lots, rows },
// carrying the district and seed it was derived from so buildingsOf(plan) needs
// nothing else. lots is deriveLots. rows has one { ax, side, depth, runs } per
// avenue side: rowRuns less each lot widened by LOT_CLEAR and the pinned towers
// (on the first avenue) widened by PIN_CLEAR, with runs under MIN_RUN dropped.
// `pinned` is the map's own tower table; omitted, the hand map's PINNED_TOWERS.
export function planLayout(district, seed, pinned = PINNED_TOWERS) {
  const picked = districtLots(district, seed, pinned);
  const rows = district.avenues.flatMap((a) => [-1, 1].map((side) => {
    const holes = picked.filter((p) => p.ax === a.x && p.side === side)
      .map((p) => [p.lot[1] - p.lot[3] / 2 - LOT_CLEAR, p.lot[1] + p.lot[3] / 2 + LOT_CLEAR])
      .concat(pinsOn(district, a.x, side, pinned));
    const runs = subtractRuns(rowRuns(district, a.x, side), holes)
      .filter(([z0, z1]) => z1 - z0 >= MIN_RUN - EPS);
    return { ax: a.x, side, depth: rowDepth(district, a.x, side), runs };
  }));
  return { district, seed, lots: picked.map((p) => p.lot), rows };
}

// ---------------------------------------------------------------------------
// New frontage (M3.T20). A road op names a dirty box; inside it the rows and
// lots are planned again from the graph as it now stands, while every parcel
// the box does not reach keeps its id. It is districtLots' own geometry — the
// same front range, depth rule and clearances — restricted to one box and
// driven by the graph's edges instead of a district's avenues.

const EDGE_EPS = 1e-6;

// One graph edge as an axis-aligned span. `vert` marks a road along z; `p` is
// its cross coordinate, the varying one runs p..p1.
function edgeSpan(edge, byId) {
  const a = byId.get(edge.a);
  const b = byId.get(edge.b);
  if (!a || !b) return null;
  return {
    id: edge.id,
    vert: Math.abs(a.x - b.x) < EDGE_EPS,
    x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
    z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z),
  };
}

// The depth a lot may take on one side of a span: half the gap to the nearest
// parallel road that overlaps it, less the building line and back gap, capped
// as rowDepth does. A side with no neighbour takes the full ROW_DEPTH_MAX.
function spanDepth(spans, span, side) {
  const coord = span.vert ? span.x0 : span.z0;
  let nearest = null;
  for (const other of spans) {
    if (other === span || other.vert !== span.vert) continue;
    const away = ((other.vert ? other.x0 : other.z0) - coord) * side;
    if (away <= EDGE_EPS) continue;
    const overlaps = span.vert
      ? other.z1 > span.z0 + EDGE_EPS && other.z0 < span.z1 - EDGE_EPS
      : other.x1 > span.x0 + EDGE_EPS && other.x0 < span.x1 - EDGE_EPS;
    if (!overlaps) continue;
    if (nearest === null || away < nearest) nearest = away;
  }
  if (nearest === null) return ROW_DEPTH_MAX;
  return Math.min(ROW_DEPTH_MAX, nearest / 2 - BUILD_LINE - BACK_GAP);
}

// The bands where a crossing road cuts this side's frontage, in the varying
// coordinate: rowRuns' cuts, read from the graph.
function crossingCuts(spans, span, band0, band1) {
  const clear = CROSSING_BAND + ROW_END_GAP;
  const cuts = [];
  for (const other of spans) {
    if (other === span || other.vert === span.vert) continue;
    const lo = span.vert ? other.x0 : other.z0;
    const hi = span.vert ? other.x1 : other.z1;
    if (lo >= band1 + ROW_END_GAP || hi <= band0 - ROW_END_GAP) continue;
    const at = other.vert ? other.x0 : other.z0;
    cuts.push([at - clear, at + clear]);
  }
  return cuts;
}

// The runs left after every footprint already standing in the box is taken
// out, widened by LOT_CLEAR, as planLayout holes out its row runs.
function runsClearOf(runs, blocked, vert, band0, band1) {
  const holes = [];
  for (const b of blocked) {
    const b0 = vert ? b.minX : b.minZ;
    const b1 = vert ? b.maxX : b.maxZ;
    if (b1 + LOT_CLEAR <= band0 || b0 - LOT_CLEAR >= band1) continue;
    holes.push([
      (vert ? b.minZ : b.minX) - LOT_CLEAR,
      (vert ? b.maxZ : b.maxX) + LOT_CLEAR,
    ]);
  }
  return subtractRuns(runs, holes);
}

function lotFootprint(span, side, depth, at, front) {
  const p = (span.vert ? span.x0 : span.z0) + side * (BUILD_LINE + depth / 2);
  return span.vert ? [p, at, depth, front] : [at, p, front, depth];
}

function lotBox([x, z, w, d]) {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

// A stable small hash of an edge id, so one side's front rolls do not depend on
// how many sides came before it.
function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// The style a new row building takes on a span: a row on an avenue keeps the
// avenue's own style; every other frontage (a connector or an op road) is brick,
// the style a back street wears.
function frontageStyle(district, span, at) {
  if (district && span.vert && district.avenues.some((a) => a.x === span.x0)) {
    return rowStyle(district, span.x0, at);
  }
  return BRICK_STYLE;
}

// One row building from a run: the same shape render/block.js draws and
// buildingParcel wraps, sized as planBuildings sizes a row, but named from the
// edge it fronts so its id survives a later op on another tile.
function frontageBuilding(span, side, depth, at, front, h, kind, style) {
  const back = (span.vert ? span.x0 : span.z0) + side * (BUILD_LINE + depth / 2);
  const x = span.vert ? back : at;
  const z = span.vert ? at : back;
  return {
    id: `row:${span.id}:${side}:${at}`,
    kind: 'row', style, facade: kind,
    x, z,
    w: span.vert ? depth : front - 1.2,
    d: span.vert ? front - 1.2 : depth,
    h,
    face: span.vert ? [-side, 0] : [0, -side],
  };
}

// The row buildings one span's free runs take, sized as planBuildings sizes a
// row and drawn from the span's own seeded stream, so one side's plan does not
// depend on how many sides came before it. Every building joins `standing`, so
// a later span cannot plan over it.
function planSpanRows(span, side, depth, runs, seed, district, standing) {
  const buildings = [];
  const rand = mulberry32(seed ^ hashText(`${span.id}:${side}:row`));
  for (const [r0, r1] of runs) {
    let at = r0;
    while (r1 - at >= MIN_RUN) {
      const st = frontageStyle(district, span, at);
      let front = st.front[0] + rand() * (st.front[1] - st.front[0]);
      if (r1 - at - front < MIN_RUN) front = r1 - at;
      const h = Math.round(st.h[0] + rand() * (st.h[1] - st.h[0]));
      const kind = st.kinds[Math.floor(rand() * st.kinds.length)];
      const w = Math.min(10 + rand() * 2, depth);
      const b = frontageBuilding(span, side, w, at + front / 2, front, h, kind, st.name);
      buildings.push(b);
      standing.push(lotBox([b.x, b.z, b.w, b.d]));
      at += front;
    }
  }
  return buildings;
}

// Plan the rows and lots a road op leaves in its dirty box. `edges` and `nodes`
// are the map graph as it now stands; `box` the op's dirty box; `blocked` every
// footprint already standing there (a lot or row that stays in the plan keeps
// its own footprint in this list, so it is never planned twice); `seed` the
// map's; `district` styles the new rows. Each lot and row is named from the edge
// it fronts, so the id does not depend on how many ops ran before, and the same
// graph always plans the same frontage. `rows` carries the new row runs and
// `buildings` the row buildings cut from them, in the shape buildingParcel
// wraps.
export function planNewFrontage(edges, nodes, box, blocked, seed, district) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const spans = edges.map((e) => edgeSpan(e, byId)).filter(Boolean);
  const standing = blocked.slice();
  const rows = [];
  const lots = [];
  const buildings = [];
  for (const span of spans) {
    if (span.x1 < box.minX - EDGE_EPS || span.x0 > box.maxX + EDGE_EPS
      || span.z1 < box.minZ - EDGE_EPS || span.z0 > box.maxZ + EDGE_EPS) continue;
    for (const side of [-1, 1]) {
      const depth = spanDepth(spans, span, side);
      if (depth < ROW_DEPTH_MIN) continue;
      const lo = Math.max(span.vert ? span.z0 : span.x0, span.vert ? box.minZ : box.minX);
      const hi = Math.min(span.vert ? span.z1 : span.x1, span.vert ? box.maxZ : box.maxX);
      if (hi - lo < MIN_RUN) continue;
      const band0 = (span.vert ? span.x0 : span.z0) + side * BUILD_LINE;
      const band1 = band0 + side * depth;
      const b0 = Math.min(band0, band1);
      const b1 = Math.max(band0, band1);
      const pb0 = span.vert ? box.minX : box.minZ;
      const pb1 = span.vert ? box.maxX : box.maxZ;
      // A lot must stand wholly on the op's tiles: a side whose depth reaches
      // past the box is left open rather than planned half outside it.
      if (b0 < pb0 - EDGE_EPS || b1 > pb1 + EDGE_EPS) continue;
      const runs = runsClearOf(
        subtractRuns([[lo, hi]], crossingCuts(spans, span, b0, b1)), standing, span.vert, b0, b1,
      ).filter(([z0, z1]) => z1 - z0 >= MIN_RUN - EDGE_EPS);
      if (!runs.length) continue;
      const state = { runs, placed: [] };
      const rand = mulberry32(seed ^ hashText(`${span.id}:${side}`));
      for (let guard = 0; guard < 64; guard++) {
        const front = LOT_FRONT[0] + rand() * (LOT_FRONT[1] - LOT_FRONT[0]);
        const ranges = lotRanges(state, front, -Infinity, Infinity);
        if (!ranges.length) break;
        const at = ranges[0][0];
        state.placed.push({ z: at, d: front });
        const lot = lotFootprint(span, side, depth, at, front);
        lots.push({ id: `lot:${span.id}:${side}:${at}`, lot });
        standing.push(lotBox(lot));
      }
      const holes = state.placed.map((p) => [p.z - p.d / 2 - LOT_CLEAR, p.z + p.d / 2 + LOT_CLEAR]);
      const free = subtractRuns(runs, holes).filter(([z0, z1]) => z1 - z0 >= MIN_RUN - EDGE_EPS);
      rows.push({ edge: span.id, side, depth, runs: free });
      buildings.push(...planSpanRows(span, side, depth, free, seed, district, standing));
    }
  }
  return { rows, lots, buildings };
}

// The style of the buildings on one row, read from the district plan: the
// avenue's place in the district's own order and the building's distance from
// the district's first crossing. Nothing here knows the hand map's coordinates
// (ax === 0 && z < 40) — a generated district styles itself from its plan.
// `kinds` index render/block.js's tower materials; `front` is the frontage
// range in metres, `h` the height range.
const CORE_REACH = 45;
const CORE_STYLE = { name: 'core', kinds: [0, 1, 2, 5], h: [28, 52], front: [12, 20] };
const TOWER_STYLE = { name: 'tower', kinds: [2, 3, 5], h: [18, 36], front: [9, 16] };
const GLASS_STYLE = { name: 'glass', kinds: [1, 2, 4, 5], h: [18, 40], front: [9, 16] };
const BRICK_STYLE = { name: 'brick', kinds: [3, 4, 2], h: [12, 26], front: [7, 13] };
const STYLE_BY_NAME = Object.fromEntries(
  [CORE_STYLE, TOWER_STYLE, GLASS_STYLE, BRICK_STYLE].map((s) => [s.name, s]));

export function rowStyle(district, ax, z) {
  const order = district.avenues.findIndex((a) => a.x === ax);
  const first = district.crossings[0];
  if (order === 0 && first && Math.abs(z - first.z) <= CORE_REACH) return CORE_STYLE;
  if (order === 0) return TOWER_STYLE;
  if (order === district.avenues.length - 1) return GLASS_STYLE;
  return BRICK_STYLE;
}

// ---------------------------------------------------------------------------
// Per-kind buildings (M4.T5). A cell's kind (citygen.KIND_SPECS) decides how
// its frontage fills: housing runs mid-rise terraces, works wide sheds on deep
// plots, suburb detached houses with side and back gardens. towers is absent
// on purpose — a towers cell keeps rowStyle's wall of today, so the hand map
// and the generated downtown do not move. Every footprint asks buildable
// (M4.T2) before it is placed — the ground's water and gradient verdict — so a
// footprint the terrain refuses is left as open frontage.

// front: metres along the avenue; depth: metres back from the building line
// (the rest of the plot stays behind); gap: metres between neighbours (the
// side garden of a house, the yard strip of a shed); styles/h: what a cell
// falls back to if citygen carried none.
const KIND_BUILD = {
  housing: { front: [8, 14], depth: [9, 12], gap: [0, 0], styles: ['brick', 'tower'], h: [10, 26] },
  works: { front: [20, 36], depth: [10, 16], gap: [1.5, 1.5], styles: ['brick'], h: [7, 16] },
  suburb: { front: [9, 13], depth: [7, 9], gap: [4, 9], styles: ['brick'], h: [6, 12] },
};

// The row-style fields one kinded building wears: a name from the district's
// own style list and its own height range (citygen, M4.T4) when it has them,
// the kind's frontage, and the facade pool of the named style. Kindless
// districts never reach here — they keep rowStyle, untouched.
function kindStyle(district, shape, rand) {
  const names = district.styles ?? shape.styles;
  const name = names[Math.floor(rand() * names.length)];
  return {
    ...(STYLE_BY_NAME[name] ?? BRICK_STYLE), name,
    front: shape.front, h: district.heights ?? shape.h,
  };
}

// One value from a [low, high] range, a fixed number when both ends match.
function rollRange(range, rand) {
  return range[0] + rand() * (range[1] - range[0]);
}

// Each row in the plan cut into the buildings the street wall draws:
// { ax, side, z, d, w, h, kind, style } — d the party-walled front along the
// row, w the depth back from the building line, h the height, kind a facade
// architecture, style the district style a use comes from. Same district and
// seed always give the same wall. `plan` defaults to the district's own;
// a caller that already holds it (WORLD_BUILDINGS) never derives it twice.
export function planBuildings(district, seed, plan = planLayout(district, seed)) {
  const rand = mulberry32(seed);
  const shape = KIND_BUILD[district.kind] ?? null;
  const out = [];
  for (const row of plan.rows) {
    for (const [r0, r1] of row.runs) {
      let at = r0;
      while (r1 - at >= MIN_RUN) {
        const st = shape ? kindStyle(district, shape, rand) : rowStyle(district, row.ax, at);
        let front = st.front[0] + rand() * (st.front[1] - st.front[0]);
        if (r1 - at - front < MIN_RUN) front = r1 - at;
        const h = Math.round(st.h[0] + rand() * (st.h[1] - st.h[0]));
        const kind = st.kinds[Math.floor(rand() * st.kinds.length)];
        const deep = shape ? rollRange(shape.depth, rand) : 10 + rand() * 2;
        const w = Math.min(deep, row.depth);
        const z = at + front / 2;
        const d = front - 1.2;
        const x = row.ax + row.side * (BUILD_LINE + w / 2);
        if (buildable(x, z, w, d).ok) out.push({ ax: row.ax, side: row.side, z, d, w, h, kind, style: st.name });
        at += front + (shape ? rollRange(shape.gap, rand) : 0);
      }
    }
  }
  return out;
}

// A row building in buildingsOf's shape: x out from the building line, the front
// facing the avenue.
function rowBuilding(b) {
  return {
    id: `row:${b.ax}:${b.side}:${b.z}`, kind: 'row', style: b.style, facade: b.kind,
    x: b.ax + b.side * (BUILD_LINE + b.w / 2), z: b.z, w: b.w, d: b.d, h: b.h, face: [-b.side, 0],
  };
}

// Every building the world draws as one list with one shape:
// { id, kind, style, facade, x, z, w, d, h, face } — kind row | tower | cap,
// style the district style a use comes from (rows), facade the architecture
// render/block.js pools, x/z/w/d the footprint, h the height, face the front.
// `plan` is planLayout's; plan.pinned and plan.caps override the world's own,
// so a map built for another seed uses that seed's towers and caps.
export function buildingsOf(plan) {
  const caps = plan.caps ?? capsFor(plan.district, plan.seed);
  return [
    ...pinnedBuildings(plan.district, plan.pinned),
    ...planBuildings(plan.district, plan.seed, plan).map(rowBuilding),
    ...caps,
  ];
}

// The plan of the world this game booted, which the street wall, zoning and the
// checker all read so they can never disagree: generated games only, null on the
// hand preset. Keyed on the world seed, never on a caller's.
export const WORLD_PLAN = worldSeed().generate ? planLayout(DISTRICTS[0], worldSeed().seed) : null;

// The street wall of the world this game booted: render/block.js draws exactly
// this, generated games only. Null on the hand preset, which keeps its own
// tables until stage 7 deletes it (M3.T13).
export const WORLD_BUILDINGS = WORLD_PLAN
  ? planBuildings(DISTRICTS[0], worldSeed().seed, WORLD_PLAN)
  : null;

// Re-exported so tests and the checker reason in the same units as the plan.
export { BUILD_LINE, PINNED_TOWERS };
