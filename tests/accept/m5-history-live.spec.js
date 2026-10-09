// M5.T32b (M5-15, docs/ROADMAP.md): the history panel opens in the game.
// M5.T32 (c67edc6) built the panel (src/ui/history.js) and the economy keeps
// the series, but nothing in the game showed the panel. In the city view its
// key opens and closes it, and while it is open it paints the economy's own
// series — the window sim/economy.js records a closed game day — on its 2D
// canvas, every frame it is open.
//
// The check drives the built game the way a player does: boot the generated
// city, rise into the city view, press the key, then read back the pixels the
// panel actually painted against the series the live economy holds
// (window.__game.history()), point for point — the same point-for-point shape
// as the Node check in m5-history.spec.js, against the pixels rather than a
// stubbed context. A second press closes it, and a second measure over two
// more game days proves the panel follows the live series rather than a
// snapshot taken when the key was pressed.
import { test, expect } from '@playwright/test';
import {
  PANEL_KEY, PANEL_LAYOUT, PANEL_SERIES, PANEL_W, pointY, rowTop,
} from '../../src/ui/history.js';

const SEED = 7;
// Game days of the economy's own series to run ahead (a game day is 720 s of
// game time, so this rides the capture probe rather than the frame loop): the
// first run slides the window, the second proves the panel follows the series.
const DAYS = 3, DAY_SECS = 720;
const { dpr } = PANEL_LAYOUT;
// Canvas pixels a stroke line may be off its own point by: one line width
// either side of the point, plus the anti-aliased edge.
const SLACK = 3;

// The panel element as the page holds it: its display state and its own size.
const panel = (page) => page.evaluate(() => {
  const el = document.getElementById('history');
  if (!el) return null;
  return { display: getComputedStyle(el).display, w: el.width, h: el.height };
});

// Two rendered frames: the panel paints on the frame loop, so a read taken in
// the same tick as a keypress would read the frame before it.
const frame = (page) => page.evaluate(
  () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

// Where the panel put the last sample of every series: the right-most painted
// column of each row's band, and the middle of the ink in that column. The
// bands are the panel's own row tops, so the measure cannot drift from it.
const painted = (page, tops) => page.evaluate(({ tops, rowH, dpr }) => {
  const canvas = document.getElementById('history');
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  const ink = (x, y) => px[(y * width + x) * 4 + 3] > 40;
  return tops.map((top) => {
    const y0 = Math.max(0, Math.round(top * dpr));
    const y1 = Math.min(height, Math.round((top + rowH) * dpr));
    let x = -1;
    for (let cx = width - 1; cx >= 0 && x < 0; cx--) {
      for (let cy = y0; cy < y1; cy++) if (ink(cx, cy)) { x = cx; break; }
    }
    if (x < 0) return null;
    let lo = y1, hi = y0;
    for (let cx = Math.max(0, x - 1); cx <= Math.min(width - 1, x + 1); cx++) {
      for (let cy = y0; cy < y1; cy++) if (ink(cx, cy)) { lo = Math.min(lo, cy); hi = Math.max(hi, cy); }
    }
    return { x, mid: +((lo + hi) / 2).toFixed(2) };
  });
}, { tops, rowH: PANEL_LAYOUT.rowH, dpr });

// The panel's row tops, in css pixels, straight from its own layout.
const rowTops = () => PANEL_SERIES.map((s, i) => rowTop(i));

// Where the economy's own series says the last sample of a row must land: the
// same two functions the paint uses, so the check reads the panel's geometry
// rather than a second copy of it.
function wantY(rows, i) {
  const s = PANEL_SERIES[i];
  const values = rows.map((r) => (s.use ? r.demand[s.use] : r[s.key]));
  const lo = Math.min(...values), hi = Math.max(...values);
  const last = values[values.length - 1];
  return { y: pointY(rowTop(i), last, lo, hi) * dpr, last, lo, hi };
}

function checkRows(spots, rows, when) {
  expect(spots.length, 'one band per series').toBe(PANEL_SERIES.length);
  for (let i = 0; i < PANEL_SERIES.length; i++) {
    const { y, last, lo, hi } = wantY(rows, i);
    const s = PANEL_SERIES[i];
    const name = `${when} ${s.label}`;
    expect(spots[i], `${name}: the row is painted`).not.toBeNull();
    // The last sample sits at the right end of the row, as the paint puts it.
    expect(spots[i].x, `${name}: the last sample is at the right end`)
      .toBeGreaterThanOrEqual(Math.round((PANEL_W - PANEL_LAYOUT.pad) * dpr) - 2);
    expect(spots[i].mid, `${name}: the last sample (${last} of ${lo}..${hi}) is where the series puts it`)
      .toBeGreaterThan(y - SLACK);
    expect(spots[i].mid, `${name}: the last sample (${last} of ${lo}..${hi}) is where the series puts it`)
      .toBeLessThan(y + SLACK);
  }
}

test('M5-15: the key opens the city history panel on the economy\'s own series', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 30000 });

  // Nothing shows the panel until its key is pressed.
  expect(await panel(page), 'the panel is in the page, closed').toMatchObject({ display: 'none' });

  // The economy's own window, closed game days of it, run ahead the way the
  // capture probe runs any other minutes-long economic swing.
  await page.evaluate((secs) => window.__game.advance(secs), DAYS * DAY_SECS);
  const rows = await page.evaluate(() => window.__game.history().rows);
  expect(rows.length, 'the economy holds its own window').toBeGreaterThan(1);
  expect(new Set(rows.map((r) => r.day)).size, 'the window holds distinct days').toBe(rows.length);

  await page.keyboard.press(PANEL_KEY);
  await frame(page);
  const open = await panel(page);
  expect(open.display, 'the key opens the panel').toBe('block');
  expect(open.w, 'the panel is its own canvas').toBe(PANEL_LAYOUT.w * dpr);
  const spots = await painted(page, rowTops());
  checkRows(spots, rows, 'opened');

  // Still open, the panel paints the live series: two more game days slide the
  // window, and the panel's ink moves with it rather than holding the snapshot
  // the key was pressed on.
  await page.evaluate((secs) => window.__game.advance(secs), 2 * DAY_SECS);
  await frame(page);
  const later = await page.evaluate(() => window.__game.history().rows);
  const moved = await painted(page, rowTops());
  checkRows(moved, later, 'two days later');
  expect(moved.some((s, i) => spots[i] && Math.abs(s.mid - spots[i].mid) >= 2),
    'the panel paints the live economy: its ink moved as the series moved').toBe(true);

  // The second press closes it.
  await page.keyboard.press(PANEL_KEY);
  await frame(page);
  expect((await panel(page)).display, 'the key closes the panel').toBe('none');
});
