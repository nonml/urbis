// M5.T24 (M5-10, docs/ROADMAP.md): road types in the sim. An edge carries its
// type — `lanes` (2 or 4) and `oneWay` — and M3's traffic drives them: a one-way
// one way only, and a queue spreads across the lanes a road runs, which is what
// makes an avenue carry more cars through a junction than a street.
// `upgradeRoad(edge, type)` changes a road in place for the difference in cost
// and undoes like every other op (M3-4). The tool and the drawn cross-section
// are M5.T25.
//
// The criterion's A/B (M5-10): one junction, one street running into it, the
// same queue of cars standing behind its light, the same lights, the evening
// rush hour. A runs the approach as the street it is; B upgrades it to an avenue
// in place. B carries at least 1.8 times A's cars through the junction — twice
// the lanes, less what the junction's turns take.
//
// Node only: no page opens, nothing is wired. The queue is placed by hand in the
// shape this module reads and writes, as tests/traffic.test.js places its cars,
// so the two runs differ in the road's type and in nothing else.
import { test, expect } from '@playwright/test';
import { createMap, mapHash, ROAD_TYPES, roadTypeOf } from '../../src/sim/map.js';
import { upgradeRoad, undo, upgradeCost } from '../../src/sim/ops.js';
import { START_HOUR } from '../../src/sim/clock.js';

const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const CARS = 60;
const RATIO = 1.8;
const QUEUE_GAP = 7;      // CAR_LEN + GAP_MIN, the closest a car follows
const SETTLE_SECS = 3;    // the queue spreading across the lanes, on a red
const GREEN_SECS = 10;    // the green, plus the last turn's interpolation
const api = () => import('../../src/sim/traffic.js');
const nodesOf = (map) => new Map(map.graph.nodes.map((n) => [n.id, n]));
const lenOf = (by, e) => Math.hypot(by.get(e.b).x - by.get(e.a).x, by.get(e.b).z - by.get(e.a).z);

// A node a z way and an x way both touch: the lights M3.T31 runs there.
function junctionAt(map, id) {
  const axes = new Set(map.graph.edges.filter((e) => e.a === id || e.b === id).map((e) => e.axis));
  return axes.size >= 2 ? id : null;
}

test('every edge names a road type: two or four lanes, one-way or not', async () => {
  expect(Object.keys(ROAD_TYPES).sort()).toEqual(['avenue', 'oneway', 'street']);
  expect(ROAD_TYPES.street).toMatchObject({ lanes: 2, oneWay: false });
  expect(ROAD_TYPES.avenue).toMatchObject({ lanes: 4, oneWay: false });
  expect(ROAD_TYPES.oneway).toMatchObject({ lanes: 2, oneWay: true });
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const types = new Set();
    for (const e of map.graph.edges) {
      expect([2, 4], `seed ${seed}: ${e.id} lanes`).toContain(e.lanes);
      expect(typeof e.oneWay, `seed ${seed}: ${e.id} oneWay`).toBe('boolean');
      expect(ROAD_TYPES[roadTypeOf(e)].lanes).toBe(e.lanes);
      types.add(roadTypeOf(e));
    }
    // A generated town lays streets and avenues; a one-way is the player's.
    expect([...types].sort(), `seed ${seed} types`).toEqual(['avenue', 'street']);
  }
});

