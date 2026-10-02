// render/setdress.js draws the dressing sim/dressing.js plans (milestone 2): the
// hand tables move out of the renderer, a generated world hangs its own signs,
// lays its own water and vents its own steam, and a world whose shops or puddles
// all fall in one power zone still boots.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ viewport: { width: 480, height: 270 } });

test('setdress.js draws what sim/dressing.js plans and keeps no table of its own', () => {
  const src = fs.readFileSync('src/render/setdress.js', 'utf8');
  expect(src).toMatch(/from '\.\.\/sim\/dressing\.js'/);
  expect(src).not.toMatch(/const SHOPS = \[/);
  expect(src).not.toMatch(/const PUDDLES = \[/);
  expect(src).not.toMatch(/const VENTS = \[/);
  for (const name of ['SHOPS', 'PUDDLES', 'VENTS']) expect(src).toMatch(new RegExp(`\\b${name}\\b`));
});

// Seed 15 lays every puddle at z >= 0 or z < 0, seed 77 hangs every shop in one
// zone, seed 7 has two avenues.
for (const world of ['', '&gen=1&seed=7', '&gen=1&seed=15', '&gen=1&seed=77']) {
  test(`the street boots dressed${world ? ` (${world.slice(1)})` : ' (hand preset)'}`, async ({ page }) => {
    // Crashes only: NaN lamps on two-avenue worlds are tests/furniture-wire.spec.js's.
    const bad = [];
    page.on('pageerror', (e) => bad.push(String(e)));
    await page.goto(`/?capture=1${world}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(bad).toEqual([]);
    expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
  });
}
