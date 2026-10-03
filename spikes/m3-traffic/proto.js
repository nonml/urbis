// M3.S2 prototype (docs/spikes/m3-traffic.md). A 6-district grid graph, 2,000
// parcels, A* routes, every resident's commute as an edge flow, and 60 cars with
// lanes, signals, gaps and junction turns. No three.js, no DOM, stays in spikes/.
import { mulberry32 } from '../../src/sim/rng.js';

export const AVENUES = [0, 200, 400, 600];
export const CROSSINGS = [0, 200, 400];
export const CAR_LEN = 4.5;
export const LANE_OFF = 2.4;
export const VMAX = 13.5;
export const HOUR_SECS = 60;
const ACCEL = 2.5;
const BRAKE = 6;
const GAP_MIN = 2.5;
const STOP_LINE = 5;
const JUNCTION_CLEAR = 8;
const TURN_SECS = 0.6;
const PHASE = { period: 24, green: 11, gap: 1 };

export function buildMap() {
  const nodeById = new Map();
  const edges = [];
  const node = (x, z) => {
    const id = `${x},${z}`;
    if (!nodeById.has(id)) nodeById.set(id, { id, x, z });
    return nodeById.get(id);
  };
  const link = (x0, z0, x1, z1, axis) => {
    const a = node(x0, z0);
    const b = node(x1, z1);
    edges.push({ id: `e${edges.length}`, a: a.id, b: b.id, axis, len: Math.hypot(x1 - x0, z1 - z0) });
  };
  for (const x of AVENUES) for (let i = 0; i + 1 < CROSSINGS.length; i++) link(x, CROSSINGS[i], x, CROSSINGS[i + 1], 'z');
  for (const z of CROSSINGS) for (let i = 0; i + 1 < AVENUES.length; i++) link(AVENUES[i], z, AVENUES[i + 1], z, 'x');
  return { nodes: [...nodeById.values()], nodeById, edges, edgeById: new Map(edges.map((e) => [e.id, e])) };
}

export function buildParcels(map, seed, count = 2000) {
  const rand = mulberry32(seed);
  const parcels = [];
  for (let i = 0; i < count; i++) {
    const edge = map.edges[Math.floor(rand() * map.edges.length)];
    parcels.push({ id: i, edge: edge.id, t: 0.1 + 0.8 * rand(), node: rand() < 0.5 ? edge.a : edge.b });
  }
  return parcels;
}

// A* over nodes, cost = length. `closed` are edge ids that do not exist, so an
// M3.T19 removeRoad can be asked for a route and honestly get null.
export function findRoute(map, from, to, closed = new Set()) {
  const goal = map.nodeById.get(to);
  const open = new Map([[from, { id: from, g: 0, f: 0, via: null, prev: null }]]);
  const best = new Map([[from, 0]]);
  while (open.size) {
    let cur = null;
    for (const c of open.values()) if (!cur || c.f < cur.f) cur = c;
    open.delete(cur.id);
    if (cur.id === to) {
      const route = [];
      for (let c = cur; c.via; c = c.prev) route.unshift(c.via);
      return route;
    }
    for (const e of map.edges) {
      if (closed.has(e.id)) continue;
      const nb = e.a === cur.id ? e.b : e.b === cur.id ? e.a : null;
      if (!nb) continue;
      const g = cur.g + e.len;
      if (g >= (best.get(nb) ?? Infinity)) continue;
      best.set(nb, g);
      const m = map.nodeById.get(nb);
      open.set(nb, { id: nb, g, f: g + Math.hypot(m.x - goal.x, m.z - goal.z), via: e.id, prev: cur });
    }
  }
  return null;
}

// Every resident's home-to-job trip as one count per edge. Only distinct node
// pairs are routed (144 here), so the caller's route cache makes 5,000 residents
// cost 132 A* once and a map lookup each after.
export function buildCommute(map, parcels, residents, closed = new Set(), cache = new Map()) {
  const counts = new Map(map.edges.map((e) => [e.id, 0]));
  let noRoute = 0;
  const n = parcels.length;
  for (let i = 0; i < residents; i++) {
    const home = parcels[i % n];
    const job = parcels[(i * 37 + 11) % n];
    const key = `${home.node}>${job.node}`;
    if (!cache.has(key)) cache.set(key, findRoute(map, home.node, job.node, closed));
    const route = cache.get(key);
    if (!route) { noRoute++; continue; }
    for (const id of route) counts.set(id, counts.get(id) + 1);
  }
  return { counts, noRoute, pairs: cache.size };
}

