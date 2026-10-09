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
  STAGE, STAGES, USES, USE_BY_KIND, BUILD_MARGIN, buildingParcel, edgesIn, frontageRoadOn,
  graphBounds, markBridges, markDirty, parcelsIn, projectOnSegment,
} from './map.js';
import { regrade, reverseGround, waterBlocked } from './terrain.js';
import { BUILD_LINE, ROW_DEPTH_MAX, planNewFrontage } from './layout.js';
import { planFurniture } from './furniture.js';

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

// The whole parcel as an undo needs it: every nested array or plain object is
// copied by value, so an op that edits one in place cannot reach back through
// the snapshot and change what the undo restores (M3-4).
function snapshot(p) {
  const copy = { ...p };
  for (const key of Object.keys(copy)) {
    const value = copy[key];
    if (Array.isArray(value)) copy[key] = value.slice();
    else if (value && typeof value === 'object') copy[key] = { ...value };
  }
  return copy;
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
      delete q.type;
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
// Services (M5.T11). A service is a finished building the player places on an
// empty lot: the parcel becomes kind 'service' with a `type`, and the city view
// gets a tool for each. Every service reaches only the buildings inside its
// catchment (`radius`, metres between centres) and only `capacity` of them, so
// a second service in the same catchment adds capacity, never a second boost
// (M5-5, serviceReach below). A customer is a building that stands — a fixed
// parcel (row, tower, cap) or a lot at its low block or above; an empty lot or
// a site takes a bed from nobody (M5.T11b). The numbers are measured, not
// guessed: `capacity` is about 80% of the median catchment on seeds 7, 11, 22,
// 33, 73, and docs/CITYVIEW.md holds the table and the per-seed counts. `use`
// is the architecture the renderer draws the building with (a clinic reads as a
// shop, a substation as a works yard) and `height` the storeys it stands, so a
// park is not a tower. `serves` names what a capacity counts, for that doc.
export const SERVICES = {
  substation: { name: 'substation', use: 'ind', height: 8, cost: 600, radius: 200, capacity: 64, serves: 'grids' },
  police: { name: 'police station', use: 'com', height: 12, cost: 900, radius: 100, capacity: 50, serves: 'cells' },
  fire: { name: 'fire station', use: 'ind', height: 10, cost: 800, radius: 300, capacity: 64, serves: 'trucks' },
  clinic: { name: 'clinic', use: 'com', height: 10, cost: 700, radius: 120, capacity: 58, serves: 'patients' },
  school: { name: 'school', use: 'com', height: 12, cost: 1000, radius: 150, capacity: 64, serves: 'pupils' },
  park: { name: 'park', use: 'com', height: 4, cost: 300, radius: 100, capacity: 50, serves: 'visitors' },
};

export const SERVICE_TYPES = Object.keys(SERVICES);

// Place a `type` service on an empty lot: kind 'service', the type's own use
// and low height, finished at HIGH, keeping its id and land. Only an empty lot
// takes one — a standing building is bulldozed first. An edit like any other,
// so the undo restores the lot exactly.
export function placeService(map, ref, type) {
  const def = SERVICES[type];
  const p = parcelOf(map, ref);
  if (!p || !def || p.kind !== 'lot' || p.stage !== STAGE.EMPTY) return NOOP;
  return edit(map, p, (q) => {
    q.kind = 'service';
    q.type = type;
    q.stage = STAGE.HIGH;
    q.progress = 0;
    q.building = false;
    q.painted = false;
    q.use = def.use;
    q.zoned = def.use;
    q.heights = STAGES.map(() => def.height);
  });
}

// The standing services of `type` among `parcels`.
export function servicesOf(parcels, type) {
  return (parcels ?? []).filter((p) => p.kind === 'service' && p.type === type);
}

// Is a parcel's centre inside a service's catchment?
export function inCatchment(service, p) {
  const def = SERVICES[service.type];
  return Boolean(def)
    && (p.x - service.x) ** 2 + (p.z - service.z) ** 2 <= def.radius * def.radius;
}

// A building a service can serve (M5.T11b): every fixed parcel — a row, tower
// or cap — and every lot past its site, at the low block or above. Empty lots
// and sites are not customers, and neither are other services; the capacity
// table in docs/CITYVIEW.md counts exactly these.
export function hasBuilding(p) {
  return p.kind !== 'service' && (p.kind !== 'lot' || p.stage >= STAGE.LOW);
}

// Which parcels a type's services reach (M5.T11). Each service takes the
// nearest unserved building inside its catchment until its capacity is full; a
// building reached once is never reached again, so a second service adds
// capacity where the first is full instead of a second helping. Returns
// Map<parcel, service>; services are not each other's customers.
export function serviceReach(parcels, type) {
  const def = SERVICES[type];
  const reach = new Map();
  if (!def) return reach;
  const customers = (parcels ?? []).filter(hasBuilding);
  const r2 = def.radius * def.radius;
  for (const service of servicesOf(parcels, type)) {
    const near = customers
      .filter((p) => !reach.has(p))
      .map((p) => ({ p, d2: (p.x - service.x) ** 2 + (p.z - service.z) ** 2 }))
      .filter((q) => q.d2 <= r2)
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, def.capacity);
    for (const { p } of near) reach.set(p, service);
  }
  return reach;
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
  const standing = nodes.length;
  const cuts = [];
  const splits = new Map();
  const dropped = [];
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
  // The edges the plan adds to the graph: the pieces a crossing-edge cut leaves
  // behind and the road itself. A caller marks bridges on these alone, so a
  // road the op did not touch keeps the kind it had.
  const fresh = [];
  for (const edge of map.graph.edges) {
    const list = splits.get(edge);
    if (!list) {
      edges.push(edge);
      continue;
    }
    // The edge the op cuts through goes out, cut at the junction into pieces.
    dropped.push(edge);
    const stops = [{ t: 0, node: byId.get(edge.a) }];
    for (const c of list.sort((p, q) => p.t - q.t)) stops.push({ t: c.t, node: ensureNode(byId, nodes, c.x, c.z) });
    stops.push({ t: 1, node: byId.get(edge.b) });
    for (let i = 1; i < stops.length; i++) {
      const piece = connect(edge, stops[i - 1].node, stops[i].node);
      edges.push(piece);
      fresh.push(piece);
    }
  }
  const laid = { lanes: ROAD_LANES, kind: ROAD_KIND, axis, district: map.district?.id ?? null, way: 'op' };
  for (let i = 1; i < chain.length; i++) {
    const piece = connect(laid, chain[i - 1], chain[i]);
    edges.push(piece);
    fresh.push(piece);
  }
  // The ground this road changes (M5.T3c): the flats of the nodes its cuts and
  // its own drag bring in and of the edges it lays in and out. The nodes come
  // first, so every edge is measured through the joints it already stands on.
  return {
    nodes, edges, fresh,
    ground: { flatsIn: [...nodes.slice(standing), ...fresh], flatsOut: dropped },
  };
}

