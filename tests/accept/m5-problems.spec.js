// M5.T34 (M5-16, docs/ROADMAP.md): problems show. In the city view every
// held-back building carries an icon for its first cause — no road, no power,
// no service in reach, no demand — the icon layer is one pooled draw, and a
// click on an icon opens the reason card. M12's causes join the same table.
//
// The Node half runs the pure sim and the cause table (law 5): a generated
// city, ticked the way main.js ticks it, sampled at 5 held-back buildings,
// then a clinic placed to prove the services' reach joins the same table. The
// browser half drives the built game: it measures the icon layer's draw rows
// with the draw ledger, picks an icon under its own pixel, clicks it and reads
// the reason card.
import { test, expect } from '@playwright/test';
import { createMap } from '../../src/sim/map.js';
import { createStreet, isDark, tickStreet } from '../../src/sim/street.js';
import { STAGE, createCity, tickZoning } from '../../src/sim/zoning.js';
import { placeService, serviceReach } from '../../src/sim/ops.js';
import {
  CAUSE, PROBLEM, heldBack, pinDemand, problemList, problemOf,
} from '../../src/sim/decline.js';
import { ICON_LIFT } from '../../src/render/problems.js';

const SEED = 7, DT = 0.05;

function boot() {
  const map = createMap(SEED);
  const city = createCity(SEED, map);
  const street = createStreet(SEED, map);
  return { map, city, street };
}

function run({ city, street }, secs) {
  for (let t = 0; t < secs; t += DT) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
  }
}

// A city with buildings standing and then held between the bands: the market
// is too thin to build and too alive to shed, so every started building stalls
// with a cause decline.js records.
function stalled() {
  const world = boot();
  ['res', 'com', 'ind'].forEach((use) => pinDemand(world.city, use, 0.75));
  run(world, 90);
  ['res', 'com', 'ind'].forEach((use) => pinDemand(world.city, use, 0.35));
  run(world, 5);
  return world;
}

test('M5-16: held-back buildings and their first causes are decline.js\'s own', () => {
  const world = stalled();
  const held = world.city.parcels.filter(heldBack);
  expect(held.length).toBeGreaterThanOrEqual(5);
  const sampled = held.slice(0, 5);
  for (const p of sampled) {
    const cause = problemOf(p, { dark: isDark(world.street, p.powerZone) });
    expect(Object.keys(PROBLEM), 'every first cause has a label and a mark').toContain(cause);
    expect(cause, 'the icon cause is the cause the sim recorded').toBe(p.why);
  }

  // No road and no power outrank the market, exactly as decline.js judges them.
  expect(problemOf({ why: CAUSE.NO_ROAD })).toBe(CAUSE.NO_ROAD);
  expect(problemOf({ why: CAUSE.NO_POWER }, { dark: true })).toBe(CAUSE.NO_POWER);
  expect(problemOf({ why: CAUSE.MARKET_THIN }, { served: false })).toBe(CAUSE.NO_SERVICE);

  // M12's causes join the same table: their lines are already written.
  expect(PROBLEM[CAUSE.NO_WATER].label).toBe('no water');
  expect(PROBLEM[CAUSE.NO_COLLECTION].label).toBe('no collection');
});

test('M5-16: one list entry per held-back building, the icon over each one', () => {
  const world = stalled();
  const list = problemList(world.city, { dark: (zone) => isDark(world.street, zone) });
  const held = world.city.parcels.filter(heldBack);
  expect(list.map((e) => e.i).sort((a, b) => a - b)).toEqual(
    held.map((p) => world.city.parcels.indexOf(p)).sort((a, b) => a - b));
  for (const entry of list) {
    expect(Object.keys(PROBLEM)).toContain(entry.cause);
  }
});

