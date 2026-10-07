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
//
// M3.T31 adds signals. Every junction where two ways meet runs one two-phase
// light: z ways move in the even phase, x ways in the odd, each with
// SIGNAL_GREEN of green in a SIGNAL_PHASE half-cycle. A car stops at the line
// while its axis is not green, held by the same arrival curve that paces it
// behind a leader, so a queue forms behind the line and clears on green.
// signalGreen is pure in the axis and the clock, so sim and render read the
// same state and the accept test can ask about any instant.
// T29's tests place cars by hand, in the shape this module reads and writes.
import { mulberry32 } from './rng.js';
import { DAY_SECS, START_HOUR } from './clock.js';
import { frontageRoad } from './map.js';
import { heightAt } from './world.js';

// The ground under a car (M4.T10): the map's own field when it has one
// (M4.T2, the field the render draws); the load-time world field is the hand
// preset's fallback.
const groundAt = (map, x, z) => (map.terrain?.heightAt ?? heightAt)(x, z);

export const CAR_LEN = 4.5;
export const LANE_OFF = 2.4;
export const VMAX = 13.5;
export const ACCEL = 2.5;
export const BRAKE = 6;
export const GAP_MIN = 2.5;
export const TURN_SECS = 0.6;
// Lanes this close at a node share its point: there is no turn to carry.
const TURN_MIN = 0.5;
const FOLLOW_GAIN = 1.5;

export const SIGNAL_GREEN = 8;
// M3.T35: the commute flow lays every resident's trip on edges for the hour;
// cars ending trips head where commuters go; economy reads flowByDistrict.
export const GAME_HOUR_SECS = DAY_SECS / 24;
export const RUSH_AM = [7, 9.5];
export const RUSH_PM = [17, 19.5];
const OFFPEAK_SHARE = 0.15;
const MATCH_PER_TICK = 60;
const ROUTES_PER_TICK = 8;
const FLOW_PREF = 0.4;
const FLOW_TRIES = 8;
export const SIGNAL_PHASE = 10;
export const SIGNAL_CYCLE = SIGNAL_PHASE * 2;
// A car holds with its centre this far short of the junction, its nose just
// inside the stop line; the test reads the held position against it.
export const STOP_LINE = 4.5;
// The kerb a head stands on, and how far short of the junction it stands.
const SIGNAL_POLE_OUT = 4.2;
const SIGNAL_BACK = 1.2;

