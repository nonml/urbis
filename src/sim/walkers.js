// M3.T34 (M3-6): walkers on the road graph. A walker holds its walkway
// (side, +1/-1 off the edge's centre-line) and its route: leg by leg to an
// edge's end, across the junction by interpolation, a new trip chained at its
// destination. `s` is the distance from the edge's a end; `tdir` the way it
// walks that edge (+1 a->b, -1 b->a), still written with `dir` for the render's
// walk cycle. At the rushes a walker is its resident between the home and job
// parcels (commute.js): sendTo() adopts its own pavement, leaving by the end
// whose way to the door is shortest. Pure sim (law 5).
import { mulberry32 } from './rng.js';
import { frontageRoad, projectOnSegment } from './map.js';
import { ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';

// Mid-pavement: kerb face to building line.
export const WALK_OFF = ROAD_HALF_WIDTH + WALKWAY_WIDTH / 2;
// A shift indoors, then an errand out: game seconds a walker holds at its
// door, and how long the stroll lasts. A game hour is 30 s, so a shift
// outlasts the rush.
export const HOLD_SECS = 120;
export const ROAM_SECS = 30;
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

// Rebuilt when a road op bumps map.version; trips run node to node. Parcel i
// walks from the pavement point nearest its frontage road ({ node, edge, s }),
// so a trip ends at the door, not at a node a block away.
function indexes(state) {
  const parcels = state.map.parcels ?? [];
  if (state.indexVersion === state.map.version && state.parcelSpot?.length === parcels.length) return false;
  state.byId = new Map(state.map.graph.nodes.map((n) => [n.id, n]));
  state.edgeById = new Map(state.map.graph.edges.map((e) => [e.id, e]));
  state.links = new Map(state.map.graph.nodes.map((n) => [n.id, []]));
  for (const e of state.map.graph.edges) {
    const len = lengthOf(state.byId, e);
    state.links.get(e.a).push({ to: e.b, len, edge: e });
    state.links.get(e.b).push({ to: e.a, len, edge: e });
  }
  state.spots = state.map.graph.nodes.map((n) => n.id);
  state.parcelSpot = parcels.map((p) => spotForParcel(state, p));
  state.indexVersion = state.map.version;
  return true;
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

function spotForParcel(state, p) {
  const road = frontageRoad(state.map, p, state.byId);
  if (!road) {
    const node = nearestNode(state, p.x, p.z);
    return node ? { node: node.id, edge: null, s: 0, side: 1 } : null;
  }
  const a = state.byId.get(road.edge.a);
  const b = state.byId.get(road.edge.b);
  const hit = projectOnSegment(p.x, p.z, a, b);
  const len = lengthOf(state.byId, road.edge);
  const node = nearerEnd(state, road.edge, p);
  // The walkway side the parcel stands on, so its door offset faces the parcel.
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const side = (p.x - hit.x) * dz - (p.z - hit.z) * dx >= 0 ? 1 : -1;
  return { node: node.id, edge: road.edge.id, s: hit.t * len, side };
}

// The doorstep parcel i walks from, or null when the parcel is gone from the
// graph (a road op) or never had one; commute.js reads its residents through it.
export function parcelSpot(state, i) {
  const spot = state.parcelSpot?.[i] ?? null;
  if (!spot || !state.byId?.has(spot.node)) return null;
  if (spot.edge !== null && !state.edgeById?.has(spot.edge)) return null;
  return spot;
}

export function createWalkers(map, seed, bodies = []) {
  const state = { map, seed, time: 0, walkers: [], indexVersion: null, rng: mulberry32((seed ^ TRIP_SEED) >>> 0),
    links: new Map(), spots: [], parcelSpot: [] };
  indexes(state);
  for (const body of bodies) state.walkers.push(makeWalker(state, body));
  return state;
}

// Boot walkers start spread along their first edge.
function makeWalker(state, body) {
  const w = { ...body, route: [], leg: 0, tdir: 1, orient: 1, s: 0, side: 1, turn: null,
    axis: 'z', dir: 1, v: 0, x: 0, z: 0, yaw: 0, commute: null, dest: null,
    hold: null, freeAfter: 0, roamUntil: 0 };
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
    // A tasked trip starts at its origin's own end, so the first edge is whole.
    const s0 = from === null ? state.rng() * lengthOf(state.byId, edge) * 0.9
      : tdir > 0 ? 0 : lengthOf(state.byId, edge);
    w.route = route; w.leg = 0; w.s = s0; w.turn = null;
    w.side = state.rng() < 0.5 ? -1 : 1;
    face(w, state.byId, edge, tdir);
    Object.assign(w, pointOn(state.byId, edge, tdir, s0, w.side));
    return true;
  }
  return false;
}

// The next trip from the destination node, so the walker never stops dead. A
// commuter holds its goal across trips: off-goal it walks back to its door.
function rollTrip(state, w, from) {
  if (w.commute !== null && w.commute !== undefined) {
    const spot = parcelSpot(state, w.commute);
    const route = spot && spot.edge !== null
      ? finishRoute(state, findRoute(state, from, spot.node), spot) : null;
    if (route) {
      w.route = route; w.leg = 0; w.dest = spot;
      return state.edgeById.get(route[0]);
    }
    w.commute = null; w.dest = null;
  }
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const to = pick(state.rng, state.spots);
    if (!to || to === from) continue;
    const route = findRoute(state, from, to);
    if (!route || route.length === 0) continue;
    w.route = route; w.leg = 0; w.dest = null;
    return state.edgeById.get(route[0]);
  }
  return null;
}

