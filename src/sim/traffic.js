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
// Nothing spawns cars yet: M3.T30 gives trips parcel-to-parcel routes. T29's
// tests place cars by hand, in the shape this module reads and writes.
export const CAR_LEN = 4.5;
export const LANE_OFF = 2.4;
export const VMAX = 13.5;
export const ACCEL = 2.5;
export const BRAKE = 6;
export const GAP_MIN = 2.5;
export const TURN_SECS = 0.6;
const FOLLOW_GAIN = 1.5;

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

// Node and edge indexes, rebuilt whenever a road op bumps map.version, so a
// removed edge cannot keep a route alive behind the sim's back (M3.T19).
function indexes(state) {
  if (state.indexVersion !== state.map.version) {
    state.byId = new Map(state.map.graph.nodes.map((n) => [n.id, n]));
    state.edgeById = new Map(state.map.graph.edges.map((e) => [e.id, e]));
    state.indexVersion = state.map.version;
  }
  return state;
}

export function createTraffic(map, seed, count = 0) {
  // `count` is the trip count M3.T30 fills in; T29's cars are placed by tests,
  // so the road starts empty here.
  return { map, seed, time: 0, cars: [], indexVersion: null };
}

export function tick(state, dt) {
  state.time += dt;
  indexes(state);
  const lanes = new Map();
  for (const c of state.cars) {
    if (c.turn) continue;
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
    const edge = state.edgeById.get(c.route[c.leg]);
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
    if (c.s < len) {
      Object.assign(c, pointOn(state.byId, edge, c.dir, c.s));
      continue;
    }
    if (c.leg === c.route.length - 1) {
      // The route ends: hold at the last node. M3.T30 gives trips an arrival
      // beyond the camera and swaps in the next trip.
      c.s = len;
      c.v = 0;
      Object.assign(c, pointOn(state.byId, edge, c.dir, len));
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
