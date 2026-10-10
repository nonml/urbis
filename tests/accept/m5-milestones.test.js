// M5.T30 (M5-12, docs/ROADMAP.md): milestones. A new game opens with the roads,
// the zone brushes, the bulldozer, the substation and the park; the police
// station and the clinic open at the first population tier and the fire station,
// the school and the other road types at the second. A tool whose tier the city
// has not reached refuses with "unlocks at N people", the city view always
// shows the population and the next tier, and reaching a tier says on screen
// what it unlocked. A scripted player who zones every free lot reaches the first
// tier within 20 game minutes on all five seeds.
//
// Every check is the player's own: the palette, a real click on a lot, the card
// under the cursor, and the game's own census for the population — the tiers
// themselves are read from sim/milestones.js rather than written a second time.
import { test, expect } from '@playwright/test';
import { TIERS } from '../../src/sim/milestones.js';
import { TOOLS } from '../../src/sim/cityview.js';

// "Five seeds" always means 7, 11, 22, 33 and 73, generated (docs/ROADMAP.md).
const SEEDS = [7, 11, 22, 33, 73];
const PICK_Y = 1.2;              // half the city view's 2.4 m pick floor
const MINUTES = 20;              // the criterion's window, in game minutes
const CHUNK = 8;                 // game seconds between reads: under the banner's life
const FIRST = TIERS[0];
const SECOND = TIERS[1];
const SERVICE = SECOND.tools.find((id) => TOOLS[id].type);   // a service of the second tier
const ROAD = SECOND.tools.find((id) => TOOLS[id].drag);      // a road type of the second tier
// What a new game opens with, and every tool a tier gates.
const OPEN = ['road', 'res', 'com', 'ind', 'unzone', 'bulldoze', 'substation', 'park'];
const GATED = [...FIRST.tools, ...SECOND.tools];
// The scripted player runs the sim twenty minutes ahead on five seeds: seconds
// of wall time each, but a browser test is a browser test.
test.setTimeout(900000);
// The frame the shots are taken at (docs/shots): the palette with its books,
// demand bars and fourteen tool rows is taller than a 960x540 window, and a
// click aimed at the middle of the overview would land on it.
test.use({ viewport: { width: 1280, height: 720 } });

const cardText = (page) => page.evaluate(() => document.getElementById('lotcard').textContent);
const banner = (page) => page.evaluate(() => {
  const el = document.getElementById('milestone-banner');
  return { text: el?.textContent ?? '', tier: el?.dataset.tier ?? '', on: el?.style.display ?? '' };
});
const state = (page) => page.evaluate(() => window.__game.cityview.state());
const lots = (page) => page.evaluate(() => window.__game.cityview.lots());
const rowOf = (page, id) => page.evaluate((k) => {
  const el = document.getElementById(`tool-${k}`);
  return el ? { lock: el.dataset.lock, title: el.title, opacity: el.style.opacity } : null;
}, id);

// The city's own count of its people, read after two frames so the tick an
// advance ended on has run tickPeople's pass with it.
const population = (page) => page.evaluate(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return window.__game.census().residents;
});