// The tiles a road op reaches: the road, the frontage band either side (so a
// parcel whose `noRoad` flips lies on a tile the renderer rebuilds) and the
// depth a replanned lot runs back from the building line, so every lot the op
// plans stands on a tile it dirties.
const REPLAN_REACH = BUILD_LINE + ROW_DEPTH_MAX;

// How much further than its own box an op still reads the roads: one span's
// depth is half the gap to the nearest parallel road that overlaps it
// (layout.js spanDepth), and a neighbour twice ROW_DEPTH_MAX plus the building
// line and layout.js's back gap away leaves it the whole ROW_DEPTH_MAX — the
// same depth no neighbour gives at all. So an edge past this cannot change a
// lot the op plans, nor front one it keeps. The back gap is layout.js's own,
// named here because an op cannot import it.
const BACK_GAP = 1.5;
const PLAN_REACH = 2 * (ROW_DEPTH_MAX + BUILD_LINE + BACK_GAP);

function roadBox(a, b) {
  return {
    minX: Math.min(a.x, b.x) - REPLAN_REACH,
    maxX: Math.max(a.x, b.x) + REPLAN_REACH,
    minZ: Math.min(a.z, b.z) - REPLAN_REACH,
    maxZ: Math.max(a.z, b.z) + REPLAN_REACH,
  };
}

