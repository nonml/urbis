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
//
// M5.T31 (M5-14) hands the junction to the player: any junction may be set to
// lights, a stop sign or a yield. The control is the city's own record on the
// map, beside the roads it governs, so a road op never disturbs it and the
// traffic, the overview and a check all read the one answer. What each control
// costs the cars that cross it is counted per junction (junctionWait), which is
// the mean wait the criterion's A/B weighs.
// T29's tests place cars by hand, in the shape this module reads and writes.
import { mulberry32 } from './rng.js';
import { DAY_SECS, START_HOUR } from './clock.js';
import { frontageRoad, lanesInDir, roadTypeOf } from './map.js';
import { heightAt } from './world.js';

// The ground under a car (M4.T10): the map's own field when it has one
// (M4.T2, the field the render draws); the load-time world field is the hand
// preset's fallback.
const groundAt = (map, x, z) => (map.terrain?.heightAt ?? heightAt)(x, z);

export const CAR_LEN = 4.5;
export const LANE_OFF = 2.4;
// How far the next lane out stands past the kerb lane, so cars in adjacent
// lanes never stand inside each other. It stays under the 4.2 m M3-6 measures
// a car against its edge's centre-line: every road is drawn a uniform 7 m wide
// until M5.T25 lays the 4-lane cross-section each type has.
export const LANE_STEP = 1.79;
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

// ---------------------------------------------------------------------------
// The control a junction runs (M5.T31, M5-14). Every junction runs the
// two-phase light above until the player sets it otherwise: a stop sign, which
// holds every car at the line for STOP_HOLD however clear the way looks, or a
// yield, which holds a car only for traffic it would cross.
export const JUNCTION_CONTROLS = ['lights', 'stop', 'yield'];
// The seconds a stop sign holds a car at its line. Two is the stand a driver
// takes at a sign they can see clear: long enough to read it, short enough that
// a queue behind it still moves.
export const STOP_HOLD = 2;
// A car held back by a junction is counted from the moment it is slowed at all,
// so a car driving up to the line at its cruise pays nothing and one standing
// in the queue pays all of it.
const CREEP = 0.1;
// How close to the line a car must be to be standing on it.
const STAND_EPS = 0.05;

// What the city's own record gives the junction `node`: lights while nothing
// has been set against it, and whatever the player set it to after that.
export function junctionControlOf(map, node) {
  return map.junctions?.[node] ?? 'lights';
}

// A click on a junction sets the control the map's record carries. False when
// the junction already runs that control, so a click reports whether the world
// changed the way every other act does.
export function setJunctionControl(map, node, control) {
  if (!JUNCTION_CONTROLS.includes(control)) return false;
  map.junctions ??= {};
  if (map.junctions[node] === control) return false;
  map.junctions[node] = control;
  return true;
}

// What the junction `node` runs, or null when it is not a junction at all: the
// nodes two ways meet at are the set the lights run at, which indexes() keeps in
// step with the graph.
export function junctionControl(state, node) {
  if (!state.signals.has(node)) return null;
  return junctionControlOf(state.map, node);
}

// What the junction has cost the cars that crossed it: the seconds cars have
// been held back at its line and how many cars have stood there, so `mean` is
// the average wait a car paid at that junction. The overview's card reads it
// and the criterion's A/B weighs one control against another at one junction.
export function junctionWait(state, node) {
  const wait = state.waits.get(node);
  const cars = wait?.cars ?? 0;
  const secs = wait?.secs ?? 0;
  return { cars, secs, mean: cars > 0 ? secs / cars : 0 };
}

// Whether the control the junction runs holds `c` back at its line this tick.
function waitsAt(state, c, edge, far, line) {
  // A car already past the line is in the junction and must clear it, not stop
  // dead in the crossing.
  if (c.s > line) return false;
  const control = junctionControl(state, far);
  if (control === null) return false;
  if (control === 'lights') return !signalGreen(edge.axis, state.time);
  if (control === 'yield') return conflicts(state, c, edge, far);
  return holdsFor(state, c, far, line);
}

// A stop sign: the car is held onto the line and stands for STOP_HOLD before it
// may go, however clear the way looks. The clock starts on the line rather than
// where the car began to brake, so a car held behind a queue stands for the
// sign's dwell when it reaches the line and not a moment sooner.
function holdsFor(state, c, far, line) {
  const at = c.stop;
  if (at && at.node === far) return state.time < at.until;
  if (line - c.s <= STAND_EPS) c.stop = { node: far, until: state.time + STOP_HOLD };
  return true;
}

// A yield: the car holds only for traffic it would cross — a car inside the
// junction, or one coming into it down another way. A car standing at its own
// line is waiting its turn, not a conflict, so two yields never hold each other
// for good.
const CONFLICT_IN = 5;        // a car this close to the node is in the junction
const CONFLICT_NEAR = 14;     // how far down another way a car counts as coming
const CONFLICT_COMING = 0.5;  // m/s: above this a car is moving, not waiting