// Z into the overview and wait for the rise, the way a player gets there.
async function boot(page, seed) {
  await page.goto(`/?capture=1&gen=1&seed=${seed}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.keyboard.press('z');
  await page.waitForFunction(() => window.__game.cityview.state().lift >= 1, null,
    { polling: 'raf', timeout: 30000 });
}

// Put the cursor on lot `index`, with the overview aimed at it from `reach`
// metres out: the game's own projection, so the click lands where the game drew
// the lot. Two frames, so the hover the view reads has settled on it. Returns
// null when the palette sits over that pixel, so the caller can re-aim.
async function hoverLot(page, index, reach) {
  await page.evaluate(([i, r]) => {
    const p = window.__game.city().parcels[i];
    window.__game.cityview.aim({ x: p.x, z: p.z, tilt: 1.25, reach: r });
  }, [index, reach]);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const pt = await page.evaluate((i) => {
    const ndc = window.__game.cityview.screen(i);
    return { x: (ndc.x * 0.5 + 0.5) * window.innerWidth, y: (0.5 - ndc.y * 0.5) * window.innerHeight };
  }, index);
  const onCanvas = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.id === 'scene', pt);
  if (!onCanvas) return null;
  await page.mouse.move(pt.x, pt.y);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  return pt;
}

// The scripted player's zoning: aim at the lot, click where it stands, and say
// whether the lot took it. A pixel the palette covers, or a pick a building
// hides, is re-aimed — further out, and then from the other side — the way a
// player would orbit rather than give up.
async function zoneLot(page, index, use) {
  for (const reach of [70, 110, 160]) {
    await page.keyboard.press('r');
    const pt = await hoverLot(page, index, reach);
    if (!pt) continue;
    await page.mouse.down();
    await page.mouse.up();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    if (await page.evaluate(([i, u]) => window.__game.cityview.lots()[i].zoned === u, [index, use])) return true;
  }
  return false;
}

// A road under the cursor, aimed at from the map's own junctions: the hold a
// road tool reads (view.road), or null when no pick finds a road.
async function hoverRoad(page) {
  const junctions = await page.evaluate(() => window.__game.city().furniture?.junctions ?? []);
  for (const j of junctions) {
    await page.evaluate((p) => window.__game.cityview.aim({ x: p.x, z: p.z, tilt: 1.25, reach: 60 }), j);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const pt = await page.evaluate(([p, y]) => window.__game.screenOf(p.x, y, p.z), [j, PICK_Y]);
    await page.mouse.move(pt.x, pt.y);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const road = await page.evaluate(() => window.__game.cityview.state().road ?? null);
    if (road) return { at: pt, road };
  }
  return null;
}

test('M5-12: a new game opens with roads, zoning, bulldoze, substation and park', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const seed of SEEDS) {
    await boot(page, seed);
    const pop = await population(page);
    for (const id of OPEN) {
      const row = await rowOf(page, id);
      expect(row, `seed ${seed}: the ${id} tool is in the palette`).toBeTruthy();
      expect(row.lock, `seed ${seed}: the ${id} tool opens with the city`).toBe('');
      expect(row.title, `seed ${seed}: the ${id} row names what it does`).toContain(TOOLS[id].name);
    }
    // Every tool a tier gates is either open — the city already holds the
    // people — or names its tier. The second tier stands above every opening
    // population, so its tools are locked on all five seeds and say so.
    for (const id of GATED) {
      const row = await rowOf(page, id);
      expect(row, `seed ${seed}: the ${id} tool is in the palette`).toBeTruthy();
      const tier = [FIRST, SECOND].find((t) => t.tools.includes(id));
      const want = pop >= tier.people ? '' : `${TOOLS[id].name} unlocks at ${tier.people} people`;
      expect(row.lock, `seed ${seed}: the ${id} row at ${pop} people`).toBe(want);
      if (want) {
        expect(row.title, `seed ${seed}: the ${id} row names its tier`).toContain(want);
        expect(Number(row.opacity), `seed ${seed}: the ${id} row stands dimmed`).toBeLessThan(1);
      }
    }
    for (const id of SECOND.tools) {
      expect((await rowOf(page, id)).lock, `seed ${seed}: the second tier is closed at ${pop} people`)
        .toContain(`unlocks at ${SECOND.people} people`);
    }
    console.log(`seed ${seed}: opens at ${pop} people`);
  }
  expect(errors).toEqual([]);
});

test('M5-12: a locked tool refuses with "unlocks at N people"', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const seed = SEEDS[0];
  await boot(page, seed);
  const free = await page.evaluate(() => window.__game.freeLots().map((l) => ({ index: l.index, x: l.x, z: l.z })));
  expect(free.length, `seed ${seed}: the city left land to build on`).toBeGreaterThanOrEqual(3);

  // The service of the second tier: the card refuses before the click, and the
  // click changes nothing.
  await page.click(`#tool-${SERVICE}`);
  expect((await state(page)).brush, 'the palette picks the locked service up').toBe(SERVICE);
  let aimed = null;
  for (const reach of [70, 110, 160]) {
    aimed = await hoverLot(page, free[0].index, reach);
    if (aimed) break;
  }
  expect(aimed, 'the cursor stands on a lot the palette is not over').toBeTruthy();
  expect(await cardText(page), 'the card refuses the locked service')
    .toContain(`${TOOLS[SERVICE].name} unlocks at ${SECOND.people} people`);
  await page.mouse.down();
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  expect(await cardText(page), 'the card still says why').toContain(`unlocks at ${SECOND.people} people`);
  expect((await lots(page))[free[0].index], 'the refused service left the lot open land')
    .toMatchObject({ zoned: null, stage: 'EMPTY' });

  // The road type of the second tier: the card refuses the change it offers,
  // and the click leaves the road standing as the street it is.
  await page.click(`#tool-${ROAD}`);
  const held = await hoverRoad(page);
  expect(held, `seed ${seed}: a road stands under the cursor`).toBeTruthy();
  expect(held.road.edge.lanes, 'the road is a street to begin with').toBe(2);
  expect(await cardText(page), 'the card refuses the locked road type')
    .toContain(`${TOOLS[ROAD].name} unlocks at ${SECOND.people} people`);
  await page.mouse.down();
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  const after = await hoverRoad(page);
  expect(after.road.edge.lanes, 'the refused click left the road a street').toBe(2);

  // And the drag: pressing a node starts one, its card names the tier it waits
  // on, and the release lays nothing — the lamp rig the street draws from, the
  // one thing a laid road adds, is exactly as it was.
  const lamps = await page.evaluate(() => window.__game.drawnLamps());
  await page.mouse.move(held.at.x, held.at.y);
  await page.mouse.down();
  await page.mouse.move(held.at.x + 40, held.at.y);
  expect(await cardText(page), 'the drag card names the tier it waits on')
    .toContain(`unlocks at ${SECOND.people} people`);
  await page.mouse.up();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
  expect((await state(page)).drag, 'the refused drag is dropped').toBe(null);
  expect(await page.evaluate(() => window.__game.drawnLamps()), 'the refused drag laid no road').toBe(lamps);
  expect(errors).toEqual([]);
});

