// The city's one description of itself: the road graph, the district bounds and
// the lookups derived from them. Pure data and pure maths — no three, no DOM
// (law 5). A new district is an entry in DISTRICTS, not a new file.
//
// Before this existed the avenue positions lived in five files and the bounds
// box in four, and the four had already drifted apart. Everything that needs to
// know where the city is reads it from here.
//
// It also builds its own district's terrain (sim/terrain.js) and re-exports
// heightAt, so anything that sits on the ground asks here instead of assuming 0.
import { createTerrain, roadFlatRects as flatRectsFor, ROAD_HALF_WIDTH } from './terrain.js';
import { generateDistrict } from './citygen.js';
import { worldSeed } from './seedstore.js';

// Carriageway geometry: the half-width lives in terrain.js, which needs it for
// the flat road footprints and cannot import this file (the one-way rule).
// Lanes sit 2 m off the centre-line because that is where traffic has always
// been drawn.
export { ROAD_HALF_WIDTH } from './terrain.js';
export const LANE_OFFSET = 2;

// Every node is on a carriageway and heightAt() is exactly zero on every
// carriageway — the road footprints are the flat rects the field is built
// around. A node off the tarmac (a ramp, a bridge deck) will have to sample it.
const GROUND_Y = 0;

// Avenues run N-S along z, crossings run E-W along x. Each is declared as a
// span; the graph is derived by cutting every span where the other axis meets
// it, so an intersection is never written down twice.
const HAND_DOWNTOWN = {
  id: 'downtown',
  avenues: [
    { id: 'main', x: 0, z0: -100, z1: 100, lanes: 2 },
    { id: 'east', x: 44, z0: -100, z1: 100, lanes: 2 },
    { id: 'west', x: -44, z0: -100, z1: 100, lanes: 2 },
  ],
  crossings: [
    { id: 'plaza', z: 40, x0: -52, x1: 52, lanes: 2 },
    { id: 'south', z: -64, x0: -7, x1: 51, lanes: 2 },
  ],
  // Where a person may go: the whole district floor. West edge is the far verge
  // beyond the west avenue, east edge is the far side of the pocket park and
  // the two infill towers flanking it (block.js:265).
  walk: { minX: -52, maxX: 70, minZ: -68, maxZ: 100 },
  // Where a car may go. Narrower on the east because the tarmac ends there —
  // the plaza crossing is 104 m of road centred on x = 0, so the network itself
  // stops at x = 52 and past it is park, not street.
  drive: { minX: -52, maxX: 52, minZ: -68, maxZ: 100 },
};

const { seed, generate } = worldSeed();
const DOWNTOWN = generate ? generateDistrict(seed) : HAND_DOWNTOWN;

export const DISTRICTS = [DOWNTOWN];

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

// kind names what the edge is for. 'avenue' and 'connector' are all the city has
// today; 'bridge', 'tunnel' and 'ramp' join them when a road leaves the flat.
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

function addDistrict(district, nodes, edges) {
  for (const av of district.avenues) {
    const met = district.crossings.filter((c) => spans(c.x0, c.x1, av.x)).map((c) => c.z);
    const zs = cutPoints(av.z0, av.z1, met);
    addChain(nodes, edges, district, av, 'avenue', 'z', zs.map((z) => [av.x, z]));
  }
  for (const cr of district.crossings) {
    const met = district.avenues.filter((a) => spans(a.z0, a.z1, cr.z)).map((a) => a.x);
    const xs = cutPoints(cr.x0, cr.x1, met);
    addChain(nodes, edges, district, cr, 'connector', 'x', xs.map((x) => [x, cr.z]));
  }
}

const NODE_BY_ID = new Map();
export const EDGES = [];
for (const district of DISTRICTS) addDistrict(district, NODE_BY_ID, EDGES);
export const NODES = [...NODE_BY_ID.values()];

export function node(id) {
  return NODE_BY_ID.get(id) ?? null;
}

function unionBox(boxes) {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    minZ: Math.min(...boxes.map((b) => b.minZ)),
    maxZ: Math.max(...boxes.map((b) => b.maxZ)),
  };
}

// The two playable boxes, and the only ones. They differ on purpose: a person
// can cross the east park, a car has no road to get there on. When a second
// district lands these stop being one box each and become per-district
// containment — a union box would let you walk through the gap between them.
export const WALK_BOUNDS = unionBox(DISTRICTS.map((d) => d.walk));
export const DRIVE_BOUNDS = unionBox(DISTRICTS.map((d) => d.drive));

// How far the road network itself reaches. Wider in z than the playable box —
// the avenues run on past the bounds so the vista closes on towers, not void.
export const GRAPH_EXTENT = {
  minX: Math.min(...NODES.map((n) => n.x)),
  maxX: Math.max(...NODES.map((n) => n.x)),
  minZ: Math.min(...NODES.map((n) => n.z)),
  maxZ: Math.max(...NODES.map((n) => n.z)),
};