function conflicts(state, c, edge, far) {
  const at = state.byId.get(far);
  if (!at) return false;
  for (const o of state.cars) {
    if (o === c || o.route.length === 0) continue;
    const d = Math.hypot(o.x - at.x, o.z - at.z);
    if (d > CONFLICT_NEAR) continue;
    if (d <= CONFLICT_IN) return true;
    if (o.turn || o.speed < CONFLICT_COMING) continue;
    if (o.axis !== edge.axis) return true;
  }
  return false;
}

// What the junction is costing this car, kept on the car until it has crossed
// the line: a control that holds one car back twice at one line is one wait.
function holdOn(c, node, dt) {
  c.held = { node, secs: (c.held?.node === node ? c.held.secs : 0) + dt };
}

// One car's wait at the junction's line, counted into what the junction has
// cost the cars that crossed it.
function noteWait(state, node, secs) {
  const wait = state.waits.get(node) ?? { cars: 0, secs: 0 };
  wait.cars += 1;
  wait.secs += secs;
  state.waits.set(node, wait);
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

// M3.T40: a road the player lays is driven within the minute (M3-6). For
// FRESH_SECS after an addRoad, cars take trips over it: the ones nearest the new
// road are re-tasked for it, and a car that finishes a trip drives it next
// rather than waiting on a random trip to happen to choose it. The sweep sorts
// by the drive ahead of each car, so it is the best-placed cars that turn; the
// junction a road lands on is live — an op that cuts a road leaves its pieces
// standing (M3.T40b) — so those are the cars at that junction, metres out.
// FRESH_RUN only bounds how far one car may be sent: a street laid out along an
// arterial, with its one junction on it, is reached by whichever car is coming
// along that arterial, and a cap under that sends nobody at all. FRESH_CARS
// keeps it to a handful, so the streets keep their own traffic and only the
// nearest few turn. REPLAN_SECS is how often the window looks again: one pass
// reads the fleet as it stood the instant before the road existed, and the car
// that can reach it soonest may not have come within reach yet (M3.T40b).
export const FRESH_SECS = 90;
export const FRESH_RUN = 1200;
const FRESH_CARS = 8;
const REPLAN_SECS = 1;
// A road op that takes ground away: cars standing on it re-task from a node
// clear of it, so a removed road empties instead of keeping cars at the dead end
// it left standing. Further than any lane's reach of the centre-line, so a car
// re-tasked from one is off that ground, not in it.
const GONE_CLEAR = 8;
// M4.T17: the road in from outside. A quarter of the fleet comes from outside
// it — the game ticks 16 cars (street.js CAR_COUNT), so four — and only ever
// runs between the far end and the town, so the road in is driven rather than
// standing empty. Half of them drive in and half drive out at boot; of the ones
// standing in town, THROUGH_SHARE run the length of the town and leave by an
// arterial end the other side — through traffic — and the rest turn round at the
// far end, which is what a commuter does.
const OUTSIDE_DIVISOR = 4;
const OUTSIDE_SPLIT = 0.5;
const THROUGH_SHARE = 0.5;

// The lane a car drives: `dir` is the sign of travel along the edge's own a->b
// order, and lane 0 sits LANE_OFF to the right of that travel, every lane past
// it LANE_STEP further out. Right of (ux, uz) is (uz, -ux), so the two
// directions sit 2 * LANE_OFF apart.
export function lanePoint(map, edge, dir, s, lane = 0) {
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  return pointOn(byId, edge, dir, s, lane);
}

function pointOn(byId, edge, dir, s, lane = 0) {
  const from = byId.get(dir > 0 ? edge.a : edge.b);
  const to = byId.get(dir > 0 ? edge.b : edge.a);
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  const off = LANE_OFF + lane * LANE_STEP;
  return {
    x: from.x + ux * s + uz * off,
    z: from.z + uz * s - ux * off,
    yaw: Math.atan2(ux, uz),
  };
}

// The lane a car holds on the edge it is driving, inside the lanes that road
// runs its way: an edge cut back under it carries the car into a lane that is
// left.
function laneOf(c, edge) {
  return Math.min(c.lane ?? 0, Math.max(0, lanesInDir(edge, c.dir) - 1));
}

// Where the cars of one lane of an edge stand relative to `from` along it:
// `ahead` the nearest in front, `beside` the nearest either side. A car
// changing lane counts in the lane it moves into, so a queue spreads evenly.
function laneCars(state, c, edge, dir, lane, from = c.s) {
  let ahead = Infinity;
  let beside = Infinity;
  for (const o of state.cars) {
    if (o === c || o.route.length === 0) continue;
    if (o.route[o.leg] !== edge.id || o.dir !== dir) continue;
    if (laneOf(o, edge) !== lane) continue;
    const d = o.s - from;
    if (d > 0) { if (d < ahead) ahead = d; }
    else if (-d < beside) beside = -d;
  }
  return { ahead, beside };
}

// The room ahead that makes a car take a lane other than the first: a queue
// this close. Farther than that every car drives the kerb lane — lane 0, where
// a one-lane direction's lane has always sat — so light traffic is unchanged.
const LANE_CROWD = 2 * (CAR_LEN + GAP_MIN);

// The lane a car takes onto an edge (M5.T24): the one with the most room ahead,
// so a queue spreads across the lanes a road runs — what makes an avenue carry
// more cars through a junction than a street (M5-10). One lane a way has
// nothing to choose.
function laneFor(state, edge, dir, c) {
  const most = Math.max(0, lanesInDir(edge, dir) - 1);
  if (most === 0) return 0;
  const own = laneCars(state, c, edge, dir, 0, 0).ahead;
  if (own > LANE_CROWD) return 0;
  let best = 0;
  let room = own;
  for (let lane = 1; lane <= most; lane++) {
    const far = laneCars(state, c, edge, dir, lane, 0).ahead;
    if (far > room) { room = far; best = lane; }
  }
  return best;
}

// The lane a car holds this step, carried back into a lane the road still runs
// by the interpolation a turn uses, so a cut-back never jumps sideways.
function laneNow(state, c, edge) {
  const lane = laneOf(c, edge);
  if (lane !== c.lane && !c.turn) {
    c.lane = lane;
    c.turn = { from: { x: c.x, z: c.z, yaw: c.yaw }, to: pointOn(state.byId, edge, c.dir, c.s, lane), t: 0 };
  }
  return lane;
}

// A car a queue is holding moves out to the free lane beside it (M5.T24): the
// queue spreads across the lanes the road runs instead of stacking in the one
// nearest the centre-line, and the junction discharges it in as many files —
// what makes an avenue carry more cars through a junction than a street
// (M5-10). Only a car whose leader is a queue's length away moves, and only
// into a lane with room beside it, so nobody is overtaken inside a car width.
function spreadQueue(state, c, edge, lane) {
  const most = Math.max(0, lanesInDir(edge, c.dir) - 1);
  if (lane >= most) return lane;
  // The lane with the most room ahead, the one it holds included, and only a
  // lane clear beside the car can take it.
  let best = lane;
  let room = laneCars(state, c, edge, c.dir, lane).ahead;
  for (let other = 0; other <= most; other++) {
    if (other === lane) continue;
    const { ahead, beside } = laneCars(state, c, edge, c.dir, other);
    if (beside < CAR_LEN + GAP_MIN || ahead <= room) continue;
    room = ahead;
    best = other;
  }
  if (best === lane) return lane;
  c.lane = best;
  c.turn = { from: { x: c.x, z: c.z, yaw: c.yaw }, to: pointOn(state.byId, edge, c.dir, c.s, best), t: 0 };
  return best;
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
//
// A rebuild is also where a road op is read as traffic: `fresh` is the edges the
// op added and `gone` the ground it took away (M3.T40). A cut edge is not gone
// ground — the op leaves its pieces standing on the same tarmac — so an old edge
// counts as gone only when nothing of its centre-line survives.
function indexes(state) {
  if (state.indexVersion === state.map.version) return false;
  const had = state.indexVersion !== null;
  const oldBy = state.byId;
  const oldEdges = state.edgeById;
  state.byId = new Map(state.map.graph.nodes.map((n) => [n.id, n]));
  state.edgeById = new Map(state.map.graph.edges.map((e) => [e.id, e]));
  if (had) readOps(state, oldBy, oldEdges);
  state.links = linksOf(state);
  state.spots = spotsOf(state);
  state.signals = signalNodes(state.map);
  state.regional = regionalOf(state);
  state.ends = endsOf(state);
  state.indexVersion = state.map.version;
  return true;
}

// The road in from outside (M4.T17, map.js's `outside`): the node at its far
// end, out in the open land past the town, or null when the map has no road in.
// Rebuilt with the indexes, so a road op that takes the road away takes the
// traffic off it with it: a car from outside keeps its town trip and stands at
// its destination, like any car cut off by an op.
function regionalOf(state) {
  const gate = state.map.outside?.gate;
  return gate && state.byId.has(gate) ? gate : null;
}

// The ends the arterials leave the town by (map.js's `outside.ends`): every one
// of them out past the town's own roads, where a car crossing the town leaves
// it. Only the nodes the graph still has count, so a road op that takes one away
// leaves through traffic the rest.
function endsOf(state) {
  return (state.map.outside?.ends ?? []).filter((id) => state.byId.has(id));
}

function readOps(state, oldBy, oldEdges) {
  state.fresh = [...state.edgeById.values()].filter((e) => !oldEdges.has(e.id));
  state.freshIds = new Set(state.fresh.map((e) => e.id));
  if (state.fresh.length > 0) {
    state.freshUntil = state.time + FRESH_SECS;
    state.nextFresh = state.time;
  }
  state.gone = [];
  for (const edge of oldEdges.values()) {
    if (state.edgeById.has(edge.id)) continue;
    const a = oldBy.get(edge.a);
    const b = oldBy.get(edge.b);
    if (!a || !b || survivesOn(state, a, b)) continue;
    state.gone.push({ a, b });
  }
  // The nodes on ground that went: a removed road leaves its ends standing, and
  // a car that reaches one has nowhere to be but back where it came from.
  state.closed = state.gone.length === 0 ? new Set()
    : new Set(state.map.graph.nodes
      .filter((n) => state.gone.some((g) => offSegment(n, g) <= GONE_CLEAR))
      .map((n) => n.id));
}

// Whether any edge of the new graph still runs along the stretch between two
// points: an op that cuts an edge leaves its pieces on that centre-line, and
// only the road that is genuinely gone takes its ground with it.
function survivesOn(state, a, b) {
  // `axis` names the coordinate that varies, as the graph does: a stretch whose
  // z is constant runs along x. Reading a vertical stretch as 'x' would skip
  // every north-south piece below, so a road cut down its length would be read
  // as taken away and its nodes closed, severing the road laid across it from
  // the junction it lands on.
  const axis = Math.abs(a.z - b.z) < 1e-9 ? 'x' : 'z';
  const lo = axis === 'x' ? Math.min(a.x, b.x) : Math.min(a.z, b.z);
  const hi = axis === 'x' ? Math.max(a.x, b.x) : Math.max(a.z, b.z);
  const cross = axis === 'x' ? a.z : a.x;
  for (const e of state.edgeById.values()) {
    if (e.axis !== axis) continue;
    const p = state.byId.get(e.a);
    const q = state.byId.get(e.b);
    if (!p || !q) continue;
    const pr = axis === 'x' ? p.x : p.z;
    const qr = axis === 'x' ? q.x : q.z;
    const at = axis === 'x' ? p.z : p.x;
    const bt = axis === 'x' ? q.z : q.x;
    if (Math.abs(at - cross) > 1e-9 || Math.abs(bt - cross) > 1e-9) continue;
    // Overlap, not touch: a neighbour that butts up to this stretch shares no
    // tarmac with it, and the road is gone.
    if (Math.max(pr, qr) <= lo + 1e-9 || Math.min(pr, qr) >= hi - 1e-9) continue;
    return true;
  }
  return false;
}

function linksOf(state) {
  const links = new Map(state.map.graph.nodes.map((n) => [n.id, []]));
  for (const e of state.map.graph.edges) {
    const len = lengthOf(state.byId, e);
    // A one-way runs one way (M5.T24): the link the other direction would give
    // does not exist, so no route is ever planned against it.
    if (lanesInDir(e, 1) > 0) links.get(e.a).push({ to: e.b, len, edge: e, dir: 1 });
    if (lanesInDir(e, -1) > 0) links.get(e.b).push({ to: e.a, len, edge: e, dir: -1 });
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

// The node nearest a point, skipping any that stands on one of `avoid`'s
// stretches: a car re-tasked by a road op (M3.T40) goes from a node off the
// ground the op took away. Every node refused answers with the plain nearest
// one, so a map with no clear node still re-tasks.
function nearestNode(state, x, z, avoid = null) {
  let best = null;
  let bestD = Infinity;
  for (const n of state.map.graph.nodes) {
    const d = Math.hypot(n.x - x, n.z - z);
    if (d >= bestD) continue;
    if (avoid && avoid.some((g) => offSegment(n, g) < GONE_CLEAR)) continue;
    bestD = d;
    best = n;
  }
  return best;
}

// How far a point stands off a stretch of centre-line, 0 on it.
function offSegment(p, g) {
  const dx = g.b.x - g.a.x;
  const dz = g.b.z - g.a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - g.a.x) * dx + (p.z - g.a.z) * dz) / len2));
  return Math.hypot(p.x - (g.a.x + dx * t), p.z - (g.a.z + dz * t));
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
    fresh: [], freshIds: new Set(), freshUntil: -1, nextFresh: 0, gone: [], closed: new Set(),
    flow: null, flowByDistrict: {},
    // What each junction has cost the cars that crossed it (M5.T31, M5-14).
    waits: new Map(),
    regional: null, ends: [],
  };
  indexes(state);
  // Cars from outside (M4.T17), on a map with a road in from outside: a quarter
  // of the fleet. A map without one (the hand preset) keeps its whole fleet in
  // town, so nothing there asks for a far end that does not exist.
  const outside = state.regional ? Math.floor(count / OUTSIDE_DIVISOR) : 0;
  for (let i = 0; i < count; i++) state.cars.push(makeCar(state, i >= count - outside));
  return state;
}

