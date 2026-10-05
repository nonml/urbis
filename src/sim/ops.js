// What the player builds: edits on the map (M3.T18). Three building ops — zone,
// bulldoze and place — each acts on one parcel, bumps map.version, marks the
// 64 m tiles the parcel's footprint touches and returns its own undo. The undo
// restores the parcel and the version and leaves the same tiles dirty, so a run
// of ops can be walked backwards to the map it started on (M3-4).
//
// The road ops (M3.T19) work the same way on the graph: addRoad cuts the new
// road and every edge it crosses at each junction, removeRoad takes one edge
// out, and both re-check the frontage of the parcels the road touched — one
// with no road in reach takes `noRoad` (map.js FRONTAGE_MAX).
//
// An op is pure logic on the map (law 5) and deterministic given its state, so
// the save's op log (M3.T38) replays.
import {
  STAGE, STAGES, USES, USE_BY_KIND, frontageRoad, markDirty, projectOnSegment,
} from './map.js';
import { BUILD_LINE, ROW_DEPTH_MAX, planNewFrontage } from './layout.js';

// A placed building is sized from its footprint with the rule the city rolls
// for a lot (zoning.js makeParcel): three storeys at the least, slender enough
// to stand, inside the band the shipped towers use. The roll's jitter is left
// out — an op is deterministic. The stage profile lets a later bulldoze step
// the height down a stage at a time instead of holding the top until it goes
// (M5-2).
const STOREY = 3.5;
const LOW_HEIGHT = 3 * STOREY;
const SLENDERNESS = 3.6;
const TOP_MIN = 22;
const TOP_MAX = 46;
const MID_SHARE = 0.45;

function topFor(w, d) {
  return Math.min(TOP_MAX, Math.max(TOP_MIN, Math.min(w, d) * SLENDERNESS));
}

function stagedHeights(top) {
  return [0, 0, LOW_HEIGHT, LOW_HEIGHT + (top - LOW_HEIGHT) * MID_SHARE, top];
}

// A parcel by object (the live city's own entry), index or id.
function parcelOf(map, ref) {
  if (typeof ref === 'number') return map.parcels[ref] ?? null;
  if (ref && typeof ref === 'object' && map.parcels.includes(ref)) return ref;
  const id = ref && typeof ref === 'object' ? ref.id : ref;
  return map.parcels.find((p) => p.id === id) ?? null;
}

function parcelBox(p) {
  return { minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 };
}

// Undo histories live beside the maps, keyed weakly, so the map itself carries
// only game state: mapHash must not see a log of how it got there.
const HISTORY = new WeakMap();

function history(map) {
  let stack = HISTORY.get(map);
  if (!stack) {
    stack = [];
    HISTORY.set(map, stack);
  }
  return stack;
}

const NOOP = () => {};

// The whole parcel as an undo needs it, `heights` by value: an op that edits
// the profile in place must not change the snapshot taken before it.
function snapshot(p) {
  return Array.isArray(p.heights) ? { ...p, heights: p.heights.slice() } : { ...p };
}

// Apply one change as an edit: snapshot the parcel, bump the version, mark the
// touched tiles and return the closure that puts all three back.
function edit(map, p, change) {
  const before = snapshot(p);
  const version = map.version;
  change(p);
  map.version = version + 1;
  markDirty(map, parcelBox(p));
  const reverse = () => {
    for (const key of Object.keys(p)) delete p[key];
    Object.assign(p, before);
    map.version = version;
    markDirty(map, parcelBox(p));
  };
  history(map).push(reverse);
  return reverse;
}

// Zone a parcel's land the way the city view does: the lot answers over the
// ticks that follow (zoning.js clearLot/growth), it does not change here. `use`
// null unzones. Any parcel can be zoned; only a lot grows by itself.
export function zone(map, ref, use) {
  const p = parcelOf(map, ref);
  if (!p || (use !== null && !USES.includes(use)) || p.zoned === use) return NOOP;
  return edit(map, p, (q) => {
    q.zoned = use;
    if (use !== null) q.painted = true;
  });
}

// One stage down, the step clearLot takes over time: a finished tower becomes
// MID, then LOW, then a SITE, and at EMPTY its land is an empty lot keeping the
// use its zoning last named. A lot's profile already steps; a standing
// building's flat one is restaged so its height follows it down.
export function bulldoze(map, ref) {
  const p = parcelOf(map, ref);
  if (!p || p.stage === STAGE.EMPTY) return NOOP;
  return edit(map, p, (q) => {
    if (q.kind !== 'lot' && q.heights[STAGE.LOW] === q.heights[STAGE.HIGH]) {
      q.heights = stagedHeights(q.heights[STAGE.HIGH] > 0 ? q.heights[STAGE.HIGH] : topFor(q.w, q.d));
    }
    q.stage -= 1;
    q.progress = 0;
    q.building = q.stage > STAGE.EMPTY;
    if (q.stage === STAGE.EMPTY) {
      q.kind = 'lot';
      q.use = q.zoned;
    }
  });
}