// Slide a point back inside a box. `hit` is what a car needs: it kills its speed
// against a wall rather than grinding along it.
export function clampToBounds(bounds, x, z) {
  const cx = Math.max(bounds.minX, Math.min(bounds.maxX, x));
  const cz = Math.max(bounds.minZ, Math.min(bounds.maxZ, z));
  return { x: cx, z: cz, hit: cx !== x || cz !== z };
}

function projectOnSegment(x, z, a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const raw = len2 === 0 ? 0 : ((x - a.x) * dx + (z - a.z) * dz) / len2;
  const t = Math.max(0, Math.min(1, raw));
  const px = a.x + dx * t;
  const pz = a.z + dz * t;
  return { t, x: px, z: pz, dist: Math.hypot(x - px, z - pz) };
}

// The stretch of road a point is standing on, the closest point on its
// centre-line, how far along that is (t, 0..1) and the distance to it.
export function nearestEdge(x, z) {
  let best = null;
  for (const edge of EDGES) {
    const hit = projectOnSegment(x, z, node(edge.a), node(edge.b));
    if (!best || hit.dist < best.dist) best = { edge, ...hit };
  }
  return best;
}

// Where a car driving this edge sits. `dir` is the sign of travel along the
// edge's own axis, and the lane sits LANE_OFFSET to the positive side of the
// other axis — exactly where street.js has always drawn traffic. That makes
// N-S right-hand and E-W left-hand, an inconsistency inherited from the shipped
// street; it gets settled when traffic migrates onto this graph, not before.
export function laneCenterLine(edge, dir) {
  const a = node(edge.a);
  const b = node(edge.b);
  const off = dir * LANE_OFFSET;
  const ox = edge.axis === 'z' ? off : 0;
  const oz = edge.axis === 'x' ? off : 0;
  return {
    x0: a.x + ox, z0: a.z + oz, y0: a.y,
    x1: b.x + ox, z1: b.z + oz, y1: b.y,
  };
}

// ---------------------------------------------------------------------------
// The ground gets a Y in sim/terrain.js (M4.T2). This file builds one terrain
// for its own district so every existing heightAt() call site keeps working;
// the map's own terrain (sim/map.js) is the authority for new code.
//
// The hand map's flats are its own roads plus the one deck no road table
// describes. The district here is fixed, so the rect builder takes no argument
// — the shape tests/streetscape-wire.spec.js pins.
const roadFlatRects = () => flatRectsFor(DOWNTOWN);
const PROMENADE = [-17, -32, 11, 4.5];
const FLAT_RECTS = [...roadFlatRects(), ...(generate ? [] : [PROMENADE])];
const TERRAIN = createTerrain({
  district: DOWNTOWN,
  flatRects: FLAT_RECTS,
});
export const heightAt = TERRAIN.heightAt;
export const buildable = TERRAIN.buildable;

// Whole-way lookups, added when render/block.js, render/lamps.js and
// sim/street.js migrated onto this file.
//
// The graph above is nodes and edges, which is what a car following a road
// wants. A generator that lays one down wants the other half: the uncut way,
// by name, with its middle and its length — a carriageway is drawn as one quad
// and its kerbs as one box, not as a chain of segments.
// ---------------------------------------------------------------------------

// The pavement flanking a carriageway, kerb face to building line. Render lays
// the slab and the sim walks people down it, so the width belongs to the road's
// cross-section rather than to either of them.
export const WALKWAY_WIDTH = 3;

const WAYS_BY_ID = new Map();
for (const d of DISTRICTS) {
  for (const w of [...d.avenues, ...d.crossings]) WAYS_BY_ID.set(w.id, w);
}

// An avenue or a crossing by name, so a call site can say 'plaza' and never 40.
export function way(id) {
  const found = WAYS_BY_ID.get(id);
  if (!found) throw new Error(`world: no way named ${id}`);
  return found;
}

// An avenue carries an x and runs in z; a crossing is the other way round.
export function isAvenue(w) {
  return w.x !== undefined;
}

export const AVENUES = DISTRICTS.flatMap((d) => d.avenues);
export const CROSSINGS = DISTRICTS.flatMap((d) => d.crossings);
// Centre-lines, in declaration order — the order the street was built in, and
// the order anything merging geometry has to keep to stay byte-identical.
export const AVENUE_X = AVENUES.map((a) => a.x);
export const CROSSING_Z = CROSSINGS.map((c) => c.z);

export function wayCenter(w) {
  return isAvenue(w)
    ? { x: w.x, z: (w.z0 + w.z1) / 2 }
    : { x: (w.x0 + w.x1) / 2, z: w.z };
}

export function wayLength(w) {
  return isAvenue(w) ? w.z1 - w.z0 : w.x1 - w.x0;
}
