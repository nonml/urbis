// M3.T29 (M3-6, docs/ROADMAP.md): car following on the road graph. A car holds
// the edge it is on (route[leg]), the direction it drives it (dir), how far it
// has come (s) and the route it is driving. It keeps a gap to the car ahead in
// its own lane, brakes on the arrival curve and turns at the next node through
// a short interpolation. Pure sim (law 5): no three.js, no DOM.
//
// The lane side is settled here: both axes drive on the right of travel,
// LANE_OFF 2.4 m out. world.js:laneCenterLine predates this and offsets N-S
// right but E-W left; traffic reads the graph through lanePoint and never
// through that, and M3.T32 moves the renderer onto this pose.
//
// M3.T30 gives every car an A* trip between parcels, chained at its destination
// through the ordinary turn, so a car never stops dead and never jumps. Only a
// boot car is placed where the camera cannot see it (60 m out, off axis); cars
// are mutated in place, never spliced, because street.js renders these objects.
// T29's tests place cars by hand, in the shape this module reads and writes.
import { mulberry32 } from './rng.js';
import { frontageRoad } from './map.js';

export const CAR_LEN = 4.5;
export const LANE_OFF = 2.4;
export const VMAX = 13.5;
export const ACCEL = 2.5;
export const BRAKE = 6;
export const GAP_MIN = 2.5;
export const TURN_SECS = 0.6;
const FOLLOW_GAIN = 1.5;

// M3-6's appear/go allowance, with margin: the follow cam rides 4.5 m behind the
// player, so a spot this far past 60 m clears the camera too. VIEW_DOT is cos 53
// degrees — inside the 82-degree horizontal frame and far enough off axis that
// the page-side view test reads it as out of frame.
const CAM_DIST = 60;
const CAM_MARGIN = 10;
const VIEW_DOT = 0.6;
const TRIP_TRIES = 40;
const TRIP_SEED = 0x51ed2701;

// The lane a car drives: `dir` is the sign of travel along the edge's own a->b
// order, and the lane sits LANE_OFF to the right of that travel. Right of
// (ux, uz) is (uz, -ux), so the two directions sit 2 * LANE_OFF apart.
export function lanePoint(map, edge, dir, s) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  return pointOn(byId, edge, dir, s);
}

function pointOn(byId, edge, dir, s) {
  const from = byId.get(dir > 0 ? edge.a : edge.b);
  const to = byId.get(dir > 0 ? edge.b : edge.a);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  return {
    x: from.x + ux * s + uz * LANE_OFF,
    z: from.z + uz * s - ux * LANE_OFF,
    yaw: Math.atan2(ux, uz),
  };
}

function lengthOf(byId, edge) {
  const a = byId.get(edge.a);
  const b = byId.get(edge.b);
  return Math.hypot(b.x - a.x, b.z - a.z);
}

// Node, edge and lane-adjacency indexes, rebuilt whenever a road op bumps
// map.version, so a removed edge cannot keep a route alive behind the sim's
// back (M3.T19). The trip spots — one per parcel, on the road it fronts — are
// rebuilt with them, so a road op's new lots join the traffic.
function indexes(state) {
  if (state.indexVersion === state.map.version) return false;
  state.byId = new Map(state.map.graph.nodes.map((n) => [n.id, n]));
  state.edgeById = new Map(state.map.graph.edges.map((e) => [e.id, e]));
  state.links = linksOf(state);
  state.spots = spotsOf(state);
  state.indexVersion = state.map.version;
  return true;
}

function linksOf(state) {
  const links = new Map(state.map.graph.nodes.map((n) => [n.id, []]));
  for (const e of state.map.graph.edges) {
    const len = lengthOf(state.byId, e);
    links.get(e.a).push({ to: e.b, len, edge: e, dir: 1 });
    links.get(e.b).push({ to: e.a, len, edge: e, dir: -1 });
  }
  return links;
}

// A trip endpoint: a parcel mapped to the graph node nearest its frontage road.
// A parcel with no road falls back to its nearest node; a map with no parcels
// (the hand preset) uses the nodes themselves.
function spotsOf(state) {
  const map = state.map;
  const spots = [];
  if (Array.isArray(map.parcels) && map.parcels.length > 0) {
    for (const p of map.parcels) {
      const road = frontageRoad(map, p, state.byId);
      const node = road ? nearerEnd(state, road.edge, p) : nearestNode(state, p.x, p.z);
      if (node) spots.push({ node: node.id, x: p.x, z: p.z });
    }
  }
  if (spots.length === 0) {
    for (const n of map.graph.nodes) spots.push({ node: n.id, x: n.x, z: n.z });
  }
  return spots;
}

function nearerEnd(state, edge, p) {
  const a = state.byId.get(edge.a);
  const b = state.byId.get(edge.b);
  return Math.hypot(a.x - p.x, a.z - p.z) <= Math.hypot(b.x - p.x, b.z - p.z) ? a : b;
}

function nearestNode(state, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const n of state.map.graph.nodes) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}

