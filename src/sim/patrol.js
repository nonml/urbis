// How the police read the city: along the map's road graph and down the street
// they are standing in. Pure maths over the map's nodes and edges — no state.
//
// Sight is a street, not a radius. Towers fill every block between the ways, so
// two points see each other when they stand in the same avenue or crossing, and
// otherwise only when they are close enough to look round a corner. That is the
// whole rule, and it is the one a player can learn: turn off the street a
// cruiser is in and it has lost you.
//
// Every reader takes the map last; callers that predate the map (response.js,
// save.js, probe.js and the Node tests) fall back to worldMap(), today's city.
import { createMap, edgesNear } from './map.js';
import { DISTRICTS, EDGES, NODES, ROAD_HALF_WIDTH, WALKWAY_WIDTH, isAvenue } from './world.js';
import { PURSUIT_HOMES } from './anchors.js';
import { SPAWN } from './spawn.js';
import { worldSeed } from './seedstore.js';

// A street as a sight line: kerb to building line on both sides.
const STREET_HALF = ROAD_HALF_WIDTH + WALKWAY_WIDTH;
// Close enough to see round a corner, or into the dark.
export const CLOSE_SIGHT = 12;
// Down a lit street. Past this, fog and traffic hide a car.
export const STREET_SIGHT = 46;
// A waypoint this near counts as reached.
const ARRIVE = 4;
// Inside this range a car stops routing and goes straight for the target, up
// the kerb if it has to — the last few metres of a chase are not on the map.
const DIRECT_RANGE = 16;
// Keep placements this far inside the drive box, so nothing lands where a car
// cannot reach.
const BOUNDS_MARGIN = 6;

let CACHED = null;
// The world being played, as a map. A generated world is createMap's own; the
// hand preset keeps the tables world.js built at load. M3.T14 removes this with
// the last constants.
export function worldMap() {
  if (CACHED) return CACHED;
  const { seed, generate } = worldSeed();
  CACHED = generate ? createMap(seed) : {
    seed,
    version: 0,
    district: DISTRICTS[0],
    graph: { nodes: NODES, edges: EDGES },
    anchors: { pursuitHomes: PURSUIT_HOMES },
    spawn: SPAWN,
  };
  return CACHED;
}

// The map's own graph, indexed by node id and by the links out of each node.
// Built once per map: the police read it every tick.
const GRAPHS = new WeakMap();

function graphOf(map) {
  let graph = GRAPHS.get(map);
  if (graph) return graph;
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const links = new Map(map.graph.nodes.map((n) => [n.id, []]));
  for (const e of map.graph.edges) {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    links.get(a.id).push({ to: b.id, len, edge: e });
    links.get(b.id).push({ to: a.id, len, edge: e });
  }
  graph = { byId, links };
  GRAPHS.set(map, graph);
  return graph;
}

function waysOf(map) {
  return [...map.district.avenues, ...map.district.crossings];
}

function inStreet(w, x, z) {
  if (isAvenue(w)) return Math.abs(x - w.x) <= STREET_HALF && z >= w.z0 && z <= w.z1;
  return Math.abs(z - w.z) <= STREET_HALF && x >= w.x0 && x <= w.x1;
}

export function shareStreet(ax, az, bx, bz, map = worldMap()) {
  return waysOf(map).some((w) => inStreet(w, ax, az) && inStreet(w, bx, bz));
}

// Can an officer at (ax, az) see a suspect at (bx, bz)? `cover` is the suspect
// standing in a blacked-out zone: then only a close look finds them.
export function canSee(ax, az, bx, bz, cover, map = worldMap()) {
  const d = Math.hypot(bx - ax, bz - az);
  if (d <= CLOSE_SIGHT) return true;
  if (cover || d > STREET_SIGHT) return false;
  return shareStreet(ax, az, bx, bz, map);
}

function endsOf(map, hit) {
  const { byId } = graphOf(map);
  const a = byId.get(hit.edge.a);
  const b = byId.get(hit.edge.b);
  return [
    { id: a.id, cost: Math.hypot(a.x - hit.x, a.z - hit.z) },
    { id: b.id, cost: Math.hypot(b.x - hit.x, b.z - hit.z) },
  ];
}

