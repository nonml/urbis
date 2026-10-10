// M6.T18 / M6-4 (docs/ROADMAP.md, task M6.T18): crane. STOP CRANE stalls the
// site it is thrown at; DROP LOAD takes a stage off the lot and shuts the site
// for a minute. Their reach is one lot (M4-5): no district goes dark and the
// sites beside it keep building.
//
// The check reaches the feature the way a player does: __game.pose stands the
// body on a spot the sim itself says aims at the crane, the real H key fires
// it (a tap for the default hack, a hold and the menu for the other), and the
// sim's own parcel state — read through __game.city(), advanced by the frame
// loop's own __game.zoning.skip — says what the site did. The worker derives
// the stand from the same map, city, street and registry the game boots, so no
// pose here is a number tuned to today's map.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { waitGame } from './lib/input.js';
import { STAGES } from '../../src/sim/zoning.js';

const FILE = fileURLToPath(import.meta.url);
const SEED = 7;
const CRANE = 'CRANE', STOP = 'STOP CRANE', DROP = 'DROP LOAD';
// The market the site works against, pinned so a stall is the hack's doing and
// not a slump in demand (the capture probe's own pinDemand, as M5's checks do).
const PINNED = 0.9;
// The window a stall is watched over, well inside the 30 s a stop runs, and the
// steps the one-minute shut is walked in.
const STALL = 15, SHUT_STEP = 15;
// How much a working site climbs in five game seconds.
const CLIMB = 0.01;

if (process.argv[2] === '--worker') {
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  const { WALK_BOUNDS } = await import('../../src/sim/world.js');
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity, tickZoning } = await import('../../src/sim/zoning.js');
  const { createStreet, tickStreet } = await import('../../src/sim/street.js');
  const { createHackables, hackablesNear, aimTarget, AIM_COS } =
    await import('../../src/sim/hackables.js');

  const map = createMap(SEED);
  const city = createCity(SEED, map);
  const street = createStreet(SEED, map);
  // The district gets to work first: a lot the city opens on is a site from the
  // first frame, and a crane only stands over one that is climbing.
  for (let t = 0; t < 30; t += 0.05) { tickStreet(street, 0.05); tickZoning(city, 0.05, street); }
  const reg = createHackables({ map, city, street });
  const inWalk = (x, z) => x > WALK_BOUNDS.minX + 2 && x < WALK_BOUNDS.maxX - 2
    && z > WALK_BOUNDS.minZ + 2 && z < WALK_BOUNDS.maxZ - 2;
  const solid = (x, z) => map.parcels.some((p) => p.stage >= STAGE.LOW
    && Math.abs(x - p.x) <= p.w / 2 + 0.7 && Math.abs(z - p.z) <= p.d / 2 + 0.7);

  // A stand for one registered thing: reachable, clear of the buildings, facing
  // it — and the aim picks that thing from the player and from up to one arm in
  // front of them, with the next thing in the cone far enough off that a walker
  // cannot steal the pick.
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

  // The working crane with the most head-room before its next stage, so the
  // seconds the page spends posing cannot finish one; the roomiest stand first.
  const cranes = reg.list.filter((e) => e.kind === 'crane' && e.ref?.building
    && e.ref.progress < 0.6)
    .map((e) => ({ e, stand: stand(e) })).filter((c) => c.stand)
    .sort((a, b) => a.e.ref.progress - b.e.ref.progress || b.stand.gap - a.stand.gap);
  const crane = cranes[0];
  if (!crane) throw new Error(`seed ${SEED}: no working crane with a stand`);
  const index = city.parcels.indexOf(crane.e.ref);
  // The nearest other working site on the same power district: what keeps
  // building while this one is shut, which is what makes the reach one lot.
  const other = city.parcels.map((p, i) => ({ p, i }))
    .filter((q) => q.i !== index && q.p.kind === 'lot' && q.p.building
      && q.p.powerZone === crane.e.ref.powerZone)
    .sort((a, b) => Math.hypot(a.p.x - crane.e.x, a.p.z - crane.e.z)
      - Math.hypot(b.p.x - crane.e.x, b.p.z - crane.e.z))[0];
  process.stdout.write(`${JSON.stringify({
    name: crane.e.name, cost: crane.e.cost, id: crane.e.ref.id, index, use: crane.e.ref.use,
    zone: crane.e.district, stand: crane.stand,
    site: { x: +crane.e.x.toFixed(2), z: +crane.e.z.toFixed(2), stage: STAGES[crane.e.ref.stage] },
    other: other ? { id: other.p.id, index: other.i, x: +other.p.x.toFixed(2), z: +other.p.z.toFixed(2) } : null,
  })}\n`);
  process.exit(0);
}