// A finished building of `kind` on a parcel: it stands at HIGH, keeps the
// parcel's own top height (or takes one from its footprint) and carries the
// use its kind names. The empty lot is bulldoze's job, so 'lot' is refused.
export function place(map, kind, ref) {
  const p = parcelOf(map, ref);
  if (!p || typeof kind !== 'string' || !kind || kind === 'lot') return NOOP;
  const top = p.heights[STAGE.HIGH] > 0 ? p.heights[STAGE.HIGH] : topFor(p.w, p.d);
  return edit(map, p, (q) => {
    q.kind = kind;
    q.stage = STAGE.HIGH;
    q.progress = 0;
    q.building = false;
    q.heights = stagedHeights(top);
    q.use = USE_BY_KIND[kind] ?? USES[0];
    q.zoned = q.use;
    q.painted = false;
  });
}

// ---------------------------------------------------------------------------
// Road ops (M3.T19). Roads run straight along one axis on the half-metre grid
// (D2), so `axis` is the coordinate that varies: 'x' for an east-west road,
// 'z' for a north-south one. A laid road is kind 'street'; every piece cut out
// of an existing edge keeps that edge's own kind and lanes.
const GRID = 0.5;
const ROAD_KIND = 'street';
const ROAD_LANES = 2;
const EPS = 1e-6;

function onGrid(v) {
  return Math.round(v / GRID) * GRID;
}

// A road point: a node, a node id ("x,z"), or { x, z } / [x, z]. Coordinates
// snap to the grid the graph is built on; anything else is not a road.
function roadPoint(ref) {
  let x;
  let z;
  if (Array.isArray(ref)) [x, z] = ref;
  else if (ref && typeof ref === 'object') ({ x, z } = ref);
  else if (typeof ref === 'string') [x, z] = ref.split(',').map(Number);
  else return null;
  if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(z))) return null;
  return { x: onGrid(Number(x)), z: onGrid(Number(z)) };
}

function edgeOf(map, ref) {
  if (typeof ref === 'string') return map.graph.edges.find((e) => e.id === ref) ?? null;
  if (ref && typeof ref === 'object' && map.graph.edges.includes(ref)) return ref;
  const id = ref && typeof ref === 'object' ? ref.id : ref;
  return map.graph.edges.find((e) => e.id === id) ?? null;
}

// Where the new road a->b meets an existing edge c->d, as parameters along
// each. A collinear overlap longer than a point is the same road twice: the
// caller refuses it. A shared endpoint is left to the node pass.
function segmentHit(a, b, c, d) {
  const rx = b.x - a.x;
  const rz = b.z - a.z;
  const sx = d.x - c.x;
  const sz = d.z - c.z;
  const den = rx * sz - rz * sx;
  const qx = c.x - a.x;
  const qz = c.z - a.z;
  if (Math.abs(den) < EPS) {
    if (Math.abs(qx * rz - qz * rx) > EPS) return null;
    const len2 = rx * rx + rz * rz;
    const p0 = (qx * rx + qz * rz) / len2;
    const p1 = ((d.x - a.x) * rx + (d.z - a.z) * rz) / len2;
    const lo = Math.max(0, Math.min(p0, p1));
    const hi = Math.min(1, Math.max(p0, p1));
    if (hi - lo <= EPS) return null;
    return { overlap: true };
  }
  const t = (qx * sz - qz * sx) / den;
  const u = (qx * rz - qz * rx) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { t, u, x: a.x + rx * t, z: a.z + rz * t };
}

function ensureNode(byId, nodes, x, z) {
  const id = `${x},${z}`;
  let node = byId.get(id);
  if (!node) {
    node = { id, x, z, y: 0 };
    byId.set(id, node);
    nodes.push(node);
  }
  return node;
}

// The nodes the new road runs through, in order: its ends, every existing edge
// it crosses and every existing node it passes over, snapped and deduped.
function chainOf(from, to, cuts, byId, nodes) {
  const key = Math.abs(from.x - to.x) < EPS ? 'z' : 'x';
  const points = [...cuts].sort((p, q) => p[key] - q[key]);
  const chain = [ensureNode(byId, nodes, from.x, from.z)];
  for (const p of points) chain.push(ensureNode(byId, nodes, p.x, p.z));
  chain.push(ensureNode(byId, nodes, to.x, to.z));
  return chain.filter((node, i) => node !== chain[i - 1]);
}