test('M5-12: the city view always shows the population and the next tier', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const seed of SEEDS) {
    await boot(page, seed);
    const pop = await population(page);
    const line = await page.evaluate(() => {
      const el = document.getElementById('milestone');
      return { pop: el.dataset.pop, next: el.dataset.next, tier: el.dataset.tier, text: el.textContent };
    });
    expect(Number(line.pop), `seed ${seed}: the line shows the city's own census`).toBe(pop);
    const tier = TIERS.filter((t) => t.people <= pop).length - 1;
    expect(Number(line.tier), `seed ${seed}: the line names the tier the city stands on`).toBe(tier);
    const want = TIERS[tier + 1];
    expect(Number(line.next), `seed ${seed}: the line names the next tier`).toBe(want ? want.people : 0);
    if (want) {
      expect(line.text, `seed ${seed}: the line says how far the next tier is`)
        .toContain(`${want.people} people`);
      // The tools the next tier opens are named where the player meets them:
      // on their own palette rows, dimmed and saying what they wait for.
      for (const id of want.tools) {
        const row = await rowOf(page, id);
        expect(row.lock, `seed ${seed}: the ${TOOLS[id].name} row names its tier`)
          .toContain(`unlocks at ${want.people} people`);
      }
    }
    console.log(`seed ${seed}: ${line.text}`);
  }
  expect(errors).toEqual([]);
});

test('M5-12: the scripted player reaches the first tier inside 20 game minutes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  for (const seed of SEEDS) {
    await boot(page, seed);
    const free = await page.evaluate(() => window.__game.freeLots().map((l) => l.index));
    expect(free.length, `seed ${seed}: the city left land to build on`).toBeGreaterThanOrEqual(3);
    const opening = await population(page);
    // The scripted player zones every free lot, and does nothing else.
    for (const index of free) {
      expect(await zoneLot(page, index, 'res'), `seed ${seed}: lot ${index} was zoned for homes`).toBe(true);
    }
    const zoned = await population(page);
    let reached = null;
    let pop = zoned;
    for (let chunk = 1; chunk <= (MINUTES * 60) / CHUNK; chunk++) {
      await page.evaluate((s) => window.__game.cityview.advance(s), CHUNK);
      pop = await population(page);
      if (reached === null && (await state(page)).tier >= 0) reached = (chunk * CHUNK) / 60;
    }
    expect(reached, `seed ${seed}: the first tier (${FIRST.people} people) came inside ${MINUTES} minutes`)
      .not.toBe(null);
    expect(reached, `seed ${seed}: the first tier came inside the window`).toBeLessThanOrEqual(MINUTES);
    console.log(`seed ${seed}: ${opening} people at the opening, ${zoned} once zoned, ${pop} after `
      + `${MINUTES} minutes — the first tier at ${reached} minutes`);
  }
  expect(errors).toEqual([]);
});

test('M5-12: reaching a tier says on screen what it unlocked', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Seed 7's opening market thins before the player's lots come up: the census
  // falls under the first tier and climbs back over it, so the tier is reached
  // in play rather than at the opening.
  const seed = SEEDS[0];
  await boot(page, seed);
  const free = await page.evaluate(() => window.__game.freeLots().map((l) => l.index));
  for (const index of free) expect(await zoneLot(page, index, 'res'), `lot ${index} was zoned`).toBe(true);

  let said = null;
  for (let chunk = 1; chunk <= (MINUTES * 60) / CHUNK && said === null; chunk++) {
    await page.evaluate((s) => window.__game.cityview.advance(s), CHUNK);
    const shown = await banner(page);
    if (shown.on === 'block' && shown.tier !== '') {
      expect(Number(shown.tier), 'the banner names the tier reached').toBe(TIERS.indexOf(FIRST));
      expect(shown.text, 'the banner names the tier').toContain('TIER 1');
      for (const id of FIRST.tools) {
        expect(shown.text, `the banner says the ${TOOLS[id].name} it unlocked`).toContain(TOOLS[id].name);
      }
      said = shown.text;
    }
  }
  expect(said, `seed ${seed}: a tier reached in play said what it unlocked`).toBeTruthy();
  // And the screen still carries the population and the tier it stands on.
  expect(Number(await page.evaluate(() => document.getElementById('milestone').dataset.tier)),
    'the city stands on the tier it reached').toBe(0);
  expect(errors).toEqual([]);
});
