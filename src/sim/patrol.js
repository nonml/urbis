// How the police read the city: along the road graph world.js owns, and down
// the street they are standing in. Pure maths over NODES and EDGES — no state.
//
// Sight is a street, not a radius. Towers fill every block between the ways, so
// two points see each other when they stand in the same avenue or crossing, and
// otherwise only when they are close enough to look round a corner. That is the
// whole rule, and it is the one a player can learn: turn off the street a
// cruiser is in and it has lost you.
import {
  AVENUES, CROSSINGS, DRIVE_BOUNDS, EDGES, NODES, ROAD_HALF_WIDTH, WALKWAY_WIDTH, isAvenue, nearestEdge, node,
} from './world.js';

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

const WAYS = [...AVENUES, ...CROSSINGS];

function inStreet(w, x, z) {
  if (isAvenue(w)) return Math.abs(x - w.x) <= STREET_HALF && z >= w.z0 && z <= w.z1;
  return Math.abs(z - w.z) <= STREET_HALF && x >= w.x0 && x <= w.x1;
}

export function shareStreet(ax, az, bx, bz) {
  return WAYS.some((w) => inStreet(w, ax, az) && inStreet(w, bx, bz));
}

// Can an officer at (ax, az) see a suspect at (bx, bz)? `cover` is the suspect
// standing in a blacked-out zone: then only a close look finds them.
export function canSee(ax, az, bx, bz, cover) {
  const d = Math.hypot(bx - ax, bz - az);
  if (d <= CLOSE_SIGHT) return true;
  if (cover || d > STREET_SIGHT) return false;
  return shareStreet(ax, az, bx, bz);
}

const LINKS = new Map(NODES.map((n) => [n.id, []]));
for (const e of EDGES) {
  const a = node(e.a);
  const b = node(e.b);
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  LINKS.get(a.id).push({ to: b.id, len, edge: e });
  LINKS.get(b.id).push({ to: a.id, len, edge: e });
}

function endsOf(hit) {
  const a = node(hit.edge.a);
  const b = node(hit.edge.b);
  return [
    { id: a.id, cost: Math.hypot(a.x - hit.x, a.z - hit.z) },
    { id: b.id, cost: Math.hypot(b.x - hit.x, b.z - hit.z) },
  ];
}

// Shortest node path from one road position to another. Fifteen nodes: a plain
// O(n^2) Dijkstra is cheaper than any structure that would speed it up.
function shortestPath(from, to) {
  const dist = new Map(NODES.map((n) => [n.id, Infinity]));
  const prev = new Map();
  for (const s of endsOf(from)) dist.set(s.id, s.cost);
  const open = new Set(NODES.map((n) => n.id));
  while (open.size) {
    let here = null;
    for (const id of open) if (here === null || dist.get(id) < dist.get(here)) here = id;
    open.delete(here);
    if (dist.get(here) === Infinity) break;
    for (const l of LINKS.get(here)) {
      const via = dist.get(here) + l.len;
      if (via < dist.get(l.to)) {
        dist.set(l.to, via);
        prev.set(l.to, here);
      }
    }
  }
  let best = null;
  for (const g of endsOf(to)) {
    const total = dist.get(g.id) + g.cost;
    if (!best || total < best.total) best = { id: g.id, total };
  }
  const path = [];
  for (let id = best.id; id !== undefined; id = prev.get(id)) path.unshift(node(id));
  return path;
}

// The next point a car at (x, z) should steer for to reach (gx, gz) by road.
export function nextWaypoint(x, z, gx, gz) {
  if (Math.hypot(gx - x, gz - z) <= DIRECT_RANGE || shareStreet(x, z, gx, gz)) return { x: gx, z: gz };
  const from = nearestEdge(x, z);
  const to = nearestEdge(gx, gz);
  if (from.dist > STREET_HALF) return { x: from.x, z: from.z };
  if (from.edge === to.edge) return { x: to.x, z: to.z };
  const next = shortestPath(from, to).find((n) => Math.hypot(n.x - x, n.z - z) > ARRIVE);
  return next ? { x: next.x, z: next.z } : { x: to.x, z: to.z };
}

function inside(x, z) {
  return x >= DRIVE_BOUNDS.minX + BOUNDS_MARGIN && x <= DRIVE_BOUNDS.maxX - BOUNDS_MARGIN
    && z >= DRIVE_BOUNDS.minZ + BOUNDS_MARGIN && z <= DRIVE_BOUNDS.maxZ - BOUNDS_MARGIN;
}

function straightOn(nodeId, edge, sign) {
  const here = node(nodeId);
  return LINKS.get(nodeId).find((l) => {
    if (l.edge === edge || l.edge.axis !== edge.axis) return false;
    const there = node(l.to);
    return Math.sign(edge.axis === 'z' ? there.z - here.z : there.x - here.x) === sign;
  });
}

// A point `dist` metres down the road from (x, z), travelling on `yaw`: along
// the edge the point stands on, straight through junctions, stopping short of
// the drive box or a dead end. Returns the road's axis and the travel sign too,
// because anything laid across a road needs to know which way the road runs.
export function aheadOnRoad(x, z, yaw, dist) {
  const hit = nearestEdge(x, z);
  let edge = hit.edge;
  const along = edge.axis === 'z' ? Math.cos(yaw) : Math.sin(yaw);
  const sign = along >= 0 ? 1 : -1;
  let px = hit.x;
  let pz = hit.z;
  let left = dist;
  for (let guard = 0; guard < EDGES.length; guard++) {
    const a = node(edge.a);
    const b = node(edge.b);
    const end = (edge.axis === 'z' ? b.z - a.z : b.x - a.x) * sign > 0 ? b : a;
    const run = Math.hypot(end.x - px, end.z - pz);
    const step = Math.min(left, run);
    const nx = px + (edge.axis === 'x' ? sign * step : 0);
    const nz = pz + (edge.axis === 'z' ? sign * step : 0);
    if (!inside(nx, nz)) break;
    px = nx;
    pz = nz;
    left -= step;
    if (left <= 0) break;
    const on = straightOn(end.id, edge, sign);
    if (!on) break;
    edge = on.edge;
  }
  return { x: px, z: pz, axis: edge.axis, sign, way: edge.way };
}

// The way id of the street a point is on, for anyone who has to name it.
export function streetAt(x, z) {
  return nearestEdge(x, z).edge.way;
}

// Where a unit called in from elsewhere in the city turns up: the junction
// inside the drive box whose distance from (x, z) is nearest `want`, skipping
// any in `taken` so two cars never share a spawn.
export function spawnNode(x, z, want, taken = []) {
  let best = null;
  for (const n of NODES) {
    if (!inside(n.x, n.z) || taken.some((t) => t.x === n.x && t.z === n.z)) continue;
    const score = Math.abs(Math.hypot(n.x - x, n.z - z) - want);
    if (!best || score < best.score) best = { n, score };
  }
  return best ? { x: best.n.x, z: best.n.z } : { x: 0, z: DRIVE_BOUNDS.minZ + BOUNDS_MARGIN };
}
