// M0-3 (docs/ROADMAP.md): real input drives the real page. The shared helpers
// in lib/input.js hold keys for game seconds, click a world point projected by
// __game.screenOf(), and open the city view with a brush picked; this example
// zones a lot by mouse and reads the zoning back out of the sim.
//
// The click is a click a player could make: the projected pixel has to be over
// the canvas (not one of the HUD's own panels), and the city view's own pick
// has to name the same lot screenOf projected. If screenOf were wrong the click
// would land on another lot or nowhere and the sim would not record the zoning.
import { test, expect } from '@playwright/test';
import { hold, clickWorld, cityView, waitGame } from './lib/input.js';

const SEED = 7;
const WALK_SECS = 1.5;
// Half the city view's 2.4 m pick floor: a point inside every lot's pick box.
const PICK_Y = 1.2;

test('M0-3: real-input helpers walk, project and zone a lot by mouse', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

  // hold: W for game seconds, counted in fixed steps, walks the player.
  const was = await page.evaluate(() => window.__game.player());
  await hold(page, 'w', WALK_SECS);
  const now = await page.evaluate(() => window.__game.player());
  const walked = Math.hypot(now.x - was.x, now.z - was.z);
  expect(walked, `holding W for ${WALK_SECS} game seconds walks the player`).toBeGreaterThan(1);

  // cityView: Z lifts the overview off the street; I picks the industrial brush.
  await cityView(page, 'ind');
  const view = await page.evaluate(() => window.__game.cityview.state());
  expect(view.mode).toBe('city');
  expect(view.lift).toBe(1);
  expect(view.brush).toBe('ind');

  // screenOf: a lot not already zoned for works projects to a pixel over the
  // canvas that the city view's own pick names as the same lot.
  const lots = await page.evaluate((pickY) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const parcels = window.__game.city().parcels;
    const zoned = window.__game.cityview.lots().map((l) => l.zoned);
    return parcels.map((p, index) => {
      const px = window.__game.screenOf(p.x, pickY, p.z);
      const ndcX = (px.x / w) * 2 - 1;
      const ndcY = 1 - (px.y / h) * 2;
      return {
        index, x: p.x, z: p.z, zoned: zoned[index],
        onCanvas: document.elementFromPoint(px.x, px.y)?.id === 'scene',
        hit: window.__game.cityview.pick(ndcX, ndcY),
      };
    });
  }, PICK_Y);
  const lot = lots.filter((t) => t.onCanvas && t.zoned !== 'ind').find((t) => t.hit === t.index);
  expect(lot, 'screenOf and the city view pick name the same lot on the canvas').toBeTruthy();

  // clickWorld: the click lands on that lot and the sim records it.
  await clickWorld(page, lot.x, PICK_Y, lot.z);
  await waitGame(page, 0.1);
  const zoned = await page.evaluate((i) => window.__game.cityview.lots()[i].zoned, lot.index);
  expect(zoned, 'the mouse click zoned the lot under the cursor').toBe('ind');
  expect(errors).toEqual([]);
});
