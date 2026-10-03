// M3.S2 (M3-9) spike checks, Node only: no page is opened. From the repo root:
//   npx playwright test -c spikes/m3-traffic/playwright.config.js
import { test, expect } from '@playwright/test';
import { buildMap, buildParcels, findRoute, buildCommute, createTraffic, tick, bench, lanePoint } from './proto.js';

test('60 cars hold their routes: no jumps, trips complete, no route lost', () => {
  const state = createTraffic(buildMap(), 7, 60);
  for (let i = 0; i < 4000; i++) tick(state, 0.05);
  expect(state.noRoute).toBe(0);
  expect(state.completed).toBeGreaterThan(30);
  expect(state.maxJump).toBeLessThan(1.2);
});

test('a red light holds a car at the line and green releases it', () => {
  const map = buildMap();
  const state = createTraffic(map, 7, 0);
  const edge = map.edgeById.get('e0');
  const p = lanePoint(map, edge, 1, 150);
  state.cars = [{ id: 1, route: ['e0', 'e1'], leg: 0, dir: 1, s: 150, v: 13, turn: null, prev: p, stuck: 0, ...p }];
  state.time = 14; // the z avenue is red until t = 24
  for (let i = 0; i < 140; i++) tick(state, 0.05);
  expect(state.cars[0].v).toBeLessThan(0.5);
  expect(state.cars[0].s).toBeLessThan(edge.len - 4);
  state.time = 0; // z green again
  for (let i = 0; i < 300; i++) tick(state, 0.05);
  expect(state.cars[0].leg).toBeGreaterThan(0);
});

test('closing the three crossing edges leaves no route across the cut', () => {
  const map = buildMap();
  const cut = new Set(map.edges.filter((e) => {
    const a = map.nodeById.get(e.a);
    const b = map.nodeById.get(e.b);
    return e.axis === 'x' && Math.min(a.x, b.x) === 200 && Math.max(a.x, b.x) === 400;
  }).map((e) => e.id));
  expect(cut.size).toBe(3);
  expect(findRoute(map, '0,0', '600,0', cut)).toBeNull();
  expect(buildCommute(map, buildParcels(map, 7, 2000), 5000, cut).noRoute).toBeGreaterThan(1000);
});

test('gridlock probe: clear with signals, stalled with all-green unsafe', () => {
  expect(bench({ cars: 300, steps: 4000 }).mouth).toBe(0);
  expect(bench({ cars: 300, steps: 4000, safeJunction: false, signals: false }).stuck).toBeGreaterThan(0);
});

test('measurement: 60 cars and 5,000 residents', () => {
  const out = (s) => process.stdout.write(`\n[proto] ${s}`);
  bench({ cars: 600, residents: 0, steps: 500 }); // JIT warm-up
  for (const cars of [60, 300, 600]) {
    const r = bench({ cars, residents: 5000, steps: 10000 });
    out(`${cars} cars safe: mean ${r.mean.toFixed(3)} ms, p95 ${r.p95.toFixed(3)} ms, max ${r.max.toFixed(1)} ms, `
      + `flow cold ${r.flowColdMs.toFixed(2)} ms, flow hot ${r.flowHotMs.toFixed(2)} ms, completed ${r.completed}\n`);
  }
  const u = bench({ cars: 300, residents: 5000, steps: 10000, safeJunction: false, signals: false });
  out(`300 cars unsafe all-green: mouth ${u.mouth}, stuck>10s ${u.stuck}, maxStuck ${u.maxStuck.toFixed(1)} s\n`);
  const r = bench({ cars: 60, residents: 5000, steps: 3000 });
  expect(r.p95).toBeLessThan(4);
});