// A car in the shape tick reads and writes, carrying the renderer's interim
// `axis` and `speed` (M3.T32 moves the renderer onto yaw and v). `stop` is the
// stop sign the car is standing for and `held` the wait a junction's line is
// costing it, both M5.T31's.
function makeCar(state, outside = false) {
  const c = {
    id: 0, route: [], leg: 0, dir: 1, s: 0, v: 0, turn: null, goal: null, stale: false,
    fresh: false, axis: 'z', speed: 0, prev: {}, x: 0, y: 0, z: 0, yaw: 0,
    stop: null, held: null,
  };
  c.outside = outside;
  // A car from outside (M4.T17) is placed on its own trip, or it is one more
  // town car: a map with no road in has none.
  if (!outside || !assignOutside(state, c)) {
    if (!assignTrip(state, c, null, false)) assignTrip(state, c, null, true);
  }
  return c;
}

// An outside car's first trip (M4.T17): between the far end and either a parcel
// in town or an arterial end the other side of it, in either direction. So the
// boot fleet holds cars driving in from the far end, cars driving out to it, and
// through traffic that has crossed the town and is leaving it. It starts where
// its trip starts, and only where the camera cannot see it — the rule every boot
// car obeys (M3-6).
function assignOutside(state, c) {
  const gate = state.regional;
  if (!gate) return false;
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const to = state.rng() < THROUGH_SHARE ? pick(state.rng, state.ends)
      : pick(state.rng, state.spots)?.node ?? null;
    if (!to || to === gate) continue;
    const inward = state.rng() < OUTSIDE_SPLIT;
    if (placeOutside(state, c, inward ? gate : to, inward ? to : gate)) return true;
  }
  return false;
}