// A node path to the door's node, then the door's own edge — even from the
// node itself, so every commute trip walks its last metres to the doorstep.
// Null when there is no way at all.
function finishRoute(state, path, spot) {
  if (!path) return null;
  if (spot.edge === null) return path.length > 0 ? path : null;
  if (path.length === 0) return [spot.edge];
  return path[path.length - 1] === spot.edge ? path : [...path, spot.edge];
}

// A resident's commute, tasked to `dest` (a parcel): the walker adopts the
// pavement it is already on, leaving by the end whose way to the door is
// shortest, and chains the path from there. Null `dest` stands the walker down
// to random trips. True when it walks a commute trip after this.
export function sendTo(state, w, dest) {
  if (dest === null || dest === undefined) { w.commute = null; w.dest = null; return true; }
  // The flag only counts on a live route: an emptied walker is re-tasked once
  // the next tick fills its trip back in.
  if (w.commute === dest && w.route.length > 0) return true;
  const spot = parcelSpot(state, dest);
  if (!spot || spot.edge === null) return false;
  if (w.turn || !Array.isArray(w.route) || w.route.length === 0) return false;
  const edge = state.edgeById.get(w.route[w.leg]);
  if (!edge) return false;
  w.commute = dest; w.dest = spot;
  if (edge.id === spot.edge) return faceDoor(state, w, edge, spot);
  const sub = leaveBy(state, w, edge, spot);
  // No way through: hold the goal and let the trip ends retry it, instead of
  // burning a full search every step on a cut graph.
  if (!sub) return false;
  w.route = [edge.id, ...sub];
  w.leg = 0;
  return true;
}

// On the goal's own frontage: face its door, pivoting in place when the door
// is behind, and let tick()'s door check stop the walker there.
function faceDoor(state, w, edge, spot) {
  const len = lengthOf(state.byId, edge);
  const ds = Math.max(0, Math.min(len, spot.s));
  const ahead = w.tdir > 0 ? ds >= w.s : ds <= w.s;
  if (!ahead) pivot(state.byId, w, edge, -w.tdir);
  return true;
}