// The overview draws a 1.3 m dashed boundary on a free lot's edge (render/
// vacant.js), so it reaches 0.65 m past the footprint. A lot an op plans keeps
// a metre of that clear of the back, so the marker stands inside the reach the
// op dirties and the open land 20 m off a new road stays open ground (M5.T3d).
const MARKER_CLEAR = 1;

// A planned lot's depth, held clear of its own boundary marker. The lot fronts
// one road span: its plot runs BUILD_LINE..BUILD_LINE+depth from that centre-
// line, and the depth is the footprint's width on a z-running road, its depth
// on an x-running one. The front edge stays where the plan put it.
function clearOfMarker(edges, [x, z, w, d], byId) {
  const road = frontageRoadOn(edges, { x, z, w, d }, byId);
  if (!road) return [x, z, w, d];
  const a = byId.get(road.edge.a);
  const b = byId.get(road.edge.b);
  if (!a || !b) return [x, z, w, d];
  const cap = ROW_DEPTH_MAX - MARKER_CLEAR;
  if (a.x === b.x) {
    const depth = Math.min(w, cap);
    if (depth === w) return [x, z, w, d];
    return [a.x + (Math.sign(x - a.x) || 1) * (BUILD_LINE + depth / 2), z, depth, d];
  }
  const depth = Math.min(d, cap);
  if (depth === d) return [x, z, w, d];
  return [x, a.z + (Math.sign(z - a.z) || 1) * (BUILD_LINE + depth / 2), w, depth];
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

// Take the doomed parcels out of the map in one pass, in place, so the parcels
// that stay keep their order — the walkers and the pickers read a parcel's
// index across an edit — and no new list is built.
function takeOut(parcels, doomed) {
  let keep = 0;
  for (let i = 0; i < parcels.length; i++) {
    if (doomed.has(parcels[i])) continue;
    parcels[keep++] = parcels[i];
  }
  parcels.length = keep;
}

// Which parcels a road op's box brings down: a lot or row the op left without a
// road, or one the new road runs through. `kept` names the lots that keep their
// frontage, and `doomed` the ones it takes out of the map, its lots and rows.
function decide(map, box, reach, kept, doomed) {
  const { byId, edges } = reach;
  for (const p of parcelsIn(map, box)) {
    const road = frontageRoadOn(edges, p, byId);
    if (p.kind === 'row') {
      if (road && road.gap > EPS) continue;
      doomed.add(p);
      const at = map.buildings ? map.buildings.findIndex((b) => b.id === p.id) : -1;
      if (at >= 0) map.buildings.splice(at, 1);
      continue;
    }
    if (p.kind !== 'lot') continue;
    if (road && road.gap > EPS) {
      kept.set(p, false);
      continue;
    }
    doomed.add(p);
    const at = map.lots.findIndex((l) => l[0] === p.x && l[1] === p.z && l[2] === p.w && l[3] === p.d);
    if (at >= 0) map.lots.splice(at, 1);
  }
}

// Replan the frontage a road op leaves in its dirty box (M3.T20). A lot or row
// the op left without a road, or one the new road runs through, comes down; new
// lots and rows are planned along the roads the box now holds, with every
// standing footprint as their keep-out. A parcel the box does not reach is not
// read, so it keeps its id, and one that survives keeps its own: its footprint
// is part of the keep-out, so the planner only fills free frontage. The frontage
// of every surviving lot is already known here — `kept` hands it to reconcile,
// so no parcel's frontage is computed twice in one op.
function replanFrontage(map, box, reach) {
  const kept = new Map();
  const replan = { padsIn: [], padsOut: [] };
  if (!Array.isArray(map.parcels) || !Array.isArray(map.lots)) return { kept, replan };
  const doomed = new Set();
  decide(map, box, reach, kept, doomed);
  if (doomed.size) {
    replan.padsOut = [...doomed];
    takeOut(map.parcels, doomed);
  }
  const blocked = parcelsIn(map, box).filter((p) => !doomed.has(p)).map(parcelBox);
  const { lots, buildings } = planNewFrontage(
    reach.edges, reach.nodes, box, blocked, map.seed, map.district,
  );
  // The op keeps its frontage off the water and its setback too (M4-2): a lot
  // or row the replan would put there is refused, as createMap refuses the
  // plan's own.
  for (const { id, lot } of lots) {
    if (waterBlocked(map.water ?? [], ...lot)) continue;
    const shape = clearOfMarker(reach.edges, lot, reach.byId);
    const parcel = newLotParcel(id, shape);
    map.parcels.push(parcel);
    map.lots.push(shape);
    replan.padsIn.push(parcel);
  }
  for (const b of buildings) {
    if (waterBlocked(map.water ?? [], b.x, b.z, b.w, b.d)) continue;
    const parcel = buildingParcel(b);
    if (map.buildings) map.buildings.push(b);
    map.parcels.push(parcel);
    replan.padsIn.push(parcel);
  }
  return { kept, replan };
}

// Recompute `noRoad` for every parcel the road touched: one with an edge
// centre-line inside FRONTAGE_MAX of its footprint has frontage, one without
// does not. Returns the parcels that changed, with enough to put them back.
// `reach` is indexed once for the whole op; `kept` holds the frontage replan
// already found, so only the new lots and the buildings are swept here.
function reconcileFrontage(map, box, reach, kept) {
  const touched = [];
  for (const p of parcelsIn(map, box)) {
    const next = kept.has(p) ? false : frontageRoadOn(reach.edges, p, reach.byId) === null;
    const current = Object.hasOwn(p, 'noRoad') ? p.noRoad : false;
    if (current === next) continue;
    touched.push({ p, had: Object.hasOwn(p, 'noRoad'), value: p.noRoad });
    p.noRoad = next;
  }
  return touched;
}

// The ground an edit changes: the flats of the road edges it lays in and takes
// out, and the pads of the parcels its replan plans in and takes out — the
// shape terrain.js's regrade reads.
function groundOf(flats, replan) {
  return {
    flatsIn: flats?.flatsIn ?? [],
    flatsOut: flats?.flatsOut ?? [],
    padsIn: replan?.padsIn ?? [],
    padsOut: replan?.padsOut ?? [],
  };
}

// The roads one op reaches: the graph's node index, the edges its own box can
// reach, and those edges' nodes in the graph's own order. Every lot the op
// plans or re-checks reads this list, and the planner takes exactly this graph,
// so a road op's cost is the roads around it and not the city's (M3.T20).
function roadReach(map, box) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const edges = edgesIn(map.graph.edges, byId, box, PLAN_REACH);
  const at = new Set();
  for (const edge of edges) {
    at.add(edge.a);
    at.add(edge.b);
  }
  return { byId, edges, nodes: map.graph.nodes.filter((n) => at.has(n.id)) };
}