// Put a car on a trip between two nodes at the node it starts from, on the lane
// its first edge carries. The lane has to be clear — exactly as a boot car's
// does, so two cars from outside never stand on one spot — and the start has to
// be out of the camera's view, so nothing the player can watch appears there.
function placeOutside(state, c, from, to) {
  if (!to || to === from) return false;
  const route = findRoute(state, from, to);
  if (!route || route.length === 0) return false;
  const edge = state.edgeById.get(route[0]);
  const dir = edge.a === from ? 1 : -1;
  const lane = laneFor(state, edge, dir, c);
  if (!clearAt(state, c, edge, dir, 0, lane)) return false;
  const at = pointOn(state.byId, edge, dir, 0, lane);
  if (!outOfView(state, at.x, at.z)) return false;
  takeTrip(state, c, route, dir, 0, to, lane);
  return true;
}

// A new trip: from a parcel's node (`from`; a random one when null) to another
// parcel's, on an A* route, starting on the lane its first edge carries in the
// direction it drives. A boot car (no origin) starts part-way along that edge,
// so the fleet is spread over the graph from the first frame instead of queued
// at a handful of junctions. `allowInView` lets a boot car take a start the
// camera can see when no out-of-view one comes up.
function assignTrip(state, c, from, allowInView) {
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const origin = from ?? pick(state.rng, state.spots)?.node;
    const to = pick(state.rng, state.spots);
    if (!origin || !to || origin === to.node) continue;
    const route = findRoute(state, origin, to.node);
    if (!route) continue;
    const edge = state.edgeById.get(route[0]);
    const dir = edge.a === origin ? 1 : -1;
    const lane = laneFor(state, edge, dir, c);
    const s0 = from === null ? freeStart(state, c, edge, dir, lane)
      : clearAt(state, c, edge, dir, 0, lane) ? 0 : null;
    if (s0 === null) continue;
    const p = pointOn(state.byId, edge, dir, s0, lane);
    if (!allowInView && !outOfView(state, p.x, p.z)) continue;
    takeTrip(state, c, route, dir, s0, to.node, lane);
    return true;
  }
  return false;
}