export function createTraffic(map, seed, count = 0) {
  const state = {
    map, seed, time: 0, cars: [], indexVersion: null,
    want: count, nextId: 1, rng: mulberry32(seed ^ TRIP_SEED), cam: null,
    links: new Map(), spots: [],
  };
  indexes(state);
  for (let i = 0; i < count; i++) state.cars.push(makeCar(state));
  return state;
}

// A car in the shape tick reads and writes, carrying the renderer's interim
// `axis` and `speed` (M3.T32 moves the renderer onto yaw and v).
function makeCar(state) {
  const c = {
    id: 0, route: [], leg: 0, dir: 1, s: 0, v: 0, turn: null, goal: null,
    axis: 'z', speed: 0, prev: {}, x: 0, z: 0, yaw: 0,
  };
  if (!assignTrip(state, c, null, false)) assignTrip(state, c, null, true);
  return c;
}

// A new trip: from a parcel's node (`from`; a random one when null) to another
// parcel's, on an A* route, starting on the first edge's lane. A boot car (no
// origin) starts part-way along that edge, so the fleet is spread over the
// graph from the first frame instead of queued at a handful of junctions.
// `allowInView` lets a boot car take a start the camera can see when no
// out-of-view one comes up; only makeCar ever allows that.
function assignTrip(state, c, from, allowInView) {
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const origin = from ?? pick(state.rng, state.spots)?.node;
    const to = pick(state.rng, state.spots);
    if (!origin || !to || origin === to.node) continue;
    const route = findRoute(state, origin, to.node);
    if (!route) continue;
    const edge = state.edgeById.get(route[0]);
    const dir = edge.a === origin ? 1 : -1;
    const s0 = from === null ? freeStart(state, c, edge, dir) : clearAt(state, c, edge.id, dir, 0) ? 0 : null;
    if (s0 === null) continue;
    const p = pointOn(state.byId, edge, dir, s0);
    if (!allowInView && !outOfView(state, p.x, p.z)) continue;
    c.id = state.nextId;
    state.nextId += 1;
    c.route = route; c.leg = 0; c.dir = dir; c.s = s0; c.v = 0; c.turn = null;
    c.goal = to.node; c.axis = edge.axis; c.speed = 0;
    Object.assign(c, p);
    c.prev.x = p.x;
    c.prev.z = p.z;
    return true;
  }
  return false;
}

// No other car within a car length and a gap of `s` on one lane: two cars at
// the same spot hold each other at gap zero for good, so nothing is placed
// there. `freeStart` searches a spread-out spot for a car with no origin.
function clearAt(state, c, edgeId, dir, s) {
  for (const o of state.cars) {
    if (o === c || o.turn || o.route.length === 0) continue;
    if (o.route[o.leg] === edgeId && o.dir === dir && Math.abs(o.s - s) < CAR_LEN + GAP_MIN) return false;
  }
  return true;
}

function freeStart(state, c, edge, dir) {
  const span = lengthOf(state.byId, edge) * 0.9;
  for (let tries = 0; tries < 8; tries++) {
    const s = state.rng() * span;
    if (clearAt(state, c, edge.id, dir, s)) return s;
  }
  return null;
}

// The next trip for a car standing at its destination: a new far parcel, driven
// from here. The car turns out of its arrival lane into the new one over the
// usual 0.6 s, so it never stops dead at the node and never jumps.
function rollTrip(state, c) {
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const to = pick(state.rng, state.spots);
    if (!to || to.node === c.goal) continue;
    const route = findRoute(state, c.goal, to.node);
    if (!route) continue;
    const edge = state.edgeById.get(route[0]);
    const dir = edge.a === c.goal ? 1 : -1;
    if (!clearAt(state, c, edge.id, dir, 0)) continue;
    c.turn = { from: { x: c.x, z: c.z, yaw: c.yaw }, to: pointOn(state.byId, edge, dir, 0), t: 0 };
    c.id = state.nextId;
    state.nextId += 1;
    c.route = route; c.leg = 0; c.dir = dir; c.s = 0;
    c.goal = to.node; c.axis = edge.axis;
    return true;
  }
  return false;
}

function pick(rng, arr) {
  return arr.length === 0 ? null : arr[Math.floor(rng() * arr.length)];
}

// The criterion's allowance: at least CAM_DIST from the camera and off its view
// axis. The camera defaults to the map's own spawn until the render loop wires
// the live one.
function outOfView(state, x, z) {
  const cam = state.cam ?? state.map.spawn?.player;
  if (!cam) return true;
  const dx = x - cam.x;
  const dz = z - cam.z;
  const d = Math.hypot(dx, dz);
  if (d < CAM_DIST + CAM_MARGIN) return false;
  return (dx * Math.sin(cam.yaw) + dz * Math.cos(cam.yaw)) / d <= VIEW_DOT;
}

