// A generated world dresses its own streets (milestone 2): the RAMEN board on the
// noodle bar, the other trade signs on row walls wide enough to carry them, steam
// off the pavement grates by the shops, water in the lanes and on the pavements
// clear of every zebra. The hand preset keeps the tables it has always drawn.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import { planLayout } from '../src/sim/layout.js';
import { HAND_PINNED, placePinned } from '../src/sim/landmarks.js';
import { spawnFor } from '../src/sim/spawn.js';
import { mulberry32 } from '../src/sim/rng.js';
import { ROAD_HALF_WIDTH, WALKWAY_WIDTH } from '../src/sim/world.js';
import {
  DRESS_SALT, HAND_PUDDLES, HAND_SHOPS, HAND_VENTS, HERO_DX, HERO_DZ, HERO_SIZE, MIDBLOCK_ZEBRA, PUDDLES,
  PUDDLE_CLEAR, PUDDLE_END, PUDDLE_LANE, PUDDLE_SIZE, PUDDLE_TRIES, RAMEN_SIGN_DZ, ROAD_PUDDLES, ROAD_Y, SHOPS,
  SHOPS_MAX, SHOP_OUT, SHOP_RUN, VENTS, VENTS_MAX, VENT_BACK, VENT_OUT, VENT_PHASE, WALK_PUDDLE_OUT,
  WALK_PUDDLE_SIZE, WALK_Y, WORLD_DRESSING, planDressing,
} from '../src/sim/dressing.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(200);
const half = (v) => Math.round(v * 2) / 2;
const sideOf = (s) => (s.ry === Math.PI / 2 ? -1 : 1);
const meets = (d, a) => d.crossings.filter((c) => c.x0 <= a.x && a.x <= c.x1);

function clearZ(d, k, z) {
  const a = d.avenues[k];
  const zebra = MIDBLOCK_ZEBRA[k];
  return meets(d, a).every((c) => Math.abs(z - c.z) >= PUDDLE_CLEAR)
    && (zebra === undefined || Math.abs(z - zebra) >= PUDDLE_CLEAR);
}

// The rule, written out a second way.
function expected(d, seed) {
  const a0 = d.avenues[0];
  const ramen = placePinned(HAND_PINNED, a0, d.crossings).find((t) => t.id === 'ramen');
  const face = (side) => (side < 0 ? Math.PI / 2 : -Math.PI / 2);
  const shops = [{ x: a0.x + ramen.side * SHOP_OUT, z: ramen.z + RAMEN_SIGN_DZ, ry: face(ramen.side), kind: 0 }];
  const cands = [];
  for (const r of planLayout(d, seed).rows) {
    for (const [r0, r1] of r.runs) {
      const z0 = Math.max(r0, d.walk.minZ);
      const z1 = Math.min(r1, d.walk.maxZ);
      if (z1 - z0 >= SHOP_RUN) cands.push({ x: r.ax + r.side * SHOP_OUT, z: half((z0 + z1) / 2), ry: face(r.side) });
    }
  }
  const m = Math.min(cands.length, SHOPS_MAX - 1);
  for (let i = 0; i < m; i += 1) shops.push({ ...cands[Math.floor((i * cands.length) / m)], kind: 1 + (i % 2) });
  const vents = [];
  for (let k = 0; k < shops.length && vents.length < VENTS_MAX; k += 2) {
    const s = shops[k];
    vents.push({ x: s.x - sideOf(s) * (SHOP_OUT - VENT_OUT), z: s.z - VENT_BACK, phase: vents.length * VENT_PHASE });
  }
  const car = spawnFor(d).car;
  const puddles = [[car.x + HERO_DX, car.z + HERO_DZ, HERO_SIZE, ROAD_Y]];
  const rand = mulberry32((seed ^ DRESS_SALT) >>> 0);
  const drawZ = () => half(d.drive.minZ + PUDDLE_END + rand() * (d.drive.maxZ - d.drive.minZ - 2 * PUDDLE_END));
  const drawSide = () => (rand() < 0.5 ? -1 : 1);
  d.avenues.forEach((a, k) => {
    for (let p = 0; p <= ROAD_PUDDLES; p += 1) {
      for (let t = 0; t < PUDDLE_TRIES; t += 1) {
        const z = drawZ();
        const side = drawSide();
        let q;
        if (p < ROAD_PUDDLES) {
          const off = PUDDLE_LANE[0] + Math.round(rand() * 2 * (PUDDLE_LANE[1] - PUDDLE_LANE[0])) / 2;
          const size = PUDDLE_SIZE[0] + Math.floor(rand() * (PUDDLE_SIZE[1] - PUDDLE_SIZE[0] + 1));
          q = [a.x + side * off, z, size, ROAD_Y];
        } else {
          q = [a.x + side * WALK_PUDDLE_OUT, z, WALK_PUDDLE_SIZE, WALK_Y];
        }
        if (clearZ(d, k, z)) { puddles.push(q); break; }
      }
    }
  });
  return { shops, puddles, vents };
}

