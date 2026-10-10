// M5.T33b (M5.T33, docs/ROADMAP.md): prove drag zoning. M5.T33 (98246a1) put
// the zone stroke in the overview — a brush held, the mouse dragged, every empty
// lot the stroke crosses zoned on the release and charged as one act — but the
// test it landed on never drags a brush, so nothing showed it works. This is
// that check, and every act in it is the player's own: Z into the overview, the
// residential brush picked off the palette with the mouse, and a real drag —
// pointer down, steps across the ground, pointer up — over three empty lots.
//
// The card is the promise and the release is the act. Before the pointer comes
// up the city view names the stroke's total cost on screen; after it every lot
// the stroke crossed is zoned, nothing else moved, the treasury is down by
// exactly the total the card named, and one Ctrl+Z takes the whole stroke back
// and refunds it in full (M5.T26).
//
// Lot positions and states are read through the probe only to aim the mouse and
// to read the result back — the same screenOf a click aims with, and the view's
// own record of the lots — so every act stays a real key or mouse event. Which
// lots the stroke should have painted is worked out here from those positions,
// never from the stroke's own answer: the check is independent of the code it
// checks. The stroke that crosses nothing, and the overview that must not orbit
// under a brush, are checked beside it.
import { test, expect } from '@playwright/test';
import { TOOLS } from '../../src/sim/cityview.js';
import { waitGame } from './lib/input.js';

const SEED = 7;
const PRICE = TOOLS.res.cost(null, null);   // the res brush's own price (M5.T19)
// Metres a lot's centre may sit off the stroke and still count as crossed: a
// lot is tens of metres wide, and the stroke is sampled every 4 m, so a lot
// whose centre the stroke passes through is a lot the stroke crossed.
const TOL = 6;
const STEPS = 8;    // mouse moves across one drag, as a hand makes them

test.setTimeout(240000);

// Two frames: one for the pointer to be read, one for the card to be painted
// from it — the settle a click waits for (tests/accept/lib/input.js).
const settle = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(resolve));
}));

const books = (page) => page.evaluate(() => window.__game.budget().money);
const zoning = (page) => page.evaluate(() => window.__game.cityview.lots());
const state = (page) => page.evaluate(() => window.__game.cityview.state().brush);
// The card the overview paints beside the cursor, as the player reads it: the
// text on screen, and the numbers it keeps on data-*.
const card = (page) => page.evaluate(() => {
  const el = document.getElementById('lotcard');
  return {
    text: el.textContent, lots: el.dataset.lots,
    cost: el.dataset.cost, shown: el.style.display,
  };
});
// The stroke's own line on the card: "◆ zone 3 lots · $300".
const CARD_LINE = /◆ zone (\d+) lots? · \$([\d,]+)/;
const cardNumbers = (c) => {
  const m = CARD_LINE.exec(c.text);
  if (!m) return null;
  return { lots: Number(m[1]), cost: Number(m[2].replace(/,/g, '')) };
};

// The empty lots the residential brush may paint, with each one's position from
// the probe and its zoning from the view's own record of the lots.
const brushableLots = (page) => page.evaluate(() => {
  const held = window.__game.cityview.lots();
  return window.__game.city().parcels
    .map((p, i) => ({
      i, kind: p.kind, x: p.x, z: p.z, stage: held[i].stage, zoned: held[i].zoned,
    }))
    .filter((l) => l.kind === 'lot' && l.stage === 'EMPTY' && l.zoned !== 'res');
});

// Metres from `p` to the segment from->to, and 0 past either end of it.
function gapFrom(p, from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const span = dx * dx + dz * dz;
  const t = span === 0 ? 0
    : Math.max(0, Math.min(1, ((p.x - from.x) * dx + (p.z - from.z) * dz) / span));
  return Math.hypot(p.x - (from.x + dx * t), p.z - (from.z + dz * t));
}

// Where the mouse has to be for the pointer's ground point to sit on a lot.
async function aimAt(page, p) {
  return page.evaluate((q) => window.__game.screenOf(q.x, 0, q.z), p);
}

// The stroke itself, as a hand makes it: the pointer goes down on the ground at
// one end, travels across in several steps, and comes up at the other. Returns
// the card the overview painted on every step, while the stroke was still held.
async function drag(page, ends) {
  await page.mouse.move(ends[0].x, ends[0].y);
  await settle(page);
  await page.mouse.down();
  const held = [];
  for (let step = 1; step <= STEPS; step++) {
    await page.mouse.move(
      ends[0].x + ((ends[1].x - ends[0].x) * step) / STEPS,
      ends[0].y + ((ends[1].y - ends[0].y) * step) / STEPS,
    );
    await settle(page);
    held.push(await card(page));
  }
  await page.mouse.up();
  await waitGame(page, 0.2);
  return held;
}

// Boot the built game, Z into the overview, and pick the residential brush off
// the palette the way a player does: put the eraser down first, so the row's
// own click is what puts the brush in hand.
async function open(page) {
  await page.goto(`/?capture=1&gen=1&seed=${SEED}&speed=1`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 60000 });
  await page.keyboard.press('x');
  expect(await state(page), 'the eraser key puts the brush down').toBeNull();
  const row = page.locator('#tool-res');
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await settle(page);
  expect(await state(page), 'the palette row holds the residential brush').toBe('res');
}