// Put a car on a route at `s0` metres along its first edge, in `lane` — the one
// with the most room ahead. Shared by the boot fleet, a re-tasked car and the
// spread onto a new road, so all three place a car the one way.
function takeTrip(state, c, route, dir, s0, goal, lane) {
  const edge = state.edgeById.get(route[0]);
  c.id = state.nextId;
  state.nextId += 1;
  c.route = route; c.leg = 0; c.dir = dir; c.s = s0; c.v = 0; c.turn = null;
  c.goal = goal; c.axis = edge.axis; c.speed = 0;
  c.lane = lane;
  const p = pointOn(state.byId, edge, dir, s0, lane);
  Object.assign(c, p);
  c.y = groundAt(state.map, p.x, p.z);
  c.prev.x = p.x;
  c.prev.z = p.z;
}

// No other car within a car length and a gap of `s` on one lane: two cars at
// the same spot hold each other at gap zero for good, so nothing is placed
// there. `freeStart` searches a spread-out spot for a car with no origin.
function clearAt(state, c, edge, dir, s, lane) {
  for (const o of state.cars) {
    if (o === c || o.turn || o.route.length === 0) continue;
    if (o.route[o.leg] === edge.id && o.dir === dir && laneOf(o, edge) === lane
      && Math.abs(o.s - s) < CAR_LEN + GAP_MIN) return false;
  }
  return true;
}

function freeStart(state, c, edge, dir, lane) {
  const span = lengthOf(state.byId, edge) * 0.9;
  for (let tries = 0; tries < 8; tries++) {
    const s = state.rng() * span;
    if (clearAt(state, c, edge, dir, s, lane)) return s;
  }
  return null;
}

