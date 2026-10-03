// Real-input helpers (docs/plan/TASKS.md M0.T4, criterion M0-3).
//
// Every helper drives the page the way a player does — through the game's own
// key and pointer listeners — and counts game time in fixed sim steps, never
// wall time, so a run at ?speed=4 costs a quarter of the seconds and a paused
// tab cannot make a hold silently shorter. `__game.step()` only advances when
// the sim actually ran a whole 50 ms step, so it is the clock these helpers
// measure.
import { STEP } from '../../../src/game/loop.js';

const WAIT_TIMEOUT = 120000;

// Hold every key in `keys` (a string, e.g. 'w', or a list, e.g. ['w', 'd'])
// for `gameSecs` of game time, then release them.
export async function hold(page, keys, gameSecs) {
  const list = typeof keys === 'string' ? [keys] : keys;
  for (const key of list) await page.keyboard.down(key);
  await waitGame(page, gameSecs);
  for (const key of list) await page.keyboard.up(key);
}

// Wait until the sim has run `secs` of game time from now on.
export async function waitGame(page, secs) {
  const target = await page.evaluate((steps) => window.__game.step() + steps, Math.ceil(secs / STEP));
  await page.waitForFunction((n) => window.__game.step() >= n, target, {
    polling: 'raf', timeout: WAIT_TIMEOUT,
  });
}

// The canvas pixel a world point projects to, via the game's own probe.
export async function screenOf(page, x, y, z) {
  return page.evaluate(([px, py, pz]) => window.__game.screenOf(px, py, pz), [x, y, z]);
}

// Click the canvas pixel a world point projects to. The move lands first and a
// frame passes so the view's hover — read from the pointer once a frame —
// settles on what is under the cursor before the press; down and up on the same
// frame would paint whatever was hovered before the move.
export async function clickWorld(page, x, y, z) {
  const pt = await screenOf(page, x, y, z);
  await page.mouse.move(pt.x, pt.y);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.mouse.down();
  await page.mouse.up();
  return pt;
}

// Palette key per use (sim/cityview.js BRUSH_KEYS); the eraser is X.
const BRUSH_KEY = { res: 'r', com: 'c', ind: 'i' };

// Z into the city view, wait for the rise to finish, then pick `brush` by its
// palette key. `brush` is a use name, 'unzone', or null for the eraser.
export async function cityView(page, brush = 'res') {
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: WAIT_TIMEOUT });
  const use = brush === 'unzone' ? null : brush;
  const key = use === null ? 'x' : BRUSH_KEY[use];
  if (!key) throw new Error(`input.js: unknown brush '${brush}'`);
  await page.keyboard.press(key);
  await page.waitForFunction((u) => window.__game.cityview.state().brush === u, use, {
    polling: 'raf', timeout: WAIT_TIMEOUT,
  });
}