// A* over the graph, cost the edge length, heuristic the grid's Manhattan gap.
function findRoute(state, from, to) {
  const goal = state.byId.get(to);
  const g = new Map([[from, 0]]);
  const came = new Map();
  const closed = new Set();
  const open = [{ id: from, f: ahead(state, from, goal) }];
  while (open.length > 0) {
    let at = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[at].f) at = i;
    const cur = open.splice(at, 1)[0];
    if (closed.has(cur.id)) continue;
    if (cur.id === to) return routeOf(came, to);
    closed.add(cur.id);
    for (const link of state.links.get(cur.id)) {
      const ng = g.get(cur.id) + link.len;
      if (ng >= (g.get(link.to) ?? Infinity)) continue;
      g.set(link.to, ng);
      came.set(link.to, { from: cur.id, edge: link.edge });
      open.push({ id: link.to, f: ng + ahead(state, link.to, goal) });
    }
  }
  return null;
}

function ahead(state, id, goal) {
  const n = state.byId.get(id);
  return Math.abs(n.x - goal.x) + Math.abs(n.z - goal.z);
}

function routeOf(came, to) {
  const route = [];
  for (let at = to; came.has(at); at = came.get(at).from) route.unshift(came.get(at).edge.id);
  return route;
}

// A road op changed the graph: a car whose route names an edge the map no
// longer has is re-tasked from the nearest surviving node, so a removed road
// empties of it within the step and an added road can carry it later. A car
// with no route at all holds until the next tick tries again.
function revalidate(state) {
  for (const c of state.cars) {
    if (c.route.length === 0 || c.route.every((id) => state.edgeById.has(id))) continue;
    c.turn = null;
    const node = nearestNode(state, c.x, c.z);
    if (!assignTrip(state, c, node ? node.id : null, true)) { c.route = []; c.v = 0; c.s = 0; }
  }
}

export function tick(state, dt) {
  state.time += dt;
  if (indexes(state)) revalidate(state);
  const lanes = new Map();
  for (const c of state.cars) {
    if (c.turn || c.route.length === 0) continue;
    const key = `${c.route[c.leg]}|${c.dir}`;
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(c);
  }
  for (const lane of lanes.values()) lane.sort((a, b) => a.s - b.s);

  for (const c of state.cars) {
    c.prev.x = c.x;
    c.prev.z = c.z;
    if (c.turn) {
      advanceTurn(c, dt);
      continue;
    }
    if (c.route.length === 0) {
      if (state.want > 0) assignTrip(state, c, null, true);
      continue;
    }
    const edge = state.edgeById.get(c.route[c.leg]);
    if (!edge) continue;
    const len = lengthOf(state.byId, edge);
    const lane = lanes.get(`${edge.id}|${c.dir}`);
    const leader = lane[lane.indexOf(c) + 1] ?? null;
    let target = VMAX;
    if (leader) {
      // Gap keeping: match speeds on the linear law, but always be able to
      // stop on the arrival curve at the leader's tail, clear = CAR_LEN +
      // GAP_MIN behind its centre. The linear law alone cannot stop for a
      // leader at rest from VMAX.
      const clear = Math.max(0, leader.s - c.s - CAR_LEN - GAP_MIN);
      target = Math.min(target, clear * FOLLOW_GAIN, Math.sqrt(2 * BRAKE * clear));
    }
    c.v = Math.max(0, Math.max(c.v - BRAKE * dt, Math.min(c.v + ACCEL * dt, target)));
    c.s += c.v * dt;
    c.speed = c.v;
    c.axis = edge.axis;
    if (c.s < len) {
      Object.assign(c, pointOn(state.byId, edge, c.dir, c.s));
      continue;
    }
    if (c.leg === c.route.length - 1) {
      // The route ends: take the next trip from this node through the usual
      // turn, so the car never stops dead and its draw slot never jumps. A
      // hand-placed car (want 0) holds at the node for good.
      c.s = len;
      Object.assign(c, pointOn(state.byId, edge, c.dir, len));
      if (state.want > 0 && c.goal !== null) { if (!rollTrip(state, c)) c.v = 0; }
      else { c.v = 0; c.speed = 0; }
      continue;
    }
    beginTurn(state, c, edge, len);
  }
}

// Leave the edge's lane for the next edge's lane through the node. The car is
// carried by a 0.6 s interpolation; it keeps the speed it arrived with.
function beginTurn(state, c, edge, len) {
  const node = c.dir > 0 ? edge.b : edge.a;
  const next = state.edgeById.get(c.route[c.leg + 1]);
  const dir = next.a === node ? 1 : -1;
  c.turn = {
    from: pointOn(state.byId, edge, c.dir, len),
    to: pointOn(state.byId, next, dir, 0),
    t: 0,
  };
  c.leg += 1;
  c.dir = dir;
  c.s = 0;
  c.axis = next.axis;
}

function advanceTurn(c, dt) {
  c.turn.t += dt / TURN_SECS;
  const { from, to, t } = c.turn;
  if (t < 1) {
    c.x = from.x + (to.x - from.x) * t;
    c.z = from.z + (to.z - from.z) * t;
    c.yaw = Math.atan2(to.x - from.x, to.z - from.z);
    return;
  }
  c.x = to.x;
  c.z = to.z;
  c.yaw = to.yaw;
  c.turn = null;
  c.v = Math.max(c.v, 2);
}
