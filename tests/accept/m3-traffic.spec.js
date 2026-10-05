// M3-6 (docs/ROADMAP.md): routed traffic, in the running game. Cars and walkers
// travel trips along the graph; no car or walker moves farther between frames
// than its speed allows, except when it appears or goes at least 60 m from the
// camera and out of its view; at 8:00 at least 60% of visible walkers are
// residents heading to their job's parcel. The signals and road-edit clauses of
// M3-6 (cars stop at a red light; after removeRoad/addRoad) have no page-side
// probe yet, so tests/accept/m3-traffic.test.js carries them in Node.
//
// M3.T28 writes this check red. Today street.js wraps cars and walkers at the
// end of the tarmac (street.js:286-313, "red: the loop") and so both no-jump
// tests fail; M3.T30-T34 route them and drop their test.fail markers. The 8:00
// clause already holds — steered commuters head for their job's z — and is not
// marked, so routing must keep it true.
import { test, expect } from '@playwright/test';
import { waitGame } from './lib/input.js';

const SEEDS = [7, 11, 22, 33, 73];
const CAM_DIST = 60;
// The follow cam's look direction is player - camera; the camera's own FOV is
// 52° vertical (~82° horizontal at 16:9), so cos 45° is the frame and then some.
const VIEW_DOT = 0.707;
const CAR_JUMP = 1.2;   // M3.S2: VMAX 13.5 m/s x 0.05 s = 0.675 m, measured < 1.2
const WALK_JUMP = 0.5;  // the fastest hurrying walker is ~2.7 m/s x 0.05 s

// Page-side: step the sim one 50 ms tick at a time and compare every mover slot
// with the last sample. A slot that moves farther than its speed allows is only
// excused when it is out of the camera's view (>60 m and outside the frame) at
// both ends — the criterion's appear/go allowance. Identity is the slot, which
// is what the renderer draws; a length change re-syncs the tracking.
async function scanJumps(page, kind, steps) {
  return page.evaluate(({ kind, steps, CAM_DIST, VIEW_DOT, CAR_JUMP, WALK_JUMP }) => {
    const g = window.__game;
    const cam = g.cam();
    const p = g.player();
    const fx = p.x - cam[0];
    const fz = p.z - cam[2];
    const fl = Math.hypot(fx, fz) || 1;
    const outOfView = (x, z) => {
      const dx = x - cam[0];
      const dz = z - cam[2];
      const d = Math.hypot(dx, dz);
      if (d < CAM_DIST) return false;
      return (dx * (fx / fl) + dz * (fz / fl)) / d <= VIEW_DOT;
    };
    const read = () => (kind === 'cars' ? g.scorecard.cars() : g.scorecard.npcs())
      .map((m) => ({ x: m.x, z: m.z }));
    const allow = kind === 'cars' ? CAR_JUMP : WALK_JUMP;
    let prev = read();
    const jumped = [];
    let samples = 0;
    for (let i = 0; i < steps; i++) {
      g.advance(0.05);
      const now = read();
      if (now.length !== prev.length) { prev = now; continue; }
      for (let j = 0; j < now.length; j++) {
        const d = Math.hypot(now[j].x - prev[j].x, now[j].z - prev[j].z);
        if (d === 0) continue;
        samples += 1;
        if (d > allow && (!outOfView(prev[j].x, prev[j].z) || !outOfView(now[j].x, now[j].z))) {
          jumped.push({ step: i, slot: j, d: +d.toFixed(1) });
        }
      }
      prev = now;
    }
    return { jumped: jumped.slice(0, 6), samples, slots: prev.length };
  }, { kind, steps, CAM_DIST, VIEW_DOT, CAR_JUMP, WALK_JUMP });
}

test.setTimeout(300000);

test('M3-6: every car holds its trips and nothing leaps on the graph', async ({ page }) => {
  // M3.T28's red check: routed cars are M3.T30. Drop this when they land.
  test.fail(true, 'M3-6 red: cars loop the lanes and wrap at the tarmac end (street.js:308-313)');
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  const r = await scanJumps(page, 'cars', 600);
  expect(r.slots, 'cars on the street').toBeGreaterThan(10);
  expect(r.samples, `car movement samples: ${r.samples}`).toBeGreaterThan(2000);
  expect(r.jumped, `car slots that moved past their speed inside the frame: ${JSON.stringify(r.jumped)}`).toEqual([]);
});

test('M3-6: walkers travel the pavements and never leap', async ({ page }) => {
  // M3.T28's red check: walkers on the graph are M3.T33. Drop this when it lands.
  test.fail(true, 'M3-6 red: walkers loop the pavements and wrap at the end (street.js:286-299)');
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  const r = await scanJumps(page, 'walkers', 600);
  expect(r.slots, 'walkers on the street').toBeGreaterThan(20);
  expect(r.samples, `walker movement samples: ${r.samples}`).toBeGreaterThan(2000);
  expect(r.jumped, `walkers that moved past their speed inside the frame: ${JSON.stringify(r.jumped)}`).toEqual([]);
});

test('M3-6: at 8:00 most visible walkers are residents heading to their job parcel', async ({ page }) => {
  // Green today because tickCommute steers commuters toward their job's z (the
  // clause the M3-6 row calls already partly built); routing must not lose it.
  const short = [];
  for (const seed of SEEDS) {
    await page.goto(`/?capture=1&gen=1&seed=${seed}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    // Grow the lots so residents exist (capture's clock is frozen, so the hour
    // holds), then let the frame loop move them in.
    await page.evaluate(() => window.__game.zoning.skip(240));
    await page.waitForFunction(() => window.__game.census().residents > 0, null, { timeout: 120000 });
    await page.evaluate(() => window.__game.setHour(8));
    await waitGame(page, 0.5);
    const before = await page.evaluate(() => ({
      npcs: window.__game.scorecard.npcs(),
      people: window.__game.scorecard.npcs().map((_, i) => window.__game.person(i)),
      parcels: window.__game.city().parcels,
    }));
    await waitGame(page, 1);
    const after = await page.evaluate(() => window.__game.scorecard.npcs());
    let visible = 0;
    let heading = 0;
    const miss = [];
    for (let i = 0; i < after.length; i++) {
      if (after[i].out === false) continue;
      visible += 1;
      const who = before.people[i];
      const m = who && /^LOT (\d+)$/.exec(who.work);
      const job = m ? before.parcels[Number(m[1])] : null;
      const vx = after[i].x - before.npcs[i].x;
      const vz = after[i].z - before.npcs[i].z;
      const toward = job && Math.hypot(vx, vz) > 1e-3
        && vx * (job.x - after[i].x) + vz * (job.z - after[i].z) > 0;
      if (toward) heading += 1;
      else miss.push(`walker ${i}: ${who ? who.work : 'no person'}`);
    }
    const share = visible ? heading / visible : 0;
    if (share < 0.6) short.push(`seed ${seed}: ${heading}/${visible} heading to work (${(share * 100).toFixed(0)}%) ${miss.slice(0, 4)}`);
  }
  expect(short, `seeds under 60%:\n${short.join('\n')}`).toEqual([]);
});
