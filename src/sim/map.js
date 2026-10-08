// The city as one object: a seed builds everything the world is made of.
// Roads, district, buildings, lots, furniture, dressing, story places and the
// spawn are today's derivations, gathered here so the sim, the renderer and the
// edits can read the same map instead of a load-time constant (M3-2).
// Pure sim (law 5): no three.js, no DOM. A map is built in a process booted on
// its seed: planLayout still reads its own load-time towers (M3.T14 removes it).
import { generateDistrict } from './citygen.js';
import { createTerrain, waterBlocked } from './terrain.js';
import { planTown } from './townplan.js';
import { BUILD_LINE, buildingsOf, planLayout } from './layout.js';
import { HAND_PINNED, placePinned } from './landmarks.js';
import { planFurniture } from './furniture.js';
import { planDressing } from './dressing.js';
import { placeSigns, ramenBoard } from './streetscape.js';
import { arcFor, pursuitHomesFor, substationsFor } from './anchors.js';
import { spawnFor } from './spawn.js';
import SIGN_DEFS from '../content/signs.json' with { type: 'json' };
import RAW_ARC from '../content/arc.json' with { type: 'json' };

// render/signs.js's own guard, kept in step: a content error degrades to a
// missing sign, never a dead boot.
const validSign = (s) => s && typeof s.text === 'string' && typeof s.sub === 'string'
  && /^#[0-9a-fA-F]{6}$/.test(s.color || '') && [-1, 0, 1].includes(s.side)
  && typeof s.z === 'number' && typeof s.y === 'number';

const GROUND_Y = 0;

// ---------------------------------------------------------------------------
// Parcels: the map's own record of every building, lot and, later, service. The
// stage scale and the use set live here, with the map that holds the parcels;
// zoning.js re-exports them — it owns what parcels do, not what one is (M3.T15).
export const STAGES = ['EMPTY', 'SITE', 'LOW', 'MID', 'HIGH'];
export const STAGE = Object.fromEntries(STAGES.map((name, i) => [name, i]));
export const USES = ['res', 'com', 'ind'];

// The use a standing building carries, from its own style: offices behind glass
// and in the core, homes in the brick rows and the plain towers, shops in the
// end caps. The style already came from the district plan (layout.rowStyle);
// nothing here reads the hand map's coordinates.
const USE_BY_STYLE = { core: 'com', glass: 'com', brick: 'res', tower: 'res' };
// Read by edits too (sim/ops.js): a placed building takes its use from here.
export const USE_BY_KIND = { tower: 'res', cap: 'com' };

// Every building the renderer draws as one parcel. It stands finished
// (STAGE.HIGH), it never grows or declines — only kind 'lot' is ticked
// (zoning.js) — and it keeps the building's own id, so a pick can name it.
// powerZone is filled in when the city is created, where the power grid is.
export function buildingParcel(b) {
  const use = USE_BY_STYLE[b.style] ?? USE_BY_KIND[b.kind] ?? USES[0];
  return {
    id: b.id, kind: b.kind,
    x: b.x, z: b.z, w: b.w, d: b.d, h: b.h,
    use, zoned: use, painted: false, noRoad: false,
    stage: STAGE.HIGH, progress: 0,
    powerZone: 0, pace: 0,
    // The drawn height at every stage: a building already high stays high.
    heights: STAGES.map(() => b.h),
    building: false, trend: 0, why: null, vacancy: 0,
  };
}

// ---------------------------------------------------------------------------
// The road graph. world.js derives the world's own at load; this is the same
// cutting, parameterized by a district, so a map can be built for any seed.
// tests/map.test.js pins the two together via the goldens until M3.T14.
function spans(lo, hi, v) {
  return v >= lo && v <= hi;
}

// A span plus every crossing value strictly inside it, in order.
function cutPoints(from, to, crossings) {
  const inside = crossings.filter((v) => v > from && v < to).sort((p, q) => p - q);
  return [from, ...inside, to];
}

function ensureNode(nodes, x, z) {
  const id = `${x},${z}`;
  if (!nodes.has(id)) nodes.set(id, { id, x, z, y: GROUND_Y });
  return nodes.get(id);
}