export function signalGreen(axis, t) {
  const p = t % PHASE.period;
  if (axis === 'z') return p < PHASE.green;
  return p >= PHASE.green + PHASE.gap && p < PHASE.green + PHASE.gap + PHASE.green;
}

// Offset 2.4 m to the right of the direction of travel, so the two directions of
// an edge sit 4.8 m apart. This is where world.js's mixed lane sides settle.
export function lanePoint(map, edge, dir, s) {
  const from = dir > 0 ? map.nodeById.get(edge.a) : map.nodeById.get(edge.b);
  const to = dir > 0 ? map.nodeById.get(edge.b) : map.nodeById.get(edge.a);
  const ux = (to.x - from.x) / edge.len;
  const uz = (to.z - from.z) / edge.len;
  return { x: from.x + ux * s + uz * LANE_OFF, z: from.z + uz * s - ux * LANE_OFF, yaw: Math.atan2(ux, uz) };
}

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];

export function createTraffic(map, seed, count, opts = {}) {
  const state = {
    map, parcels: opts.parcels ?? buildParcels(map, seed), rand: mulberry32(seed), time: 0, cars: [],
    routes: new Map(), nodeBusy: new Map(), closed: opts.closed ?? new Set(),
    safeJunction: opts.safeJunction !== false, signals: opts.signals !== false,
    noRoute: 0, completed: 0, maxJump: 0,
  };
  for (let i = 0; i < count; i++) spawnCar(state);
  return state;
}

export function spawnCar(state) {
  for (let tries = 0; tries < 6; tries++) {
    const from = pick(state.rand, state.parcels).node;
    const to = pick(state.rand, state.parcels).node;
    const key = `${from}>${to}`;
    let route = state.routes.get(key);
    if (route === undefined) {
      route = findRoute(state.map, from, to, state.closed);
      state.routes.set(key, route);
    }
    if (!route) { state.noRoute++; continue; }
    if (!route.length) continue;
    const edge = state.map.edgeById.get(route[0]);
    const dir = edge.a === from ? 1 : -1;
    const p = lanePoint(state.map, edge, dir, 0);
    const car = { id: state.completed + state.cars.length + 1, route, leg: 0, dir, s: 0, v: VMAX * 0.4, turn: null, prev: { x: p.x, z: p.z }, stuck: 0, ...p };
    state.cars.push(car);
    return car;
  }
  return null;
}

export function tick(state, dt) {
  state.time += dt;
  const lanes = new Map();
  for (const c of state.cars) {
    if (c.turn) continue;
    const key = `${c.route[c.leg]}|${c.dir}`;
    if (!lanes.has(key)) lanes.set(key, []);
    lanes.get(key).push(c);
  }
  for (const lane of lanes.values()) lane.sort((a, b) => a.s - b.s);
  const done = [];
  for (const c of state.cars) {
    c.prev.x = c.x;
    c.prev.z = c.z;
    if (c.turn) { advanceTurn(state, c, dt); recordJump(state, c); continue; }
    const edge = state.map.edgeById.get(c.route[c.leg]);
    const lane = lanes.get(`${edge.id}|${c.dir}`);
    const leader = lane[lane.indexOf(c) + 1] ?? null;
    let target = Math.min(VMAX, leader ? Math.max(0, (leader.s - c.s - CAR_LEN - GAP_MIN) * 1.5) : VMAX);
    const stop = stopTarget(state, c, edge, lanes);
    if (stop !== null) target = Math.min(target, Math.sqrt(2 * BRAKE * Math.max(0, stop - c.s - 0.4)));
    c.v = Math.max(0, Math.max(c.v - BRAKE * dt, Math.min(c.v + ACCEL * dt, target)));
    c.s += c.v * dt;
    c.stuck = target < 0.5 && c.v < 0.2 ? c.stuck + dt : 0;
    if (c.s >= edge.len) {
      if (c.leg === c.route.length - 1) { done.push(c); continue; }
      beginTurn(state, c, edge);
      recordJump(state, c);
      continue;
    }
    Object.assign(c, lanePoint(state.map, edge, c.dir, c.s));
    recordJump(state, c);
  }
  for (const c of done) { state.completed++; state.cars.splice(state.cars.indexOf(c), 1); spawnCar(state); }
}