const WORLD = JSON.parse(
  execFileSync(process.execPath, [FILE, '--worker', String(SEED)], { encoding: 'utf8' }).trim());

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
// The lot state the game itself holds, the frame loop's own skip of the street
// and city sim — the same tickZoning the loop calls every step — and the market
// the site works against, held where the evidence needs it.
const lots = (page) => page.evaluate(() => window.__game.city().parcels);
const lotOf = (list, id) => list.find((p) => p.id === id);
const skip = (page, secs) => page.evaluate((s) => window.__game.zoning.skip(s), secs);
const pin = (page, use) => page.evaluate(([u, l]) => window.__game.zoning.pin(u, l), [use, PINNED]);
const note = (page) => page.evaluate(() => window.__game.zoning.note());
const aimText = (page) => page.evaluate(() => document.getElementById('aim')?.textContent ?? '');

async function boot(page, errors) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
}

// Stand where the sim says the crane is aimed: pose the body, turn the walk
// heading at it with the frame loop's own tickPlayer, and wait for the HUD's own
// highlight to name it — the pick the game holds, not this file's.
async function stand(page) {
  const { px, pz, yaw } = WORLD.stand;
  await page.evaluate(([x, z, y]) => window.__game.pose(x, z, y), [px, pz, yaw]);
  await page.evaluate(([fx, fz]) => window.__game.scorecard.simWalk(0.35, fx, fz),
    [Math.sin(yaw), Math.cos(yaw)]);
  await page.waitForFunction((want) => document.getElementById('aim')?.textContent === want,
    `${CRANE} · ₡${WORLD.cost}`, { polling: 'raf', timeout: 20000 });
}

// The site working before the key: `secs` of game seconds at a pinned market,
// and the lot climbs. Every check below is a change from this, not a guess. The
// skip is short on purpose — the game's own frames run alongside it, and a site
// left too long at a pinned market tops out its stage out from under the aim.
async function working(page, id, secs = 3) {
  const before = lotOf(await lots(page), id);
  await pin(page, before.use);
  await skip(page, secs);
  const after = lotOf(await lots(page), id);
  expect(after.height, 'the site is working before the key').toBeGreaterThan(before.height + CLIMB);
  return after;
}

// The crane is still the pick when the key goes down: the registry registers a
// crane for a lot breaking ground and a building once it stands, so a site that
// tops out while the page sets up would take the hack off the aim.
async function stillAimed(page) {
  expect(await aimText(page), 'the crane is still the aim at the key')
    .toBe(`${CRANE} · ₡${WORLD.cost}`);
}

test('M6.T18: the crane stops — the site stalls, and no district goes dark', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  await stand(page);
  expect(await page.evaluate(() => window.__game.dark()), 'the street is lit before the key')
    .toEqual([false, false]);
  const worked = await working(page, WORLD.id);
  await stillAimed(page);

  await page.keyboard.press('h');
  await waitGame(page, 0.3);
  const fired = lotOf(await lots(page), WORLD.id);
  expect(fired.height, 'the key fired nothing that moves the site first')
    .toBeGreaterThanOrEqual(worked.height - CLIMB);
  await skip(page, 10);
  const stopped = lotOf(await lots(page), WORLD.id);
  expect(stopped.height, 'the stopped crane holds the height it reached').toBeCloseTo(fired.height, 5);
  expect(stopped.progress, 'and makes no progress').toBeCloseTo(fired.progress, 5);
  expect(stopped.stage, 'and loses no stage').toBe(fired.stage);
  expect(await page.evaluate(() => window.__game.dark()),
    'a crane hack blacks out no district').toEqual([false, false]);
  expect(await note(page), 'the lot note names the hack that stopped it')
    .toContain('crane stopped');
  // The stop lifts: the same market that was building the site takes it again.
  await skip(page, 25);
  expect(lotOf(await lots(page), WORLD.id).height, 'the crane lifts and the site works again')
    .toBeGreaterThan(fired.height + CLIMB);
  expect(errors, 'no page error on the way').toEqual([]);
});