// kind names what the edge is for: 'avenue' and 'connector' today.
function addChain(nodes, edges, district, way, kind, axis, points) {
  let prev = ensureNode(nodes, points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const next = ensureNode(nodes, points[i][0], points[i][1]);
    edges.push({
      id: `${district.id}.${way.id}.${i - 1}`,
      a: prev.id,
      b: next.id,
      lanes: way.lanes,
      kind,
      axis,
      district: district.id,
      way: way.id,
    });
    prev = next;
  }
}

// Every district's roads cut together into one graph (M4.T4): the plan's own,
// each cell's, and the arterials that join them, so shared junctions are one
// node and a car can leave a cell and reach any other. The plan's own ways stay
// first, so where the town's roads run through them a lookup reads the plan's.
function districtsGraph(cells, town, district) {
  const graph = buildGraph({
    id: 'town',
    avenues: [...district.avenues, ...cells.flatMap((d) => d.avenues), ...town.arterials.avenues],
    crossings: [...district.crossings, ...cells.flatMap((d) => d.crossings), ...town.arterials.crossings],
  });
  const own = new Set([...district.avenues, ...district.crossings].map((w) => w.id));
  graph.edges = [
    ...graph.edges.filter((e) => own.has(e.way)),
    ...graph.edges.filter((e) => !own.has(e.way)),
  ];
  return graph;
}

// A road crossing the water is a bridge (M4.T7): its edge takes kind `bridge`
// and keeps its own lanes and its nodes' y — the road's own level — so the
// deck is flush with the road at both ends. Generation cuts an arterial at
// the corridor edge, so one edge spans bank to bank. Roads run along one axis
// (D2), so an edge crosses a water rect strictly inside it; a road lying along
// the water's edge or ending on it does not cross.
const BRIDGE_EPS = 1e-6;

function crossesWater(a, b, water) {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minZ = Math.min(a.z, b.z);
  const maxZ = Math.max(a.z, b.z);
  return water.some(([cx, cz, hw, hd]) => minX < cx + hw - BRIDGE_EPS
    && maxX > cx - hw + BRIDGE_EPS && minZ < cz + hd - BRIDGE_EPS
    && maxZ > cz - hd + BRIDGE_EPS);
}

// Mark every edge that crosses map water as a bridge. `water` is the map's
// water, the same [cx, cz, hw, hd] rects terrain.buildable refuses; a road op
// (sim/ops.js) marks the pieces its own new road brings over the water with
// the same rule.
export function markBridges(graph, water) {
  if (!water || water.length === 0) return graph;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  for (const edge of graph.edges) {
    if (edge.kind === 'bridge') continue;
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (a && b && crossesWater(a, b, water)) edge.kind = 'bridge';
  }
  return graph;
}

// Every avenue cut where a crossing meets it, every crossing cut where an
// avenue meets it, as nodes and edges.
function buildGraph(district) {
  const byId = new Map();
  const edges = [];
  for (const av of district.avenues) {
    const met = district.crossings.filter((c) => spans(c.x0, c.x1, av.x)).map((c) => c.z);
    addChain(byId, edges, district, av, 'avenue', 'z',
      cutPoints(av.z0, av.z1, met).map((z) => [av.x, z]));
  }
  for (const cr of district.crossings) {
    const met = district.avenues.filter((a) => spans(a.z0, a.z1, cr.z)).map((a) => a.x);
    addChain(byId, edges, district, cr, 'connector', 'x',
      cutPoints(cr.x0, cr.x1, met).map((x) => [x, cr.z]));
  }
  return { nodes: [...byId.values()], edges };
}

// A lot is a parcel of its own: the plan's footprint, the id the live city
// gives it (sim/zoning.js `lot:<index>`), and the whole empty-parcel shape the
// city fills in. An unzoned lot on a fresh map is a well-formed parcel, not a
// stub missing half its fields.
function lotParcel(lot, index) {
  const [x, z, w, d] = lot;
  return {
    id: `lot:${index}`, kind: 'lot',
    x, z, w, d,
    use: null, zoned: null, painted: false, noRoad: false,
    stage: STAGE.EMPTY, progress: 0,
    powerZone: 0, pace: 0,
    heights: STAGES.map(() => 0),
    building: false, trend: 0, why: null, vacancy: 0,
  };
}