test('upgradeRoad changes the road in place, for the difference in cost, and undoes', async () => {
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const golden = mapHash(map);
    const by = nodesOf(map);
    const edge = map.graph.edges.find((e) => e.lanes === 2 && lenOf(by, e) > 60);
    expect(edge, `seed ${seed}: a street to upgrade`).toBeTruthy();
    const shape = { id: edge.id, a: edge.a, b: edge.b, kind: edge.kind, axis: edge.axis };
    const metres = lenOf(by, edge);
    expect(upgradeCost(map, edge, 'avenue'), `seed ${seed}: the avenue's difference per metre`)
      .toBeCloseTo(metres * (ROAD_TYPES.avenue.cost - ROAD_TYPES.street.cost), 6);

    const version = map.version;
    upgradeRoad(map, edge, 'avenue');
    expect(roadTypeOf(edge)).toBe('avenue');
    expect(edge.lanes).toBe(4);
    expect(edge.oneWay).toBe(false);
    // In place: the same road, the same nodes, the same edges around it.
    expect({ id: edge.id, a: edge.a, b: edge.b, kind: edge.kind, axis: edge.axis }).toEqual(shape);
    expect(map.version).toBe(version + 1);
    expect(map.dirty.size, 'the road\'s tiles are rebuilt').toBeGreaterThan(0);
    expect(mapHash(map)).not.toBe(golden);

    expect(undo(map)).toBe(true);
    expect(roadTypeOf(edge)).toBe('street');
    expect(edge.lanes).toBe(2);
    expect(edge.oneWay).toBe(false);
    expect({ id: edge.id, a: edge.a, b: edge.b, kind: edge.kind, axis: edge.axis }).toEqual(shape);
    expect(map.version).toBe(version);
    expect(mapHash(map)).toBe(golden);

    // The type it already is costs nothing and changes nothing.
    expect(upgradeCost(map, edge, 'street')).toBe(0);
    upgradeRoad(map, edge, 'street');
    expect(roadTypeOf(edge)).toBe('street');
    expect(map.version).toBe(version);
    // A one-way is a type of its own, not a flag on an avenue, and it undoes.
    upgradeRoad(map, edge, 'oneway');
    expect(roadTypeOf(edge)).toBe('oneway');
    expect(edge.lanes).toBe(2);
    expect(edge.oneWay).toBe(true);
    undo(map);
    expect(mapHash(map)).toBe(golden);
  }
});

test('a one-way is routed and driven the one way it names', async () => {
  const { createTraffic, tick } = await api();
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const state = createTraffic(map, seed, CARS);
    state.cam = { x: map.spawn.player.x, z: map.spawn.player.z, yaw: map.spawn.player.yaw };
    for (let i = 0; i < 40; i++) tick(state, DT);
    // The busiest road the fleet is running both ways right now, so the op
    // turns cars that are already on it around and the check is about them.
    const on = new Map();
    for (const c of state.cars) {
      if (c.turn || c.route.length === 0) continue;
      on.set(c.route[c.leg], (on.get(c.route[c.leg]) ?? 0) + 1);
    }
    const both = [...on.keys()].filter((id) => state.cars.some((c) => c.route[c.leg] === id && c.dir > 0)
      && state.cars.some((c) => c.route[c.leg] === id && c.dir < 0));
    const busiest = [...both].sort((a, b) => on.get(b) - on.get(a))[0];
    expect(busiest, `seed ${seed}: a road driven both ways`).toBeTruthy();
    const edge = map.graph.edges.find((e) => e.id === busiest);
    upgradeRoad(map, edge, 'oneway');
    expect(edge.oneWay).toBe(true);
    // The cars already on it drive to its end and turn round; nobody ever takes
    // it the wrong way again, and no route is ever planned against it.
    const onIt = () => state.cars.filter((c) => !c.turn && c.route[c.leg] === edge.id && c.dir < 0);
    expect(onIt().length, `seed ${seed}: cars already running it the other way`).toBeGreaterThan(0);
    let against = onIt();
    for (let i = 0; i < 2400 && against.length > 0; i++) {
      tick(state, DT);
      against = onIt();
    }
    expect(against, `seed ${seed}: a car took the one-way the wrong way:\n${JSON.stringify(against.map((c) => c.id))}`).toEqual([]);
  }
});