// The stop-line distance a conflict would stop the car at: the light for its
// axis, a junction already claimed by a turning car, or — with safeJunction on —
// a green whose next lane has no 8 m of space ("don't block the box").
function stopTarget(state, c, edge, lanes) {
  if (c.leg === c.route.length - 1 || edge.len - c.s > 30) return null;
  const node = c.dir > 0 ? edge.b : edge.a;
  if (state.signals && !signalGreen(edge.axis, state.time)) return edge.len - STOP_LINE;
  if (state.nodeBusy.has(node)) return edge.len - STOP_LINE;
  if (state.safeJunction) {
    const next = state.map.edgeById.get(c.route[c.leg + 1]);
    const lane = lanes.get(`${next.id}|${next.a === node ? 1 : -1}`) ?? [];
    if (lane[0] && lane[0].s < JUNCTION_CLEAR) return edge.len - STOP_LINE;
  }
  return null;
}

function beginTurn(state, c, edge) {
  const node = c.dir > 0 ? edge.b : edge.a;
  const next = state.map.edgeById.get(c.route[c.leg + 1]);
  const dir = next.a === node ? 1 : -1;
  c.turn = { from: lanePoint(state.map, edge, c.dir, edge.len), to: lanePoint(state.map, next, dir, 0), t: 0, node };
  c.leg++;
  c.dir = dir;
  c.s = 0;
  state.nodeBusy.set(node, c.id);
}

function advanceTurn(state, c, dt) {
  c.turn.t += dt / TURN_SECS;
  if (c.turn.t < 1) {
    const { from, to, t } = c.turn;
    c.x = from.x + (to.x - from.x) * t;
    c.z = from.z + (to.z - from.z) * t;
    c.yaw = Math.atan2(to.x - from.x, to.z - from.z);
    return;
  }
  c.x = c.turn.to.x;
  c.z = c.turn.to.z;
  c.yaw = c.turn.to.yaw;
  state.nodeBusy.delete(c.turn.node);
  c.turn = null;
  c.v = Math.max(c.v, 2);
}

function recordJump(state, c) {
  const d = Math.hypot(c.x - c.prev.x, c.z - c.prev.z);
  if (d > state.maxJump) state.maxJump = d;
}

// A car stopped in a junction mouth: past its stop line, within 8 m of the lane
// it entered, barely moving. Over 10 s of that is the gridlock failure.
export function probeGridlock(state) {
  let mouth = 0;
  let stuck = 0;
  let maxStuck = 0;
  for (const c of state.cars) {
    if (c.turn || c.leg === 0 || c.v >= 0.2 || c.s <= 0 || c.s >= JUNCTION_CLEAR) continue;
    mouth++;
    if (c.stuck > 10) stuck++;
    if (c.stuck > maxStuck) maxStuck = c.stuck;
  }
  return { mouth, stuck, maxStuck };
}

// One timed run: 60 visible cars by default, the 5,000-resident flow relaid on
// the hour (as M3.T35 will), on the 2,000-parcel map.
export function bench(opts = {}) {
  const map = buildMap();
  const parcels = buildParcels(map, opts.seed ?? 7, 2000);
  const state = createTraffic(map, opts.seed ?? 7, opts.cars ?? 60, {
    parcels, closed: opts.closed, safeJunction: opts.safeJunction, signals: opts.signals,
  });
  const routeCache = new Map();
  const times = [];
  const flowTimes = [];
  let hour = -1;
  for (let i = 0; i < (opts.steps ?? 2000); i++) {
    const t0 = performance.now();
    const h = Math.floor(state.time / HOUR_SECS) % 24;
    if (h !== hour) {
      hour = h;
      const f0 = performance.now();
      buildCommute(map, parcels, opts.residents ?? 5000, state.closed, routeCache);
      flowTimes.push(performance.now() - f0);
    }
    tick(state, 0.05);
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return {
    mean: times.reduce((s, t) => s + t, 0) / times.length,
    p95: times[Math.floor(times.length * 0.95)],
    max: times[times.length - 1],
    flowColdMs: flowTimes[0] ?? 0,
    flowHotMs: flowTimes[flowTimes.length - 1] ?? 0,
    completed: state.completed, noRoute: state.noRoute, ...probeGridlock(state),
  };
}
