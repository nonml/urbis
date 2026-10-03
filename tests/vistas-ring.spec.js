// The horizon on a generated world reads as more city: a skyline ring past the
// built edge on the east, north and south, two towers far out in the west valley
// (milestone 2). Pure data from the district and the seed.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import {
  CAP_D, CAP_GAP, RING_D, RING_EAST, RING_GAP, RING_H, RING_MIN, RING_NORTH, RING_SOUTH, RING_W, RING_WEST,
  WEST_GAP, ringFor,
} from '../src/sim/vistas.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(200);
const EPS = 1e-6;

const box = (r) => [r.x - r.w / 2, r.x + r.w / 2, r.z - r.d / 2, r.z + r.d / 2];
const meets = ([a0, a1, a2, a3], [b0, b1, b2, b3]) => a0 < b1 - EPS && b0 < a1 - EPS && a2 < b3 - EPS && b2 < a3 - EPS;

function built(d) {
  const z0 = Math.min(...d.avenues.map((a) => a.z0));
  const z1 = Math.max(...d.avenues.map((a) => a.z1));
  const reach = CAP_GAP + CAP_D[1] + RING_GAP;
  return { x0: d.drive.minX - WEST_GAP, x1: d.walk.maxX + RING_GAP, z0: z0 - reach, z1: z1 + reach };
}

test('the ring stands outside the built area, on every side but an open west', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const ring = ringFor(d, seed);
    const b = built(d);
    expect(ring.length, `seed ${seed}`).toBe(RING_EAST + RING_NORTH + RING_SOUTH + RING_WEST);
    for (const r of ring) {
      expect(meets(box(r), [b.x0, b.x1, b.z0, b.z1]), `seed ${seed}: ${JSON.stringify(r)} inside the city`).toBe(false);
    }
    const east = ring.filter((r) => r.x - r.w / 2 >= b.x1 - EPS);
    const west = ring.filter((r) => r.x + r.w / 2 <= b.x0 + EPS);
    const north = ring.filter((r) => r.z - r.d / 2 >= b.z1 - EPS && !east.includes(r) && !west.includes(r));
    const south = ring.filter((r) => r.z + r.d / 2 <= b.z0 + EPS && !east.includes(r) && !west.includes(r));
    expect([east.length, north.length, south.length, west.length], `seed ${seed}: east, north, south, west`)
      .toEqual([RING_EAST, RING_NORTH, RING_SOUTH, RING_WEST]);
  }
});

test('ring towers never overlap each other and are sized from their ranges', () => {
  const heights = new Set();
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const ring = ringFor(d, seed);
    expect(ringFor(d, seed), `seed ${seed}: same seed, same ring`).toEqual(ring);
    ring.forEach((r, i) => {
      const long = Math.max(r.w, r.d);
      const short = Math.min(r.w, r.d);
      expect(short >= RING_MIN - EPS && long <= Math.max(RING_W[1], RING_D[1]) + EPS, `seed ${seed}: ${JSON.stringify(r)}`)
        .toBe(true);
      expect(r.h >= RING_H[0] - EPS && r.h <= RING_H[1] + EPS, `seed ${seed}: ${JSON.stringify(r)}`).toBe(true);
      heights.add(r.h);
      ring.slice(i + 1).forEach((q) => {
        expect(meets(box(r), box(q)), `seed ${seed}: ${JSON.stringify(r)} meets ${JSON.stringify(q)}`).toBe(false);
      });
    });
  }
  expect(heights.size).toBeGreaterThan(10);
});
