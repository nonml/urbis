// A tower crane must not swing its boom through a neighbour, and it must not
// hang a jib in the air with no mast under it. craneRig() is pure, so the
// rules are proved on synthetic rects here, and then on real generated cities
// in the browser through the capture-only __game.cranes() probe.
import { test, expect } from '@playwright/test';
import { craneRig, JIB } from '../src/render/zoning.js';

// A crane at the origin, boxed in on every heading by a dense ring of small
// rects at radius R. Ring spacing at R = 18 is ~1.6 m, so the 3 m blockers
// overlap and no jib slips between them.
function ring(R, n = 72) {
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return { x: R * Math.cos(a), z: R * Math.sin(a), w: 3, d: 3 };
  });
}

const CRANE = { x: 0, z: 0, w: 2, d: 2 };

test('open ground takes the full jib', () => {
  expect(craneRig(CRANE, []).jib).toBe(JIB);
});

test('a crane boxed in at 18 m takes a shorter jib, at 9 m drops it', () => {
  const short = craneRig(CRANE, ring(18));
  expect(short.jib, 'full jib reaches the wall').toBe(JIB * 0.75);
  const none = craneRig(CRANE, ring(9));
  expect(none.jib, 'even the shortest jib reaches the wall').toBe(0);
  expect(none, 'a jib-less crane has no swing').toEqual({ rest: 0, swing: 0, jib: 0 });
});

test('every crane in every generated city points its boom into the clear', async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let cranes = 0, shortened = 0, jibless = 0;
  for (const seed of [...Array.from({ length: 12 }, (_, i) => i + 1), 73]) {
    await page.goto(`/?capture=1&gen=1&seed=${seed}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.evaluate(() => window.__game.advance(120));
    const list = await page.evaluate(() => window.__game.cranes());
    for (const c of list) {
      expect(c.clear, `seed ${seed}: crane at (${c.x}, ${c.z}), jib ${c.jib}, yaw ${c.yaw}`).toBe(true);
      if (c.jib === 0) jibless++;
      else if (c.jib < JIB) shortened++;
    }
    cranes += list.length;
  }
  expect(errors, errors.join('; ')).toEqual([]);
  expect(cranes, 'generated cities grow cranes to test').toBeGreaterThan(0);
  console.log(`cranes: ${cranes}, shortened: ${shortened}, jib-less: ${jibless}`);
});
