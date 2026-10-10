// M6.T20 / M6-4 (docs/ROADMAP.md M6, "Planning office"): the planning office's
// two hacks — FAST-TRACK and FREEZE — and the sim they work on, all of it in
// src/sim/zoning.js.
//
// Proved here, on every seed in docs/ROADMAP.md's own five: the registry
// carries one office per district on a standing building; the permit it acts
// on is the site nearest it on its own power district and no other lot moves
// (M4-5 — every other lot in a twin city that ran the same seconds with no
// hack is the twin's own, on the market the capture probes pin); FAST-TRACK
// works the site at full pace — the pace the same site works at on a full
// market, measured on a twin — for a minute, and the market takes it back;
// FREEZE holds the site's height, stage and progress exact for two minutes
// and thaws; the lot note's own line (decline.js describe, the line
// render/lotnote.js paints) names the hack while it holds; and the refusals
// say why.
//
// Not proved here, and why: firing the hack by aim and key, and a unit that
// watches it raising heat, are the applier's and the police's
// (src/game/input.js's onFire, src/sim/wanted.js's drive) — files this task
// does not own, exactly as M6.T7's file says of the signal hack. The radio
// line for both kinds is dispatch's own, already green in
// tests/accept/m6-t6.spec.js, which names FAST-TRACK and FREEZE among the
// lines it writes for a witnessed hack of every kind.
import { test, expect } from '@playwright/test';
import { STAGE, builtHeight, createCity, hackPermit, tickZoning } from '../../src/sim/zoning.js';
import { describe, pinDemand } from '../../src/sim/decline.js';
import { createMap } from '../../src/sim/map.js';
import { createStreet, isDark, tickStreet } from '../../src/sim/street.js';
import { createClock, tickClock } from '../../src/sim/clock.js';
import { createHackables, syncHackables, HACKS } from '../../src/sim/hackables.js';

const DT = 0.05;
const SEEDS = [7, 11, 22, 33, 73];
// The frame loop's own order and step (main.js tickSim), run out here: the
// world works this long before the hack — long enough that a district stands
// two sites, one of them fresh — and this long before a district has built its
// sites and has no permit left to act on.
const WARM = 20, DRY = 30;
// The market every use is held at while the hacks are watched: above the
// growth band's floor, so a site works, and low enough that a fast-tracked
// permit visibly doubles what it does. The same pinDemand the capture probes
// hold a market with, so the reach A/B below is the sim's own.
const MARKET = 0.5;
// The window a pace is measured over — short enough that no site finishes its
// stage inside it, long enough to read.
const STEP = 1;
// The freeze is walked in these steps, and the minute a fast-track runs.
const FREEZE_STEP = 15, FREEZE_STEPS = 8, FAST_SECS = 60;
// How much more a fast-tracked site climbs than the same site at the same
// market: full pace against the market's own is a near double.
const DOUBLE = 1.5;

function build(seed, secs = WARM) {
  const map = createMap(seed);
  const city = createCity(seed, map);
  const street = createStreet(seed, map);
  const clock = createClock();
  const reg = createHackables({ map, city, street });
  const run = (secs2) => {
    // Whole steps, never a float clock: a twin and a hacked city must run the
    // same number of ticks and differ in nothing but the hack.
    for (let n = Math.round(secs2 / DT); n > 0; n--) {
      tickClock(clock, DT);
      tickStreet(street, DT);
      tickZoning(city, DT, street);
      syncHackables(reg, { map, street, city });
    }
  };
  run(secs);
  return { map, city, street, reg, run };
}

function pinAll(city) {
  for (const use of ['res', 'com', 'ind']) pinDemand(city, use, MARKET);
}

// The office's own permit: the site nearest it on the office's power district.
function permitOf(city, office) {
  let best = null;
  city.parcels.forEach((p, i) => {
    if (p.kind !== 'lot' || p.stage !== STAGE.SITE) return;
    if (office.district !== null && p.powerZone !== office.district) return;
    const d = Math.hypot(p.x - office.x, p.z - office.z);
    if (!best || d < best.d) best = { i, p, d };
  });
  return best;
}

