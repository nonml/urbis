// M3.T29 (M3-6, docs/ROADMAP.md): car following. A car holds the edge it is on,
// the direction and distance along it, and its route; it keeps a gap to the car
// ahead in its own lane and interpolates through a node onto the next edge. Node
// only: no page opens, nothing is wired. The lane side is settled here — both
// axes drive on the right of travel, 2.4 m out (world.js:laneCenterLine's
// N-S-right/E-W-left mix is what M3.T32 replaces with this pose).
import { test, expect } from '@playwright/test';
import { createMap, edgesNear } from '../src/sim/map.js';
import {
  CAR_LEN, GAP_MIN, LANE_OFF, VMAX, createTraffic, lanePoint, tick,
} from '../src/sim/traffic.js';

const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const JUMP_M = 1.2;   // M3-6's bound: VMAX 13.5 m/s x 50 ms, with lane slack
const TURN_SEED = 22; // one T: three 109 m avenues cut by one crossing

const nodesOf = (map) => new Map(map.graph.nodes.map((n) => [n.id, n]));
const lengthOf = (byId, e) => Math.hypot(byId.get(e.b).x - byId.get(e.a).x, byId.get(e.b).z - byId.get(e.a).z);

// A car in the shape tick reads: route, leg, and the lane as route[leg] + dir,
// with s metres along it. prev is where the last step started from.
function car(id, map, route, leg, dir, s, v) {
  const edge = map.graph.edges.find((e) => e.id === route[leg]);
  const p = lanePoint(map, edge, dir, s);
  return { id, route, leg, dir, s, v, turn: null, prev: { x: p.x, z: p.z }, ...p };
}

function longestEdge(map, min) {
  const byId = nodesOf(map);
  return map.graph.edges.filter((e) => lengthOf(byId, e) >= min)
    .sort((a, b) => lengthOf(byId, b) - lengthOf(byId, a))[0];
}

test('lanePoint settles both directions on the right of travel, 2.4 m out', () => {
  expect(LANE_OFF).toBe(2.4);
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const byId = nodesOf(map);
    for (const edge of map.graph.edges) {
      const len = lengthOf(byId, edge);
      for (const dir of [1, -1]) {
        const a = byId.get(dir > 0 ? edge.a : edge.b);
        const b = byId.get(dir > 0 ? edge.b : edge.a);
        const ux = (b.x - a.x) / len;
        const uz = (b.z - a.z) / len;
        for (const s of [0, len / 2, len]) {
          const p = lanePoint(map, edge, dir, s);
          expect(p.x - (a.x + ux * s)).toBeCloseTo(uz * 2.4, 6);
          expect(p.z - (a.z + uz * s)).toBeCloseTo(-ux * 2.4, 6);
          expect(p.yaw).toBeCloseTo(Math.atan2(ux, uz), 6);
        }
      }
      const out = lanePoint(map, edge, 1, len / 2);
      const back = lanePoint(map, edge, -1, len / 2);
      expect(Math.hypot(out.x - back.x, out.z - back.z)).toBeCloseTo(2 * 2.4, 6);
    }
  }
});

test('a car alone runs to VMAX and never moves farther than its speed allows', () => {
  expect(VMAX).toBe(13.5);
  const map = createMap(TURN_SEED);
  const edge = longestEdge(map, 90);
  expect(edge, 'a 90 m avenue to run out on').toBeTruthy();
  const state = createTraffic(map, TURN_SEED, 0);
  state.cars = [car(1, map, [edge.id], 0, 1, 0, 0)];
  let peak = 0;
  let prev = { x: state.cars[0].x, z: state.cars[0].z };
  for (let i = 0; i < 200; i++) {
    tick(state, DT);
    const c = state.cars[0];
    if (!c) break;
    expect(Math.hypot(c.x - prev.x, c.z - prev.z)).toBeLessThanOrEqual(VMAX * DT + 1e-9);
    peak = Math.max(peak, c.v);
    prev = { x: c.x, z: c.z };
  }
  expect(peak).toBeCloseTo(13.5, 3);
});

