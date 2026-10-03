// Street-wall rows on generated districts, proven without a browser (milestone 2,
// docs/PROCGEN.md stage 3). layout.js is pure (law 5), so hundreds of seeds run
// in milliseconds. Same runner as the gate: no new tooling.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import {
  BACK_GAP, BUILD_LINE, CROSSING_BAND, MIN_RUN, ROW_DEPTH_MAX, ROW_DEPTH_MIN, ROW_END_GAP,
  rowDepth, rowRuns,
} from '../src/sim/layout.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(300);
const SIDES = [-1, 1];
const EPS = 1e-9;
const length = (runs) => runs.reduce((n, [z0, z1]) => n + z1 - z0, 0);

// The x band a row's buildings occupy, nearest edge to the avenue first.
function band(d, ax, side) {
  const near = ax + side * BUILD_LINE;
  const far = ax + side * (BUILD_LINE + rowDepth(d, ax, side));
  return [Math.min(near, far), Math.max(near, far)];
}

function cutters(d, ax, side) {
  const [bx0, bx1] = band(d, ax, side);
  return d.crossings.filter((c) => c.x0 < bx1 + ROW_END_GAP && c.x1 > bx0 - ROW_END_GAP);
}

test('row depth: full on an outer side, shared fairly between two avenues', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const xs = d.avenues.map((a) => a.x).sort((p, q) => p - q);
    for (const [i, ax] of xs.entries()) {
      for (const side of SIDES) {
        const depth = rowDepth(d, ax, side);
        const at = `seed ${seed} avenue x=${ax} side ${side}`;
        expect(depth >= ROW_DEPTH_MIN - EPS && depth <= ROW_DEPTH_MAX + EPS, `${at}: depth ${depth}`).toBe(true);
        const neighbour = xs[i + side];
        if (neighbour === undefined) {
          expect(depth, `${at}: outer side`).toBeCloseTo(ROW_DEPTH_MAX, 9);
        } else {
          const fair = Math.min(ROW_DEPTH_MAX, Math.abs(neighbour - ax) / 2 - BUILD_LINE - BACK_GAP);
          expect(depth, `${at}: shared side`).toBeCloseTo(fair, 9);
        }
      }
    }
  }
});

test('facing rows between two avenues never touch', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const xs = d.avenues.map((a) => a.x).sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i++) {
      const eastBack = band(d, xs[i], 1)[1];
      const westBack = band(d, xs[i + 1], -1)[0];
      expect(westBack - eastBack >= 2 * BACK_GAP - EPS, `seed ${seed}: rows ${xs[i]} | ${xs[i + 1]}`).toBe(true);
    }
  }
});

test('rows stay on their avenue, sorted, at least MIN_RUN long, clear of every crossing', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    for (const a of d.avenues) {
      for (const side of SIDES) {
        const runs = rowRuns(d, a.x, side);
        const at = `seed ${seed} avenue x=${a.x} side ${side}`;
        runs.forEach(([z0, z1], k) => {
          expect(z1 - z0 >= MIN_RUN - EPS, `${at}: run ${k} too short`).toBe(true);
          expect(z0 >= a.z0 + ROW_END_GAP - EPS && z1 <= a.z1 - ROW_END_GAP + EPS, `${at}: run ${k} off the avenue`)
            .toBe(true);
          if (k > 0) expect(z0 >= runs[k - 1][1] - EPS, `${at}: runs ${k - 1} and ${k} out of order`).toBe(true);
          for (const c of cutters(d, a.x, side)) {
            const clear = CROSSING_BAND + ROW_END_GAP;
            const hits = z0 < c.z + clear - EPS && z1 > c.z - clear + EPS;
            expect(hits, `${at}: run ${k} crosses ${c.id} at z ${c.z}`).toBe(false);
          }
        });
      }
    }
  }
});

test('rows line the whole avenue except where a crossing cuts them', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    for (const a of d.avenues) {
      for (const side of SIDES) {
        const cuts = cutters(d, a.x, side).length;
        const most = a.z1 - a.z0 - 2 * ROW_END_GAP;
        // Each cut removes its band, and may strand a stub shorter than MIN_RUN either side.
        const least = most - cuts * 2 * (CROSSING_BAND + ROW_END_GAP) - (cuts + 1) * MIN_RUN;
        const got = length(rowRuns(d, a.x, side));
        expect(got >= least - EPS && got <= most + EPS, `seed ${seed} x=${a.x} side ${side}: ${got} m of row`)
          .toBe(true);
      }
    }
  }
});

test('the same district always gives the same rows', () => {
  const d = generateDistrict(7);
  for (const a of d.avenues) {
    for (const side of SIDES) expect(rowRuns(d, a.x, side)).toEqual(rowRuns(generateDistrict(7), a.x, side));
  }
});