// Shortest node path from one road position to another. Fifteen nodes: a plain
// O(n^2) Dijkstra is cheaper than any structure that would speed it up.
function shortestPath(map, from, to) {
  const { byId, links } = graphOf(map);
  const dist = new Map([...byId.keys()].map((id) => [id, Infinity]));
  const prev = new Map();
  for (const s of endsOf(map, from)) dist.set(s.id, s.cost);
  const open = new Set(byId.keys());
  while (open.size) {
    let here = null;
    for (const id of open) if (here === null || dist.get(id) < dist.get(here)) here = id;
    open.delete(here);
    if (dist.get(here) === Infinity) break;
    for (const l of links.get(here)) {
      const via = dist.get(here) + l.len;
      if (via < dist.get(l.to)) {
        dist.set(l.to, via);
        prev.set(l.to, here);
      }
    }
  }
  let best = null;
  for (const g of endsOf(map, to)) {
    const total = dist.get(g.id) + g.cost;
    if (!best || total < best.total) best = { id: g.id, total };
  }
  const path = [];
  for (let id = best.id; id !== undefined; id = prev.get(id)) path.unshift(byId.get(id));
  return path;
}

// The next point a car at (x, z) should steer for to reach (gx, gz) by road.
export function nextWaypoint(x, z, gx, gz, map = worldMap()) {
  if (Math.hypot(gx - x, gz - z) <= DIRECT_RANGE || shareStreet(x, z, gx, gz, map)) return { x: gx, z: gz };
  const from = edgesNear(map, x, z)[0];
  const to = edgesNear(map, gx, gz)[0];
  if (from.dist > STREET_HALF) return { x: from.x, z: from.z };
  if (from.edge === to.edge) return { x: to.x, z: to.z };
  const next = shortestPath(map, from, to).find((n) => Math.hypot(n.x - x, n.z - z) > ARRIVE);
  return next ? { x: next.x, z: next.z } : { x: to.x, z: to.z };
}

function inside(map, x, z) {
  const { minX, maxX, minZ, maxZ } = map.district.drive;
  return x >= minX + BOUNDS_MARGIN && x <= maxX - BOUNDS_MARGIN
    && z >= minZ + BOUNDS_MARGIN && z <= maxZ - BOUNDS_MARGIN;
}

function straightOn(map, nodeId, edge, sign) {
  const { byId, links } = graphOf(map);
  const here = byId.get(nodeId);
  return links.get(nodeId).find((l) => {
    if (l.edge === edge || l.edge.axis !== edge.axis) return false;
    const there = byId.get(l.to);
    return Math.sign(edge.axis === 'z' ? there.z - here.z : there.x - here.x) === sign;
  });
}

// A point `dist` metres down the road from (x, z), travelling on `yaw`: along
// the edge the point stands on, straight through junctions, stopping short of
// the drive box or a dead end. Returns the road's axis and the travel sign too,
// because anything laid across a road needs to know which way the road runs.
export function aheadOnRoad(x, z, yaw, dist, map = worldMap()) {
  const { byId } = graphOf(map);
  const hit = edgesNear(map, x, z)[0];
  let edge = hit.edge;
  const along = edge.axis === 'z' ? Math.cos(yaw) : Math.sin(yaw);
  const sign = along >= 0 ? 1 : -1;
  let px = hit.x;
  let pz = hit.z;
  let left = dist;
  for (let guard = 0; guard < map.graph.edges.length; guard++) {
    const a = byId.get(edge.a);
    const b = byId.get(edge.b);
    const end = (edge.axis === 'z' ? b.z - a.z : b.x - a.x) * sign > 0 ? b : a;
    const run = Math.hypot(end.x - px, end.z - pz);
    const step = Math.min(left, run);
    const nx = px + (edge.axis === 'x' ? sign * step : 0);
    const nz = pz + (edge.axis === 'z' ? sign * step : 0);
    if (!inside(map, nx, nz)) break;
    px = nx;
    pz = nz;
    left -= step;
    if (left <= 0) break;
    const on = straightOn(map, end.id, edge, sign);
    if (!on) break;
    edge = on.edge;
  }
  return { x: px, z: pz, axis: edge.axis, sign, way: edge.way };
}

// The way id of the street a point is on, for anyone who has to name it.
export function streetAt(x, z, map = worldMap()) {
  return edgesNear(map, x, z)[0].edge.way;
}

// Where a unit called in from elsewhere in the city turns up: the junction
// inside the drive box whose distance from (x, z) is nearest `want`, skipping
// any in `taken` so two cars never share a spawn.
export function spawnNode(x, z, want, taken = [], map = worldMap()) {
  let best = null;
  for (const n of map.graph.nodes) {
    if (!inside(map, n.x, n.z) || taken.some((t) => t.x === n.x && t.z === n.z)) continue;
    const score = Math.abs(Math.hypot(n.x - x, n.z - z) - want);
    if (!best || score < best.score) best = { n, score };
  }
  return best ? { x: best.n.x, z: best.n.z } : { x: 0, z: map.district.drive.minZ + BOUNDS_MARGIN };
}
