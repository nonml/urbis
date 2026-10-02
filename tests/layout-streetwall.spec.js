// On a generated district the street wall stands where the layout plan says:
// no row building overlaps another row building or a lot, none stands on a road,
// and every row is built up (milestone 2). The referee is the real overlap
// checker, which builds the actual towers headless; this only reads its report.
// Vista caps, the south row and the skyline ring are later tasks, so pairs that
// involve only those are not judged here.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const SEEDS = [1, 2, 3, 4, 5];
const MIN_WORST_ROW = 90;

function check(seed) {
  const run = spawnSync(process.execPath, ['scripts/check_overlap.mjs', '--seed', String(seed)], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  return run.stdout;
}

const isRow = (line) => line.includes('ROW[');

test('row buildings never overlap each other or a lot', () => {
  for (const seed of SEEDS) {
    const pairs = check(seed).split('\n').filter((l) => l.includes('  ×  '));
    const bad = pairs.filter((l) => {
      const [a, b] = l.split('  ×  ');
      return (isRow(a) && (isRow(b) || b.includes('LOTS['))) || (isRow(b) && a.includes('LOTS['));
    });
    expect(bad, `seed ${seed}`).toEqual([]);
  }
});

test('no row building stands on a road', () => {
  for (const seed of SEEDS) {
    const bad = check(seed).split('\n').filter((l) => l.includes('  on  road') && isRow(l));
    expect(bad, `seed ${seed}`).toEqual([]);
  }
});

test(`every row is at least ${MIN_WORST_ROW}% built, measured against the plan's own runs`, () => {
  // The hand tables measure the hand map; on a generated one only the plan's runs mean anything.
  expect(fs.readFileSync('scripts/check_overlap.mjs', 'utf8')).toContain('WORLD_PLAN');
  for (const seed of SEEDS) {
    const worst = Number(/^frontage: worst row ([\d.]+)%/m.exec(check(seed))?.[1]);
    expect(worst >= MIN_WORST_ROW, `seed ${seed}: worst row ${worst}%`).toBe(true);
  }
});