// The way out of the walker's own edge: the end reaching the door's node
// soonest — the walk to it plus the path from it. The walker pivots when that
// end is behind it, but never steps over the centre-line.
function leaveBy(state, w, edge, spot) {
  const len = lengthOf(state.byId, edge);
  const pathA = findRoute(state, edge.a, spot.node);
  const pathB = findRoute(state, edge.b, spot.node);
  const costA = pathA ? w.s + pathCost(state, pathA) : Infinity;
  const costB = pathB ? len - w.s + pathCost(state, pathB) : Infinity;
  const viaA = costA <= costB;
  const path = viaA ? pathA : pathB;
  if (!path) return null;
  const tdir = viaA ? -1 : 1;
  if (tdir !== w.tdir) pivot(state.byId, w, edge, tdir);
  return finishRoute(state, path, spot);
}

// Turn in place on the walker's own edge — the sim's only reversal.
function pivot(byId, w, edge, tdir) {
  w.tdir = tdir;
  face(w, byId, edge, tdir);
  w.yaw = pointOn(byId, edge, tdir, w.s, w.side).yaw;
}

const pathCost = (state, route) => route.reduce((n, id) => n + lengthOf(state.byId, state.edgeById.get(id)), 0);

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
    if (w.hold !== null && w.hold !== undefined) continue;
    if (w.turn) { advanceTurn(w, dt); continue; }
    if (w.route.length === 0) { assignTrip(state, w, null); continue; }
    const edge = state.edgeById.get(w.route[w.leg]);
    if (!edge) continue;
    const len = lengthOf(state.byId, edge);
    const s = w.s + w.tdir * v * dt;
    if (w.dest && w.dest.edge !== null && w.route[w.leg] === w.dest.edge) {
      const ds = Math.max(0, Math.min(len, w.dest.s));
      if ((w.tdir > 0 && w.s < ds && s >= ds) || (w.tdir < 0 && w.s > ds && s <= ds)) {
        arriveDoor(state, w, edge, ds); continue;
      }
    }
    if (s > len || s < 0) { arrive(state, w, edge, len, s, v); continue; }
    w.s = s;
    const p = pointOn(state.byId, edge, w.tdir, s, w.side);
    w.phase += Math.hypot(p.x - w.x, p.z - w.z) * 4;
    w.x = p.x; w.z = p.z; w.yaw = p.yaw; w.axis = edge.axis; w.dir = w.tdir * w.orient;
  }
}

// Off one end: the route carries on through this node whichever way the path
// runs — forward first, back when the walker walks an edge b->a — its far end
// rolls a new trip, a dead end turns back at the node: geometry, not steering.
function arrive(state, w, edge, len, s, v) {
  const atB = s > len;
  const node = atB ? edge.b : edge.a;
  const from = pointOn(state.byId, edge, w.tdir, Math.max(0, Math.min(len, w.s)), w.side);
  let next = null;
  const fwd = w.leg < w.route.length - 1 ? state.edgeById.get(w.route[w.leg + 1]) : null;
  const bwd = w.leg > 0 ? state.edgeById.get(w.route[w.leg - 1]) : null;
  if (fwd && touches(fwd, node)) { w.leg += 1; next = fwd; }
  else if (bwd && touches(bwd, node) && bwd !== edge) { w.leg -= 1; next = bwd; }
  if (!next) next = rollTrip(state, w, node);
  if (!next) { w.tdir *= -1; w.s = Math.max(0, Math.min(len, w.s)); return; }
  beginTurn(state, w, next, node, from, v);
}

function touches(edge, node) {
  return edge.a === node || edge.b === node;
}

// At the door: stand on the doorstep and go inside — out, held for a shift,
// then an errand (commute.js frees and roams it); the views skip the indoors.
function arriveDoor(state, w, edge, ds) {
  w.s = ds;
  const p = pointOn(state.byId, edge, w.tdir, ds, w.side);
  w.phase += Math.hypot(p.x - w.x, p.z - w.z) * 4;
  w.x = p.x; w.z = p.z; w.yaw = p.yaw;
  w.hold = w.commute; w.commute = null; w.dest = null;
  w.freeAfter = state.time + HOLD_SECS;
  w.out = false;
  w.route = [edge.id]; w.leg = 0;
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
