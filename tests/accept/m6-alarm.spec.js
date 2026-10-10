// M6.T19 / M6-4 (docs/ROADMAP.md M6, task M6.T19): the fire alarm, fired the way
// a player does. Aimed at a building, the real H key sets M5's alarm off
// (sim/alarms.js raiseAlarm) and the building empties onto the pavement; its
// shop takes nobody back in for the alarm's whole life, then opens again.
//
// Everything here is read off the running game (seed 7, &gen=1): the morning
// rush walks the shop's staff in through commute.js's own door, H fires through
// game/input.js's own onFire, and the walkers are street.npcs — the bodies the
// renderer draws, read through the game's own probe. M5-5
// (tests/accept/m5-fire.test.js) pins the alarm's two minutes and the station
// that halves it; this file is what the street does while one rings, and that
// nothing outside the one building changes.
import { test, expect } from '@playwright/test';
import { waitGame } from './lib/input.js';

const SEED = 7;
// The frame pin M0.T3 gives a check: 8 whole steps a frame, so a two-minute
// alarm costs fifteen seconds of wall clock instead of two minutes of it.
const SPEED = 8;
// The morning rush (sim/commute.js RUSH_AM), held there by ?capture's clock:
// the hour the staff walk to their shop and stay for a shift.
const RUSH_HOUR = 8;
// The alarm's own life (sim/alarms.js ALARM_SECS): the two minutes the plan
// names a shut shop for.
const ALARM_SECS = 120;
// A building's own walkers stand on its doorstep line — walkers.js's WALK_OFF
// each side of the street it fronts — this far of the door across the road, and
// this far of it along the street. PAVEMENT is how far out on the pavement they
// stay once the alarm puts them there.
const STRIP = 11, ALONG = 2, PAVEMENT = 45;
// The name the registry gives a standing lot's building (sim/hackables.js).
const NAMES = { res: 'APARTMENTS', com: 'OFFICES', ind: 'WORKS' };

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const walkers = async (page) => (await page.evaluate(() => window.__game.scorecard.npcs()))
  .map((n, i) => ({ ...n, i }));
const clock = (page) => page.evaluate(() => window.__game.step() * 0.05);
// The busiest doorstep in `list`: where the most of them stand.
function crowdAt(list) {
  let door = null, most = 0;
  for (const w of list) {
    const near = list.filter((m) => dist(m, w) < 6).length;
    if (near > most) { most = near; door = w; }
  }
  return { door, most };
}