// The graph a road op hands planFurniture (sim/furniture.js), which re-derives
// every fitting the city has from the graph it is given. Only the edges a
// player laid and the edges that meet one of those roads at a node take part in
// an op road's lamps, boxes or junctions: a fitting stands along a `way: 'op'`
// edge, and a node only reads as a junction through the edges that meet it. So
// this is the whole graph's own answer — same edges, same order — over the
// player's roads instead of the city's, and a graph with no op roads yet hands
// back the district plan alone.
function furnitureGraph(graph) {
  const laid = new Set();
  const joint = new Set();
  for (const edge of graph.edges) {
    if (edge.way !== 'op') continue;
    laid.add(edge);
    joint.add(edge.a);
    joint.add(edge.b);
  }
  if (!laid.size) return { nodes: [], edges: [] };
  const edges = graph.edges.filter((e) => laid.has(e) || joint.has(e.a) || joint.has(e.b));
  const at = new Set();
  for (const edge of edges) {
    at.add(edge.a);
    at.add(edge.b);
  }
  return { nodes: graph.nodes.filter((n) => at.has(n.id)), edges };
}

// Apply a graph change as an edit: snapshot the graph and the parcels, run the
// change, plan the new frontage and re-check noRoad over the road's tiles, bump
// the version and return the closure that puts it all back. Snapshots of the
// arrays make the undo exact, so 200 ops walk back to the golden map (M3-4).
// `flats` is the road edges the change lays in and takes out, which is what the
// ground is re-graded by.
function roadEdit(map, box, change, flats = null) {
  const version = map.version;
  const snap = [
    map.graph.nodes.slice(),
    map.graph.edges.slice(),
    map.parcels ? map.parcels.slice() : null,
    map.lots ? map.lots.slice() : null,
    map.buildings ? map.buildings.slice() : null,
    map.bounds && map.district ? { ...map.district.drive } : null,
    map.bounds ? { ...map.bounds } : null,
    map.terrain ?? null,
    map.furniture ?? null,
  ];
  const [nodesBefore, edgesBefore, parcelsBefore, lotsBefore, buildingsBefore,
    driveBefore, boundsBefore, terrainBefore, furnitureBefore] = snap;
  change();
  const reach = roadReach(map, box);
  const { kept, replan } = replanFrontage(map, box, reach);
  const touched = reconcileFrontage(map, box, reach, kept);
  // The road grades its own corridor and its new lots' pads (M5.T3c): the
  // ground is derived from the graph and the parcels, so a new road that
  // leaves the old flats gets ground of its own instead of standing over hills.
  const ground = groundOf(flats, replan);
  const graded = Boolean(terrainBefore && map.graph);
  if (graded) regrade(terrainBefore, ground);
  // The streets a road op leaves carry their own furniture (M5.T4): the lamps,
  // boxes and junctions of every `way: 'op'` edge, planned with the district's
  // own. A generated map has a plan; the hand preset keeps none.
  if (furnitureBefore) map.furniture = planFurniture(map.district, map.seed, furnitureGraph(map.graph));
  // A road op settles the drivable box on the graph it leaves (M5.T3b): the car
  // is clamped to the exact box of the roads, so a road that leaves the old box
  // hands the car its whole length, and the city view pans the build margin.
  if (driveBefore) {
    const land = graphBounds(map.graph);
    Object.assign(map.district.drive, land);
    Object.assign(map.bounds, {
      minX: land.minX - BUILD_MARGIN, maxX: land.maxX + BUILD_MARGIN,
      minZ: land.minZ - BUILD_MARGIN, maxZ: land.maxZ + BUILD_MARGIN,
    });
  }
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
    if (buildingsBefore) {
      map.buildings.length = 0;
      map.buildings.push(...buildingsBefore);
    }
    for (const t of touched) {
      if (t.had) t.p.noRoad = t.value;
      else delete t.p.noRoad;
    }
    if (driveBefore) Object.assign(map.district.drive, driveBefore);
    if (boundsBefore) Object.assign(map.bounds, boundsBefore);
    if (graded) regrade(map.terrain, reverseGround(ground));
    if (furnitureBefore) map.furniture = furnitureBefore;
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
  // A new road over the water becomes a bridge like the generated ones
  // (M4.T7): only the pieces new to the graph are marked, so every edge the
  // undo snapshots keeps the kind it had.
  markBridges({ nodes: plan.nodes, edges: plan.fresh }, map.water);
  return roadEdit(map, roadBox(from, to), () => {
    map.graph.nodes.length = 0;
    map.graph.nodes.push(...plan.nodes);
    map.graph.edges.length = 0;
    map.graph.edges.push(...plan.edges);
  }, plan.ground);
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
  }, { flatsIn: [], flatsOut: [edge] });
}

// Undo the last op on a map. The handle an op returned does the same; this is
// for a caller that kept only the map (the city view's Ctrl+Z, M5-7).
export function undo(map) {
  const stack = HISTORY.get(map);
  if (!stack || stack.length === 0) return false;
  stack.pop()();
  return true;
}