test('a follower keeps its gap; an oncoming car is not a leader', () => {
  const map = createMap(TURN_SEED);
  const edge = longestEdge(map, 90);
  const len = lengthOf(nodesOf(map), edge);
  const state = createTraffic(map, TURN_SEED, 0);
  state.cars = [car(1, map, [edge.id], 0, 1, 0, 13.5), car(2, map, [edge.id], 0, 1, 40, 8)];
  let minCentre = Infinity;
  let stayedBehind = true;
  for (let i = 0; i < 300; i++) {
    tick(state, DT);
    const [f, l] = state.cars;
    if (f.leg !== 0 || l.leg !== 0 || f.turn || l.turn) continue;
    minCentre = Math.min(minCentre, l.s - f.s);
    stayedBehind &&= f.s <= l.s;
  }
  // The rule holds CAR_LEN 4.5 + GAP_MIN 2.5 centre to centre, less a step.
  expect(CAR_LEN).toBe(4.5);
  expect(GAP_MIN).toBe(2.5);
  expect(minCentre).toBeGreaterThan(CAR_LEN + GAP_MIN - 0.5);
  expect(stayedBehind, 'the follower stayed behind').toBe(true);
  expect(state.cars[0].v, 'the follower came to rest behind the stopped leader').toBeLessThan(0.5);

  state.cars = [car(3, map, [edge.id], 0, 1, 0, 8), car(4, map, [edge.id], 0, -1, 0, 8)];
  let minV = Infinity;
  let crossed = false;
  for (let i = 0; i < 200 && !crossed; i++) {
    tick(state, DT);
    const [a, b] = state.cars;
    if (i > 60) minV = Math.min(minV, a.v, b.v);
    crossed = a.s + b.s >= len;
  }
  expect(crossed, 'the two lanes met at the middle of the edge').toBe(true);
  expect(minV, 'neither car braked for the oncoming lane').toBeGreaterThan(12);
});

test('a car turns through its node onto the next edge, never off the graph', () => {
  const map = createMap(TURN_SEED);
  const byId = nodesOf(map);
  const avenue = map.graph.edges.find((e) => e.axis === 'z' && lengthOf(byId, e) > 80);
  const node = byId.get(avenue.b);
  const next = map.graph.edges.find((e) => e.axis === 'x' && (e.a === node.id || e.b === node.id));
  expect(next, 'a crossing at the avenue far node').toBeTruthy();
  const dir2 = next.a === node.id ? 1 : -1;
  const state = createTraffic(map, TURN_SEED, 0);
  state.cars = [car(1, map, [avenue.id, next.id], 0, 1, lengthOf(byId, avenue) - 25, 9)];
  let sawTurn = false;
  let prev = { x: state.cars[0].x, z: state.cars[0].z };
  for (let i = 0; i < 300; i++) {
    tick(state, DT);
    const c = state.cars[0];
    expect(Math.hypot(c.x - prev.x, c.z - prev.z), `jump on frame ${i}`).toBeLessThanOrEqual(JUMP_M);
    expect(edgesNear(map, c.x, c.z, 4.2).length, `frame ${i} off the graph`).toBeGreaterThan(0);
    sawTurn ||= Boolean(c.turn);
    prev = { x: c.x, z: c.z };
    if (c.leg === 1 && !c.turn && c.s > 10) break;
  }
  const c = state.cars[0];
  expect(sawTurn, 'the car interpolated through the node').toBe(true);
  expect(c.leg).toBe(1);
  expect(c.dir).toBe(dir2);
  const lane = lanePoint(map, next, dir2, c.s);
  expect(Math.hypot(c.x - lane.x, c.z - lane.z), 'on the next edge lane').toBeCloseTo(0, 9);
});

test('createTraffic is a clock and the cars on it', () => {
  const state = createTraffic(createMap(7), 7, 0);
  expect([state.time, state.cars]).toEqual([0, []]);
  tick(state, DT); tick(state, DT);
  expect(state.time).toBeCloseTo(2 * DT, 9);
});
