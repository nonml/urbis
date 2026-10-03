// Lots spread over the district instead of packing into one end of each street,
// and two lots on one row always leave room for a building between them
// (milestone 2). The lot rules in layout-lots.spec.js still hold alongside.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import { LOT_CLEAR, MIN_RUN, deriveLots } from '../src/sim/layout.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(300);
// The lots' centres reach across at least this share of the district's drive length.
const SPREAD = 0.5;
// Between two lots on one row: a building's MIN_RUN, plus each lot's clear strip.
const GAP = MIN_RUN + 2 * LOT_CLEAR;
const EPS = 1e-6;

test(`lots reach across at least ${SPREAD * 100}% of the district`, () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const zs = deriveLots(d, seed).map(([, z]) => z);
    const spread = (Math.max(...zs) - Math.min(...zs)) / (d.drive.maxZ - d.drive.minZ);
    expect(spread >= SPREAD - EPS, `seed ${seed}: lots span ${(spread * 100).toFixed(0)}%`).toBe(true);
  }
});

test('two lots on one row leave room for a building between them', () => {
  for (const seed of SEEDS) {
    const lots = deriveLots(generateDistrict(seed), seed);
    for (let i = 0; i < lots.length; i++) {
      for (let j = i + 1; j < lots.length; j++) {
        const [a, b] = [lots[i], lots[j]];
        if (Math.abs(a[0] - b[0]) > EPS) continue;
        const gap = Math.abs(a[1] - b[1]) - (a[3] + b[3]) / 2;
        expect(gap >= GAP - EPS, `seed ${seed}: lots ${i} and ${j} are ${gap.toFixed(2)} m apart`).toBe(true);
      }
    }
  }
});