// Districts are areas (M3.T36, M3-7): the map's power districts with bounds
// and names. Today's town is one district, so the areas are its two power
// halves — the same split zoneAt drew at z = 0, now as data the sim, the
// hacks and the economy read instead of code. Ids are 0-based in order, so an
// area's id is its index in street.zones and the economy's districts.
function splitDistricts(district) {
  const { walk, drive } = district;
  const south = (box) => ({ ...box, maxZ: Math.min(box.maxZ, 0) });
  const north = (box) => ({ ...box, minZ: Math.max(box.minZ, 0) });
  return [
    { id: 0, name: 'south', walk: south(walk), drive: south(drive) },
    { id: 1, name: 'north', walk: north(walk), drive: north(drive) },
  ];
}

// The box a road graph spans (M5.T3b): the map's own buildable land grows from
// this, so a new game's whole town fits however the seed lays it out.
export function graphBounds(graph) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const node of graph.nodes) {
    if (node.x < minX) minX = node.x;
    if (node.x > maxX) maxX = node.x;
    if (node.z < minZ) minZ = node.z;
    if (node.z > maxZ) maxZ = node.z;
  }
  return { minX, maxX, minZ, maxZ };
}

// Open land a road drag may still reach past the outermost road (M5.T3b): the
// build box is the graph's own box grown by this much, so a player can leave
// the town's edge instead of being fenced onto its last street.
export const BUILD_MARGIN = 100;

// A seed's whole map. `version` is the edit revision; ops (M3.T18) bump it, so
// the chunks know what to rebuild (M3.T27).
export function createMap(seed) {
  const district = generateDistrict(seed);
  // The coarse town (M4.T3): cells, kinds, arterials and the river. M4.T4 turns
  // each cell into a district of its own kind (citygen.KIND_SPECS: avenue gap,
  // crossing count, height and style range) and cuts every one of their roads
  // with the arterials into map.graph. The load-time district still fills the
  // map until M4.T5 moves the buildings onto the cells.
  const town = planTown(seed);
  const water = town.river.rects;
  const cells = town.cells.map((cell) => generateDistrict(seed, cell, cell.kind));
  const plan = planLayout(district, seed);
  plan.pinned = placePinned(HAND_PINNED, district.avenues[0], district.crossings);
  const dressing = planDressing(district, seed);
  const arc = arcFor(RAW_ARC, district);
  const graph = markBridges(districtsGraph(cells, town, district), water);
  const buildings = buildingsOf(plan);
  // The city's own land is never on the water or within its setback (M4-2):
  // a lot the load-time district's plan put there is refused, so nothing can
  // grow on the river. (The legacy street wall stands where planBuildings put
  // it — m3-parcels pins that derivation — and goes with the hand tables in
  // M4.T15.)
  const lots = plan.lots.filter(([x, z, w, d]) => !waterBlocked(water, x, z, w, d));
  const map = {
    seed,
    version: 0,
    // Tiles an edit has touched since the renderer last drained them (M3.T27).
    // Render state, not map content: mapHash ignores it by design.
    dirty: new Set(),
    district,
    districts: splitDistricts(district),
    // One district per town-plan cell, in cell order: its kind, its own roads,
    // and the height and style range its buildings may take (M4.T4, M4.T5).
    cells,
    // All districts' roads, cut into one graph through the arterials (M4.T4),
    // every water crossing kind `bridge` (M4.T7).
    graph,
    town,
    // The town's water (M4.T3): terrain.buildable refuses a footprint in it or
    // its setback (M4.T5, M4.T7), and M4.T8 draws it. Rects are terrain's
    // [cx, cz, hw, hd].
    water,
    buildings,
    // Every building the renderer draws, and every lot, is one parcel with an
    // id: nothing the city shows a footprint for is anonymous (M3-3).
    parcels: [
      ...lots.map(lotParcel),
      ...buildings.map(buildingParcel),
    ],
    lots,
    furniture: planFurniture(district, seed),
    dressing: {
      ...dressing,
      signs: placeSigns(SIGN_DEFS.filter(validSign), district, plan.rows, ramenBoard(dressing.shops[0])),
    },
    anchors: {
      places: arc.places,
      signs: arc.signs,
      substations: substationsFor(district),
      pursuitHomes: pursuitHomesFor(district),
    },
    spawn: spawnFor(district),
  };
  // The map's own ground (M4.T2): built last, from the map itself, so the flats
  // and, from M4.T3, the water are the map's data and not a copy of it.
  map.terrain = createTerrain(map);
  // The land a player can build on is the whole generated town (M5.T3b), not
  // the legacy district's own little road box: the graph now spans every cell
  // and arterial. The drive box grows to the graph plus BUILD_MARGIN, so a drag
  // can leave the outermost road. Its east edge stays the legacy district's own
  // until the first road op settles the box (ops.js roadEdit), because
  // render/outskirts.js picks its lane's crossing by `x1 === drive.maxX`.
  // `map.bounds` is the same box the city view pans over, and a road op keeps
  // it in step.
  const land = graphBounds(map.graph);
  map.bounds = {
    minX: land.minX - BUILD_MARGIN, maxX: land.maxX + BUILD_MARGIN,
    minZ: land.minZ - BUILD_MARGIN, maxZ: land.maxZ + BUILD_MARGIN,
  };
  district.drive.minX = map.bounds.minX;
  district.drive.minZ = map.bounds.minZ;
  district.drive.maxZ = map.bounds.maxZ;
  return map;
}