// A road piece between two nodes: a cut out of an existing edge keeps that
// edge's own kind and lanes; a newly laid piece is a street.
function connect(template, from, to) {
  return { ...template, id: `road:${from.id}:${to.id}`, a: from.id, b: to.id };
}

// The graph addRoad would leave: the road itself plus every edge it meets, cut
// at the junction. Null when it doubles an existing edge or goes nowhere.
function planRoad(map, from, to, axis) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const nodes = map.graph.nodes.slice();
  const cuts = [];
  const splits = new Map();
  for (const edge of map.graph.edges) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    const hit = segmentHit(from, to, a, b);
    if (!hit) continue;
    if (hit.overlap) return null;
    if (hit.t > EPS && hit.t < 1 - EPS) cuts.push({ x: onGrid(hit.x), z: onGrid(hit.z) });
    if (hit.u > EPS && hit.u < 1 - EPS) {
      const list = splits.get(edge) ?? [];
      list.push({ t: hit.u, x: onGrid(hit.x), z: onGrid(hit.z) });
      splits.set(edge, list);
    }
  }
  for (const node of map.graph.nodes) {
    const hit = projectOnSegment(node.x, node.z, from, to);
    if (hit.dist <= EPS && hit.t > EPS && hit.t < 1 - EPS) cuts.push({ x: node.x, z: node.z });
  }
  const chain = chainOf(from, to, cuts, byId, nodes);
  if (chain.length < 2) return null;
  const edges = [];
  for (const edge of map.graph.edges) {
    const list = splits.get(edge);
    if (!list) {
      edges.push(edge);
      continue;
    }
    const stops = [{ t: 0, node: byId.get(edge.a) }];
    for (const c of list.sort((p, q) => p.t - q.t)) stops.push({ t: c.t, node: ensureNode(byId, nodes, c.x, c.z) });
    stops.push({ t: 1, node: byId.get(edge.b) });
    for (let i = 1; i < stops.length; i++) edges.push(connect(edge, stops[i - 1].node, stops[i].node));
  }
  const laid = { lanes: ROAD_LANES, kind: ROAD_KIND, axis, district: map.district?.id ?? null, way: 'op' };
  for (let i = 1; i < chain.length; i++) edges.push(connect(laid, chain[i - 1], chain[i]));
  return { nodes, edges };
}

// The tiles a road op reaches: the road, the frontage band either side (so a
// parcel whose `noRoad` flips lies on a tile the renderer rebuilds) and the
// depth a replanned lot runs back from the building line, so every lot the op
// plans stands on a tile it dirties.
const REPLAN_REACH = BUILD_LINE + ROW_DEPTH_MAX;

function roadBox(a, b) {
  return {
    minX: Math.min(a.x, b.x) - REPLAN_REACH,
    maxX: Math.max(a.x, b.x) + REPLAN_REACH,
    minZ: Math.min(a.z, b.z) - REPLAN_REACH,
    maxZ: Math.max(a.z, b.z) + REPLAN_REACH,
  };
}

// The parcel shape sim/map.js gives a lot (lotParcel), for a lot a road op
// plans: a whole empty parcel, not a stub. map.js is not imported for it
// because map.js imports this module's layout, so the shape is kept in step by
// hand.
function newLotParcel(id, [x, z, w, d]) {
  return {
    id, kind: 'lot',
    x, z, w, d,
    use: null, zoned: null, painted: false, noRoad: false,
    stage: STAGE.EMPTY, progress: 0,
    powerZone: 0, pace: 0,
    heights: STAGES.map(() => 0),
    building: false, trend: 0, why: null, vacancy: 0,
  };
}

// True when a parcel's footprint meets a box.
function meets(box, p) {
  return p.x - p.w / 2 <= box.maxX && p.x + p.w / 2 >= box.minX
    && p.z - p.d / 2 <= box.maxZ && p.z + p.d / 2 >= box.minZ;
}

// Replan the lots a road op leaves in its dirty box (M3.T20). A lot the op left
// without a road, or one the new road runs through, comes down; new lots are
// planned along the roads the box now holds, with every standing footprint as
// their keep-out. A parcel the box does not reach is not read, so it keeps its
// id, and a lot that survives keeps its own: its footprint is part of the
// keep-out, so the planner only fills free frontage.
function replanFrontage(map, box) {
  if (!Array.isArray(map.parcels) || !Array.isArray(map.lots)) return;
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  for (let i = map.parcels.length - 1; i >= 0; i--) {
    const p = map.parcels[i];
    if (p.kind !== 'lot' || !meets(box, p)) continue;
    const road = frontageRoad(map, p, byId);
    if (road && road.gap > EPS) continue;
    map.parcels.splice(i, 1);
    const at = map.lots.findIndex((l) => l[0] === p.x && l[1] === p.z && l[2] === p.w && l[3] === p.d);
    if (at >= 0) map.lots.splice(at, 1);
  }
  const blocked = map.parcels.filter((p) => meets(box, p)).map(parcelBox);
  const { lots } = planNewFrontage(map.graph.edges, map.graph.nodes, box, blocked, map.seed);
  for (const { id, lot } of lots) {
    map.parcels.push(newLotParcel(id, lot));
    map.lots.push(lot);
  }
}

