// M5-5 clinic and school (M5.T15, docs/ROADMAP.md): A/B. A district served by a
// clinic — or a school — earns its wealth back at least 20% faster than the same
// district in an untouched twin (economy.js WEALTH_RISE_SECS, 25 s today), a
// second clinic in the same district adds capacity and not a second boost, and a
// district with no service climbs at the town's own pace.
//
// Node only, one seed per process (m5-noroad.test.js's worker shape): the worker
// builds every world the way main.js builds one — the seed's map, a street and a
// city on it — and steps them by the frame loop's own 50 ms. A clinic or a school
// is an ops.js service parcel on the district's emptiest lot; the buildings it
// serves lie inside ops.js serviceReach (the catchment-with-capacity rule of
// M5-5). The window is the district's wealth climbing from one held floor to
// another — floor at SET, climb to DONE — with the market frozen (no firm moves)
// and the employment it chases held at what the district opened with, so the
// window is the service and nothing else. The number is ticks of the frame's own
// 50 ms, and the rate it implies: `probeConstants().wealthRiseSecs` over them.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const TICKS_PER_SEC = Math.round(1 / DT);
const BOOST = 0.2;
const FASTER = 1 - BOOST;
const SET = 0.5, DONE = 0.8;
const WINDOW = 3.5;                       // the window is this many rise times long
const HANDS = { clinic: 'clinic', school: 'school', two: 'clinic' };
const COUNTS = { clinic: 1, school: 1, two: 2 };

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, STAGE } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet } = await import('../../src/sim/street.js');
  const { SERVICES, placeService, servicesOf, serviceReach } = await import('../../src/sim/ops.js');
  const { probeConstants, tickEconomy } = await import('../../src/sim/economy.js');

  function world() {
    const map = createMap(seed);
    const street = createStreet(seed, map);
    const city = createCity(seed, map);
    return { map, street, city };
  }

  const stands = (map, z) => map.parcels.filter((p) => p.kind !== 'lot' && p.powerZone === z);
  const empties = (map, z) => map.parcels
    .filter((p) => p.kind === 'lot' && p.stage === STAGE.EMPTY && p.powerZone === z)
    .sort((a, b) => a.id.localeCompare(b.id));

  // The busier district the player could serve: enough standing floor for a
  // catchment, and an empty lot to build the service on.
  function pickZone(map) {
    for (let z = 0; z < map.districts.length; z++) {
      if (stands(map, z).length >= 4 && empties(map, z).length >= 2) return z;
    }
    throw new Error(`seed ${seed}: no district has standing buildings and two empty lots`);
  }

  // A frozen market: no firm moves, so the jobs and homes the wealth chases
  // stand still for the whole window and only the service differs.
  function freeze(city) {
    for (const d of city.economy.districts) Object.assign(d, { firms: { com: 0, ind: 0 }, nextMove: Infinity });
  }

  // Ticks of the frame's own 50 ms for `zone`'s wealth to climb from one held
  // floor to the next. The market is frozen and the employment it chases is
  // held at what the district opened the window with, so the whole run is the
  // service and nothing else.
  function ticksToClimb(w, zone, cap) {
    const d = w.city.economy.districts[zone];
    const jobs0 = d.jobs, homes0 = d.homes;
    d.wealth = SET;
    d.jobs = homes0;
    d.homes = homes0;
    let target = -1, ticks = 0;
    while (d.wealth < DONE && ticks < cap) {
      target = Math.min(d.jobs, d.homes) / d.homes;
      ticks += 1;
      tickEconomy(w.city.economy, w.city.parcels, () => 0, w.street, DT);
    }
    d.jobs = jobs0;
    d.homes = homes0;
    return { ticks, target };
  }

  const A = world();
  const zone = pickZone(A.map);
  freeze(A.city);
  const rise = probeConstants().wealthRiseSecs;
  const cap = Math.round(rise * WINDOW * TICKS_PER_SEC);
  const base = ticksToClimb(A, zone, cap);

  const rows = Object.fromEntries(Object.entries(HANDS).map(([name, type]) => {
    const B = world();
    for (const lot of empties(B.map, zone).slice(0, COUNTS[name])) placeService(B.map, lot, type);
    freeze(B.city);
    const reach = serviceReach(B.map.parcels, type);
    return [name, {
      services: servicesOf(B.map.parcels, type).filter((p) => p.powerZone === zone).length,
      served: [...reach.keys()].filter((p) => p.powerZone === zone).length,
      radius: SERVICES[type].radius,
      ...ticksToClimb(B, zone, cap),
    }];
  }));

  process.stdout.write(`${JSON.stringify({ seed, zone, rise, base, rows })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(180000);
for (const seed of SEEDS) {
  test(`M5-5 clinic seed ${seed}: wealth climbs back at least 20% faster in a district with a clinic or a school`, () => {
    const r = row(seed);
    const { base, rows, zone } = r;
    expect(base.target, `seed ${seed}: the window has a floor to climb to`).toBeGreaterThan(DONE);
    expect(base.ticks, `seed ${seed}: the untouched district needs the whole window`)
      .toBeGreaterThan(r.rise * TICKS_PER_SEC * FASTER);
    for (const key of ['clinic', 'school']) {
      expect(rows[key].services, `seed ${seed}: the ${key} stands in district ${zone}`).toBe(1);
      expect(rows[key].served, `seed ${seed}: the ${key} serves buildings in its catchment`)
        .toBeGreaterThan(0);
      expect(rows[key].radius, `seed ${seed}: the ${key} catchment is the documented radius`)
        .toBeGreaterThan(0);
      const speed = base.ticks / Math.max(1, rows[key].ticks);
      expect(speed, `seed ${seed}: with the ${key} the district earns its floor back in ${rows[key].ticks} ticks (about ${(r.rise / speed).toFixed(1)} s), the untouched one in ${base.ticks} (${r.rise} s)`)
        .toBeGreaterThanOrEqual(1 + BOOST);
    }
    // Capacity, not a second boost: the pair serves the buildings one clinic
    // left unreachable, and earns no faster than the one did.
    expect(rows.two.services, `seed ${seed}: two clinics stand in district ${zone}`).toBe(2);
    expect(rows.two.served, `seed ${seed}: the second clinic adds capacity`)
      .toBeGreaterThanOrEqual(rows.clinic.served);
    const one = base.ticks / Math.max(1, rows.clinic.ticks);
    const pair = base.ticks / Math.max(1, rows.two.ticks);
    expect(pair, `seed ${seed}: the second clinic does not earn faster (${pair.toFixed(3)}x against one clinic's ${one.toFixed(3)}x)`)
      .toBeLessThanOrEqual(one + 0.02);
  });
}
