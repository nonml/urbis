// The renderer draws the streetscape sim/streetscape.js places (milestone 2): the
// neon blade signs and the mid-block zebras come from the plan, and the hand
// map's alley washes and river promenade stay on the hand map instead of
// hanging inside a generated world's buildings.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test.use({ viewport: { width: 480, height: 270 } });

test('block.js and signs.js draw what sim/streetscape.js places', () => {
  const block = fs.readFileSync('src/render/block.js', 'utf8');
  expect(block).toMatch(/import \{ MIDBLOCK \} from '\.\.\/sim\/streetscape\.js'/);
  expect(block).not.toMatch(/\[20, -20, 10\]/);
  expect(block).toMatch(/for \(const \{ x, z: cz \} of MIDBLOCK\)/);
  expect(block).toMatch(/\.\.\.\(WORLD_PLAN \? \[\] : \[box\(22, WALK_RISE, 9, -17, 0\.0, -32\)\]\)/);
  expect(block).toMatch(/\.\.\.\(WORLD_PLAN \? \[\] : \[box\(0\.35, 1\.0, 9, -27\.8, 0\.5, -32\)\]\)/);
  const signs = fs.readFileSync('src/render/signs.js', 'utf8');
  expect(signs).toMatch(/import \{ worldSigns \} from '\.\.\/sim\/streetscape\.js'/);
  expect(signs).toMatch(/const SIGNS = worldSigns\(SIGN_DEFS\.filter\(/);
  expect(signs).toMatch(/const ALLEYS = WORLD_PLAN \? \[\] : \[/);
  expect(signs).toMatch(/if \(alleys\.mesh\) group\.add\(alleys\.mesh\)/);
  expect(signs).toMatch(/if \(alleyAttr\) alleyAttr\.needsUpdate = true/);
  const world = fs.readFileSync('src/sim/world.js', 'utf8');
  expect(world).toMatch(/const FLAT_RECTS = \[\.\.\.roadFlatRects\(\), \.\.\.\(generate \? \[\] : \[PROMENADE\]\)\];/);
});

// Seeds 7 and 15 have two avenues (two hand avenues share one), 77 three, 2 four.
for (const world of ['', '&gen=1&seed=7', '&gen=1&seed=15', '&gen=1&seed=77', '&gen=1&seed=2']) {
  test(`the street boots with its signs and zebras${world ? ` (${world.slice(1)})` : ' (hand preset)'}`, async ({ page }) => {
    const bad = [];
    page.on('pageerror', (e) => bad.push(String(e)));
    await page.goto(`/?capture=1${world}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(bad).toEqual([]);
    expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
  });
}
