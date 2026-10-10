// M5.T26 (M5-7, docs/ROADMAP.md): undo. Ctrl+Z in the city view takes the
// last act back through M3's own undo (sim/ops.js) and refunds its cost in
// full, for UNDO_SECS of game time after the act; past the window the act
// stands and keeps its charge. The cost of a zone brush is M5.T19's price
// (sim/cityview.js TOOL_PRICE), so the treasury must show the act paying for
// itself and the undo giving it back.
//
// Every check is the player's own: the palette key, a real mouse click on the
// lot the cursor holds, and Ctrl+Z on the keyboard — nothing reaches into the
// sim behind the game's back. m5-cost.spec.js holds the price and the
// refusal; this is the refund half of M5-7.
import { test, expect } from '@playwright/test';
import { TOOLS } from '../../src/sim/cityview.js';
import { cityView, waitGame } from './lib/input.js';

const SEED = 7;
const SPEED = 4;                  // ?speed: the game clock runs four steps a frame
const COST = TOOLS.res.cost(null, null);
const UNDO = 10;                  // game seconds the act stays refundable (M5.T26)
test.setTimeout(180000);

const books = (page) => page.evaluate(() => window.__game.budget().money);
const lotState = (page, i) => page.evaluate((k) => window.__game.cityview.lots()[k], i);

// Z into the overview and hold the residential brush: the act under test.
async function open(page) {
  await page.goto(`/?capture=1&gen=1&seed=${SEED}&speed=${SPEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await cityView(page);
  const lots = await page.evaluate(() => window.__game.freeLots());
  expect(lots.length, `seed ${SEED}: the city left open land to build on`).toBeGreaterThanOrEqual(2);
  return lots;
}

// A click on the lot at (x, z), the way a player paints one: the pointer moves
// there, a frame passes so the view's hover settles, and the click lands.
async function paint(page, x, z) {
  const px = await page.evaluate((p) => window.__game.screenOf(p.x, 1.2, p.z), { x, z });
  await page.mouse.move(px.x, px.y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.mouse.down();
  await page.mouse.up();
  await waitGame(page, 0.1);
}

// Ctrl+Z, the key the player presses to take an act back.
const undo = (page) => page.keyboard.press('Control+z');

test('M5.T26: Ctrl+Z takes the last act back and refunds its cost in full', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const lots = await open(page);
  const lot = lots[0].index;
  const before = await books(page);

  // The act: the R brush zones the lot for its price.
  await paint(page, lots[0].x, lots[0].z);
  expect((await lotState(page, lot)).zoned, 'the brush zoned the lot').toBe('res');
  const charged = await books(page);
  expect(charged, `the act charged the treasury $${COST}`).toBe(before - COST);

  // Ctrl+Z inside the window: the act is undone through M3's own undo and the
  // whole charge comes back.
  await undo(page);
  await waitGame(page, 0.1);
  expect((await lotState(page, lot)).zoned, 'Ctrl+Z took the zoning back').toBe(null);
  expect(await books(page), 'the refund is the cost in full').toBe(before);

  // The last act is the one taken back, not a walk down the history: a second
  // press with nothing fresh done is nothing at all.
  await undo(page);
  await waitGame(page, 0.2);
  expect((await lotState(page, lot)).zoned, 'a second Ctrl+Z undoes nothing more').toBe(null);
  expect(await books(page), 'and refunds nothing more').toBe(before);
  expect(errors).toEqual([]);
});

test('M5.T26: an act is undoable for ten game seconds, and stands after that', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const lots = await open(page);
  const lot = lots[1].index;
  const before = await books(page);

  await paint(page, lots[1].x, lots[1].z);
  expect((await lotState(page, lot)).zoned, 'the brush zoned the lot').toBe('res');
  expect(await books(page), 'the act charged the treasury').toBe(before - COST);

  // Past UNDO_SECS of game time the window is shut: the act stands and keeps
  // what it cost.
  await waitGame(page, UNDO + 1);
  await undo(page);
  await waitGame(page, 0.2);
  expect((await lotState(page, lot)).zoned, 'an act past the window stands zoned').toBe('res');
  expect(await books(page), 'and keeps its charge').toBe(before - COST);
  expect(errors).toEqual([]);
});

test('M5.T26: the key belongs to the overview, and still answers up there', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const lots = await open(page);
  const lot = lots[0].index;
  const before = await books(page);
  await paint(page, lots[0].x, lots[0].z);
  expect(await books(page), 'the act charged the treasury').toBe(before - COST);

  // Down to the street and back up: the act is well inside its window, and the
  // key is the city view's, so nothing happens to it down there — and the Z the
  // street keeps is not taken from it either.
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.__game.cityview.state().lift <= 0, null,
    { polling: 'raf', timeout: 30000 });
  await undo(page);
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.__game.cityview.state().lift >= 1, null,
    { polling: 'raf', timeout: 30000 });
  expect((await lotState(page, lot)).zoned, 'the street’s Ctrl+Z leaves the act standing').toBe('res');
  expect(await books(page), 'and its charge with it').toBe(before - COST);

  // The same key back up there takes it back and refunds it.
  await undo(page);
  await waitGame(page, 0.1);
  expect((await lotState(page, lot)).zoned, 'Ctrl+Z up there takes the act back').toBe(null);
  expect(await books(page), 'and refunds it in full').toBe(before);
  expect(errors).toEqual([]);
});
