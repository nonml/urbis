// M6.T3 / M6-4 (docs/ROADMAP.md, task M6.T3): fire and menu. One key fires the
// aimed thing's default hack; holding the key opens a menu of its hacks.
//
// The check reaches the feature the way a player does: __game.pose stands the
// body on a spot the sim itself says aims at the thing, real key events tap and
// hold the hack key, and the sim's own zone state with the HUD's own panels say
// what happened. The worker computes the stands from the same map, city and
// street the game boots, so no pose here is a number tuned to today's map.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { waitGame } from './lib/input.js';

const FILE = fileURLToPath(import.meta.url);
const SEED = 7;
const CHOICE = 'ALL-GREEN', OTHER = 'BOLLARDS';

if (process.argv[2] === '--worker') {
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  const { WALK_BOUNDS } = await import('../../src/sim/world.js');
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet, districtAt } = await import('../../src/sim/street.js');
  const { createHackables, hackablesNear, aimTarget, AIM_COS } = await import('../../src/sim/hackables.js');

  const map = createMap(SEED);
  const city = createCity(SEED, map);
  const street = createStreet(SEED, map);
  const reg = createHackables({ map, city, street });
  const inWalk = (x, z) => x > WALK_BOUNDS.minX + 2 && x < WALK_BOUNDS.maxX - 2
    && z > WALK_BOUNDS.minZ + 2 && z < WALK_BOUNDS.maxZ - 2;
  const solid = (x, z) => map.parcels.some((p) => p.stage >= STAGE.LOW
    && Math.abs(x - p.x) <= p.w / 2 + 0.7 && Math.abs(z - p.z) <= p.d / 2 + 0.7);

  // A stand for one registered thing: reachable, clear of the buildings, facing
  // it — and the aim picks that thing from the player and from up to one arm in
  // front of them (the follow cam's arm shortens at a wall, which leaves the
  // recovered body that much ahead), with the next thing in the cone far enough
  // off that a walker cannot steal the pick.
  function stand(target) {
    for (const r of [4, 5, 6, 8, 10, 13, 16, 20]) {
      for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const px = target.x + Math.cos(ang) * r, pz = target.z + Math.sin(ang) * r;
        if (!inWalk(px, pz) || solid(px, pz)) continue;
        const yaw = Math.atan2(target.x - px, target.z - pz);
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const pick = (ox, oz) => aimTarget(reg, ox, oz, fx, fz)?.entry ?? null;
        if (pick(px, pz) !== target) continue;
        if ([0, 1.5, 3, 4.4].some((fwd) => pick(px + fx * fwd, pz + fz * fwd) !== target)) continue;
        const next = hackablesNear(reg, px, pz, 40).filter(({ entry }) => entry !== target
          && ((entry.x - px) * fx + (entry.z - pz) * fz)
          / Math.max(Math.hypot(entry.x - px, entry.z - pz), 0.01) >= AIM_COS);
        const gap = next.length ? Math.min(...next.map((n) => n.dist)) : 99;
        if (gap < Math.max(10, r * 1.6)) continue;
        return { px: +px.toFixed(2), pz: +pz.toFixed(2), yaw: +yaw.toFixed(3), r, gap: +gap.toFixed(1) };
      }
    }
    return null;
  }
  // The best stand of the candidates of one kind: the one with the most room
  // around it, so nothing can wander in and take the aim off the thing.
  const best = (list, extra = () => ({})) => {
    const hit = list.map((e) => ({ e, stand: stand(e) })).filter((c) => c.stand)
      .sort((a, b) => b.stand.gap - a.stand.gap)[0];
    return hit ? { id: hit.e.id, name: hit.e.name, cost: hit.e.cost, ...extra(hit.e), stand: hit.stand } : null;
  };
  const boxes = reg.list.filter((e) => e.kind === 'control');
  const junctions = reg.list.filter((e) => e.kind === 'junction' && e.hacks.length > 1);
  const control = best(boxes, (e) => ({ zone: districtAt(street, e.x, e.z) }));
  process.stdout.write(`${JSON.stringify({ control, junction: best(junctions) })}\n`);
  process.exit(0);
}

const WORLD = JSON.parse(
  execFileSync(process.execPath, [FILE, '--worker', String(SEED)], { encoding: 'utf8' }).trim());

const lights = (page) => page.evaluate(() => window.__game.scorecard.lights());
const aimText = (page) => page.evaluate(() => document.getElementById('aim').textContent);
const hudText = (page) => page.evaluate(() => document.getElementById('hud').innerHTML);
const menuOf = (page) => page.evaluate(() => {
  const el = document.getElementById('hackmenu');
  return {
    open: el?.style.display === 'block',
    text: el?.textContent ?? '',
    rows: [...(el?.querySelectorAll('[data-row]') ?? [])].map((r) => ({
      text: r.textContent, sel: r.dataset.sel === '1',
    })),
  };
});
const menuShown = (page) => page.waitForFunction(
  () => document.getElementById('hackmenu')?.style.display === 'block',
  null, { polling: 'raf', timeout: 20000 });

async function boot(page, errors) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
}