test('M6.T18: the load drops — a stage comes off the lot and the site shuts for a minute', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  await stand(page);
  await working(page, WORLD.id);
  await stillAimed(page);
  // Read the stage at the key, not seconds before it: a site a hair from
  // topping out its stage could finish it while the menu opens.
  const before = lotOf(await lots(page), WORLD.id);

  await page.keyboard.down('h');
  await menuShown(page);
  await page.keyboard.up('h');
  const open = await menuOf(page);
  expect(open.rows.map((r) => r.text), 'the menu lists the crane\'s hacks')
    .toEqual([`${STOP} · ₡1`, `${DROP} · ₡2`]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitGame(page, 0.4);

  const dropped = lotOf(await lots(page), WORLD.id);
  expect(STAGES.indexOf(dropped.stage), 'a stage comes off the lot')
    .toBe(STAGES.indexOf(before.stage) - 1);
  expect(dropped.building, 'and the crane comes down with it').toBe(false);
  expect(await note(page), 'the lot note names the dropped load while the site is shut')
    .toContain('load dropped');

  // The shut, walked in 15 s steps: no work at any step inside the minute, and
  // work again at the step past it. The game's own frames run alongside, so the
  // count is the minute plus whatever the page spent asking.
  let secs = 0, open2 = false;
  for (let step = 0; step < 8; step++) {
    const at = lotOf(await lots(page), WORLD.id);
    expect(at.stage, `after ${secs}s the site is still shut`).toBe(dropped.stage);
    expect(at.progress, `after ${secs}s of the shut it has done nothing`).toBe(0);
    await skip(page, SHUT_STEP);
    secs += SHUT_STEP;
    const now = lotOf(await lots(page), WORLD.id);
    if (now.progress > 0 || now.stage !== dropped.stage) { open2 = true; break; }
  }
  expect(open2, 'the site works again once the minute is up').toBe(true);
  expect(secs, 'the shut runs a minute, not a moment').toBeGreaterThan(45);
  expect(secs, 'and not for good').toBeLessThanOrEqual(90);
  expect(errors, 'no page error on the way').toEqual([]);
});

test('M6.T18: the shut is the lot\'s own — the site beside it keeps building', async ({ page }) => {
  const errors = [];
  await boot(page, errors);
  expect(WORLD.other, 'the sim found a second working site on the same district').toBeTruthy();
  await stand(page);
  const beside = await working(page, WORLD.other.id);
  await working(page, WORLD.id);
  await stillAimed(page);

  await page.keyboard.press('h');
  await waitGame(page, 0.3);
  const fired = lotOf(await lots(page), WORLD.id);
  await skip(page, STALL);
  const besideAfter = lotOf(await lots(page), WORLD.other.id);
  const stopped = lotOf(await lots(page), WORLD.id);
  expect(besideAfter.height, 'the site beside the hacked one keeps climbing')
    .toBeGreaterThan(beside.height + CLIMB);
  expect(stopped.height, 'while the hacked one stands still').toBeCloseTo(fired.height, 5);
  expect(await page.evaluate(() => window.__game.dark()),
    'no district went dark to stop it').toEqual([false, false]);
  expect(await page.evaluate(() => window.__game.heat()),
    'a crane hack no unit is watching raises no tier').toBe(0);
  expect(errors, 'no page error on the way').toEqual([]);
});
