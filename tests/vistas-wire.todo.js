// On a generated world the caps and the ring replace the hand map's south row,
// terminus towers and skyline ring, and nothing overlaps (milestone 2). The
// referee is the real overlap checker, which builds the actual towers headless.
// The hand preset keeps its tables: its numbers must not move.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function check(...args) {
  const run = spawnSync(process.execPath, ['scripts/check_overlap.mjs', ...args], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  return run.stdout;
}

test('a generated world reads its vistas from the plan', () => {
  expect(fs.readFileSync('src/render/block.js', 'utf8')).toContain('WORLD_VISTAS');
});

test('no building overlaps another on a generated world', () => {
  for (const seed of SEEDS) {
    expect(check('--seed', String(seed)), `seed ${seed}`).toMatch(/^overlap: 0 intersecting pairs/m);
  }
});

test('no vista tower stands on a road', () => {
  for (const seed of SEEDS) {
    const bad = check('--seed', String(seed)).split('\n')
      .filter((l) => l.includes('  on  road') && !l.includes('PINNED_TOWERS'));
    expect(bad, `seed ${seed}`).toEqual([]);
  }
});

test('the hand preset is untouched', () => {
  const out = check();
  expect(out).toMatch(/^overlap: 0 intersecting pairs among 83 buildings and 10 lots/m);
  expect(out).toMatch(/^road: 7 towers on a road or walkway/m);
});
