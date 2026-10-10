// M6-3 (docs/ROADMAP.md, task M6.T4): the battery. Every hack spends its cost;
// one the battery cannot pay for does not fire and the HUD says why; the meter
// refills at the rate docs/HACKING.md states; holding Q (Focus) slows the game
// to 0.3 times speed for up to 4 s and spends battery while held.
//
// The worker builds the world the game boots (seed 7) and checks the rule
// against HACKING.md's own table, so no number here is tuned to today's map.
// The page then drives the running game with real keys, as a player does.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEED = 7;
// The doc's own row for one label, e.g. `| BLACKOUT | 6 | one district ... |`.
const DOC = readFileSync(new URL('../../docs/HACKING.md', import.meta.url), 'utf8');
const rowOf = (label) => {
  const m = DOC.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*(-?[0-9.]+)\\s*\\|`, 'i'));
  return m === null ? null : Number(m[1]);
};

if (process.argv[2] === '--worker') {
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  const { createMap } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet, districtAt } = await import('../../src/sim/street.js');
  const { HACKS } = await import('../../src/sim/hackables.js');
  const {
    createBattery, batterySpend, batteryLevel, batteryTick, hackCost,
    REFILL_PER_SEC, FOCUS_DRAIN_PER_SEC, FOCUS_SPEED, FOCUS_SECS,
  } = await import('../../src/sim/battery.js');
  setWorldSeed(SEED, true);
  const map = createMap(SEED), city = createCity(SEED, map), street = createStreet(SEED, map);
  const paid = batterySpend(createBattery(), HACKS.blackout);
  process.stdout.write(`${JSON.stringify({
    doc: { refill: rowOf('REFILL'), focus: rowOf('FOCUS'), time: rowOf('FOCUS TIME'), drain: rowOf('FOCUS DRAIN') },
    hacks: Object.keys(HACKS).map((id) => ({ id, doc: rowOf(HACKS[id].name), cost: hackCost(id) })),
    rule: {
      refill: REFILL_PER_SEC, drain: FOCUS_DRAIN_PER_SEC, speed: FOCUS_SPEED, secs: FOCUS_SECS,
      full: batteryLevel(createBattery()),
      paid: { ok: paid.ok, level: batteryLevel(paid.battery), reason: paid.reason },
      empty: batterySpend({ level: 0 }, HACKS.blackout).reason,
      ticked: batteryLevel(batteryTick(paid.battery, 5, false)),
    },
  })}\n`);
  process.exit(0);
}

const WORLD = JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(SEED)],
  { encoding: 'utf8' }).trim());
const blackout = WORLD.hacks.find((h) => h.id === 'blackout');
const hudText = (page) => page.evaluate(() => document.getElementById('hud').textContent);
// The meter's own level, in points, read off the status block: the percentage
// the level is named by, with the reason it ran out kept on its own phrase.
const level = async (page) => {
  const text = await hudText(page);
  return Number(/battery (\d+)%/i.exec(text)?.[1]);
};
// The sim's own truth about which power districts are out, read live.
const someDark = (page) => page.waitForFunction(() => window.__game.dark().some(Boolean));
const noneDark = (page) => page.waitForFunction(() => !window.__game.dark().some(Boolean));
const stepsPerSec = async (page) => {
  const a = await page.evaluate(() => window.__game.step());
  await page.waitForTimeout(1000);
  return (await page.evaluate(() => window.__game.step()) - a);
};
// M6.T3 hands the key to whatever the aim is on — a walker's profiler spends
// nothing and fires nothing — so the check drives the game's own entry point for
// the blackout, `__game.hack()`, which is main.js's fireHack with nothing in
// front of it. The battery gate under test is the first thing that runs.
const hack = (page) => page.evaluate(() => window.__game.hack());

test('every hack\'s cost and the refill rate are the ones docs/HACKING.md states', () => {
  expect(blackout.doc).not.toBeNull();
  for (const h of WORLD.hacks) {
    expect(h.doc, `${h.id} has no row in docs/HACKING.md`).not.toBeNull();
    expect(h.cost, `${h.id} costs ${h.doc} in the doc and ${h.cost} in the code`).toBe(h.doc);
  }
  expect(WORLD.rule.refill).toBe(WORLD.doc.refill);
  expect(WORLD.rule.drain).toBe(WORLD.doc.drain);
  expect(WORLD.rule.speed).toBe(WORLD.doc.focus);
  expect(WORLD.rule.secs).toBe(WORLD.doc.time);
  expect(WORLD.rule.speed).toBe(0.3);
  expect(WORLD.rule.secs).toBe(4);
});

test('a hack spends its cost, and one it cannot pay for refuses and says why', () => {
  expect(WORLD.rule.full).toBeGreaterThan(0.9);
  expect(WORLD.rule.paid.ok).toBe(true);
  expect(WORLD.rule.paid.level).toBeCloseTo(1 - blackout.cost / 100, 3);
  expect(WORLD.rule.empty, 'an empty battery must name why it refused').toMatch(/batter/i);
  expect(WORLD.rule.ticked).toBeCloseTo(
    Math.min(1, WORLD.rule.paid.level + WORLD.rule.refill * 5 / 100), 3);
});
test('the running game spends it, refuses with a reason, and takes Q as focus', async ({ page }) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`/?capture=1&seed=${SEED}`);
  await page.waitForFunction(() => window.__game?.draws() > 0);
  await page.waitForFunction(() => /battery \d+%/i.test(document.getElementById('hud').textContent));
  const plain = await stepsPerSec(page);

  // Hold Q: the game slows to 0.3x and the meter pays for the hold. The hold
  // ends at 4 s of holding and the pace comes back; spent to nothing, the meter
  // is what refuses rather than a timer.
  await page.keyboard.down('q');
  const slow = await stepsPerSec(page);
  expect(slow, 'holding Q must slow the game to 0.3x').toBeLessThan(plain * 0.5);
  await page.keyboard.up('q');
  expect(await stepsPerSec(page)).toBeGreaterThan(plain * 0.6);
  // Spend the meter down on focus alone: each press is four seconds of holding,
  // and about four of them are what a full meter buys.
  for (let i = 0; i < 8; i++) {
    if ((await level(page)) < blackout.cost) break;
    await page.keyboard.down('q');
    await page.waitForFunction((n) => window.__game.step() >= n,
      await page.evaluate(() => window.__game.step()) + 24, { timeout: 30000 });
    await page.keyboard.up('q');
  }
  expect(await level(page), 'focus must spend the meter while held').toBeLessThan(blackout.cost);

  // With the meter spent, the one hack the battery cannot pay for does not
  // fire, and the HUD says why.
  await hack(page);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__game.dark().some(Boolean)),
    'a hack the battery cannot pay for must not fire').toBe(false);
  expect(await hudText(page)).toMatch(/no battery/i);

  // The meter comes back on its own, so play continues — and the hack it can
  // pay for fires and takes its cost off the meter.
  await page.waitForFunction((c) => {
    const m = /battery (\d+)%/i.exec(document.getElementById('hud').textContent);
    return !!m && Number(m[1]) >= c;
    // Above the cost by a few points: the meter's display rounds, so a reading
    // of the cost itself can still be short of it.
  }, blackout.cost + 4, { polling: 200, timeout: 40000 });
  const before = await level(page);
  await hack(page);
  await someDark(page);
  // The status block writes on its own clock (4 Hz), so the meter's new number
  // lands a refresh after the hack does.
  await page.waitForTimeout(450);
  const paid = await level(page);
  expect(before - paid, 'a hack spends its cost').toBeGreaterThanOrEqual(blackout.cost - 1);
  expect(before - paid).toBeLessThanOrEqual(blackout.cost + 2);
  expect(errors).toEqual([]);
});
