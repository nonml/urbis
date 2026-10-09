// M3-6 (docs/ROADMAP.md): routed traffic. Cars travel trips along the road
// graph; no car moves farther between frames than its speed allows (except when
// it appears or goes at least 60 m from the camera and out of its view); cars
// stop at a red light; after removeRoad no car is on that road within 10 game
// seconds; after addRoad a car drives it within 60 game seconds. The walker half
// (at 8:00, 60% of visible walkers heading to their job's parcel) needs the
// page's clock and camera and is checked in tests/accept/m3-traffic.spec.js.
//
// M3.T28 writes this check red. Today sim/traffic.js does not exist and street.js
// wraps cars at the end of the tarmac (street.js:308-313); M3.T29-T35 build
// routed traffic and drop the test.fail markers below. The contract they build
// to is M3.S2's proven shape:
//   src/sim/traffic.js exports createTraffic(map, seed, count) -> { time, cars },
//   tick(state, dt), signalGreen(axis, t) and lanePoint(map, edge, dir, s);
//   a car carries { id, route, leg, dir, s, v, turn, prev, x, z, yaw }, and
//   state.cam = { x, z, yaw } is the camera spawns are measured from.
import { test, expect } from '@playwright/test';
import { createMap, edgesNear, projectOnSegment } from '../../src/sim/map.js';
import { addRoad, removeRoad } from '../../src/sim/ops.js';

const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const CARS = 60;
const CAM_DIST = 60;
const JUMP_M = 1.2;      // M3.S2: VMAX 13.5 m/s x 50 ms step, measured under 1.2
const LANE_REACH = 4.2;  // 2.4 m lane offset + a car's half-width + slack
const api = () => import('../../src/sim/traffic.js');
const camAt = (map) => ({ x: map.spawn.player.x, z: map.spawn.player.z, yaw: map.spawn.player.yaw });
const nodesOf = (map) => new Map(map.graph.nodes.map((n) => [n.id, n]));
const lenOf = (by, e) => Math.hypot(by.get(e.b).x - by.get(e.a).x, by.get(e.b).z - by.get(e.a).z);
const onEdge = (by, e, x, z, lo = 0.02, hi = 0.98) => {
  const h = projectOnSegment(x, z, by.get(e.a), by.get(e.b));
  return h.dist <= LANE_REACH && h.t >= lo && h.t <= hi;
};

// The first instant `secs` of `pred` holds without a break: a light that stays
// red long enough to hold a car through its whole approach.
function firstSpan(pred, secs) {
  for (let t = 0; t <= 120; t += DT) {
    let ok = true;
    for (let u = t; u <= t + secs && ok; u += DT) ok = pred(u);
    if (ok) return t;
  }
  return null;
}

test('M3-6: a car drives its route along the graph and never jumps', async () => {
  const { createTraffic, tick } = await api();
  const rows = [];
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const cam = camAt(map);
    const state = createTraffic(map, seed, CARS);
    state.cam = cam;
    const prev = new Map();
    const seen = new Set();
    let sampled = 0;
    let jumps = 0;
    let offGraph = 0;
    for (let i = 0; i < 4000; i++) {
      tick(state, DT);
      for (const c of state.cars) {
        seen.add(c.id);
        const was = prev.get(c.id);
        if (was) {
          sampled += 1;
          const d = Math.hypot(c.x - was.x, c.z - was.z);
          const far = Math.hypot(c.x - cam.x, c.z - cam.z) >= CAM_DIST
            && Math.hypot(was.x - cam.x, was.z - cam.z) >= CAM_DIST;
          if (d > JUMP_M && !far) jumps += 1;
        }
        prev.set(c.id, { x: c.x, z: c.z });
        if (edgesNear(map, c.x, c.z, LANE_REACH).length === 0) offGraph += 1;
      }
      const live = new Set(state.cars.map((c) => c.id));
      for (const id of prev.keys()) if (!live.has(id)) prev.delete(id);
    }
    rows.push({ seed, sampled, seen: seen.size, jumps, offGraph });
  }
  expect(rows.filter((r) => r.sampled < 10000), `too few car samples:\n${JSON.stringify(rows)}`).toEqual([]);
  expect(rows.filter((r) => r.seen <= CARS), `no trip finished:\n${JSON.stringify(rows)}`).toEqual([]);
  expect(rows.filter((r) => r.jumps > 0), `cars moved past their step:\n${JSON.stringify(rows.filter((r) => r.jumps > 0))}`).toEqual([]);
  expect(rows.filter((r) => r.offGraph > 0), `car samples off every graph edge:\n${JSON.stringify(rows.filter((r) => r.offGraph > 0))}`).toEqual([]);
});