// True while `axis` has green at sim time `t`. Two phases share the cycle:
// phase 0 is the z ways, phase 1 the x ways, and the rest of each half is an
// all-red clearance before the cross traffic is released.
export function signalGreen(axis, t) {
  const cycle = ((t % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
  const phase = Math.floor(cycle / SIGNAL_PHASE);
  return cycle % SIGNAL_PHASE < SIGNAL_GREEN && phase === (axis === 'x' ? 1 : 0);
}

// One head per approach to every junction of two ways: on the right kerb
// SIGNAL_BACK short of the junction, facing back at the cars it stops. The sim
// and the render pool derive from the same node test, so a light cannot exist
// without a car obeying it.
export function signalHeads(map) {
  const junctions = signalNodes(map);
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const heads = [];
  for (const n of map.graph.nodes) {
    if (!junctions.has(n.id)) continue;
    const incident = map.graph.edges.filter((e) => e.a === n.id || e.b === n.id);
    for (const e of incident) {
      const dir = e.b === n.id ? 1 : -1;
      const from = byId.get(dir > 0 ? e.a : e.b);
      const dx = n.x - from.x;
      const dz = n.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len;
      const uz = dz / len;
      const s = Math.max(0, len - SIGNAL_BACK);
      heads.push({
        x: from.x + ux * s + uz * SIGNAL_POLE_OUT,
        z: from.z + uz * s - ux * SIGNAL_POLE_OUT,
        yaw: Math.atan2(-ux, -uz),
        axis: e.axis,
      });
    }
  }
  return heads;
}

// The nodes a light runs at: every one a z way and an x way both touch.
function signalNodes(map) {
  const axes = new Map();
  for (const e of map.graph.edges) {
    if (!axes.has(e.a)) axes.set(e.a, new Set());
    if (!axes.has(e.b)) axes.set(e.b, new Set());
    axes.get(e.a).add(e.axis);
    axes.get(e.b).add(e.axis);
  }
  const ids = new Set();
  for (const [id, set] of axes) if (set.size >= 2) ids.add(id);
  return ids;
}

// M3-6's appear/go allowance, with margin: the follow cam rides 4.5 m behind the
// player, so a spot this far past 60 m clears the camera too. VIEW_DOT is cos 53
// degrees — inside the 82-degree horizontal frame and far enough off axis that
// the page-side view test reads it as out of frame.
const CAM_DIST = 60;
const CAM_MARGIN = 10;
const VIEW_DOT = 0.6;
const TRIP_TRIES = 40;
const TRIP_SEED = 0x51ed2701;
const FLOW_SEED = 0x51ed3501;

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
  state.signals = signalNodes(state.map);
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

// --- The commute flow (M3.T35): every resident's trip on edges by hour ---
export function hourOf(t) {
  return (START_HOUR + t / GAME_HOUR_SECS) % 24;
}

function flowDir(hour) {
  if (hour >= RUSH_AM[0] && hour < RUSH_AM[1]) return 'am';
  if (hour >= RUSH_PM[0] && hour < RUSH_PM[1]) return 'pm';
  return null;
}

function flowShare(hour) {
  return flowDir(hour) ? 1 : OFFPEAK_SHARE;
}

// Economy's density (25 m2 floor, 3.5 m storey), copied to avoid a sim cycle.
const PER_PERSON = 25 * 3.5;
function floorOf(p) {
  return Math.round(((p.heights?.[p.stage] ?? 0) * p.w * p.d) / PER_PERSON * (1 - (p.vacancy ?? 0)));
}

function residentsOf(p) {
  return p.use === 'res' ? floorOf(p) : 0;
}

function workersOf(p) {
  return p.use === 'com' || p.use === 'ind' ? floorOf(p) : 0;
}

function routeLen(state, route) {
  let len = 0;
  for (const id of route) {
    const e = state.edgeById.get(id);
    if (e) len += lengthOf(state.byId, e);
  }
  return len;
}

// Match runs a slice a tick so 2,000 parcels never pay at once (M3-9).
function beginFlow(state, parcels) {
  const jobs = [];
  const queue = [];
  parcels.forEach((p, i) => {
    if (workersOf(p) > 0) jobs.push({ i, free: workersOf(p) });
    else if (residentsOf(p) > 0) queue.push(i);
  });
  return {
    version: state.map.version, count: parcels.length, jobs, queue, cursor: 0,
    match: new Map(), pairs: [], pending: [], load: new Map(),
    dest: [], destTotal: 0, by: {}, bucket: -1, stage: 'match',
  };
}

// Each home takes the nearest job parcel with room, like people.js matchJobs.
function matchSlice(f, parcels) {
  const end = Math.min(f.queue.length, f.cursor + MATCH_PER_TICK);
  for (; f.cursor < end; f.cursor++) {
    const i = f.queue[f.cursor];
    const home = parcels[i];
    const r = residentsOf(home);
    if (r <= 0) continue;
    let at = -1;
    let bestD = Infinity;
    for (let j = 0; j < f.jobs.length; j++) {
      const jb = f.jobs[j];
      if (jb.free <= 0) continue;
      const q = parcels[jb.i];
      const d = Math.hypot(q.x - home.x, q.z - home.z);
      if (d < bestD) { bestD = d; at = j; }
    }
    if (at < 0) continue;
    const take = Math.min(r, f.jobs[at].free);
    f.jobs[at].free -= take;
    f.match.set(home.id ?? i, { i, j: f.jobs[at].i, take });
  }
}

// Matched pairs become node pairs; routes solve a few a tick. Same node is a
// walk (no edges); null route is a cut graph, late in the economy.
function queueRoutes(state, f) {
  const seen = new Set();
  for (const m of f.match.values()) {
    const a = state.spots[m.i]?.node;
    const b = state.spots[m.j]?.node;
    if (!a || !b) continue;
    const pair = { m, a, b, route: undefined };
    f.pairs.push(pair);
    if (a === b) { pair.route = []; continue; }
    const key = `${a}>${b}`;
    if (!seen.has(key)) { seen.add(key); f.pending.push(pair); }
    else pair.route = 'dup';
  }
}

function routeSlice(state, f) {
  for (let n = 0; n < ROUTES_PER_TICK && f.pending.length > 0; n++) {
    const p = f.pending.pop();
    p.route = findRoute(state, p.a, p.b);
    for (const q of f.pairs) if (q.route === 'dup' && q.a === p.a && q.b === p.b) q.route = p.route;
  }
}

// Lay trips on edges for the hour (reversed homeward in the evening) and
// publish the per-district summary the economy reads.
function reweight(state, f, parcels) {
  const hour = hourOf(state.time);
  const dir = flowDir(hour) ?? (hour < 12 ? 'am' : 'pm');
  const share = flowShare(hour);
  const load = new Map();
  const attract = new Map();
  const by = {};
  for (const p of f.pairs) {
    if (p.route === 'dup') continue;
    const home = parcels[p.m.i];
    const job = parcels[p.m.j];
    if (!home || home.use !== 'res' || !job || (job.use !== 'com' && job.use !== 'ind')) continue;
    const r = Math.min(residentsOf(home), p.m.take);
    if (r <= 0) continue;
    const zone = home.powerZone ?? 0;
    const d = by[zone] ??= { residents: 0, late: 0, len: 0 };
    d.residents += r;
    if (!p.route) { d.late += r; continue; }
    if (p.route.length === 0) continue;
    d.len += r * routeLen(state, p.route);
    const edges = dir === 'am' ? p.route : [...p.route].reverse();
    for (const id of edges) load.set(id, (load.get(id) ?? 0) + r * share);
    const node = dir === 'am' ? p.b : p.a;
    attract.set(node, (attract.get(node) ?? 0) + r * share);
  }
  f.load = load;
  f.dest = [];
  f.destTotal = 0;
  for (const [node, w] of attract) {
    if (w <= 0) continue;
    f.dest.push({ node, cum: (f.destTotal += w) });
  }
  f.by = by;
  f.bucket = Math.floor(hour);
  const out = {};
  for (const [zone, d] of Object.entries(by)) {
    out[zone] = {
      residents: d.residents,
      late: d.residents > 0 ? d.late / d.residents : 0,
      mins: d.residents > 0 ? d.len / d.residents / VMAX / 60 : 0,
    };
  }
  state.flowByDistrict = out;
}

// A few pairs a tick toward a ready flow. The match rebuilds on a version or
// parcel change, and again on the hour: lots grow under it, and an hourly
// re-match picks the growth up within half a minute and keeps a restored save
// converging with the run it left (both rebuild at the same hour boundary).
function tickFlow(state) {
  const parcels = state.map.parcels ?? [];
  let f = state.flow;
  if (!f || f.version !== state.map.version || f.count !== parcels.length) {
    f = state.flow = beginFlow(state, parcels);
  }
  if (f.stage === 'match') {
    matchSlice(f, parcels);
    if (f.cursor >= f.queue.length) { queueRoutes(state, f); f.stage = 'routes'; }
    return;
  }
  if (f.stage === 'routes') {
    routeSlice(state, f);
    if (f.pending.length === 0) { f.stage = 'ready'; reweight(state, f, parcels); }
    return;
  }
  if (Math.floor(hourOf(state.time)) !== f.bucket) {
    f = state.flow = beginFlow(state, parcels);
  }
}

// This hour's travellers on one edge, for the traffic overlay (M5.T21).
export function edgeLoad(state, edgeId) {
  return state.flow?.load.get(edgeId) ?? 0;
}

export function createTraffic(map, seed, count = 0) {
  const state = {
    map, seed, time: 0, cars: [], indexVersion: null,
    want: count, nextId: 1, rng: mulberry32(seed ^ TRIP_SEED), cam: null,
    flowRng: mulberry32(seed ^ FLOW_SEED),
    links: new Map(), spots: [], signals: new Set(),
    flow: null, flowByDistrict: {},
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
    axis: 'z', speed: 0, prev: {}, x: 0, y: 0, z: 0, yaw: 0,
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
    c.y = groundAt(state.map, p.x, p.z);
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

// The next trip, chained through the usual turn; false when blocked.
function chainRoute(state, c, route, dest) {
  const edge = state.edgeById.get(route[0]);
  if (!edge) return false;
  const dir = edge.a === c.goal ? 1 : -1;
  if (!clearAt(state, c, edge.id, dir, 0)) return false;
  c.turn = { from: { x: c.x, z: c.z, yaw: c.yaw }, to: pointOn(state.byId, edge, dir, 0), t: 0 };
  c.id = state.nextId;
  state.nextId += 1;
  c.route = route; c.leg = 0; c.dir = dir; c.s = 0;
  c.goal = dest; c.axis = edge.axis;
  return true;
}

// A trip where the commuters go: arrival-weighted, so cars sample the flow.
// Draws on its own stream so sampling never shifts the trip stream (M3-6).
function flowTrip(state, c) {
  const f = state.flow;
  if (!f || f.stage !== 'ready' || f.destTotal <= 0) return false;
  for (let tries = 0; tries < FLOW_TRIES; tries++) {
    const r = state.flowRng() * f.destTotal;
    let node = null;
    for (const d of f.dest) if (r < d.cum) { node = d.node; break; }
    node ??= f.dest.length > 0 ? f.dest[f.dest.length - 1].node : null;
    if (!node || node === c.goal) continue;
    const route = findRoute(state, c.goal, node);
    if (!route) continue;
    if (chainRoute(state, c, route, node)) return true;
  }
  return false;
}

// The next trip for a car standing at its destination: a new far parcel, driven
// from here. The car turns out of its arrival lane into the new one over the
// usual 0.6 s, so it never stops dead at the node and never jumps. Two trips
// in five head where the commuters go instead (M3.T35). The random pick runs
// first on the trip stream exactly as before, so sampling the flow never
// shifts the random trips (M3-6); the flow choice draws on its own stream.
function rollTrip(state, c) {
  let fallback = null;
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const to = pick(state.rng, state.spots);
    if (!to || to.node === c.goal) continue;
    const route = findRoute(state, c.goal, to.node);
    if (!route) continue;
    const edge = state.edgeById.get(route[0]);
    const dir = edge.a === c.goal ? 1 : -1;
    if (!clearAt(state, c, edge.id, dir, 0)) continue;
    fallback = { route, node: to.node };
    break;
  }
  if (state.flowRng() < FLOW_PREF && flowTrip(state, c)) return true;
  if (!fallback) return false;
  return chainRoute(state, c, fallback.route, fallback.node);
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
  tickFlow(state);
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
    // The stop line is a stationary leader at the junction. A car already past
    // it is in the junction and must clear, not stop dead in the crossing; a
    // car behind it eases onto the line and is held there while its axis is
    // not green, so it cannot creep into the crossing.
    const far = c.dir > 0 ? edge.b : edge.a;
    const line = len - STOP_LINE;
    const hold = state.signals.has(far) && c.s <= line && !signalGreen(edge.axis, state.time);
    if (hold) {
      const clear = line - c.s;
      target = Math.min(target, clear * FOLLOW_GAIN, Math.sqrt(2 * BRAKE * clear));
    }
    c.v = Math.max(0, Math.max(c.v - BRAKE * dt, Math.min(c.v + ACCEL * dt, target)));
    c.s += c.v * dt;
    if (hold && c.s > line) { c.s = line; c.v = 0; }
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
  // One pass after the step puts every car on the ground, whichever branch
  // moved it — lane, turn or held at the line (M4.T10).
  for (const c of state.cars) c.y = groundAt(state.map, c.x, c.z);
}

// Leave the edge's lane for the next edge's lane through the node. The car is
// carried by a 0.6 s interpolation; it keeps the speed it arrived with. A route
// that runs straight through the node ends and starts on the same point: there
// is no turn to carry, and interpolating it would park the car at the junction
// for the whole 0.6 s (M0-9), so it takes the next edge in the same step.
function beginTurn(state, c, edge, len) {
  const node = c.dir > 0 ? edge.b : edge.a;
  const next = state.edgeById.get(c.route[c.leg + 1]);
  const dir = next.a === node ? 1 : -1;
  const from = pointOn(state.byId, edge, c.dir, len);
  const to = pointOn(state.byId, next, dir, 0);
  c.leg += 1;
  c.dir = dir;
  c.s = 0;
  c.axis = next.axis;
  // The car reaches the lane's end in the step that crosses it; leaving the
  // pose at the overshoot point holds the drawn car for a frame (M0-9).
  Object.assign(c, from);
  if (Math.hypot(to.x - from.x, to.z - from.z) < TURN_MIN) return;
  c.turn = { from, to, t: 0 };
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
