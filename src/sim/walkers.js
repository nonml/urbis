// M3.T33 (M3-6): walkers on the road graph. A walker holds its walkway
// (side, +1/-1 off the edge's centre-line) and its route: leg by leg to an
// edge's end, across the junction by interpolation, a new trip chained at its
// destination. `s` is the distance from the edge's a end however it faces;
// `tdir` is the way it walks that edge (+1 a->b, -1 b->a) and `dir` the world
// sign — what render/npcs.js draws and commute.js steers; steering flips
// `tdir` in place, so a commuter turns round without a jump. Pure sim (law 5).
import { mulberry32 } from './rng.js';
import { ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';

// Mid-pavement: kerb face to building line.
export const WALK_OFF = ROAD_HALF_WIDTH + WALKWAY_WIDTH / 2;
const TRIP_TRIES = 40;
const TRIP_SEED = 0x5bd1e995;

function pointOn(byId, edge, tdir, s, side) {
  const a = byId.get(edge.a), b = byId.get(edge.b);
  const dx = b.x - a.x, dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len, uz = dz / len;
  return {
    x: a.x + ux * s + uz * side * WALK_OFF,
    z: a.z + uz * s - ux * side * WALK_OFF,
    yaw: Math.atan2(tdir > 0 ? ux : -ux, tdir > 0 ? uz : -uz),
  };
}

// `orient` is which way the edge runs on its own axis; `dir` is the world sign.
function face(w, byId, edge, tdir) {
  const a = byId.get(edge.a), b = byId.get(edge.b);
  const d = edge.axis === 'x' ? b.x - a.x : b.z - a.z;
  w.orient = d < 0 ? -1 : 1;
  w.tdir = tdir; w.axis = edge.axis;
  w.dir = tdir * w.orient;
}
function lengthOf(byId, edge) {
  const a = byId.get(edge.a);
  const b = byId.get(edge.b);
  return Math.hypot(b.x - a.x, b.z - a.z);
}

// Rebuilt when a road op bumps map.version; trips run node to node.
function indexes(state) {
  if (state.indexVersion === state.map.version) return false;
  state.byId = new Map(state.map.graph.nodes.map((n) => [n.id, n]));
  state.edgeById = new Map(state.map.graph.edges.map((e) => [e.id, e]));
  state.links = new Map(state.map.graph.nodes.map((n) => [n.id, []]));
  for (const e of state.map.graph.edges) {
    const len = lengthOf(state.byId, e);
    state.links.get(e.a).push({ to: e.b, len, edge: e });
    state.links.get(e.b).push({ to: e.a, len, edge: e });
  }
  state.spots = state.map.graph.nodes.map((n) => n.id);
  state.indexVersion = state.map.version;
  return true;
}

export function createWalkers(map, seed, bodies = []) {
  const state = { map, seed, time: 0, walkers: [], indexVersion: null, rng: mulberry32((seed ^ TRIP_SEED) >>> 0),
    links: new Map(), spots: [] };
  indexes(state);
  for (const body of bodies) state.walkers.push(makeWalker(state, body));
  return state;
}

// Boot walkers start spread along their first edge.
function makeWalker(state, body) {
  const w = { ...body, route: [], leg: 0, tdir: 1, orient: 1, s: 0, side: 1, turn: null,
    axis: 'z', dir: 1, v: 0, x: 0, z: 0, yaw: 0 };
  if (assignTrip(state, w, null)) return w;
  const n0 = state.map.graph.nodes[0]; if (n0) { w.x = n0.x + WALK_OFF; w.z = n0.z; }
  return w;
}

// A new trip on a shortest-path route; a boot walker starts mid-first-edge.
function assignTrip(state, w, from) {
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const origin = from ?? pick(state.rng, state.spots);
    const to = pick(state.rng, state.spots);
    if (!origin || !to || origin === to) continue;
    const route = findRoute(state, origin, to);
    if (!route || route.length === 0) continue;
    const edge = state.edgeById.get(route[0]);
    const tdir = edge.a === origin ? 1 : -1;
    const s0 = from === null ? state.rng() * lengthOf(state.byId, edge) * 0.9 : 0;
    w.route = route; w.leg = 0; w.s = s0; w.turn = null;
    w.side = state.rng() < 0.5 ? -1 : 1;
    face(w, state.byId, edge, tdir);
    Object.assign(w, pointOn(state.byId, edge, tdir, s0, w.side));
    return true;
  }
  return false;
}

// The next trip from the destination node, so the walker never stops dead.
function rollTrip(state, w, from) {
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const to = pick(state.rng, state.spots);
    if (!to || to === from) continue;
    const route = findRoute(state, from, to);
    if (!route || route.length === 0) continue;
    w.route = route; w.leg = 0;
    return state.edgeById.get(route[0]);
  }
  return null;
}

