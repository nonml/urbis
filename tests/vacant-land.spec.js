// Free land the player can see (milestone 5). A generated city leaves each
// district FREE_LOTS empty, unzoned lots (sim/zoning.js freeLand); this proves
// the render layer makes them readable: a ground plate, a low fence with a gap
// and a LAND FOR LEASE board at street level, a pale boundary and the board from
// the overview, and none of it once the player zones the lot.
//
// The overview is oblique and buildings hide ground: a lot's centre is pickable
// from at least one heading (the overview aim probe), not every heading. The
// street pose stands on the walkway the lot faces, the same pose a player walks.
import { test, expect } from '@playwright/test';

const SEEDS = [7, 73, 1234567];
const POSE_SETTLE = 400;
const CITY_SETTLE = 600;
// Full turns of the overview heading, tried until the lot's centre is on top.
const HEADINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4];
const VACANT = 'Group/vacant-lot';

const isVacant = (hit) => Boolean(hit && hit.path && hit.path.endsWith('/vacant-lot'));

async function boot(page, seed) {
  await page.goto(`/?capture=1&gen=1&seed=${seed}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
}

// The pixel of a lot's centre in city view, in the page's own pixels.
async function lotPixel(page, index) {
  return page.evaluate((i) => {
    const s = window.__game.cityview.screen(i);
    return {
      x: (s.x * 0.5 + 0.5) * window.innerWidth,
      y: (1 - (s.y * 0.5 + 0.5)) * window.innerHeight,
      ndc: [s.x, s.y],
    };
  }, index);
}

async function pickAt(page, x, y) {
  return page.evaluate(([px, py, w, h]) => window.__game.pick(px, py, w, h),
    [x, y, await page.evaluate(() => window.innerWidth), await page.evaluate(() => window.innerHeight)]);
}

for (const seed of SEEDS) {
  test(`seed ${seed}: free land reads in city view and on the pavement, and goes when zoned`, async ({ page }) => {
    await boot(page, seed);
    const free = await page.evaluate(() => window.__game.freeLots());
    expect(free.length, `seed ${seed} has free land`).toBeGreaterThan(0);

    // City view: every free lot is in the frame the district opens on, and each
    // one is pickable: aim the overview until its centre sits on the vacant mesh.
    await page.keyboard.press('z');
    await page.waitForFunction(() => window.__game.cityview.state().lift >= 1, null, { timeout: 15000 });
    await page.waitForTimeout(CITY_SETTLE);
    // Frame the free land the way the player pans to it: an overview over the
    // free lots' own centre, far enough back that every one is on screen.
    const mid = free.reduce((a, l) => ({ x: a.x + l.x / free.length, z: a.z + l.z / free.length }), { x: 0, z: 0 });
    await page.evaluate(([x, z]) => window.__game.cityview.aim({ x, z, yaw: 0, tilt: 1.0, reach: 200 }), [mid.x, mid.z]);
    await page.waitForTimeout(200);
    for (const lot of free) {
      const s = await lotPixel(page, lot.index);
      expect(Math.abs(s.ndc[0]), `seed ${seed} lot ${lot.index} x in frame`).toBeLessThanOrEqual(1);
      expect(Math.abs(s.ndc[1]), `seed ${seed} lot ${lot.index} y in frame`).toBeLessThanOrEqual(1);
    }
    // Each lot is pickable: its centre lands on the vacant mesh from at least one
    // heading (buildings hide ground; the player orbits to see it).
    for (const lot of free) {
      let firstSolid = null;
      for (const turn of HEADINGS) {
        await page.evaluate(([l, y]) => window.__game.cityview.aim({
          x: l.x, z: l.z, yaw: l.pose.yaw + y, tilt: 1.25, reach: 80,
        }), [lot, turn]);
        await page.waitForTimeout(100);
        const at = await lotPixel(page, lot.index);
        const hits = await pickAt(page, at.x, at.y);
        firstSolid = hits.find((h) => !h.see);
        if (isVacant(firstSolid)) break;
      }
      expect(isVacant(firstSolid), `seed ${seed} lot ${lot.index} city pick: ${firstSolid?.path}`).toBe(true);
    }
    await page.keyboard.press('z');
    await page.waitForFunction(() => window.__game.cityview.state().lift <= 0, null, { timeout: 15000 });

    // Street: the walkway pose that faces the lot, its dressing at the centre.
    for (const lot of free) {
      await page.evaluate((l) => window.__game.pose(l.pose.x, l.pose.z, l.pose.yaw), lot);
      await page.waitForTimeout(POSE_SETTLE);
      const hits = await page.evaluate(() => window.__game.pick(
        window.innerWidth / 2, window.innerHeight / 2, window.innerWidth, window.innerHeight,
      ));
      const vac = hits.find(isVacant);
      expect(vac, `seed ${seed} lot ${lot.index} street centre hits dressing: ${hits.map((h) => h.path).join(',')}`).toBeTruthy();
      expect(vac.dist, `seed ${seed} lot ${lot.index} dressing near`).toBeLessThan(8);
    }

    // Zoning the lot removes its dressing: it leaves the free set and the
    // pavement pick that found it a moment ago finds none of it now.
    const gone = free[0];
    await page.evaluate((l) => window.__game.pose(l.pose.x, l.pose.z, l.pose.yaw), gone);
    await page.waitForTimeout(POSE_SETTLE);
    expect(await page.evaluate((i) => window.__game.zone(i, 'res'), gone.index)).toBe(true);
    await page.waitForTimeout(POSE_SETTLE);
    const after = await page.evaluate(() => window.__game.freeLots());
    expect(after.map((l) => l.index), `seed ${seed}: zoned lot left the free set`).not.toContain(gone.index);
    const hits = await page.evaluate(() => window.__game.pick(
      window.innerWidth / 2, window.innerHeight / 2, window.innerWidth, window.innerHeight,
    ));
    expect(hits.some(isVacant), `seed ${seed}: dressing gone after zoning`).toBe(false);
  });
}
