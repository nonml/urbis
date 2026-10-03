// Driving to either end of any avenue on a generated world ends in a lit tower,
// not black void (milestone 2). The caps are pure data from the district and the
// seed; tests/vistas-wire.spec.js proves the street wall and the roads leave them room.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import { CAP_D, CAP_GAP, CAP_H, CAP_W, capsFor } from '../src/sim/vistas.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(200);
const EPS = 1e-6;
const within = (v, [lo, hi]) => v >= lo - EPS && v <= hi + EPS;
const half = (v) => Math.abs(v * 2 - Math.round(v * 2)) < EPS;

test('every avenue is capped at both ends, centred on it', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const caps = capsFor(d, seed);
    expect(caps.length, `seed ${seed}`).toBe(d.avenues.length * 2);
    for (const a of d.avenues) {
      const north = caps.filter((c) => Math.abs(c.x - a.x) < EPS && c.z > a.z1);
      const south = caps.filter((c) => Math.abs(c.x - a.x) < EPS && c.z < a.z0);
      expect([north.length, south.length], `seed ${seed} ${a.id}`).toEqual([1, 1]);
      expect(north[0].z - north[0].d / 2 - a.z1, `seed ${seed} ${a.id} north gap`).toBeCloseTo(CAP_GAP, 6);
      expect(a.z0 - (south[0].z + south[0].d / 2), `seed ${seed} ${a.id} south gap`).toBeCloseTo(CAP_GAP, 6);
      expect(north[0].face).toEqual([0, -1]);
      expect(south[0].face).toEqual([0, 1]);
    }
  }
});

test('caps are sized from their ranges, on half-metres, and the seed decides them', () => {
  const heights = new Set();
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const caps = capsFor(d, seed);
    expect(capsFor(d, seed), `seed ${seed}: same seed, same caps`).toEqual(caps);
    for (const c of caps) {
      expect(within(c.w, CAP_W) && within(c.d, CAP_D) && within(c.h, CAP_H), `seed ${seed}: ${JSON.stringify(c)}`)
        .toBe(true);
      expect(half(c.w) && half(c.d) && half(c.h), `seed ${seed}: ${JSON.stringify(c)} off the half-metre`).toBe(true);
      heights.add(c.h);
    }
  }
  expect(heights.size).toBeGreaterThan(10);
});
