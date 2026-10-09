// M5.R1 (docs/ROADMAP.md): the HUD reads cleanly.
//
// The city view's screenshot at 20 s (seed 7) showed the district table painted
// across the status lines at the top left, so neither could be read, and the
// news feed holding four copies of one line. So, checked here:
//
//   1. No two HUD panels cross, at 1280x720 and 1920x1080, in the street view
//      and in the city view — with the panels the game itself puts up: the
//      status lines, the news feed, the mission panel, the city view's palette,
//      the district table, the lot note and the police radio (a live chase puts
//      the radio up, which is the case that used to run the left column into
//      the status lines).
//   2. A news line pushed back to back folds into one line with a count.
//
// Every panel is read from the page as getBoundingClientRect(), so this is the
// layout the player sees and not a number a developer typed.
import { test, expect } from '@playwright/test';

const SIZES = [[1280, 720], [1920, 1080]];
// The line the feed folds: the one the screenshot showed four times.
  const REPEAT = '5 people moved out of the city';
// Game seconds to let the city develop before the frame is measured: long
// enough for lots to break ground and the feed to have something to say.
const SETTLE = 12;

test.setTimeout(600000);

// A frame's worth of rAF: the HUD writes on its own clock, and the news panel
// paints on the frame after the line is pushed.
async function frames(page, n = 2) {
  await page.evaluate((k) => new Promise((resolve) => {
    let left = k;
    const tick = () => (--left > 0 ? requestAnimationFrame(tick) : resolve());
    requestAnimationFrame(tick);
  }), n);
}

async function boot(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 120000 });
  await stepGame(page, SETTLE);
}

// Wait for `secs` of game time: the sim catches up in whole steps however slow
// the rasteriser is, so this is not a wall-clock wait.
async function stepGame(page, secs) {
  const target = await page.evaluate((s) => window.__game.step() + s * 20, secs);
  await page.waitForFunction((n) => window.__game.step() >= n, target, {
    polling: 'raf', timeout: 300000,
  });
}

// Every HUD panel the frame is showing, as its box: the fixed-position elements
// hung on the body. A full-screen backdrop (the title, the pause menu) is not a
// panel, and a display:none element is not on screen.
async function readPanels(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.body.children) {
      if (el.tagName === 'CANVAS') continue;
      const style = getComputedStyle(el);
      if (style.position !== 'fixed' || style.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.width >= innerWidth - 2 && r.height >= innerHeight - 2) continue;
      out.push({ id: el.id || el.tagName, x: r.x, y: r.y, w: r.width, h: r.height });
    }
    return out;
  });
}

// The pairs of panels whose boxes cross. Panels stacked edge to edge share a
// line and do not cross, so a stack is not a failure: a hair of overlap (a
// rounding of a fractional box) is not either, a panel drawn over another's
// text is.
function crossings(panels) {
  const out = [];
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const a = panels[i], b = panels[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 0.5 && oy > 0.5) {
        out.push(`${a.id} over ${b.id} by ${ox.toFixed(1)}x${oy.toFixed(1)} px`);
      }
    }
  }
  return out;
}

// The check, stated as one assertion with every crossing named.
async function expectNoCrossing(page, where) {
  const panels = await readPanels(page);
  const bad = crossings(panels);
  expect(new Set(panels.map((p) => p.id)).size, `${where}: panels found`).toBeGreaterThan(3);
  expect(bad, `${where}: ${panels.map((p) => `${p.id}@${Math.round(p.x)},${Math.round(p.y)}`).join(' ')}`)
    .toEqual([]);
}

async function cityView(page) {
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 120000 });
  // A frame, so the panels the overview lays out have settled where they stand.
  await frames(page);
}

async function streetView(page) {
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.__game.cityview.state().mode !== 'city', null, {
    polling: 'raf', timeout: 120000,
  });
  await frames(page);
}

// A live chase: the police radio speaks, which is the panel that used to be
// stacked over the status lines in the city view.
async function chase(page) {
  await page.evaluate(() => window.__game.police.tier(2));
  await stepGame(page, 4);
  const rows = await page.evaluate(() => {
    const el = document.getElementById('dispatch');
    return el ? [...el.children].filter((r) => getComputedStyle(r).display !== 'none').length : 0;
  });
  expect(rows, 'the police radio is on screen').toBeGreaterThan(0);
}

test('M5.R1: no two HUD panels cross, in either view, at either size', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await boot(page, ...SIZES[0]);

  // 1280x720: the street, then the overview, then the overview with the radio.
  await expectNoCrossing(page, '1280x720 street');
  await cityView(page);
  await expectNoCrossing(page, '1280x720 city');
  await chase(page);
  await expectNoCrossing(page, '1280x720 city, radio');

  // 1920x1080, the other way round: the overview first, then the street.
  await page.setViewportSize({ width: SIZES[1][0], height: SIZES[1][1] });
  await frames(page);
  await chase(page);
  await expectNoCrossing(page, '1920x1080 city, radio');
  await streetView(page);
  await expectNoCrossing(page, '1920x1080 street');
  await cityView(page);
  await expectNoCrossing(page, '1920x1080 city');

  expect(errors, 'no page error').toEqual([]);
});

test('M5.R1: a news line repeated back to back folds into one line with a count', async ({ page }) => {
  await boot(page, 1280, 720);
  // The feed's own push, four times in a row, as a city that keeps saying the
  // same thing does. The sim is held still first, so nothing else says
  // anything between the pushes and the read.
  await page.evaluate(() => window.__game.pause());
  await page.evaluate((line) => {
    for (let i = 0; i < 4; i++) window.__game.pushNews(line);
  }, REPEAT);
  await frames(page);

  const rows = await page.evaluate(() =>
    [...document.getElementById('news').children].map((r) => r.textContent));
  expect(rows, 'four of one line spend one of the feed\'s four slots').toEqual([`${REPEAT} ×4`]);
  // The probe reads the same feed the panel draws.
  expect(await page.evaluate(() => window.__game.news())).toEqual([`${REPEAT} ×4`]);

  // A different line after it is its own line, with no count of its own.
  await page.evaluate(() => window.__game.pushNews('Power back in the south district'));
  await frames(page);
  const after = await page.evaluate(() =>
    [...document.getElementById('news').children].map((r) => r.textContent));
  expect(after.length, 'the repeated line is still one line').toBe(2);
  expect(after[0]).toMatch(/^5 people moved out of the city ×\d+$/);
  expect(after[1]).toBe('Power back in the south district');
});