// Stand where the sim says the thing is aimed: pose the body, turn the walk
// heading at it with the frame loop's own tickPlayer, and wait for the HUD's own
// highlight to name it — the pick the game holds, not this file's.
async function stand(page, t) {
  expect(t.stand, `${t.name}: the sim found a stand with it aimed`).toBeTruthy();
  const fx = Math.sin(t.stand.yaw), fz = Math.cos(t.stand.yaw);
  await page.evaluate(([x, z, yaw]) => window.__game.pose(x, z, yaw),
    [t.stand.px, t.stand.pz, t.stand.yaw]);
  await page.evaluate(([fx, fz]) => window.__game.scorecard.simWalk(0.35, fx, fz), [fx, fz]);
  await page.waitForFunction((want) => document.getElementById('aim')?.textContent === want,
    `${t.name} · ₡${t.cost}`, { polling: 'raf', timeout: 20000 });
}

test('M6.T3: one key fires the aimed thing\'s default hack, and nothing outside its reach changes', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  const c = WORLD.control;
  await stand(page, c);
  expect((await lights(page)).dark, 'the street is lit before the key').toEqual([false, false]);

  await page.keyboard.press('h');
  await waitGame(page, 0.3);
  const want = [false, false];
  want[c.zone] = true;
  expect((await lights(page)).dark,
    `the control box's own district (zone ${c.zone}) goes dark and the other stays lit`).toEqual(want);
  expect(await hudText(page), 'the status line names the blackout the key fired').toContain(`BLACKOUT Z${c.zone}`);
  await waitGame(page, 3.6);
  expect((await lights(page)).phase[c.zone], 'the collapse ends with the district dark').toBe('dark');
  expect((await lights(page)).glow[c.zone], 'and its light is out').toBe(0);
  expect(errors, 'no page error on the way').toEqual([]);
});

test('M6.T3: holding the key opens a menu of the thing\'s hacks, and the menu fires one', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  const c = WORLD.control;
  await stand(page, c);

  await page.keyboard.down('h');
  await menuShown(page);
  expect((await lights(page)).dark, 'the hold opens the menu without firing').toEqual([false, false]);
  const open = await menuOf(page);
  expect(open.text, 'the menu names the aimed thing').toContain(c.name);
  expect(open.rows.map((r) => r.text), 'the menu lists the thing\'s hacks').toEqual([`BLACKOUT · ₡${c.cost}`]);
  expect(open.rows.map((r) => r.sel), 'the default hack is the selected row').toEqual([true]);

  // The release that ends the hold is not a second press: the menu stays, and
  // still nothing has fired.
  await page.keyboard.up('h');
  expect((await menuOf(page)).open, 'the release leaves the menu open').toBe(true);
  expect((await lights(page)).dark).toEqual([false, false]);

  await page.keyboard.press('Enter');
  await waitGame(page, 0.3);
  expect((await lights(page)).dark[c.zone], 'the menu fires the hack it names').toBe(true);
  expect((await menuOf(page)).open, 'a hack that takes closes the menu').toBe(false);
  expect(errors, 'no page error on the way').toEqual([]);
});

test('M6.T3: a thing with more than one hack lists them all, and one the sim cannot fire refuses', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  const j = WORLD.junction;
  await stand(page, j);

  // The hold opens the menu without firing; every hack the thing carries is
  // listed, the default one selected.
  await page.keyboard.down('h');
  await menuShown(page);
  expect((await lights(page)).dark, 'opening the menu fires nothing').toEqual([false, false]);
  await page.keyboard.up('h');
  let m = await menuOf(page);
  expect(m.text, 'the menu names the aimed thing').toContain(j.name);
  expect(m.rows.map((r) => r.text), 'every hack the thing carries is listed').toEqual([
    `${CHOICE} · ₡${j.cost}`, `${OTHER} · ₡${j.cost}`,
  ]);
  expect(m.rows.map((r) => r.sel), 'the default hack is the selected row').toEqual([true, false]);

  // The sim has no applier for either yet, so the chosen one refuses and says
  // why — and the street stays lit, because a junction's hacks are not the
  // district blackout.
  await page.keyboard.press('ArrowDown');
  m = await menuOf(page);
  expect(m.rows.map((r) => r.sel), 'the arrow keys move the selection').toEqual([false, true]);
  await page.keyboard.press('Enter');
  m = await menuOf(page);
  expect(m.text, 'the row refuses, and names the hack it refused').toContain(OTHER);
  expect(m.open, 'a refusal leaves the menu open to be read').toBe(true);
  expect((await lights(page)).dark, 'and changes nothing').toEqual([false, false]);

  await page.keyboard.press('Escape');
  expect((await menuOf(page)).open, 'Escape puts the menu away').toBe(false);

  // M6-2: the blackout works in every district, so a thing whose own hack the
  // sim has not built yet leaves the key on the district's own — the key never
  // stops being the blackout.
  await page.keyboard.press('h');
  await waitGame(page, 0.3);
  expect((await lights(page)).dark.some(Boolean), 'a tap still does the district blackout').toBe(true);
  expect(await hudText(page), 'the status line names the blackout').toContain('BLACKOUT Z');
  expect((await menuOf(page)).open, 'and opens no menu').toBe(false);
  expect(errors, 'no page error on the way').toEqual([]);
});
