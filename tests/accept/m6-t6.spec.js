// M6.T6 / M6-4 (docs/ROADMAP.md M6-4): police see hacks. A hack thrown while a
// unit has eyes on it is a witnessed crime — the wanted sim raises the tier on
// cause `hack` (wanted.js raise) and dispatch names the hack it watched; thrown
// where no unit can see it, the same act is the grid's own blackout, reported as
// tampering and not witnessed. The Node half reads the events the sim emitted
// and the line per hack kind; the page half throws the blackout with the hack
// key, the way a player does, and reads the radio that names it.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { waitGame } from './lib/input.js';
import { createWanted, forceTier, wantedOnBlackout, drainEvents } from '../../src/sim/wanted.js';
import { createDispatch, tickDispatch } from '../../src/sim/dispatch.js';
import { HACKS } from '../../src/sim/hackables.js';
import { canSee } from '../../src/sim/patrol.js';
import { createMap, STAGE } from '../../src/sim/map.js';
import { createCity } from '../../src/sim/zoning.js';
import { createStreet, districtAt } from '../../src/sim/street.js';
import { createHackables, hackablesNear, aimTarget, AIM_COS } from '../../src/sim/hackables.js';
import { WALK_BOUNDS } from '../../src/sim/world.js';

const FILE = fileURLToPath(import.meta.url);
const SEED = 7;
// The line dispatch writes for a hack the police watched (dispatch.js HACK_LINES).
const SEEN = 'BLACKOUT on';
// Inside patrol.js CLOSE_SIGHT, so a unit this close sees the player wherever
// either of them stands.
const WATCH = 8;
// The wanted sim's own hand-map scene: the blackout site and the park no cruiser
// can see into (tests/wanted.spec.js).
const SITE = { x: 2, z: 26 };
const HIDEOUT = { x: 66, z: -40 };

if (process.argv[2] === '--worker') {
  const map = createMap(SEED);
  const city = createCity(SEED, map);
  const street = createStreet(SEED, map);
  const reg = createHackables({ map, city, street });
  const inWalk = (x, z) => x > WALK_BOUNDS.minX + 2 && x < WALK_BOUNDS.maxX - 2
    && z > WALK_BOUNDS.minZ + 2 && z < WALK_BOUNDS.maxZ - 2;
  const solid = (x, z) => map.parcels.some((p) => p.stage >= STAGE.LOW
    && Math.abs(x - p.x) <= p.w / 2 + 0.7 && Math.abs(z - p.z) <= p.d / 2 + 0.7);
  // A stand with the box aimed: clear of the walls, facing it, and with nothing
  // else in the 30-degree cone — a walker's own default hack is the profiler,
  // which is not this hack, so a stolen aim would throw nothing.
  function stand(box) {
    for (const r of [6, 5, 7, 8, 10]) {
      for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        const px = box.x + Math.cos(ang) * r, pz = box.z + Math.sin(ang) * r;
        if (!inWalk(px, pz) || solid(px, pz)) continue;
        const yaw = Math.atan2(box.x - px, box.z - pz);
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const pick = (ox, oz) => aimTarget(reg, ox, oz, fx, fz)?.entry ?? null;
        if (pick(px, pz) !== box) continue;
        // The step or two the test turns the walk heading with (input.js aims
        // the HUD from the player's own yaw, not the camera's) leaves the body
        // still aimed at the box and still on the same district's street.
        if ([1.5, 3, 4.4].some((f) => pick(px + fx * f, pz + fz * f) !== box)) continue;
        if ([1.5, 3].some((f) => !inWalk(px + fx * f, pz + fz * f) || solid(px + fx * f, pz + fz * f))) continue;
        if (districtAt(street, px, pz) !== districtAt(street, px + fx * 1.5, pz + fz * 1.5)) continue;
        const other = hackablesNear(reg, px, pz, 40).some(({ entry }) => entry !== box
          && ((entry.x - px) * fx + (entry.z - pz) * fz)
          / Math.max(Math.hypot(entry.x - px, entry.z - pz), 0.01) >= AIM_COS);
        if (other) continue;
        return { px: +px.toFixed(2), pz: +pz.toFixed(2), yaw: +yaw.toFixed(3), fx: +fx.toFixed(3), fz: +fz.toFixed(3) };
      }
    }
    return null;
  }
  const hit = reg.list.filter((e) => e.kind === 'control')
    .map((e) => ({ e, at: stand(e) })).find((c) => c.at);
  if (!hit) throw new Error(`seed ${SEED}: no stand with a control box aimed`);
  const { px, pz } = hit.at;
  // The nearest road node well clear of the stand that cannot see it, for the
  // unit that watches nothing happen (patrol.js canSee is the game's own rule).
  const blind = map.graph.nodes.filter((n) => !canSee(n.x, n.z, px, pz, false, map)
    && Math.hypot(n.x - px, n.z - pz) >= 30)
    .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
  if (!blind) throw new Error(`seed ${SEED}: no road node blind to the stand`);
  process.stdout.write(`${JSON.stringify({
    name: hit.e.name, cost: hit.e.cost,
    box: { x: hit.e.x, z: hit.e.z }, stand: hit.at, zone: districtAt(street, px, pz),
    blind: { x: blind.x, z: blind.z },
  })}\n`);
  process.exit(0);
}