// The junction the A/B measures: the longest road running into a junction, with
// a road leaving it long enough to take the cars the junction discharges. `p`
// is the approach, `j` the junction, `g` the exit, so a car on the route p -> g
// crosses the junction.
function junctionOf(map, minExit = 100) {
  const by = nodesOf(map);
  let best = null;
  for (const p of map.graph.edges) {
    if (p.axis !== 'x') continue;
    for (const end of [p.a, p.b]) {
      if (!junctionAt(map, end)) continue;
      const g = map.graph.edges.find((e) => e !== p && e.axis === 'x'
        && (e.a === end || e.b === end) && lenOf(by, e) >= minExit);
      if (!g) continue;
      if (!best || lenOf(by, p) > lenOf(by, best.p)) best = { by, j: end, p, g };
    }
  }
  return best;
}

// One run of the A/B is inline below: the queue, the lights and the seconds
// are the same in both, and only the approach's type differs.

test('an avenue carries at least 1.8 times a street\'s cars through one junction', async () => {
  const { createTraffic, tick, lanePoint, hourOf, RUSH_PM, signalGreen, GAME_HOUR_SECS, STOP_LINE } = await api();
  const rows = [];
  for (const seed of SEEDS) {
    const setup = junctionOf(createMap(seed));
    expect(setup, `seed ${seed}: a junction with a road running into it`).toBeTruthy();
    const place = createMap(seed);
    const { by, j, p, g } = setup;
    const dirP = j === p.b ? 1 : -1;
    const len = lenOf(by, p);
    const line = len - STOP_LINE;
    // The queue standing behind the light, nose to tail from the stop line
    // back: the demand, and it is the same queue in both runs.
    const queue = [];
    for (let i = 0; ; i++) {
      const s = line - i * QUEUE_GAP;
      if (s < 2) break;
      const at = lanePoint(place, p, dirP, s);
      queue.push({
        id: i + 1, route: [p.id, g.id], leg: 0, lane: 0, dir: dirP, s, v: 0, turn: null,
        prev: { x: at.x, z: at.z }, ...at,
      });
    }
    expect(queue.length, `seed ${seed}: a queue behind the light`).toBeGreaterThan(8);

    // The evening rush, on a red for the approach's axis: the queue settles and
    // the green it is counted over comes round inside the rush as well.
    const rushAt = (hour) => {
      let t = (hour - START_HOUR) * GAME_HOUR_SECS;
      while (t < 0) t += 24 * GAME_HOUR_SECS;
      return t;
    };
    const t0 = rushAt((RUSH_PM[0] + RUSH_PM[1]) / 2);
    expect(hourOf(t0)).toBeGreaterThanOrEqual(RUSH_PM[0]);
    let start = t0;
    while (signalGreen(p.axis, start)) start += DT;
    expect(hourOf(start)).toBeLessThan(RUSH_PM[1]);
    expect(hourOf(start + SETTLE_SECS + GREEN_SECS)).toBeLessThan(RUSH_PM[1]);

    const counts = {};
    for (const type of ['street', 'avenue']) {
      const map = createMap(seed);
      const state = createTraffic(map, seed, 0);
      state.cam = null;
      upgradeRoad(map, map.graph.edges.find((e) => e.id === p.id), type);
      state.time = start;
      state.cars = queue.map((c) => ({ ...c, prev: { ...c.prev } }));
      for (let i = 0; i < Math.round(SETTLE_SECS / DT); i++) tick(state, DT);
      expect(state.cars.every((c) => c.leg === 0), 'nobody crossed on the red').toBe(true);
      expect(signalGreen(p.axis, state.time), 'the green the queue is counted over').toBe(true);
      let crossed = 0;
      for (let i = 0; i < Math.round(GREEN_SECS / DT); i++) {
        tick(state, DT);
        for (const c of state.cars) {
          if (c.leg > 0 && !c.counted) { c.counted = true; crossed += 1; }
        }
      }
      counts[type] = crossed;
    }
    rows.push({ seed, queue: queue.length, street: counts.street, avenue: counts.avenue, ratio: counts.avenue / counts.street });
  }
  const short = rows.filter((r) => r.avenue / r.street < RATIO);
  expect(short, `avenue against street through one junction:\n${JSON.stringify(rows)}`).toEqual([]);
});
