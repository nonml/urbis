// A generated world's street wears its own signs and zebras (milestone 2): every
// neon blade sign hangs on a real building front of the avenue it was written
// for, the ラーメン blade over the RAMEN board, and each avenue's mid-block zebra
// lies between two parking slots, clear of the junctions and the start car. The
// hand preset keeps what it has always drawn.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateDistrict } from '../src/sim/citygen.js';
import { planLayout } from '../src/sim/layout.js';
import { planDressing } from '../src/sim/dressing.js';
import { parkedFor } from '../src/sim/furniture.js';
import { spawnFor } from '../src/sim/spawn.js';
import { counterpartX } from '../src/sim/anchors.js';
import {
  HAND_MIDBLOCK, MIDBLOCK, SIGN_GAP, SIGN_IN, ZEBRA_CAR, ZEBRA_CLEAR, ZEBRA_END, ZEBRA_STEP,
  placeSigns, ramenBoard, worldSigns, zebrasFor,
} from '../src/sim/streetscape.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const DEFS = JSON.parse(fs.readFileSync('src/content/signs.json', 'utf8'));
const meets = (d, a) => d.crossings.filter((c) => c.x0 <= a.x && a.x <= c.x1);
const world = (seed) => {
  const d = generateDistrict(seed);
  return { d, rows: planLayout(d, seed).rows, ramen: ramenBoard(planDressing(d, seed).shops[0]), carZ: spawnFor(d).car.z };
};

// The zebra rule, written out a second way: walk outward from the hand z.
function expectedZebras(d, carZ) {
  return d.avenues.flatMap((a, k) => {
    const lo = Math.max(a.z0, d.walk.minZ) + ZEBRA_END;
    const hi = Math.min(a.z1, d.walk.maxZ) - ZEBRA_END;
    const ok = (z) => z >= lo && z <= hi && z % ZEBRA_STEP === 0
      && meets(d, a).every((c) => Math.abs(z - c.z) >= ZEBRA_CLEAR)
      && (k > 0 || Math.abs(z - carZ) >= ZEBRA_CAR);
    const hz = HAND_MIDBLOCK[k % 3].z;
    const below = Math.floor(hz / ZEBRA_STEP) * ZEBRA_STEP;
    for (let i = 0; i < 40; i += 1) {
      const down = below - i * ZEBRA_STEP;
      const up = below + (i + 1) * ZEBRA_STEP;
      const pick = [down, up].filter(ok).sort((p, q) => Math.abs(p - hz) - Math.abs(q - hz) || p - q)[0];
      if (pick !== undefined) {
        // A farther step could only win if it were nearer, and it is not.
        return [{ x: a.x, z: pick }];
      }
    }
    return [];
  });
}

// The sign rule, written out a second way.
function expectedSigns(d, rows, ramen) {
  const kept = [];
  for (const def of DEFS) {
    if (def.face === 'south') continue;
    let at;
    if (def.sub === 'RAMEN') {
      at = { ax: d.avenues[0].x, side: ramen.side, z: ramen.z };
    } else {
      const ax = counterpartX(def.ax ?? 0, d);
      const row = rows.find((r) => r.ax === ax && r.side === def.side);
      const spans = (row?.runs ?? [])
        .map(([r0, r1]) => [Math.max(r0, d.walk.minZ) + SIGN_IN, Math.min(r1, d.walk.maxZ) - SIGN_IN])
        .filter(([lo, hi]) => lo <= hi);
      if (!spans.length) continue;
      const zs = spans.map(([lo, hi]) => Math.min(hi, Math.max(lo, def.z)));
      const best = zs.reduce((b, z) => (Math.abs(z - def.z) < Math.abs(b - def.z) ? z : b));
      at = { ax, side: def.side, z: best };
    }
    if (kept.some((k) => k.ax === at.ax && k.side === at.side && Math.abs(k.z - at.z) < SIGN_GAP)) continue;
    kept.push({ ...def, ...at });
  }
  return kept;
}

test('the hand preset keeps its zebras and signs', () => {
  expect(HAND_MIDBLOCK).toEqual([{ x: 0, z: 20 }, { x: 44, z: -20 }, { x: -44, z: 10 }]);
  expect(MIDBLOCK).toBe(HAND_MIDBLOCK);
  expect(worldSigns(DEFS)).toBe(DEFS);
  expect(ramenBoard({ x: -6, z: -12, ry: Math.PI / 2, kind: 0 })).toEqual({ side: -1, z: -12 });
  expect(ramenBoard({ x: 6, z: 3, ry: -Math.PI / 2, kind: 0 })).toEqual({ side: 1, z: 3 });
});

test('a generated world paints its zebras exactly by the rule', () => {
  for (const seed of SEEDS) {
    const { d, carZ } = world(seed);
    expect(zebrasFor(d, carZ), `seed ${seed}`).toEqual(expectedZebras(d, carZ));
  }
});