// The next trip, chained through the usual turn; false when blocked.
function chainRoute(state, c, route, dest) {
  const edge = state.edgeById.get(route[0]);
  if (!edge) return false;
  const dir = edge.a === c.goal ? 1 : -1;
  const lane = laneFor(state, edge, dir, c);
  if (!clearAt(state, c, edge, dir, 0, lane)) return false;
  c.lane = lane;
  c.turn = { from: { x: c.x, z: c.z, yaw: c.yaw }, to: pointOn(state.byId, edge, dir, 0, lane), t: 0 };
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
// usual 0.6 s, so it never stops dead at the node and never jumps. A road the
// player has just laid is taken first when one stands near (M3.T40), then two
// trips in five head where the commuters go instead (M3.T35). The random pick
// runs on the trip stream exactly as before, and each of these draws on its own
// stream, so neither shifts the random trips (M3-6).
function rollTrip(state, c) {
  // A car from outside (M4.T17) keeps its own round: in to town from the far
  // end, and out again.
  if (c.outside) return outsideTrip(state, c);
  if (freshTrip(state, c)) return true;
  let fallback = null;
  for (let tries = 0; tries < TRIP_TRIES; tries++) {
    const to = pick(state.rng, state.spots);
    if (!to || to.node === c.goal) continue;
    const route = findRoute(state, c.goal, to.node);
    if (!route) continue;
    const edge = state.edgeById.get(route[0]);
    const dir = edge.a === c.goal ? 1 : -1;
    if (!clearAt(state, c, edge, dir, 0, laneFor(state, edge, dir, c))) continue;
    fallback = { route, node: to.node };
    break;
  }
  if (state.flowRng() < FLOW_PREF && flowTrip(state, c)) return true;
  if (!fallback) return false;
  return chainRoute(state, c, fallback.route, fallback.node);
}

// The next trip for a car from outside (M4.T17). Every one of them runs between
// the far end and the town, because the road in is the door the outside world
// has: standing at the far end it drives in, and standing in town it drives out
// to it again. In town includes the arterial ends past it, so a through car
// appears at the far end, runs the length of the town and leaves by an arterial
// end the other side — and comes back the same way. The trip leaves through the
// usual turn, like every other trip a car takes where it stands.
function outsideTrip(state, c) {
  const gate = state.regional;
  if (c.goal !== gate) return driveOutside(state, c, gate);
  // A share of the cars driving in run the length of the town instead of
  // turning off at a parcel.
  const through = state.flowRng() < THROUGH_SHARE;
  const to = through ? pick(state.rng, state.ends)
    : pick(state.rng, state.spots)?.node ?? null;
  return driveOutside(state, c, to);
}

// A trip from where a car stands to another node, planned and chained through
// the usual turn. False when there is no way there, or the lane it would leave
// by is not clear: the car holds and tries again next tick, as any car does.
function driveOutside(state, c, to) {
  if (!to || to === c.goal) return false;
  const route = findRoute(state, c.goal, to);
  if (!route || route.length === 0) return false;
  return chainRoute(state, c, route, to);
}

// A trip over a road the player has just laid (M3.T40, M3-6): from a node, along
// the shortest way to one end of a new edge, then down that edge to the other
// end. Left to chance a new street waits for a random trip to happen to choose it
// — the first car can be two minutes out — so the road the player has just laid
// carries traffic inside the minute. Returns { route, far }: `route` starts at
// `from`, `far` is the node the trip ends at. `arriveOn` is the edge the car
// reaches `from` over, so it is never sent straight back down it.
function freshRoute(state, from, arriveOn = null) {
  let best = null;
  for (const edge of state.fresh) {
    for (const near of [edge.a, edge.b]) {
      const far = near === edge.a ? edge.b : edge.a;
      if (far === from || !state.byId.has(near)) continue;
      const approach = findRoute(state, from, near);
      // No way to that end, so no trip: an approach that failed to plan is not
      // an empty one. Treating it as empty builds a trip that claims to start at
      // `from` and names only the new edge, which starts somewhere else entirely
      // — the car is then chained onto an edge it is nowhere near and is driven
      // across the map to reach it. An empty approach is only true when the car
      // is already standing at the end it drives in at.
      if (approach === null || (approach.length === 0 && from !== near)) continue;
      // A car that reaches this end *from* the far one has to turn back down the
      // edge it came along, and the lane swap cannot carry that; the trip goes in
      // the other end instead. On a dead-end spur that leaves the junction end.
      if (cameFrom(state, approach, near) === far) continue;
      if (approach[approach.length - 1] === arriveOn) continue;
      const route = [...approach, edge.id];
      // Both ends of a street are weighed and the nearer one taken. Taking the
      // first that works sends a car the long way round a spur to reach the far
      // tip it could have entered at the junction, which costs it the minute
      // M3-6 measures in.
      const len = routeLen(state, route);
      if (!best || len < best.len) best = { route, far, len };
    }
  }
  return best;
}

// The node a route reached `node` from — the far end of its last edge.
function cameFrom(state, route, node) {
  if (route.length === 0) return null;
  const edge = state.edgeById.get(route[route.length - 1]);
  if (!edge) return null;
  return edge.a === node ? edge.b : edge.a;
}

// A trip over a road the player has just laid, for a car standing at its
// destination and free to take it now.
function freshTrip(state, c) {
  if (state.time > state.freshUntil) return false;
  const over = freshRoute(state, c.goal);
  if (!over || routeLen(state, over.route) > FRESH_RUN) return false;
  return chainRoute(state, c, over.route, over.far);
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

// Whether a car's remaining route stands on ground a road op has taken away: it
// names an edge the map no longer has, or it reaches a node on that ground.
function routeClosed(state, c) {
  if (state.closed.size === 0) return false;
  for (let i = c.leg; i < c.route.length; i++) {
    const edge = state.edgeById.get(c.route[i]);
    if (!edge) return true;
    if (state.closed.has(edge.a) || state.closed.has(edge.b)) return true;
  }
  return false;
}

// A* over the graph, cost the edge length, heuristic the grid's Manhattan gap.
// Ground a road op has taken away is not on the way anywhere: the route stops at
// its border, so a trip is never planned back over a road that is not there.
function findRoute(state, from, to) {
  if (state.closed.has(from) || state.closed.has(to)) return null;
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
      if (state.closed.has(link.to)) continue;
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
// longer has is re-tasked from the nearest surviving node clear of the ground
// the op took away, so a removed road empties of it within the step (M3-6) and
// an added road can carry it later. A car with no route at all holds at that
// node until the next tick tries again.
//
// A car in a turn is between two lane points, and re-tasking it there would
// jump it a lane's width in one step. It finishes its 0.6 s turn and is
// re-tasked after (M3.T40b): left holding a route naming a road that is gone,
// it reached the end of its leg and found no next edge to turn onto.
function revalidate(state) {
  for (const c of state.cars) {
    if (c.route.length === 0) continue;
    if (!c.route.every((id) => state.edgeById.has(id)) || routeClosed(state, c)) {
      if (c.turn) { c.stale = true; continue; }
      retask(state, c);
      continue;
    }
    // A road the car's route would run a one-way against (M5.T24): it finishes
    // the edge it is on and takes its next trip at that edge's far end, so it
    // never drives a one-way the wrong way for a second edge.
    if (oneWayAgainst(state, c) && !c.turn) {
      const here = state.edgeById.get(c.route[c.leg]);
      c.route = c.route.slice(0, c.leg + 1);
      if (here) c.goal = c.dir > 0 ? here.b : here.a;
    }
  }
}

// Whether the edges a car has still to drive run a one-way against the one
// direction it names: a car on such an edge already drives to its end and its
// route stops there.
function oneWayAgainst(state, c) {
  const here = state.edgeById.get(c.route[c.leg]);
  if (!here) return false;
  let at = c.dir > 0 ? here.a : here.b;
  for (let i = c.leg + 1; i < c.route.length; i++) {
    const e = state.edgeById.get(c.route[i]);
    if (!e) return false;
    if (e.b === at && lanesInDir(e, -1) === 0) return true;
    at = e.a === at ? e.b : e.a;
  }
  return false;
}

function retask(state, c) {
  c.turn = null;
  const node = nearestNode(state, c.x, c.z, state.gone);
  if (!assignTrip(state, c, node ? node.id : null, true)) holdAt(state, c, node);
}

// A car the op left with no trip still may not stand on the ground the op took
// away: it waits at the node `retask` already picked, no route, until a tick
// offers it one. Left where it was, it sits in the lane of a centre-line that
// is no longer in the map — an op that splits the graph into one routable
// component (a comb with its spine cut) can assign almost no car a trip, and
// every one of them stays on the removed road for the ten seconds M3-6 counts.
function holdAt(state, c, node) {
  c.route = [];
  c.v = 0;
  c.s = 0;
  if (!node) return;
  c.goal = node.id;
  c.x = node.x;
  c.z = node.z;
  c.y = groundAt(state.map, node.x, node.z);
  c.prev.x = node.x;
  c.prev.z = node.z;
}

// The cars a road op caught mid-turn, once they are standing in a lane again.
function retaskStale(state) {
  for (const c of state.cars) {
    if (!c.stale || c.turn) continue;
    c.stale = false;
    retask(state, c);
  }
}

// The cars a new road can claim (M3.T40, M3-6): every car that can reach it
// inside FRESH_RUN has its trip run on over it, cheapest first, so the street
// the player just laid carries traffic inside the minute instead of waiting on a
// random trip to happen to choose it. Each car keeps the leg it is on — it is
// mid-lane, and stopping it there would jump it — and plans from that leg's far
// node, which is where it is going anyway. Cars reach a street they are not
// standing near the same way, over a fresh trip taken at their destination.
//
// The window looks again every REPLAN_SECS until it closes (M3.T40b): a car
// standing at the junction the road lands on is claimed on the op tick and is
// driving it seconds later, but a street whose one junction sits on an arterial
// is reached by whichever car is coming along it, and the fleet reads very
// differently a minute later. A car already on its way there is counted and left
// alone, so the number diverted at once stays FRESH_CARS.
function replanNear(state) {
  if (state.fresh.length === 0 || state.time > state.freshUntil) return;
  if (state.time < state.nextFresh) return;
  state.nextFresh = state.time + REPLAN_SECS;
  const spans = state.fresh.map((e) => ({ a: state.byId.get(e.a), b: state.byId.get(e.b) }));
  const plans = [];
  let live = 0;
  for (const c of state.cars) {
    if (c.turn || c.route.length === 0) continue;
    const edge = state.edgeById.get(c.route[c.leg]);
    if (!edge) continue;
    if (c.route.slice(c.leg).some((id) => state.freshIds.has(id))) {
      // Only a car this window diverted counts against FRESH_CARS: a random
      // trip that happens to cross the new road is traffic, not a diversion,
      // and counting it would fill the window's hands with cars it never sent.
      if (c.fresh) live += 1;
      continue;
    }
    c.fresh = false;
    // A drive over the road is at least this far as the crow flies, so a car
    // standing further off it than FRESH_RUN cannot be sent for it.
    if (Math.min(...spans.map((g) => offSegment(c, g))) > FRESH_RUN) continue;
    const over = freshRoute(state, edgeEnd(state, c), edge.id);
    if (!over) continue;
    // The trip runs on from the end of this leg, so its first edge has to leave
    // that node. One that is this leg again is a U-turn the lane swap cannot
    // carry, and splicing it in would put the car back where it came from.
    if (over.route[0] === edge.id) continue;
    const left = lengthOf(state.byId, edge) - c.s;
    const cost = left + routeLen(state, over.route);
    if (cost <= FRESH_RUN) plans.push({ c, over, cost });
  }
  if (plans.length === 0) return;
  plans.sort((p, q) => p.cost - q.cost);
  for (const { c, over } of plans.slice(0, Math.max(0, FRESH_CARS - live))) {
    c.route = [...c.route.slice(0, c.leg + 1), ...over.route];
    c.goal = over.far;
    c.fresh = true;
  }
}

// The node at the far end of the edge a car is driving, in its own direction.
function edgeEnd(state, c) {
  const edge = state.edgeById.get(c.route[c.leg]);
  return edge ? (c.dir > 0 ? edge.b : edge.a) : c.goal;
}

export function tick(state, dt) {
  state.time += dt;
  if (indexes(state)) revalidate(state);
  replanNear(state);
  tickFlow(state);
  const lanes = new Map();
  for (const c of state.cars) {
    if (c.turn || c.route.length === 0) continue;
    const edge = state.edgeById.get(c.route[c.leg]);
    if (!edge) continue;
    const key = `${edge.id}|${c.dir}|${laneOf(c, edge)}`;
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
    const lane = laneNow(state, c, edge);
    const file = lanes.get(`${edge.id}|${c.dir}|${lane}`);
    const leader = file[file.indexOf(c) + 1] ?? null;
    // A car a queue is holding moves out to the free lane beside it, so the
    // queue spreads across the lanes the road runs (M5.T24).
    const held = leader !== null && leader.s - c.s < CAR_LEN + GAP_MIN + 1;
    let target = VMAX;
    if (leader) {
      // Gap keeping: match speeds on the linear law, but always be able to
      // stop on the arrival curve at the leader's tail, clear = CAR_LEN +
      // GAP_MIN behind its centre. The linear law alone cannot stop for a
      // leader at rest from VMAX.
      const clear = Math.max(0, leader.s - c.s - CAR_LEN - GAP_MIN);
      target = Math.min(target, clear * FOLLOW_GAIN, Math.sqrt(2 * BRAKE * clear));
    }
    // The stop line is a stationary leader at the junction, and the control the
    // junction runs is what stops a car there (M5.T31). A car already past it is
    // in the junction and must clear, not stop dead in the crossing; a car
    // behind it eases onto the line and is held there, so it cannot creep into
    // the crossing.
    const far = c.dir > 0 ? edge.b : edge.a;
    const line = len - STOP_LINE;
    const hold = waitsAt(state, c, edge, far, line);
    if (hold) {
      const clear = line - c.s;
      target = Math.min(target, clear * FOLLOW_GAIN, Math.sqrt(2 * BRAKE * clear));
    }
    c.v = Math.max(0, Math.max(c.v - BRAKE * dt, Math.min(c.v + ACCEL * dt, target)));
    c.s += c.v * dt;
    if (hold) {
      if (c.s > line) { c.s = line; c.v = 0; }
      if (c.v < VMAX - CREEP) holdOn(c, far, dt);
    } else if (c.held && (c.held.node !== far || c.s > line)) {
      // The car has left this junction's line: its wait is what the junction
      // cost it, counted once however many times the control held it back.
      if (c.held.node === far) noteWait(state, far, c.held.secs);
      c.held = null;
    }
    c.speed = c.v;
    c.axis = edge.axis;
    if (c.s < len) {
      Object.assign(c, pointOn(state.byId, edge, c.dir, c.s, lane));
      // The lane change is carried by the interpolation a turn uses, so it
      // starts from the pose this step has just left the car in (M0-9).
      if (held && !c.turn) spreadQueue(state, c, edge, lane);
      continue;
    }
    if (c.leg === c.route.length - 1) {
      // The route ends: take the next trip from this node through the usual
      // turn, so the car never stops dead and its draw slot never jumps. A
      // hand-placed car (want 0) holds at the node for good.
      c.s = len;
      Object.assign(c, pointOn(state.byId, edge, c.dir, len, lane));
      if (state.want > 0 && c.goal !== null) { if (!rollTrip(state, c)) c.v = 0; }
      else { c.v = 0; c.speed = 0; }
      continue;
    }
    beginTurn(state, c, edge, len);
  }
  retaskStale(state);
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
  const from = pointOn(state.byId, edge, c.dir, len, laneOf(c, edge));
  const lane = laneFor(state, next, dir, c);
  const to = pointOn(state.byId, next, dir, 0, lane);
  c.leg += 1;
  c.dir = dir;
  c.s = 0;
  c.axis = next.axis;
  c.lane = lane;
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