test('M3-6: a car holds at the line while its light is red and crosses on green', async () => {
  const { createTraffic, tick, signalGreen, lanePoint } = await api();
  const map = createMap(SEEDS[0]);
  const byId = nodesOf(map);
  const edge = map.graph.edges.find((e) => lenOf(byId, e) > 60
    && map.graph.edges.some((n) => n !== e && (n.a === e.b || n.b === e.b)));
  expect(edge, 'an avenue edge long enough to brake on, with a way on at its far node').toBeTruthy();
  const next = map.graph.edges.find((n) => n !== edge && (n.a === edge.b || n.b === edge.b));
  const len = lenOf(byId, edge);
  const redAt = firstSpan((t) => !signalGreen(edge.axis, t), 9);
  const greenAt = firstSpan((t) => signalGreen(edge.axis, t), 5);
  expect(redAt, `a 9 s red for the ${edge.axis} axis`).not.toBe(null);
  expect(greenAt, `a 5 s green for the ${edge.axis} axis`).not.toBe(null);

  const state = createTraffic(map, SEEDS[0], 0);
  const from = lanePoint(map, edge, 1, len - 20);
  state.time = redAt;
  state.cars = [{
    id: 1, route: [edge.id, next.id], leg: 0, dir: 1, s: len - 20, v: 13,
    turn: null, stuck: 0, prev: { x: from.x, z: from.z }, ...from,
  }];
  for (let i = 0; i < 140; i++) tick(state, DT);
  expect(signalGreen(edge.axis, state.time), 'the light is still red after 7 s').toBe(false);
  expect(state.cars[0].v, `speed at the line: ${state.cars[0].v} m/s`).toBeLessThan(0.5);
  expect(state.cars[0].s, `held at ${state.cars[0].s} of ${len} m`).toBeLessThan(len - 3.9);

  state.time = greenAt;
  let crossed = false;
  for (let i = 0; i < 200 && !crossed; i++) {
    tick(state, DT);
    const car = state.cars.find((c) => c.id === 1);
    crossed = !car || car.leg > 0;
  }
  expect(crossed, `the car went on ${(state.time - greenAt).toFixed(1)} s of green`).toBe(true);
});

test('M3-6: after removeRoad no car is on that road within 10 game seconds', async () => {
  const { createTraffic, tick } = await api();
  const rows = [];
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const byId = nodesOf(map);
    const state = createTraffic(map, seed, CARS);
    state.cam = camAt(map);
    for (let i = 0; i < 40; i++) tick(state, DT);
    // The road a car is driving right now, mid-edge so the check is about the
    // road itself and not a junction it happens to be crossing.
    const on = state.cars.filter((c) => !c.turn).map((c) => {
      const near = edgesNear(map, c.x, c.z, LANE_REACH);
      return near.length ? { edge: near[0].edge, t: near[0].t } : null;
    }).filter((h) => h && h.t > 0.2 && h.t < 0.8);
    expect(on.length, `seed ${seed}: a car is mid-edge 2 s in`).toBeGreaterThan(0);
    removeRoad(map, on[0].edge);
    for (let i = 0; i < 200; i++) tick(state, DT);
    const still = state.cars.filter((c) => onEdge(byId, on[0].edge, c.x, c.z)).map((c) => c.id);
    rows.push({ seed, still });
  }
  const late = rows.filter((r) => r.still.length > 0);
  expect(late, `cars on a removed road 10 game seconds later:\n${JSON.stringify(late)}`).toEqual([]);
});

test('M3-6: after addRoad a car drives it within 60 game seconds', async () => {
  // Measured 2026-10-06: within 60 s a car is routed over the new road
  // (900/1200 frames, seed 73) but the first arrival is ~120 s; the old pass
  // was cars crossing the junction geometry, no route held the new edge.
  // M3.T40 makes nearby cars take trips over a new road and drops this marker.
  const { createTraffic, tick } = await api();
  const rows = [];
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const state = createTraffic(map, seed, CARS);
    state.cam = camAt(map);
    const before = new Set(map.graph.edges.map((e) => e.id));
    // A new street into the block: front an existing node, 90 m along one axis.
    // addRoad cuts every crossing and replans the frontage (M3.T20), so a trip
    // can end on it.
    const walk = map.district.walk;
    let laid = null;
    for (const n of map.graph.nodes) {
      for (const [dx, dz] of [[0, 90], [0, -90], [90, 0], [-90, 0]]) {
        const end = { x: n.x + dx, z: n.z + dz };
        if (end.x < walk.minX + 5 || end.x > walk.maxX - 5
          || end.z < walk.minZ + 5 || end.z > walk.maxZ - 5) continue;
        const version = map.version;
        addRoad(map, n, end);
        if (map.version === version) continue;
        const by = nodesOf(map);
        laid = map.graph.edges.filter((e) => !before.has(e.id)
          && projectOnSegment(by.get(e.a).x, by.get(e.a).z, n, end).dist < 0.6
          && projectOnSegment(by.get(e.b).x, by.get(e.b).z, n, end).dist < 0.6);
        break;
      }
      if (laid) break;
    }
    expect(laid && laid.length, `seed ${seed}: a road can be laid into the district`).toBeTruthy();
    const by = nodesOf(map);
    let drove = 0;
    for (let i = 0; i < 1200; i++) {
      tick(state, DT);
      if (state.cars.some((c) => laid.some((e) => onEdge(by, e, c.x, c.z)))) drove += 1;
    }
    rows.push({ seed, drove, laid: laid.length });
  }
  const empty = rows.filter((r) => r.drove === 0);
  expect(empty, `new roads no car ever drove in 60 game seconds:\n${JSON.stringify(empty)}`).toEqual([]);
});
