// M5-5 substation (M5.T12): A/B. A district the player serves with two
// substations comes back from the H hack's blackout in half the dark time; one
// is not enough, and a pair in one district leaves the other's blackout whole.
// Node only, one seed per process (m5-noroad.test.js's worker shape): the
// service is an ops.js parcel on an empty lot, the effect in street.js darkUntil.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05, HACK_CAP = 60;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet, tickStreet, hackBlackout, isDark, BLACKOUT_SECS, COLLAPSE_SECS } =
    await import('../../src/sim/street.js');
  const { placeService } = await import('../../src/sim/ops.js');

  // One fresh world the way main.js builds one: the seed's map, the city's own
  // parcels in it, and a street reading that same map.
  function world() {
    const map = createMap(seed);
    const street = createStreet(seed, map);
    const city = createCity(seed, map);
    return { map, city, street };
  }
  const empties = (w, zone) => w.city.parcels
    .filter((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY && p.powerZone === zone);
  // The darkUntil the hack set, then the ticks it takes isDark to clear.
  function blackout(w, zone) {
    if (hackBlackout(w.street, zone) === 0) throw new Error(`seed ${seed}: hack refused`);
    const start = w.street.time;
    const set = w.street.zones[zone].darkUntil - start;
    let ticked = 0;
    while (isDark(w.street, zone)) {
      tickStreet(w.street, DT);
      ticked += DT;
      if (ticked > HACK_CAP) throw new Error(`seed ${seed}: zone ${zone} never came back`);
    }
    return { set, ticked };
  }

  // A control, B one substation, C a pair and its neighbour's own blackout.
  const a = world();
  const zone = empties(a, 1).length > empties(a, 0).length ? 1 : 0;
  const base = blackout(a, zone);
  const b = world();
  placeService(b.map, empties(b, zone)[0], 'substation');
  const single = blackout(b, zone);
  const c = world();
  for (const lot of empties(c, zone).slice(0, 2)) placeService(c.map, lot, 'substation');
  const pair = blackout(c, zone);
  const neighbour = blackout(c, 1 - zone);

  process.stdout.write(`${JSON.stringify({
    seed, zone, expect: BLACKOUT_SECS + COLLAPSE_SECS, base, single, pair, neighbour,
    services: c.city.parcels
      .filter((p) => p.kind === 'service' && p.type === 'substation' && p.powerZone === zone).length,
  })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(120000);
for (const seed of SEEDS) {
  test(`M5-5 substation seed ${seed}: a district with two comes back in half the dark time`, () => {
    const r = row(seed);
    const full = r.base.set;
    expect(r.services, `seed ${seed}: two substations stand in zone ${r.zone}`).toBe(2);
    expect(full, `seed ${seed}: the hack sets its own full dark time`).toBeCloseTo(r.expect, 9);
    expect(r.single.set, `seed ${seed}: one substation is not a pair`).toBeCloseTo(full, 9);
    expect(r.pair.set, `seed ${seed}: the pair halves the district's dark time`).toBeCloseTo(full / 2, 9);
    expect(r.neighbour.set, `seed ${seed}: the pair reaches only its own district`).toBeCloseTo(full, 9);
    for (const [name, m] of [['base', r.base], ['pair', r.pair]]) {
      expect(m.ticked, `seed ${seed}: ${name} comes back when its darkUntil says`).toBeGreaterThanOrEqual(m.set - 1e-9);
      expect(m.ticked, `seed ${seed}: ${name} comes back within a tick of its darkUntil`).toBeLessThan(m.set + DT + 1e-9);
    }
  });
}