// The office to hack, its permit, and the site beside it that keeps working:
// the office whose permit is freshest, so no site finishes a stage inside a
// measurement window.
function scene(reg, city) {
  let best = null;
  for (const office of reg.list.filter((e) => e.kind === 'planning')) {
    const target = permitOf(city, office);
    const control = target && city.parcels.map((p, i) => ({ p, i }))
      .filter((q) => q.i !== target.i && q.p.kind === 'lot' && q.p.stage === STAGE.SITE
        && q.p.powerZone === target.p.powerZone)
      .sort((a, b) => Math.hypot(a.p.x - office.x, a.p.z - office.z)
        - Math.hypot(b.p.x - office.x, b.p.z - office.z))[0];
    if (!control) continue;
    if (!best || target.p.progress < best.target.p.progress) best = { office, target, control };
  }
  return best;
}

// The units a lot has climbed toward its next stage since it broke ground:
// continuous across a stage change, so a pace reads the same either side.
const climb = (p) => (p.stage - STAGE.SITE) + p.progress;
const note = (map, p) => describe(p, map) ?? '';
// Every lot but the hacked one is the twin's own (M4-5).
function reach(city, twin, skipLot) {
  city.parcels.forEach((p, i) => {
    if (i === skipLot) return;
    const q = twin.city.parcels[i];
    expect(p.stage, `lot ${i} stands at the twin's stage`).toBe(q.stage);
    expect(p.progress, `lot ${i} has the twin's progress`).toBeCloseTo(q.progress, 9);
  });
}

test.describe('the registry carries a planning office for every district', () => {
  for (const seed of SEEDS) {
    test(`seed ${seed}: one office per district, on a standing building`, () => {
      const { map, reg } = build(seed);
      const areas = map.districts ?? [{ id: 0 }];
      const offices = reg.list.filter((e) => e.kind === 'planning');
      expect(offices.length, 'a building per district').toBe(areas.length);
      for (const e of offices) {
        expect(e.name).toBe('PLANNING OFFICE');
        expect(e.cost, 'the default hack\'s cost').toBe(2);
        expect(e.hacks.map((h) => h.id)).toEqual(['permit_fast', 'permit_freeze']);
        expect(areas.some((a) => a.id === e.district), 'the office names its district').toBe(true);
        expect(e.ref && e.ref.kind !== 'lot', 'the office stands in a building').toBe(true);
      }
    });
  }
});

