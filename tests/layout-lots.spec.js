// Zonable lots on generated districts, and the rows they are cut out of, proven
// without a browser (milestone 2, docs/PROCGEN.md stage 5). Same runner as the gate.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import {
  BUILD_LINE, LOT_CLEAR, LOT_FRONT, LOTS_MAX, LOTS_MIN, MIN_RUN, PIN_CLEAR, PINNED_TOWERS,
  deriveLots, planLayout, rowDepth, rowRuns,
} from '../src/sim/layout.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(300);
const SIDES = [-1, 1];
const EPS = 1e-6;
const length = (runs) => runs.reduce((n, [z0, z1]) => n + z1 - z0, 0);
const zSpan = ([, z, , dd]) => [z - dd / 2, z + dd / 2];
const crosses = ([a0, a1], [b0, b1]) => a0 < b1 - EPS && a1 > b0 + EPS;

// The avenue side a lot stands on: its near x edge is that side's building line.
function homeOf(d, [x, , w]) {
  for (const a of d.avenues) {
    for (const side of SIDES) {
      if (Math.abs(x - side * w / 2 - (a.x + side * BUILD_LINE)) < EPS) return { ax: a.x, side };
    }
  }
  return null;
}

function pinSpans(d, ax, side) {
  if (ax !== d.avenues[0].x) return [];
  const half = (t) => (t.d + PIN_CLEAR) / 2;
  return PINNED_TOWERS.filter((t) => t.side === side).map((t) => [t.z - half(t), t.z + half(t)]);
}

test('every seed gets LOTS_MIN..LOTS_MAX lots, the same ones every time', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const lots = deriveLots(d, seed);
    expect(lots.length >= LOTS_MIN && lots.length <= LOTS_MAX, `seed ${seed}: ${lots.length} lots`).toBe(true);
    expect(deriveLots(generateDistrict(seed), seed), `seed ${seed}: deterministic`).toEqual(lots);
    for (const lot of lots) expect(lot.length === 4 && lot.every(Number.isFinite), `seed ${seed}: ${lot}`).toBe(true);
  }
  expect(deriveLots(generateDistrict(1), 1)).not.toEqual(deriveLots(generateDistrict(1), 2));
});

test('each lot sits in a row: on a building line, row-deep, inside a run, inside the drive bounds', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    for (const lot of deriveLots(d, seed)) {
      const at = `seed ${seed} lot ${lot}`;
      const home = homeOf(d, lot);
      expect(home, `${at}: not on any building line`).not.toBeNull();
      expect(lot[2], `${at}: depth`).toBeCloseTo(rowDepth(d, home.ax, home.side), 6);
      expect(lot[3] >= LOT_FRONT[0] - EPS && lot[3] <= LOT_FRONT[1] + EPS, `${at}: front ${lot[3]}`).toBe(true);
      const [z0, z1] = zSpan(lot);
      const inRun = rowRuns(d, home.ax, home.side).some(([r0, r1]) => z0 >= r0 - EPS && z1 <= r1 + EPS);
      expect(inRun, `${at}: not inside a row run`).toBe(true);
      expect(z0 >= d.drive.minZ - EPS && z1 <= d.drive.maxZ + EPS, `${at}: outside the drive bounds`).toBe(true);
      for (const pin of pinSpans(d, home.ax, home.side)) expect(crosses([z0, z1], pin), `${at}: on a pinned tower`)
        .toBe(false);
    }
  }
});

test('no two lots overlap', () => {
  for (const seed of SEEDS) {
    const lots = deriveLots(generateDistrict(seed), seed);
    for (let i = 0; i < lots.length; i++) {
      for (let j = i + 1; j < lots.length; j++) {
        const [a, b] = [lots[i], lots[j]];
        const overlap = Math.abs(a[0] - b[0]) < (a[2] + b[2]) / 2 - EPS
          && Math.abs(a[1] - b[1]) < (a[3] + b[3]) / 2 - EPS;
        expect(overlap, `seed ${seed}: lots ${i} and ${j}`).toBe(false);
      }
    }
  }
});

test('the plan cuts every lot and pinned tower out of its row', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const plan = planLayout(d, seed);
    expect(plan.lots, `seed ${seed}: plan lots`).toEqual(deriveLots(d, seed));
    expect(plan.rows.length, `seed ${seed}: one row per avenue side`).toBe(d.avenues.length * 2);
    for (const row of plan.rows) {
      const at = `seed ${seed} row x=${row.ax} side ${row.side}`;
      expect(row.depth, `${at}: depth`).toBeCloseTo(rowDepth(d, row.ax, row.side), 9);
      const full = rowRuns(d, row.ax, row.side);
      const mine = plan.lots.filter((lot) => {
        const h = homeOf(d, lot);
        return h && h.ax === row.ax && h.side === row.side;
      });
      const holes = [
        ...mine.map((lot) => [zSpan(lot)[0] - LOT_CLEAR, zSpan(lot)[1] + LOT_CLEAR]),
        ...pinSpans(d, row.ax, row.side),
      ];
      for (const [r0, r1] of row.runs) {
        expect(r1 - r0 >= MIN_RUN - EPS, `${at}: run too short`).toBe(true);
        expect(full.some(([f0, f1]) => r0 >= f0 - EPS && r1 <= f1 + EPS), `${at}: run outside rowRuns`).toBe(true);
        for (const h of holes) expect(crosses([r0, r1], h), `${at}: run over a lot or pinned tower`).toBe(false);
      }
      // Only the holes, and stubs too short to build on beside them, may go missing.
      const least = length(full) - holes.reduce((n, [h0, h1]) => n + h1 - h0, 0) - 2 * holes.length * MIN_RUN;
      expect(length(row.runs) >= least - EPS, `${at}: ${length(row.runs)} m of row, expected at least ${least}`)
        .toBe(true);
    }
  }
});