test('M6.T19: H at a building empties it onto the pavement and shuts its shop for the alarm\'s two minutes', async ({ page }) => {
  test.setTimeout(400000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}&speed=${SPEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });

  // The morning rush: the staff walk in and hold for their shift, until a
  // doorstep carries three of its own.
  await page.evaluate((h) => window.__game.setHour(h), RUSH_HOUR);
  await page.waitForFunction(() => {
    const held = window.__game.scorecard.npcs().filter((n) => n.out === false);
    return held.some((w) => held.filter((h) => Math.hypot(h.x - w.x, h.z - w.z) < 6).length >= 3);
  }, null, { polling: 'raf', timeout: 240000 });
  const hidden = await walkers(page);
  const { door, most } = crowdAt(hidden.filter((n) => !n.out));
  expect(most, 'a building with its staff inside').toBeGreaterThan(2);
  // The building that door belongs to: the lot its doorstep faces.
  const prints = await page.evaluate(() => window.__game.footprints());
  const lots = await page.evaluate(() => window.__game.city().parcels);
  const near = [];
  for (let i = 0; i < lots.length; i++) {
    const p = prints.find((q) => q.name === `lot:${i}`);
    if (p && dist(p, door) <= Math.max(p.w, p.d) / 2 + 6) near.push({ p, i });
  }
  near.sort((a, b) => dist(a.p, door) - dist(b.p, door));
  const hit = near.find((c) => ['LOW', 'MID', 'HIGH'].includes(lots[c.i].stage));
  expect(hit, 'the door belongs to a standing building').toBeTruthy();
  const { p: f, i } = hit, lot = lots[i];
  expect(['com', 'ind'], `a shop with staff in it (${lot.use})`).toContain(lot.use);
  // The door strip: its own line of pavement, both sides of the street.
  const reach = Math.hypot(f.x - door.x, f.z - door.z);
  const nx = (f.x - door.x) / reach, nz = (f.z - door.z) / reach;
  const strip = (n) => Math.abs((n.x - door.x) * nx + (n.z - door.z) * nz) < STRIP
    && Math.abs((n.x - door.x) * -nz + (n.z - door.z) * nx) < ALONG;
  const mine = hidden.filter((n) => !n.out && strip(n));
  expect(mine.length, 'the people inside the building').toBeGreaterThan(2);

  // A stand on the street the door opens onto — a little along the frontage, so
  // nothing on the kerb is in the cone — facing it: the game's own aim picks
  // that building there, and the key fires what the aim holds.
  const want = `${NAMES[lot.use]} · ₡1`;
  let stood = null;
  for (const along of [6, -6, 9, -9, 12, 4, -4]) {
    for (const off of [0, 2, -2, 4, 6]) {
      const px = +(door.x + nx * off - nz * along).toFixed(2);
      const pz = +(door.z + nz * off + nx * along).toFixed(2);
      if (prints.some((q) => Math.abs(q.x - px) < q.w / 2 + 0.2 && Math.abs(q.z - pz) < q.d / 2 + 0.2)) continue;
      await page.evaluate(([x, z, y]) => window.__game.pose(x, z, y),
        [px, pz, Math.atan2(f.x - px, f.z - pz)]);
      await waitGame(page, 0.4);
      const aim = await page.evaluate(() => {
        const el = document.getElementById('aim');
        return el && el.style.display === 'block' ? el.textContent : null;
      });
      if (aim === want) { stood = { px, pz }; break; }
    }
    if (stood) break;
  }
  expect(stood, `a stand with the ${lot.use} building aimed at`).toBeTruthy();

  await page.keyboard.press('h');
  await waitGame(page, 1);
  const now = await walkers(page);
  const out = now.filter((n) => mine.some((m) => m.i === n.i));
  expect(out.every((n) => n.out), 'H empties the building: everyone inside is out').toBe(true);
  expect(out.every((n) => dist(n, door) < PAVEMENT), 'and they are on the pavement outside its door').toBe(true);
  const left = now.filter((n) => n.out && hidden.some((h) => h.i === n.i && !h.out)).map((n) => n.i);
  expect([...left].sort(), 'the only people who left are the building\'s own (M4-5)')
    .toEqual(mine.map((m) => m.i).sort());

  // The shop is shut for the alarm's whole life, and opens again once it clears.
  const t0 = await clock(page);
  const inside = (list) => list.filter((n) => !n.out && strip(n)).length;
  let opened = -1;
  for (let t = 0; t < ALARM_SECS + 120 && opened < 0; t += 5) {
    await waitGame(page, 5);
    const list = await walkers(page);
    if (inside(list) > 0) opened = await clock(page) - t0;
  }
  expect(opened, 'the shop takes nobody in for the alarm\'s two minutes')
    .toBeGreaterThan(ALARM_SECS - 12);
  expect(opened, 'and opens again once the alarm has cleared').toBeLessThan(ALARM_SECS + 120);
  expect(inside(await walkers(page)), 'the shop has its staff back').toBeGreaterThan(0);

  // The hold menu lists the building's own hack, and fires it: it rings again.
  await page.keyboard.down('h');
  await page.waitForFunction(() => document.getElementById('hackmenu')?.style.display === 'block',
    null, { polling: 'raf', timeout: 20000 });
  await page.keyboard.up('h');
  expect(await page.evaluate(() => document.getElementById('hackmenu').textContent),
    'the menu lists the building\'s own hack').toContain('FIRE ALARM · ₡1');
  await page.keyboard.press('Enter');
  await waitGame(page, 1);
  expect(inside(await walkers(page)), 'Enter on it rings the alarm again and empties the shop').toBe(0);
  expect(errors, 'no page error on the way').toEqual([]);
});