test('every zebra is between parked cars, clear of the junctions and the start car', () => {
  let painted = 0;
  for (const seed of SEEDS) {
    const { d, carZ } = world(seed);
    const zebras = zebrasFor(d, carZ);
    painted += zebras.length;
    expect(zebras.length, `seed ${seed}: most avenues get a zebra`).toBeGreaterThanOrEqual(d.avenues.length - 1);
    const parked = parkedFor(d, seed);
    for (const zb of zebras) {
      const a = d.avenues.find((v) => v.x === zb.x);
      expect(a, `seed ${seed}: zebra on no avenue`).toBeTruthy();
      expect(zb.z, `seed ${seed}`).toBeGreaterThanOrEqual(d.walk.minZ + ZEBRA_END);
      expect(zb.z, `seed ${seed}`).toBeLessThanOrEqual(d.walk.maxZ - ZEBRA_END);
      for (const c of meets(d, a)) expect(Math.abs(zb.z - c.z), `seed ${seed}: zebra in a junction`).toBeGreaterThanOrEqual(ZEBRA_CLEAR);
      for (const [px, , pz] of parked) {
        if (px === zb.x) expect(Math.abs(pz - zb.z), `seed ${seed}: a car parked on the stripes`).toBeGreaterThanOrEqual(5);
      }
      if (zb.x === d.avenues[0].x) expect(Math.abs(carZ - zb.z), `seed ${seed}: start car on the stripes`).toBeGreaterThanOrEqual(ZEBRA_CAR);
    }
  }
  expect(painted).toBeGreaterThan(0);
});

test('a generated world hangs its signs exactly by the rule', () => {
  for (const seed of SEEDS) {
    const { d, rows, ramen } = world(seed);
    expect(placeSigns(DEFS, d, rows, ramen), `seed ${seed}`).toEqual(expectedSigns(d, rows, ramen));
  }
});

test('every sign hangs on a building front, the ラーメン blade over the RAMEN board', () => {
  for (const seed of SEEDS) {
    const { d, rows, ramen } = world(seed);
    const signs = placeSigns(DEFS, d, rows, ramen);
    expect(signs.length, `seed ${seed}`).toBeGreaterThanOrEqual(DEFS.length - 3);
    expect(signs.some((s) => s.face === 'south'), `seed ${seed}`).toBe(false);
    const blade = signs.find((s) => s.sub === 'RAMEN');
    expect(blade, `seed ${seed}`).toMatchObject({ ax: d.avenues[0].x, side: ramen.side, z: ramen.z });
    for (const s of signs) {
      expect(d.avenues.some((a) => a.x === s.ax), `seed ${seed}: ${s.text} off every avenue`).toBe(true);
      for (const t of signs) {
        if (t !== s && t.ax === s.ax && t.side === s.side) expect(Math.abs(t.z - s.z), `seed ${seed}: ${s.text} on ${t.text}`).toBeGreaterThanOrEqual(SIGN_GAP);
      }
      if (s === blade) continue;
      const row = rows.find((r) => r.ax === s.ax && r.side === s.side);
      const held = row.runs.some(([z0, z1]) => s.z - SIGN_IN >= z0 - 1e-9 && s.z + SIGN_IN <= z1 + 1e-9);
      expect(held, `seed ${seed}: ${s.text} at z ${s.z} hangs over a gap`).toBe(true);
      expect(s.z, `seed ${seed}`).toBeGreaterThanOrEqual(d.walk.minZ);
      expect(s.z, `seed ${seed}`).toBeLessThanOrEqual(d.walk.maxZ);
    }
  }
});

test('a generated world draws its own zebras and signs', () => {
  const src = `
    const { setWorldSeed } = await import('./src/sim/seedstore.js');
    setWorldSeed(7, true);
    const fs = await import('node:fs');
    const { DISTRICTS } = await import('./src/sim/world.js');
    const { WORLD_PLAN } = await import('./src/sim/layout.js');
    const { SHOPS } = await import('./src/sim/dressing.js');
    const { spawnFor } = await import('./src/sim/spawn.js');
    const s = await import('./src/sim/streetscape.js');
    const defs = JSON.parse(fs.readFileSync('src/content/signs.json', 'utf8'));
    const d = DISTRICTS[0];
    console.log(JSON.stringify({
      zebras: JSON.stringify(s.MIDBLOCK) === JSON.stringify(s.zebrasFor(d, spawnFor(d).car.z)),
      signs: JSON.stringify(s.worldSigns(defs)) === JSON.stringify(s.placeSigns(defs, d, WORLD_PLAN.rows, s.ramenBoard(SHOPS[0]))),
      moved: s.MIDBLOCK !== s.HAND_MIDBLOCK && s.MIDBLOCK.length > 0,
    }));
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8' });
  expect(JSON.parse(out.trim().split('\n').pop())).toEqual({ zebras: true, signs: true, moved: true });
});