test('the hand preset keeps the dressing it has always drawn', () => {
  expect(WORLD_DRESSING).toBe(null);
  expect(SHOPS).toBe(HAND_SHOPS);
  expect(PUDDLES).toBe(HAND_PUDDLES);
  expect(VENTS).toBe(HAND_VENTS);
  expect(HAND_SHOPS.map((s) => [s.x, s.z, s.kind])).toEqual([[-6, -12, 0], [6, 2, 1], [-6, 22, 2], [35.5, -20, 1], [50, 14, 0], [10, -60.9, 2]]);
  expect(HAND_PUDDLES.length).toBe(13);
  expect(HAND_PUDDLES[0]).toEqual([-1.5, 25.5, 8, 0.025]);
  expect(HAND_VENTS).toEqual([{ x: -5.5, z: -30, phase: 0 }, { x: 46.5, z: 8, phase: 0.8 }, { x: -5.5, z: -14, phase: 1.6 }]);
});

test('a generated world plans its dressing exactly by the rule', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    expect(planDressing(d, seed), `seed ${seed}`).toEqual(expected(d, seed));
  }
});

test('the RAMEN board hangs on the noodle bar and every other sign on a wall wide enough', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const { shops } = planDressing(d, seed);
    const ramen = placePinned(HAND_PINNED, d.avenues[0], d.crossings).find((t) => t.id === 'ramen');
    expect(shops[0].kind, `seed ${seed}`).toBe(0);
    expect(shops.slice(1).some((s) => s.kind === 0), `seed ${seed}: a second RAMEN`).toBe(false);
    expect(Math.abs(shops[0].z - ramen.z) + 3, `seed ${seed}: RAMEN off its tower`).toBeLessThanOrEqual(ramen.d / 2);
    expect(shops.length, `seed ${seed}`).toBeGreaterThan(1);
    expect(shops.length, `seed ${seed}`).toBeLessThanOrEqual(SHOPS_MAX);
    const rows = planLayout(d, seed).rows;
    for (const s of shops.slice(1)) {
      const side = sideOf(s);
      const row = rows.find((r) => r.side === side && Math.abs(r.ax + side * SHOP_OUT - s.x) < 1e-9);
      expect(row, `seed ${seed}: shop at ${s.x} is on no row`).toBeTruthy();
      const held = row.runs.some(([z0, z1]) => s.z - 3.5 >= z0 && s.z + 3.5 <= z1);
      expect(held, `seed ${seed}: shop at z ${s.z} overhangs its wall`).toBe(true);
      expect(s.z - 3.5, `seed ${seed}: shop past where the player can walk`).toBeGreaterThanOrEqual(d.walk.minZ);
      expect(s.z + 3.5, `seed ${seed}: shop past where the player can walk`).toBeLessThanOrEqual(d.walk.maxZ);
    }
  }
});

test('steam rises off the pavement by the shops', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const { vents } = planDressing(d, seed);
    expect(vents.length, `seed ${seed}`).toBeGreaterThan(0);
    expect(vents.length, `seed ${seed}`).toBeLessThanOrEqual(VENTS_MAX);
    for (const v of vents) {
      const off = Math.min(...d.avenues.map((a) => Math.abs(v.x - a.x)));
      expect(off, `seed ${seed}`).toBeGreaterThan(ROAD_HALF_WIDTH);
      expect(off, `seed ${seed}`).toBeLessThan(ROAD_HALF_WIDTH + WALKWAY_WIDTH);
    }
  }
});

test('water lies in the lanes and on the pavements, clear of every zebra, and moves with the seed', () => {
  let landed = 0;
  let possible = 0;
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const { puddles } = planDressing(d, seed);
    possible += d.avenues.length * (ROAD_PUDDLES + 1);
    landed += puddles.length - 1;
    for (const [x, z, size, y] of puddles.slice(1)) {
      const k = d.avenues.findIndex((a) => Math.abs(x - a.x) <= WALK_PUDDLE_OUT + 1e-9);
      expect(k, `seed ${seed}: puddle at ${x} is off every avenue`).toBeGreaterThanOrEqual(0);
      const off = Math.abs(x - d.avenues[k].x);
      if (y === ROAD_Y) {
        expect(off).toBeGreaterThanOrEqual(PUDDLE_LANE[0]);
        expect(off).toBeLessThanOrEqual(PUDDLE_LANE[1]);
        expect(Number.isInteger(size) && size >= PUDDLE_SIZE[0] && size <= PUDDLE_SIZE[1]).toBe(true);
      } else {
        expect([y, size]).toEqual([WALK_Y, WALK_PUDDLE_SIZE]);
        expect(Math.abs(off - WALK_PUDDLE_OUT)).toBeLessThan(1e-9);
      }
      expect(clearZ(d, k, z), `seed ${seed}: puddle at z ${z} on a zebra`).toBe(true);
      expect(z).toBeGreaterThanOrEqual(d.drive.minZ + PUDDLE_END);
      expect(z).toBeLessThanOrEqual(d.drive.maxZ - PUDDLE_END);
    }
  }
  expect(landed / possible, 'nearly every puddle finds a clear spot').toBeGreaterThan(0.95);
  const a = planDressing(generateDistrict(5), 5).puddles;
  expect(planDressing(generateDistrict(5), 5).puddles).toEqual(a);
  expect(planDressing(generateDistrict(6), 6).puddles).not.toEqual(a);
});