test('M5.T33b: a dragged brush zones every empty lot it crosses, and one Ctrl+Z takes the whole stroke back', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page);

  // The land the stroke will be dragged over, and the stroke itself: the
  // straight drag across the most empty lots this city leaves open. The ends
  // are lot centres, so the drag starts and finishes on the land it paints.
  const lots = await brushableLots(page);
  let plan = null;
  for (const from of lots) {
    for (const to of lots) {
      if (from === to) continue;
      const hit = lots.filter((l) => gapFrom(l, from, to) <= TOL);
      if (hit.length >= 3 && (!plan || hit.length > plan.hit.length)) plan = { from, to, hit };
    }
  }
  expect(plan, `seed ${SEED} leaves a drag across three empty lots `
    + `(${lots.length} paintable: ${lots.map((l) => l.i).join(',')})`).not.toBeNull();
  const { from, to, hit } = plan;

  // Both ends of the drag must be on the canvas and off the palette, or the
  // pointer would never reach the ground they stand on.
  const panel = await page.locator('#cityview').boundingBox();
  const size = page.viewportSize();
  const ends = [await aimAt(page, from), await aimAt(page, to)];
  for (const [n, px] of ends.entries()) {
    expect(px.x, `drag end ${n} is inside the frame`).toBeGreaterThan(4);
    expect(px.x, `drag end ${n} is inside the frame`).toBeLessThan(size.width - 4);
    expect(px.y, `drag end ${n} is inside the frame`).toBeGreaterThan(4);
    expect(px.y, `drag end ${n} is inside the frame`).toBeLessThan(size.height - 4);
    const overPanel = panel && px.x >= panel.x && px.x <= panel.x + panel.width
      && px.y >= panel.y && px.y <= panel.y + panel.height;
    expect(overPanel, `drag end ${n} is off the palette`).toBeFalsy();
  }

  const before = await zoning(page);
  const moneyBefore = await books(page);
  const viewBefore = await page.evaluate(() => {
    const v = window.__game.cityview.state();
    return { yaw: v.yaw, tilt: v.tilt, reach: v.reach, x: v.x, z: v.z };
  });

  // The act: a real press on the ground, a real drag across the lots, and the
  // card read while the stroke is still held.
  const held = await drag(page, ends);

  // Before the release: the city view names the stroke's lots and their total
  // cost on screen, and the total is the lots' price each, every step of the
  // way across them.
  for (const c of held) {
    expect(c.shown, 'the card is on screen while the stroke is held').toBe('block');
    const n = cardNumbers(c);
    expect(n, `the card names the stroke's lots and cost: "${c.text}"`).not.toBeNull();
    expect(n.cost, `the stroke's total is the lots' price each: "${c.text}"`).toBe(n.lots * PRICE);
    expect(Number(c.lots), 'the card keeps the same lots it shows').toBe(n.lots);
    expect(Number(c.cost), 'the card keeps the same cost it shows').toBe(n.cost);
  }
  const shown = cardNumbers(held[held.length - 1]);
  expect(shown.lots, `the drag crossed at least three empty lots, crossed ${shown.lots}`)
    .toBeGreaterThanOrEqual(3);
  expect(shown.cost).toBe(shown.lots * PRICE);

  // After the release: every lot the stroke crossed is zoned, and no other lot
  // changed — the stroke painted what the card promised and nothing more.
  const after = await zoning(page);
  const changed = after.map((l, i) => i).filter((i) => after[i].zoned !== before[i].zoned);
  expect(changed.sort((a, b) => a - b), 'the lots that changed are the ones the stroke crossed')
    .toEqual(hit.map((l) => l.i).sort((a, b) => a - b));
  for (const i of changed) {
    expect(before[i].zoned, `lot ${i} was not already residential`).not.toBe('res');
    expect(after[i].zoned, `lot ${i} is zoned residential`).toBe('res');
  }
  expect(await books(page), `the act charged the stroke's total $${shown.cost}`)
    .toBe(moneyBefore - shown.cost);

  // The drag is the stroke's, never the overview's orbit: the heading, the tilt
  // and the pivot the overview was holding are the ones it still holds.
  const viewAfter = await page.evaluate(() => {
    const v = window.__game.cityview.state();
    return { yaw: v.yaw, tilt: v.tilt, reach: v.reach, x: v.x, z: v.z };
  });
  expect(viewAfter, 'the stroke owns the drag, so the overview never orbits')
    .toEqual(viewBefore);

  // The same land dragged again is not crossed again: the brush only paints
  // lots whose zoning would change, so the card says there is nothing to zone,
  // the release lands none of it and charges nothing — and leaves the act the
  // first stroke charged standing for Ctrl+Z.
  const again = await drag(page, [ends[1], ends[0]]);
  const nothing = cardNumbers(again[again.length - 1]);
  expect(nothing, `the card says there is nothing to zone: "${again[again.length - 1].text}"`)
    .toBeNull();
  expect(again[again.length - 1].text, 'the card says there is nothing to zone')
    .toContain('no empty lots crossed');
  expect(await zoning(page), 'the second stroke changed no lot').toEqual(after);
  expect(await books(page), 'the second stroke charged nothing').toBe(moneyBefore - shown.cost);

  // One Ctrl+Z takes the whole stroke back — every lot it zoned, and no other
  // — and refunds the total in full.
  await page.keyboard.press('Control+z');
  await waitGame(page, 0.2);
  const undone = await zoning(page);
  for (let i = 0; i < before.length; i++) {
    expect(undone[i].zoned, `Ctrl+Z put lot ${i} back as it was`).toBe(before[i].zoned);
  }
  expect(await books(page), 'the refund is the stroke\'s total in full').toBe(moneyBefore);
  expect(errors).toEqual([]);
});