// Recompute `noRoad` for every parcel the road touched: one with an edge
// centre-line inside FRONTAGE_MAX of its footprint has frontage, one without
// does not. Returns the parcels that changed, with enough to put them back.
function reconcileFrontage(map, box) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const touched = [];
  for (const p of map.parcels) {
    const pb = parcelBox(p);
    const meets = pb.minX <= box.maxX && pb.maxX >= box.minX && pb.minZ <= box.maxZ && pb.maxZ >= box.minZ;
    if (!meets) continue;
    const next = frontageRoad(map, p, byId) === null;
    const current = Object.hasOwn(p, 'noRoad') ? p.noRoad : false;
    if (current === next) continue;
    touched.push({ p, had: Object.hasOwn(p, 'noRoad'), value: p.noRoad });
    p.noRoad = next;
  }
  return touched;
}

// Apply a graph change as an edit: snapshot the graph and the parcels, run the
// change, plan the new frontage and re-check noRoad over the road's tiles, bump
// the version and return the closure that puts it all back. Snapshots of the
// arrays make the undo exact, so 200 ops walk back to the golden map (M3-4).
function roadEdit(map, box, change) {
  const version = map.version;
  const nodesBefore = map.graph.nodes.slice();
  const edgesBefore = map.graph.edges.slice();
  const parcelsBefore = map.parcels ? map.parcels.slice() : null;
  const lotsBefore = map.lots ? map.lots.slice() : null;
  change();
  replanFrontage(map, box);
  const touched = reconcileFrontage(map, box);
  map.version = version + 1;
  markDirty(map, box);
  const reverse = () => {
    map.graph.nodes.length = 0;
    map.graph.nodes.push(...nodesBefore);
    map.graph.edges.length = 0;
    map.graph.edges.push(...edgesBefore);
    if (parcelsBefore) {
      map.parcels.length = 0;
      map.parcels.push(...parcelsBefore);
    }
    if (lotsBefore) {
      map.lots.length = 0;
      map.lots.push(...lotsBefore);
    }
    for (const t of touched) {
      if (t.had) t.p.noRoad = t.value;
      else delete t.p.noRoad;
    }
    map.version = version;
    markDirty(map, box);
  };
  history(map).push(reverse);
  return reverse;
}

// Lay a road from one point to another. Both ends snap to the half-metre grid
// and the road runs along x or z; a diagonal, a zero-length road or one that
// would double an existing edge is refused. Every edge the road crosses is cut
// at the junction, so the crossing is a node like any other.
export function addRoad(map, a, b) {
  const from = roadPoint(a);
  const to = roadPoint(b);
  if (!from || !to) return NOOP;
  if (from.x === to.x && from.z === to.z) return NOOP;
  const axis = Math.abs(from.z - to.z) < EPS ? 'x' : Math.abs(from.x - to.x) < EPS ? 'z' : null;
  if (!axis) return NOOP;
  const plan = planRoad(map, from, to, axis);
  if (!plan) return NOOP;
  return roadEdit(map, roadBox(from, to), () => {
    map.graph.nodes.length = 0;
    map.graph.nodes.push(...plan.nodes);
    map.graph.edges.length = 0;
    map.graph.edges.push(...plan.edges);
  });
}

// Take one edge out of the graph, by object or id, and re-check the frontage
// of the parcels it used to serve. Nodes stay: a dead end is still a place.
export function removeRoad(map, ref) {
  const edge = edgeOf(map, ref);
  if (!edge) return NOOP;
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const a = byId.get(edge.a);
  const b = byId.get(edge.b);
  if (!a || !b) return NOOP;
  return roadEdit(map, roadBox(a, b), () => {
    const at = map.graph.edges.indexOf(edge);
    if (at >= 0) map.graph.edges.splice(at, 1);
  });
}

// Undo the last op on a map. The handle an op returned does the same; this is
// for a caller that kept only the map (the city view's Ctrl+Z, M5-7).
export function undo(map) {
  const stack = HISTORY.get(map);
  if (!stack || stack.length === 0) return false;
  stack.pop()();
  return true;
}