function pick(rng, arr) {
  return arr.length === 0 ? null : arr[Math.floor(rng() * arr.length)];
}
// Shortest path (Dijkstra: dozens of nodes, no heuristic), cost edge length.
function findRoute(state, from, to) {
  if (!state.byId.has(from) || !state.byId.has(to)) return null;
  const g = new Map([[from, 0]]);
  const came = new Map();
  const closed = new Set();
  const open = [{ id: from, f: 0 }];
  while (open.length > 0) {
    let at = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[at].f) at = i;
    const cur = open.splice(at, 1)[0];
    if (closed.has(cur.id)) continue;
    if (cur.id === to) return routeOf(came, to);
    closed.add(cur.id);
    for (const link of state.links.get(cur.id) ?? []) {
      const ng = g.get(cur.id) + link.len;
      if (ng >= (g.get(link.to) ?? Infinity)) continue;
      g.set(link.to, ng);
      came.set(link.to, { from: cur.id, edge: link.edge });
      open.push({ id: link.to, f: ng });
    }
  }
  return null;
}

function routeOf(came, to) {
  const route = [];
  for (let at = to; came.has(at); at = came.get(at).from) route.unshift(came.get(at).edge.id);
  return route;
}
// A road op changed the graph: a walker whose route names a gone edge is
// re-tasked from scratch, so a removed road empties of it.
function revalidate(state) {
  for (const w of state.walkers) {
    if (w.route.length === 0 || w.route.every((id) => state.edgeById.has(id))) continue;
    w.turn = null;
    if (!assignTrip(state, w, null)) { w.route = []; w.s = 0; }
  }
}

export function tick(state, dt) {
  state.time += dt;
  if (indexes(state)) revalidate(state);
  for (const w of state.walkers) {
    const v = w.v ?? w.speed ?? 0;
    if (w.turn) { advanceTurn(w, dt); continue; }
    if (w.route.length === 0) { assignTrip(state, w, null); continue; }
    const edge = state.edgeById.get(w.route[w.leg]);
    if (!edge) continue;
    // commute.js steers z walkers by `dir` between steps; obey by turning
    // round on the same pavement rather than stepping across the walkway.
    if (edge.axis === 'z' && w.dir !== 0 && w.dir !== w.tdir * w.orient) w.tdir *= -1;
    const len = lengthOf(state.byId, edge);
    const s = w.s + w.tdir * v * dt;
    if (s > len || s < 0) { arrive(state, w, edge, len, s, v); continue; }
    w.s = s;
    const p = pointOn(state.byId, edge, w.tdir, s, w.side);
    w.phase += Math.hypot(p.x - w.x, p.z - w.z) * 4;
    w.x = p.x; w.z = p.z; w.yaw = p.yaw; w.axis = edge.axis; w.dir = w.tdir * w.orient;
  }
}

// Off one end: the route's next leg takes it, its far end rolls a new trip
// from that node, a dead end turns round in place.
function arrive(state, w, edge, len, s, v) {
  const atB = s > len;
  const node = atB ? edge.b : edge.a;
  const from = pointOn(state.byId, edge, w.tdir, Math.max(0, Math.min(len, w.s)), w.side);
  let next = null;
  if (atB && w.leg < w.route.length - 1) {
    next = state.edgeById.get(w.route[w.leg + 1]) ?? null;
    if (next) w.leg += 1;
  } else if (!atB && w.leg > 0) {
    next = state.edgeById.get(w.route[w.leg - 1]) ?? null;
    if (next) w.leg -= 1;
  }
  if (!next) next = rollTrip(state, w, node);
  if (!next) { w.tdir *= -1; w.s = Math.max(0, Math.min(len, w.s)); return; }
  beginTurn(state, w, next, node, from, v);
}

// Onto the next edge at the node's own end, paced at the walker's own speed:
// no step outruns it, and v 0 holds it mid-crossing in a blackout.
function beginTurn(state, w, next, node, from, v) {
  const tdir = next.a === node ? 1 : -1;
  const s0 = tdir > 0 ? 0 : lengthOf(state.byId, next);
  const to = pointOn(state.byId, next, tdir, s0, w.side);
  const dist = Math.hypot(to.x - from.x, to.z - from.z);
  w.s = s0;
  face(w, state.byId, next, tdir);
  if (dist < 1e-6) { w.x = to.x; w.z = to.z; w.yaw = to.yaw; return; }
  w.turn = { from, to, t: 0, dist, spd: Math.max(v, 0) };
}

function advanceTurn(w, dt) {
  const u = w.turn;
  u.t += (u.spd * dt) / u.dist;
  const k = Math.min(u.t, 1);
  const nx = u.from.x + (u.to.x - u.from.x) * k;
  const nz = u.from.z + (u.to.z - u.from.z) * k;
  w.phase += Math.hypot(nx - w.x, nz - w.z) * 4;
  w.x = nx; w.z = nz;
  w.yaw = Math.atan2(u.to.x - u.from.x, u.to.z - u.from.z);
  if (u.t < 1) return;
  w.x = u.to.x; w.z = u.to.z; w.yaw = u.to.yaw; w.turn = null;
}