for (const seed of SEEDS) {
  test(`seed ${seed}: FAST-TRACK works the site at full pace for a minute, and the market takes it back`, () => {
    const { map, city, street, reg, run } = build(seed);
    const sceneAt = scene(reg, city);
    expect(sceneAt, 'a district with a site and one beside it').toBeTruthy();
    const { office, target, control } = sceneAt;
    // The permit the applier takes is the site nearest the office on its own
    // district, and nothing else.
    const near = city.parcels.map((p, i) => ({ p, i }))
      .filter((q) => q.p.kind === 'lot' && q.p.stage === STAGE.SITE && q.p.powerZone === office.district)
      .sort((a, b) => Math.hypot(a.p.x - office.x, a.p.z - office.z)
        - Math.hypot(b.p.x - office.x, b.p.z - office.z))[0];
    expect(target.i, 'the office acts on its nearest site').toBe(near.i);

    pinAll(city);
    // The twin at a full market: the same seed, the same seconds, the same
    // site, working at full pace. That is what a fast-track is worth.
    const full = build(seed);
    pinDemand(full.city, target.p.use, 1);
    const fullLot = full.city.parcels[target.i];
    const fullFrom = climb(fullLot);
    full.run(STEP);
    const fullPace = climb(fullLot) - fullFrom;

    const from = climb(target.p), controlFrom = climb(control.p);
    run(STEP);
    const marketPace = climb(target.p) - from;
    const controlPace = climb(control.p) - controlFrom;
    expect(marketPace, 'the site is working before the key').toBeGreaterThan(0);

    expect(hackPermit(city, office, HACKS.permit_fast), 'the applier takes the hack').toBe(null);
    expect(note(map, target.p), 'the lot note names the fast-track').toContain('permit fast-tracked');
    run(STEP);
    const fastPace = climb(target.p) - from - marketPace;
    expect(fastPace, 'the fast-tracked site climbs at full pace').toBeCloseTo(fullPace, 6);
    expect(fastPace, 'nearly twice the market\'s own pace').toBeGreaterThan(marketPace * DOUBLE);
    expect(climb(control.p) - controlFrom - controlPace,
      'the site beside it keeps the market\'s pace').toBeCloseTo(controlPace, 6);
    for (let z = 0; z < street.zones.length; z++) {
      expect(isDark(street, z), 'no district went dark').toBe(false);
    }

    // The minute runs out: the same site, the same market, the market's pace.
    run(FAST_SECS - STEP);
    const backFrom = climb(target.p);
    run(STEP);
    const backPace = climb(target.p) - backFrom;
    expect(backPace, 'the site is still working after the minute').toBeGreaterThan(0);
    expect(backPace, 'and works at the market\'s pace, not the permit\'s')
      .toBeLessThan(fullPace * 0.85);
    expect(note(map, target.p), 'the note no longer names the permit').not.toContain('permit');

    // The reach (M4-5): the twin ran the same seconds with no hack, on the
    // same pinned market. Every lot but the hacked one is the twin's own.
    const twin = build(seed);
    pinAll(twin.city);
    twin.run(FAST_SECS + 2 * STEP);
    reach(city, twin, target.i);
  });

  test(`seed ${seed}: FREEZE holds the permit for two minutes and touches no other lot`, () => {
    const { map, city, street, reg, run } = build(seed);
    const sceneAt = scene(reg, city);
    expect(sceneAt, 'a district with a site and one beside it').toBeTruthy();
    const { office, target, control } = sceneAt;
    pinAll(city);
    const controlFrom = climb(control.p);
    run(STEP);
    expect(climb(target.p), 'the site is working before the key').toBeGreaterThan(0);

    const twin = build(seed);
    pinAll(twin.city);
    twin.run(STEP);
    expect(hackPermit(city, office, HACKS.permit_freeze), 'the applier takes the hack').toBe(null);
    const held = { stage: target.p.stage, progress: target.p.progress, height: builtHeight(target.p) };
    expect(note(map, target.p), 'the lot note names the frozen permit').toContain('permit frozen');

    // The two minutes, walked in steps: nothing moves at any step inside them.
    let frozen = 0;
    for (let step = 0; step < FREEZE_STEPS; step++) {
      expect(target.p.stage, `after ${frozen}s the site is still held`).toBe(held.stage);
      expect(target.p.progress, `after ${frozen}s of the freeze it has done nothing`).toBe(held.progress);
      expect(builtHeight(target.p), `after ${frozen}s it stands as it stood`).toBe(held.height);
      expect(note(map, target.p), 'the note still names the freeze').toContain('permit frozen');
      expect(climb(control.p), `after ${frozen}s the site beside it has climbed`)
        .toBeGreaterThan(controlFrom);
      run(FREEZE_STEP);
      frozen += FREEZE_STEP;
      if (builtHeight(target.p) > held.height) break;
    }
    expect(frozen, 'the freeze runs two minutes, not a moment').toBeGreaterThan(100);
    expect(frozen, 'and not for good').toBeLessThanOrEqual(135);
    run(STEP);
    expect(builtHeight(target.p), 'the permit thaws and the site works again').toBeGreaterThan(held.height);
    expect(note(map, target.p), 'the note no longer names the freeze').not.toContain('permit');
    for (let z = 0; z < street.zones.length; z++) {
      expect(isDark(street, z), 'no district went dark to freeze it').toBe(false);
    }

    // The reach (M4-5): the twin ran the same seconds with no hack. The frozen
    // site never changed height, so the economy never saw a difference, and
    // every other lot is the twin's own.
    twin.run(frozen + STEP);
    reach(city, twin, target.i);
  });
}

test('a hack thrown at anything but a planning office, or where no permit waits, says why', () => {
  const { reg, city } = build(11);
  expect(hackPermit(city, null, HACKS.permit_fast), 'no office in reach').toBeTruthy();
  const crane = reg.list.find((e) => e.kind === 'crane');
  expect(crane, 'the seed has a working crane to aim the wrong hack at').toBeTruthy();
  expect(hackPermit(city, crane, HACKS.permit_freeze), 'a crane is not a planning office').toBeTruthy();
  expect(hackPermit(city, reg.list.find((e) => e.kind === 'planning'), HACKS.blackout),
    'a hack the office does not offer').toBeTruthy();
  // A district whose sites have all been built: the office has no permit to
  // act on and says so, the way a stalled crane does.
  const dry = build(11, DRY);
  const office = dry.reg.list.filter((e) => e.kind === 'planning').find((e) => !permitOf(dry.city, e));
  expect(office, 'a district with no site left to permit').toBeTruthy();
  expect(hackPermit(dry.city, office, HACKS.permit_fast), 'no permit waiting there').toBeTruthy();
});