// The graph node nearest a point, as { node, dist }.
export function nodeAt(map, x, z) {
  let best = null;
  for (const node of map.graph.nodes) {
    const dist = Math.hypot(node.x - x, node.z - z);
    if (best === null || dist < best.dist) best = { node, dist };
  }
  return best;
}

export function projectOnSegment(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const raw = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2;
  const t = Math.max(0, Math.min(1, raw));
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  return { t, x: px, z: pz, dist: Math.hypot(x - px, z - pz) };
}

// Every edge whose centre-line comes within `radius` of a point, nearest first.
// `edgesNear(map, x, z)[0]` is world.js's nearestEdge hit.
export function edgesNear(map, x, z, radius = Infinity) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const hits = [];
  for (const edge of map.graph.edges) {
    const hit = projectOnSegment(x, z, byId.get(edge.a), byId.get(edge.b));
    if (hit.dist <= radius) hits.push({ edge, ...hit });
  }
  return hits.sort((p, q) => p.dist - q.dist);
}

// ---------------------------------------------------------------------------
// Frontage. A parcel fronts a road when an edge centre-line comes within the
// building line of its footprint — the 7.5 m every lot, row and pinned tower
// stands off its avenue (landmarks.js BUILD_LINE). A parcel the road ops leave
// with no road in reach is marked `noRoad` (sim/ops.js), the reason it will
// decline with (M5.T6).
export const FRONTAGE_MAX = BUILD_LINE;

function indexNodes(map) {
  return new Map(map.graph.nodes.map((n) => [n.id, n]));
}

// The gap between two spans on one axis, 0 when they overlap.
function spanGap(lo0, hi0, lo1, hi1) {
  return Math.max(0, Math.max(lo0 - hi1, lo1 - hi0));
}

// Every road runs along one axis (D2), so the gap between a parcel's footprint
// and an edge centre-line is one axis gap per direction.
function boxEdgeGap(box, a, b) {
  if (Math.abs(a.x - b.x) < 1e-9) {
    return Math.hypot(spanGap(a.x, a.x, box.minX, box.maxX),
      spanGap(Math.min(a.z, b.z), Math.max(a.z, b.z), box.minZ, box.maxZ));
  }
  return Math.hypot(spanGap(Math.min(a.x, b.x), Math.max(a.x, b.x), box.minX, box.maxX),
    spanGap(a.z, a.z, box.minZ, box.maxZ));
}

// The nearest road a parcel fronts, as { edge, gap }, or null. `byId` lets an
// editor sweep many parcels without re-indexing the graph for each.
export function frontageRoad(map, p, byId = indexNodes(map)) {
  return frontageRoadOn(map.graph.edges, p, byId);
}

// frontageRoad over a candidate list of edges. An op (sim/ops.js) narrows the
// graph to the edges its own box can reach once, and reads this list for every
// lot in the box, instead of sweeping the whole graph once per lot (M3.T20).
export function frontageRoadOn(edges, p, byId) {
  const box = { minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 };
  let best = null;
  for (const edge of edges) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    const gap = boxEdgeGap(box, a, b);
    if (gap <= FRONTAGE_MAX + 1e-6 && (!best || gap < best.gap)) best = { edge, gap };
  }
  return best;
}

