// A generated world's lamps, parked cars, utility boxes and junctions come from
// its roads (milestone 2): every avenue and crossing is lit on the hand map's
// rhythm, no pole or box stands in a road, the parked cars are the seed's, and
// the hand preset has no plan (its render keeps its tables).
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { generateDistrict } from '../src/sim/citygen.js';
import { ROAD_HALF_WIDTH } from '../src/sim/world.js';
import {
  ARM, BOX_OUT, BOX_PHASE, BOX_STEP, CROSS_HEAD_OUT, CROSS_POLE_OUT, LAMP_PHASE, LAMP_STEP,
  PARK_PHASE, PARK_SHARE, PARK_STEP, POLE_X, WORLD_FURNITURE,
  avenueSpots, boxesFor, crossingSpots, junctionsOf, lampsFor, parkedFor,
} from '../src/sim/furniture.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(100);
const SIM = new URL('../src/sim/', import.meta.url).href;
const meets = (c, a) => c.x0 <= a.x && a.x <= c.x1;
const sideOf = (i) => (i % 2 === 0 ? -1 : 1);

// Inside a carriageway: an avenue's along its length, a crossing's between its ends.
function inRoad(d, x, z) {
  return d.avenues.some((a) => Math.abs(x - a.x) < ROAD_HALF_WIDTH && z >= a.z0 && z <= a.z1)
    || d.crossings.some((c) => Math.abs(z - c.z) < ROAD_HALF_WIDTH && x >= c.x0 && x <= c.x1);
}

test('lamps light every avenue and crossing on the rhythm, from the kerb', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const want = [
      ...d.avenues.flatMap((a) => avenueSpots(a, d.crossings, LAMP_PHASE, LAMP_STEP).map((z, i) => {
        const side = sideOf(i);
        return { x: a.x + side * POLE_X, z, hx: a.x + side * (POLE_X - ARM), hz: z, rotY: side > 0 ? 0 : Math.PI, zone: z < 0 ? 0 : 1 };
      })),
      ...d.crossings.flatMap((c) => crossingSpots(c, d.avenues, LAMP_PHASE, LAMP_STEP).map((x, i) => {
        const side = sideOf(i);
        return {
          x, z: c.z + side * CROSS_POLE_OUT, hx: x, hz: c.z + side * CROSS_HEAD_OUT,
          rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2, zone: c.z + side * CROSS_POLE_OUT < 0 ? 0 : 1,
        };
      })),
    ];
    const lamps = lampsFor(d);
    expect(lamps, `seed ${seed}`).toEqual(want);
    for (const a of d.avenues) {
      const mine = lamps.filter((l) => Math.abs(Math.abs(l.x - a.x) - POLE_X) < 1e-9);
      expect(mine.filter((l) => l.x < a.x).length, `seed ${seed} ${a.id} west`).toBeGreaterThanOrEqual(3);
      expect(mine.filter((l) => l.x > a.x).length, `seed ${seed} ${a.id} east`).toBeGreaterThanOrEqual(3);
    }
    lamps.forEach((l) => expect(inRoad(d, l.x, l.z), `seed ${seed}: a pole at ${l.x}, ${l.z} in a road`).toBe(false));
  }
});

test('parked cars are the seed\'s, at kerb slots off the junctions', () => {
  let slots = 0;
  let cars = 0;
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const parked = parkedFor(d, seed);
    expect(parkedFor(d, seed)).toEqual(parked);
    expect(parked.length, `seed ${seed}`).toBeGreaterThan(0);
    const order = d.avenues.flatMap((a) => [-1, 1].flatMap((side) =>
      avenueSpots(a, d.crossings, PARK_PHASE, PARK_STEP).map((z) => `${a.x} ${side} ${z}`)));
    slots += order.length;
    cars += parked.length;
    const keys = parked.map(([x, side, z]) => `${x} ${side} ${z}`);
    expect(keys.every((k) => order.includes(k)), `seed ${seed}: a car off its slots`).toBe(true);
    expect(keys.map((k) => order.indexOf(k)), `seed ${seed}: in slot order`).toEqual(keys.map((k) => order.indexOf(k)).sort((p, q) => p - q));
  }
  const share = cars / slots;
  expect(share).toBeGreaterThan(PARK_SHARE - 0.05);
  expect(share).toBeLessThan(PARK_SHARE + 0.05);
  expect(parkedFor(generateDistrict(5), 5)).not.toEqual(parkedFor(generateDistrict(5), 6));
});

test('utility boxes stand out against the building line, never in a road', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const want = d.avenues.flatMap((a) => avenueSpots(a, d.crossings, BOX_PHASE, BOX_STEP)
      .map((z, i) => [a.x + sideOf(i) * BOX_OUT, z]));
    const boxes = boxesFor(d);
    expect(boxes, `seed ${seed}`).toEqual(want);
    boxes.forEach(([x, z]) => expect(inRoad(d, x, z)).toBe(false));
  }
});

test('every place a crossing meets an avenue is a junction', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const want = d.crossings.flatMap((c) => d.avenues.filter((a) => meets(c, a)).map((a) => ({ x: a.x, z: c.z })));
    expect(junctionsOf(d), `seed ${seed}`).toEqual(want);
    expect(want.length).toBeGreaterThanOrEqual(d.crossings.length * 2);
  }
});

test('the hand preset has no plan; a generated world has its own', () => {
  expect(WORLD_FURNITURE).toBeNull();
  for (const seed of [3, 7, 12]) {
    const code = `
      const { setWorldSeed } = await import('${SIM}seedstore.js');
      setWorldSeed(${seed}, true);
      const { DISTRICTS } = await import('${SIM}world.js');
      const f = await import('${SIM}furniture.js');
      const d = DISTRICTS[0];
      const same = JSON.stringify(f.WORLD_FURNITURE) === JSON.stringify({
        lamps: f.lampsFor(d), parked: f.parkedFor(d, ${seed}), boxes: f.boxesFor(d), junctions: f.junctionsOf(d),
      });
      console.log(JSON.stringify({ same, lamps: f.WORLD_FURNITURE.lamps.length }));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const out = JSON.parse(run.stdout);
    expect(out.same, `seed ${seed}`).toBe(true);
    expect(out.lamps).toBeGreaterThan(10);
  }
});