test('M5-16: a service the city runs holds back every parcel its reach misses', () => {
  const world = boot();
  ['res', 'com', 'ind'].forEach((use) => pinDemand(world.city, use, 0.75));
  run(world, 90);
  const site = world.city.parcels.find((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY);
  expect(site, 'the seed leaves land for a clinic').toBeTruthy();
  const placed = placeService(world.map, site, 'clinic');
  expect(placed).toBeTruthy();
  // Stop the boom so buildings are held back and enter the problem list.
  ['res', 'com', 'ind'].forEach((use) => pinDemand(world.city, use, 0.35));
  run(world, 5);
  const reach = serviceReach(world.city.parcels, 'clinic');
  const buildings = world.city.parcels.filter((p) => p.kind === 'lot' && p.stage >= STAGE.LOW);
  expect(buildings.length).toBeGreaterThan(1);
  const away = (p) => Math.hypot(p.x - site.x, p.z - site.z);
  const near = buildings.reduce((a, b) => (away(b) < away(a) ? b : a));
  const far = buildings.reduce((a, b) => (away(b) > away(a) ? b : a));
  expect(away(near), 'a building inside the catchment').toBeLessThan(120);
  expect(away(far), 'a building outside it').toBeGreaterThan(120);
  expect(reach.has(near)).toBe(true);
  expect(reach.has(far)).toBe(false);

  const list = problemList(world.city);
  const causeOf = (p) => list.find((e) => e.i === world.city.parcels.indexOf(p))?.cause ?? null;
  expect(causeOf(near)).not.toBe(CAUSE.NO_SERVICE);
  expect(causeOf(far)).toBe(CAUSE.NO_SERVICE);
});

test('M5-16: in the city view, one draw carries every icon and a click opens its card', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/?capture=1&gen=1&seed=73');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  // Hold the market between the bands so buildings stall with a recorded cause.
  await page.evaluate(() => {
    for (const use of ['res', 'com', 'ind']) window.__game.zoning.pin(use, 0.75);
    window.__game.zoning.skip(90);
    for (const use of ['res', 'com', 'ind']) window.__game.zoning.pin(use, 0.35);
    window.__game.zoning.skip(5);
  });
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 30000 });

  const parcels = await page.evaluate(() => {
    const lots = window.__game.cityview.lots();
    const dark = window.__game.dark();
    return window.__game.city().parcels.map((p, i) => ({ ...p, ...lots[i], dark: dark[p.zone] }));
  });
  const held = parcels.filter((p) => p.kind === 'lot' && p.zoned !== null && p.use === p.zoned
    && (p.building || p.stage !== 'EMPTY') && p.trend !== 'growing' && p.stage !== 'HIGH'
    && PROBLEM[p.why]);
  expect(held.length, 'the stalled city is full of held-back buildings').toBeGreaterThanOrEqual(5);

  // The ledger names every draw of one whole frame: the icons are one row.
  const frames = await page.evaluate(() => window.__game.ledger(1));
  const rows = frames[0].filter((r) => r.name === 'problems');
  expect(rows.length, 'all the icons cost exactly one draw').toBe(1);
  expect(rows[0].instances, 'every held-back building has an icon').toBe(held.length);

  // Click each held-back building's own icon. A nearer icon can cover one on
  // screen, so a click that opens another lot's card is that lot's own check
  // instead; five buildings whose own icon was hit are the sampled five.
  const sampled = [];
  for (const p of held) {
    await page.evaluate((q) => window.__game.cityview.aim({ x: q.x, z: q.z, reach: 120 }), p);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const at = await page.evaluate((q) => window.__game.screenOf(q.x, q.y, q.z),
      { x: p.x, y: p.height + ICON_LIFT, z: p.z });
    expect(at.x).toBeGreaterThan(0);
    expect(at.x).toBeLessThan(960);
    expect(at.y).toBeGreaterThan(0);
    expect(at.y).toBeLessThan(540);
    const over = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [at.x, at.y]);
    expect(over, 'the icon is over the canvas, not the palette').toBe('scene');

    await page.mouse.click(at.x, at.y);
    // The card is DOM written by the frame's own update: let the frame run.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const card = await page.evaluate(() => {
      const el = document.getElementById('lotcard');
      return {
        shown: getComputedStyle(el).display !== 'none', cause: el.dataset.cause ?? '',
        lot: el.dataset.lot ?? '', text: el.textContent ?? '',
      };
    });
    expect(card.shown, `a click on the icon over lot ${parcels.indexOf(p)} opens a reason card`).toBe(true);
    const hit = parcels[Number(card.lot)];
    const cause = problemOf(hit, { dark: hit.dark });
    expect(card.cause, 'the card shows the clicked building\'s first cause').toBe(cause);
    expect(card.text.toLowerCase()).toContain(PROBLEM[cause].label);
    const lots = await page.evaluate(() => window.__game.cityview.lots());
    expect(lots[Number(card.lot)].zoned, 'the icon click paints nothing').toBe(hit.zoned);
    if (Number(card.lot) === parcels.indexOf(p)) sampled.push(p);
    if (sampled.length === 5) break;
  }
  expect(sampled.length, 'five buildings answered from their own icon').toBe(5);
});
