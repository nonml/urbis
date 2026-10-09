// M5.T29b (M5-11): the pollution overlay is reachable. M5.T29 taught
// render/overlays.js to shade the field sim/pollution.js puts out, but the ring
// the O key walks is the sim's own OVERLAYS (sim/cityview.js): an overlay named
// nowhere in it is one the player never sees. Node runs the pure sim (law 5) and
// checks the tint's value on five lots against pollutionOf; the browser half
// presses O from off in the built game and walks it to pollution.
import { test, expect } from '@playwright/test';
import { createMap } from '../../src/sim/map.js';
import { createCity, tickZoning } from '../../src/sim/zoning.js';
import { createStreet, tickStreet } from '../../src/sim/street.js';
import { createCityView, OVERLAYS, tickCityView } from '../../src/sim/cityview.js';
import { pollutionOf } from '../../src/sim/pollution.js';
import { overlayValue } from '../../src/render/overlays.js';

// 110 game seconds, the growth m5-overlays.spec.js runs: works lots have broken
// ground and the commute flow has laid an hour out, so both sources stand.
const SEED = 7, DT = 0.05, GROW_SECS = 110;
const FIVE_OF = (list) => [0, 1, 2, 3, 4].map((k) => Math.floor((k * list.length) / 5));

test("M5-11: pollution is the sim's own field on five lots, and seed 7 reads smoke", () => {
  const map = createMap(SEED);
  const city = createCity(SEED, map);
  const street = createStreet(SEED, map);
  const view = createCityView(city, map);
  for (let t = 0; t < GROW_SECS; t += DT) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
    tickCityView(view, city, DT, new Set());
  }
  const ctx = { map, street, dark: () => false };
  const read = (i) => overlayValue('pollution', city, view, i, ctx);
  for (const i of FIVE_OF(city.parcels)) {
    expect(read(i), `lot ${i}`).toBe(pollutionOf(city.parcels[i], city, street));
  }
  expect(Math.max(...city.parcels.map((p, i) => read(i))), 'a lot stands in the smoke').toBeGreaterThan(0);
});

test('M5-11: O pressed from off walks the ring to pollution', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  // The slot pollution sits in, off the sim's own list — the same source the
  // bundle under test was built from.
  const at = OVERLAYS.findIndex((o) => o.id === 'pollution');
  expect(at, 'pollution is named in the ring the O key walks').toBeGreaterThan(0);
  const slot = () => page.evaluate(() => window.__game.cityview.state().overlay);
  expect(await slot(), 'the view opens on off').toBe(0);
  for (let k = 1; k <= at; k++) {
    await page.keyboard.press('o');
    expect(await slot(), `the ${k}th press walks the ring forward`).toBe(k);
  }
});
