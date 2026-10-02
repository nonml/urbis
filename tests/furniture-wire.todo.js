// On a generated world the street furniture is the plan's (milestone 2): the
// lamps, the parked cars, the kerb clutter, the zebras and the drain grates
// follow the generated roads, so a world with two avenues or four draws every
// fitting at a real place, and nothing is drawn at NaN. The hand preset keeps
// its tables.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createStreet } from '../src/sim/street.js';

const SIM = new URL('../src/sim/', import.meta.url).href;
const WORLDS = ['', '&gen=1&seed=3', '&gen=1&seed=7', '&gen=1&seed=12'];

test.use({ viewport: { width: 480, height: 270 } });

test('the render and the street read the plan', () => {
  expect(fs.readFileSync('src/render/lamps.js', 'utf8')).toContain('WORLD_FURNITURE');
  expect(fs.readFileSync('src/sim/street.js', 'utf8')).toContain('WORLD_FURNITURE');
  const block = fs.readFileSync('src/render/block.js', 'utf8');
  expect(block).toContain('WORLD_FURNITURE');
  expect(block).toContain('rhythm(');
});

test('the hand preset parks its 14 cars where it always has', () => {
  const parked = createStreet(20260916).cars.filter((c) => c.parked);
  expect(parked.length).toBe(14);
});

test('a generated world parks the plan\'s cars', () => {
  for (const seed of [3, 7, 12]) {
    const code = `
      const { setWorldSeed } = await import('${SIM}seedstore.js');
      setWorldSeed(${seed}, true);
      const { WORLD_FURNITURE } = await import('${SIM}furniture.js');
      const { createStreet } = await import('${SIM}street.js');
      const cars = createStreet(${seed}).cars.filter((c) => c.parked)
        .map((c) => [+c.lane.toFixed(3), c.z]);
      const plan = WORLD_FURNITURE.parked.map(([x, side, z]) => [+(x + side * 3.4).toFixed(3), z]);
      console.log(JSON.stringify({ cars, plan }));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const { cars, plan } = JSON.parse(run.stdout);
    expect(plan.length).toBeGreaterThan(0);
    expect(cars, `seed ${seed}`).toEqual(plan);
  }
});

for (const world of WORLDS) {
  test(`nothing is drawn at NaN${world ? ` (${world.slice(1)})` : ' (hand preset)'}`, async ({ page }) => {
    const bad = [];
    page.on('console', (m) => { if (/NaN/.test(m.text())) bad.push(m.text()); });
    page.on('pageerror', (e) => bad.push(String(e)));
    await page.goto(`/?capture=1${world}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(bad).toEqual([]);
    expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
  });
}