const WORLD = JSON.parse(
  execFileSync(process.execPath, [FILE, '--worker', String(SEED)], { encoding: 'utf8' }).trim());

// Pose the player where the sim says the box is aimed, wait for the HUD's own
// highlight to name it, stand one of the game's own units on duty `where`, held
// still so what sees the hack is where the unit stands and not how fast a car
// could get there — and throw the blackout with the hack key.
async function threwAt(page, where, errors) {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 60000 });
  const { px, pz, yaw } = WORLD.stand;
  await page.evaluate(([x, z, y]) => window.__game.pose(x, z, y), [px, pz, yaw]);
  // Turn the walk heading at the box with the frame loop's own tickPlayer: that
  // yaw, not the camera's, is the one the HUD's aim reads.
  await page.evaluate(([fx, fz]) => window.__game.scorecard.simWalk(0.35, fx, fz),
    [WORLD.stand.fx, WORLD.stand.fz]);
  await page.waitForFunction((want) => document.getElementById('aim')?.textContent === want,
    `${WORLD.name} · ₡${WORLD.cost}`, { polling: 'raf', timeout: 20000 });
  await page.evaluate(([x, z]) => {
    const g = window.__game;
    g.police.reset();
    g.police.tier(1);
    g.police.unit(0, x, z, Math.PI);
    g.police.hold(true);
  }, [where.x, where.z]);
  await page.keyboard.press('h');
  await waitGame(page, 0.5);
  const r = await page.evaluate(() => ({
    at: window.__game.player(), heat: window.__game.heat(),
    radio: window.__game.wanted().radio, dark: window.__game.dark(),
  }));
  await page.evaluate(() => window.__game.police.hold(false));
  return r;
}

test('M6.T6: a blackout a unit is watching is witnessed and the radio names it', async ({ page }) => {
  const errors = [];
  const r = await threwAt(page, { x: WORLD.stand.px + WATCH, z: WORLD.stand.pz }, errors);
  expect(Math.hypot(r.at.x - WORLD.box.x, r.at.z - WORLD.box.z),
    'the player stands at the box the stand aimed at').toBeLessThan(8);
  expect(r.dark[WORLD.zone], 'the key threw the blackout of the box it was aimed at').toBe(true);
  expect(r.heat, 'the unit watching it raises the tier').toBe(2);
  expect(r.radio.join(' '), 'dispatch names the hack the unit watched').toContain(SEEN);
  expect(errors, 'no page error on the way').toEqual([]);
});

test('M6.T6: the same blackout where no unit can see it is reported, not witnessed', async ({ page }) => {
  const errors = [];
  const r = await threwAt(page, WORLD.blind, errors);
  expect(r.dark[WORLD.zone], 'the same blackout still throws').toBe(true);
  expect(r.heat, 'the grid reports it either way').toBe(2);
  expect(r.radio.length, 'dispatch said something').toBeGreaterThan(0);
  expect(r.radio.join(' '), 'no unit saw it, so there is no hack to name').not.toContain(SEEN);
  expect(errors, 'no page error on the way').toEqual([]);
});

// The wanted sim's own event for a blackout thrown at the hand map's site while
// a unit stands `at`: the tier it reached, the cause and the hack kind.
function threwInSim(at) {
  const w = createWanted();
  forceTier(w, 1, { x: SITE.x, z: SITE.z, yaw: 0, inCar: false }, 0);
  Object.assign(w.pursuit[0], { x: at.x, z: at.z, speed: 0 });
  wantedOnBlackout(w, SITE.x, SITE.z, 0);
  return { heat: w.heat, event: drainEvents(w)[0] };
}

test('M6.T6: the wanted sim raises a witnessed blackout on cause hack, an unwatched one as the grid crime', () => {
  const watched = threwInSim({ x: SITE.x + WATCH, z: SITE.z });
  expect(watched.heat, 'the unit watching it raises the tier').toBe(2);
  expect(watched.event.cause).toBe('hack');
  expect(watched.event.hack).toBe('blackout');
  const unseen = threwInSim(HIDEOUT);
  expect(unseen.heat, 'a blackout nobody watched is still a blackout on the grid').toBe(2);
  expect(unseen.event.cause).toBe('blackout');
  expect(unseen.event.hack).toBe(null);
});

test('M6.T6: dispatch has a line of its own for every hack kind', () => {
  const kinds = Object.keys(HACKS);
  // A fresh channel per kind on the same seed, so the line is the kind's own and
  // not the RNG's; REPEAT_SECS apart on the one channel would drop them.
  const said = kinds.map((hack, i) => {
    const d = createDispatch(20260916);
    const e = { type: 'tier_up_1', cause: 'hack', hack, x: SITE.x, z: SITE.z, yaw: 0, inCar: false, time: i * 8 };
    tickDispatch(d, [e], e.time);
    return { hack, line: d.lines.at(-1) };
  });
  for (const { hack, line } of said) {
    expect(line?.speaker, `${hack} is said by someone`).toBeTruthy();
    expect(line.text, `${hack}'s line names the street it was seen on`).toContain('Main');
    expect(line.text, `${hack}'s line names the hack`).toContain(HACKS[hack].name);
  }
  expect(new Set(said.map((s) => s.line.text)).size, 'one line per kind, not one line for all of them')
    .toBe(kinds.length);
});