// The edges whose own box comes within `reach` of `box`, the graph's own order
// kept. Every road runs along one axis (D2), so the gap between a footprint
// and an edge centre-line is one axis gap per direction (boxEdgeGap): an edge
// whose span stays farther out than the reach on either axis cannot meet
// anything inside the box. `reach` is FRONTAGE_MAX for a frontage sweep, and
// wider still for a replan, which measures one span against its neighbours.
export function edgesIn(edges, byId, box, reach = FRONTAGE_MAX) {
  const near = [];
  for (const edge of edges) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    if (!a || !b) continue;
    if (Math.max(a.x, b.x) < box.minX - reach || Math.min(a.x, b.x) > box.maxX + reach
      || Math.max(a.z, b.z) < box.minZ - reach || Math.min(a.z, b.z) > box.maxZ + reach) continue;
    near.push(edge);
  }
  return near;
}

// Every parcel whose footprint meets the box { minX, maxX, minZ, maxZ }, in the
// map's own order: the only parcels an edit on that box reads, so a replan or a
// frontage sweep never touches a lot it cannot change (M3.T20).
export function parcelsIn(map, box) {
  return (map.parcels ?? []).filter((p) => p.x - p.w / 2 <= box.maxX && p.x + p.w / 2 >= box.minX
    && p.z - p.d / 2 <= box.maxZ && p.z + p.d / 2 >= box.minZ);
}

// Every building whose footprint meets the box { minX, maxX, minZ, maxZ }.
export function buildingsIn(map, box) {
  return map.buildings.filter((b) => b.x - b.w / 2 <= box.maxX && b.x + b.w / 2 >= box.minX
    && b.z - b.d / 2 <= box.maxZ && b.z + b.d / 2 >= box.minZ);
}

// The district a point stands in, or null. M3.T36 adds map.districts; today a
// map holds one.
export function districtAt(map, x, z) {
  const districts = map.districts ?? [map.district];
  return districts.find((d) => x >= d.walk.minX && x <= d.walk.maxX
    && z >= d.walk.minZ && z <= d.walk.maxZ) ?? null;
}

// ---------------------------------------------------------------------------
// Dirty tiles. The render's chunk manager cuts the world at 64 m (render/
// chunks.js); an edit marks the tiles its footprint touches so only they are
// built again (M3.T27). The size and the keys live in the sim, next to the map
// that holds them, because src/sim/ cannot import the renderer (law 5).
export const TILE_SIZE = 64;
const TILE_EPS = 1e-6;

export function tileOf(x, z) {
  return `${Math.floor(x / TILE_SIZE)},${Math.floor(z / TILE_SIZE)}`;
}

// Every tile a box overlaps. A box edge that lands exactly on a tile line does
// not reach across it: the epsilon keeps a footprint touching a boundary from
// claiming the neighbour.
export function tilesIn(box) {
  const keys = new Set();
  const hiX = Math.floor((box.maxX - TILE_EPS) / TILE_SIZE);
  const hiZ = Math.floor((box.maxZ - TILE_EPS) / TILE_SIZE);
  for (let tx = Math.floor(box.minX / TILE_SIZE); tx <= hiX; tx++) {
    for (let tz = Math.floor(box.minZ / TILE_SIZE); tz <= hiZ; tz++) keys.add(`${tx},${tz}`);
  }
  return [...keys];
}

export function markDirty(map, box) {
  for (const key of tilesIn(box)) map.dirty.add(key);
}

// Hand the dirty tiles back in a stable order (by tile x, then z) and clear the
// set, so one version change rebuilds each tile once.
export function drainDirty(map) {
  const keys = [...map.dirty].sort((a, b) => {
    const [ax, az] = a.split(',').map(Number);
    const [bx, bz] = b.split(',').map(Number);
    return ax - bx || az - bz;
  });
  map.dirty.clear();
  return keys;
}

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

// Sorted keys, so a field reorder is not an edit.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

// A stable 64-bit fingerprint of everything the map holds. The ops test
// (M3.T21) uses it to prove 200 edits and their undos give the map back.
export function mapHash(map) {
  const text = canonical(map);
  let hash = FNV_OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash.toString(16).padStart(16, '0');
}
