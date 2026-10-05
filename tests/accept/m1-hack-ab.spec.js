// M1-5 (docs/ROADMAP.md): the player walks to the lit district and presses H.
// The dark district loses at least 10% of its jobs against an untouched control
// within 5 game minutes; the other district stays bit-identical.
//
// Browser half: on seed 1 the player walks with real keys into the district
// with the city in it, presses H, and that district goes dark while the other
// stays lit. The session runs through the M0.T2 recorder: ?record=1 keeps the
// walk and the hack, and ?replay= feeds them back to the same __game.stateHash()
// at the same step, so the act the guard measures is the act a player performs.
//
// A/B half, Node-only (never opens a page; one seed per worker, as
// m1-calm.test.js does): the A/B runner (tests/accept/lib/ab.js) steps an
// untouched control and a world whose busiest district is hacked at minute 1.
// At minute 5 the hacked district is at most 90% of the control's jobs, and a
// SHA-256 of every parcel and the economy record of the other district is the
// same string in both worlds. The probe measured -64 jobs at 5 minutes; this
// keeps that guard measured, never estimated.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hold, waitGame } from './lib/input.js';

const SEEDS = [7, 11, 22, 33, 73];
const HACK_AT = 60;          // the poke lands at minute 1
const SECS = 300;            // the bar: 5 game minutes
const LOSS = 0.10;           // M1-5's at least 10% of jobs
const RECORD_SPEED = 4;
const REPLAY_SPEED = 8;
const FILE = fileURLToPath(import.meta.url);

// The district with the city in it — the most built height, the way the probe
// picks its poke (scripts/economy-probe.mjs pickZone). That is the lit district
// the player walks to before pressing H.
function busiest(w) {
  const height = w.city.economy.districts.map((_, z) =>
    w.city.parcels.filter((p) => p.powerZone === z).reduce((s, p) => s + w.heightOf(p), 0));
  return height[1] > height[0] ? 1 : 0;
}

// Every byte of the district that must not move: its parcels and its economy
// record. A hash turns the equality into one string a failure can print.
function districtHash(w, zone) {
  return createHash('sha256').update(JSON.stringify({
    parcels: w.city.parcels.filter((p) => p.powerZone === zone),
    district: w.city.economy.districts[zone],
  })).digest('hex');
}

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { runAB } = await import('./lib/ab.js');
  let zone = -1;
  let out = null;
  await runAB({
    seed, at: HACK_AT, secs: SECS,
    poke: (poked, base) => {
      if (zone < 0) zone = busiest(base);
      poked.hack(zone);
    },
    sample: ({ base, poked }, t) => {
      if (t < SECS - 1e-6) return;
      const other = 1 - zone;
      out = {
        zone,
        baseJobs: Math.round(base.city.economy.districts[zone].jobs),
        pokedJobs: Math.round(poked.city.economy.districts[zone].jobs),
        other: districtHash(base, other) === districtHash(poked, other),
      };
    },
  });
  process.stdout.write(`${JSON.stringify({ seed, ...out })}\n`);
  process.exit(0);
}

test.setTimeout(240000);

test('M1-5: walking to the lit district and H blacks it out, through a replay', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&gen=1&seed=1&speed=${RECORD_SPEED}&record=1`);
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });

  const target = await page.evaluate(() => {
    const sums = [0, 0];
    for (const p of window.__game.city().parcels) sums[p.zone] += p.height;
    return sums[1] > sums[0] ? 1 : 0;
  });

  // Real keys: W walks toward -z and S toward +z, and street.js zoneAt splits
  // the two districts at z = 0. Shift hurries; the cap is only a runaway guard.
  const was = await page.evaluate(() => window.__game.player());
  const dir = target === 0 ? 'w' : 's';
  for (let tries = 0; tries < 20; tries++) {
    await hold(page, [dir, 'Shift'], 1);
    const zone = await page.evaluate(() => (window.__game.player().z < 0 ? 0 : 1));
    if (zone === target) break;
  }
  const now = await page.evaluate(() => window.__game.player());
  expect(Math.hypot(now.x - was.x, now.z - was.z), 'the player walked').toBeGreaterThan(2);
  expect(await page.evaluate(() => (window.__game.player().z < 0 ? 0 : 1)), 'standing in the lit district').toBe(target);

  await page.keyboard.press('h');
  await page.waitForFunction((z) => window.__game.dark()[z] === true, target, { polling: 'raf', timeout: 30000 });
  const dark = await page.evaluate(() => window.__game.dark());
  expect(dark[target], 'the district the player stands in goes dark').toBe(true);
  expect(dark[1 - target], 'the other district stays lit').toBe(false);

  // Let the blackout settle, stop the clock, and keep the session to replay.
  await waitGame(page, 2);
  await page.evaluate(() => window.__game.pause());
  const rec = await page.evaluate(() => ({
    step: window.__game.step(),
    hash: window.__game.stateHash(),
    dark: window.__game.dark(),
    log: window.__game.inputLog(),
  }));
  expect(rec.log.events.some((e) => e.type === 'keydown' && e.key === 'h'), 'the log kept the hack').toBe(true);

  // The same input through M0.T2 must land on the same world at the same step.
  await page.route('**/tests/replays/m1-hack.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(rec.log) }));
  await page.goto(`/?capture=1&gen=1&seed=1&speed=${REPLAY_SPEED}&replay=m1-hack`);
  await page.waitForFunction(() => window.__game.replayDone() || window.__game.replayError(), null, { timeout: 120000 });
  const rep = await page.evaluate(() => ({
    error: window.__game.replayError(),
    step: window.__game.step(),
    hash: window.__game.stateHash(),
    dark: window.__game.dark(),
  }));
  expect(rep.error, 'the replay loaded').toBeNull();
  expect(rep.step, 'the replay stops at the recorded step').toBe(rec.step);
  expect(rep.hash, 'the replay lands on the recorded state').toBe(rec.hash);
  expect(rep.dark, 'the replayed hack blacked out the same district').toEqual(rec.dark);
  expect(errors).toEqual([]);
});

test('M1-5: five seeds, the dark district loses 10% of its jobs and the other is bit-identical', () => {
  const rows = SEEDS.map((seed) => JSON.parse(execFileSync(
    process.execPath, [FILE, '--worker', String(seed)], { encoding: 'utf8' }).trim().split('\n').pop()));
  for (const r of rows) {
    const loss = (r.baseJobs - r.pokedJobs) / r.baseJobs;
    expect(loss, `seed ${r.seed}: district ${r.zone} jobs ${r.baseJobs} -> ${r.pokedJobs}`).toBeGreaterThanOrEqual(LOSS);
    expect(r.other, `seed ${r.seed}: district ${1 - r.zone} bit-identical between A and B`).toBe(true);
  }
});
