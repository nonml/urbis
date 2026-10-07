// M5-3 (docs/ROADMAP.md): A/B, removing a generated road. In A no car drives
// it within 10 game seconds, a commuter whose route used it arrives later than
// in B, and a standing building it left with no other road declines with the
// reason "no road". One seed per process; no page opens.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05, LANE_REACH = 4.2, CAR_SECS = 10, NO_ROAD_SECS = 120;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, projectOnSegment } = await import('../../src/sim/map.js');
  const { removeRoad, undo } = await import('../../src/sim/ops.js');
  const { createStreet, tickStreet } = await import('../../src/sim/street.js');
  const { createCity, tickZoning } = await import('../../src/sim/zoning.js');
  const { sendTo } = await import('../../src/sim/walkers.js');
  const { describe } = await import('../../src/sim/decline.js');
  // The first generated road whose removal leaves a standing building with no
  // road in reach (ops.js marks it noRoad; M5.T6 makes it decline).
  const probe = createMap(seed);
  let chosen = null;
  for (const edge of probe.graph.edges) {
    const version = probe.version;
    removeRoad(probe, edge);
    const p = probe.version !== version
      && probe.parcels.find((q) => q.noRoad && q.kind !== 'lot' && q.kind !== 'row');
    undo(probe);
    if (p) { chosen = { edge, parcel: p.id }; break; }
  }
  if (!chosen) throw new Error(`seed ${seed}: no generated road leaves a building with no other road`);

  const mapA = createMap(seed), mapB = createMap(seed);
  const streetA = createStreet(seed, mapA), streetB = createStreet(seed, mapB);
  const cityA = createCity(seed, mapA);
  removeRoad(mapA, chosen.edge.id);
  tickStreet(streetA, DT); tickStreet(streetB, DT);
  // 1. No car drives the removed road in A within 10 game seconds. The window
  //    stops short of both junctions, so a car queued on a crossing street at
  //    the node is not read as driving the road.
  const byA = new Map(mapA.graph.nodes.map((n) => [n.id, n]));
  const onEdge = (c) => {
    const h = projectOnSegment(c.x, c.z, byA.get(chosen.edge.a), byA.get(chosen.edge.b));
    return h.dist <= LANE_REACH && h.t >= 0.1 && h.t <= 0.9;
  };
  let frames = 0;
  for (let i = 0; i < CAR_SECS / DT; i++) {
    tickStreet(streetA, DT);
    if (streetA.traffic.cars.some(onEdge)) frames += 1;
  }
  // 2. One commuter, placed on the same pavement in both worlds and tasked to
  //    the same door: in B the route uses the removed road, in A it goes round.
  const origin = mapB.graph.edges.find((q) => q.id !== chosen.edge.id
    && (q.a === chosen.edge.a || q.b === chosen.edge.a || q.a === chosen.edge.b || q.b === chosen.edge.b));
  const place = { route: [origin.id], leg: 0, s: 0, tdir: 1, orient: 1, turn: null, commute: null, dest: null, hold: null };
  const wA = Object.assign(streetA.walkers.walkers[0], place);
  const wB = Object.assign(streetB.walkers.walkers[0], place);
  let dest = null;
  for (let d = 0; d < mapB.parcels.length && dest === null; d++) {
    const pb = { ...wB, route: [...wB.route] };
    if (!sendTo(streetB.walkers, pb, d) || !pb.route.includes(chosen.edge.id)) continue;
    const pa = { ...wA, route: [...wA.route] };
    if (sendTo(streetA.walkers, pa, d)) dest = d;
  }
  let tA = null, tB = null;
  if (dest !== null) {
    sendTo(streetA.walkers, wA, dest);
    sendTo(streetB.walkers, wB, dest);
    for (let i = 0; i < 20000 && (tA === null || tB === null); i++) {
      tickStreet(streetA, DT);
      tickStreet(streetB, DT);
      if (tA === null && wA.hold === dest) tA = (i + 1) * DT;
      if (tB === null && wB.hold === dest) tB = (i + 1) * DT;
    }
  }
  // 3. The building with no road declines, and its note names the cause.
  const bld = mapA.parcels.find((q) => q.id === chosen.parcel);
  let at = null, note = null;
  for (let i = 0; i < NO_ROAD_SECS / DT && at === null; i++) {
    tickStreet(streetA, DT);
    tickZoning(cityA, DT, streetA);
    if (bld?.trend === 'declining' && /no road/i.test(describe(bld, mapA) ?? '')) { at = +(i * DT).toFixed(1); note = describe(bld, mapA); }
  }
  const out = { seed, parcel: chosen.parcel, noRoad: bld?.noRoad === true, frames, dest, tA, tB, at, note };
  process.stdout.write(`${JSON.stringify(out)}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(120000);
for (const seed of SEEDS) {
  test(`M5-3 seed ${seed}: a removed road empties, commuters detour, a building loses its road`, () => {
    test.fail(true, 'M5-3 red: a lot with noRoad does not decline with "no road"');
    const r = row(seed);
    expect(r.parcel, `seed ${seed}: a building loses its only road`).toBeTruthy();
    expect(r.noRoad, `seed ${seed}: ops marks it noRoad`).toBe(true);
    expect(r.frames, `seed ${seed}: no car drives the removed road for ${CAR_SECS} game seconds`).toBe(0);
    expect(r.dest, `seed ${seed}: a commuter route used the removed road`).not.toBeNull();
    expect(r.tB, `seed ${seed}: the B commuter arrives`).not.toBeNull();
    expect(r.tA ?? Infinity, `seed ${seed}: the A commuter arrives later (${r.tA} vs ${r.tB})`).toBeGreaterThan(r.tB);
    expect(r.at, `seed ${seed}: the building declines within ${NO_ROAD_SECS} game seconds`).not.toBeNull();
    expect(r.note, `seed ${seed}: the reason is "no road"`).toMatch(/no road/i);
  });
}
