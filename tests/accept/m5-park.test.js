// M5-5 park (M5.T16, docs/ROADMAP.md): A/B. Home demand rises at least 0.05 in
// the district a park reaches — the park's own 100 m catchment and its capacity
// (SERVICES.park, ops.js serviceReach) — against the same district in an
// untouched twin of the same world, and a second park in that catchment adds
// capacity and not a second lift. Node only, one seed per process
// (m5-noroad.test.js's worker shape): the worker builds every world the way
// main.js builds one — the seed's map, a street and a city on it — and steps
// them by the frame loop's own 50 ms. A park is an ops.js service parcel on the
// district's emptiest lot; the buildings it lifts lie inside serviceReach (the
// catchment-with-capacity rule of M5-5).
//
// The window is the district's home demand settling on the price the market
// quotes for homes: the market is frozen (no firm moves) and the lots keep the
// floor they opened with, so the two twins quote the same price but for the
// park and the whole difference is the service. Demand chases price with a
// MARKET_LAG_SECS lag (economy.js), so the window is five of those lags — long
// enough for the rise to land, and each row carries the settled demand beside
// the price it settled on so the check says so.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05;
const LAGS = 5;                    // the window is this many market lags long
const RISE = 0.05;                 // the lift docs/ROADMAP.md asks for
const RADIUS = 100;                // SERVICES.park.radius, docs/CITYVIEW.md
const COUNTS = { one: 1, two: 2 };

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
  // catchment, and empty lots to build the park (and the second one) on.
  function pickZone(map) {
    for (let z = 0; z < map.districts.length; z++) {
      if (stands(map, z).length >= 4 && empties(map, z).length >= 2) return z;
    }
    throw new Error(`seed ${seed}: no district has standing buildings and two empty lots`);
  }

  // A frozen market: no firm moves, so the jobs and homes the price is struck
  // against stand still for the whole window and only the park differs.
  function freeze(city) {
    for (const d of city.economy.districts) Object.assign(d, { firms: { com: 0, ind: 0 }, nextMove: Infinity });
  }

  // Where `zone`'s home demand settles, with `parks` parks on its emptiest
  // lots: the market frozen and stepped by the frame's own 50 ms for five lags,
  // so the demand has all but landed on the price the district quotes.
  function settle(w, zone, parks) {
    for (const lot of empties(w.map, zone).slice(0, parks)) placeService(w.map, lot, 'park');
    freeze(w.city);
    const d = w.city.economy.districts[zone];
    const ticks = Math.round(probeConstants().marketLagSecs * LAGS / DT);
    for (let i = 0; i < ticks; i++) tickEconomy(w.city.economy, w.city.parcels, () => 0, w.street, DT);
    return { demand: d.demand.res, price: d.price.res };
  }

  const A = world();
  const zone = pickZone(A.map);
  const base = settle(A, zone, 0);

  const rows = Object.fromEntries(Object.entries(COUNTS).map(([name, count]) => {
    const B = world();
    const settled = settle(B, zone, count);
    const reach = serviceReach(B.map.parcels, 'park');
    return [name, {
      services: servicesOf(B.map.parcels, 'park').filter((p) => p.powerZone === zone).length,
      served: [...reach.keys()].filter((p) => p.powerZone === zone).length,
      ...settled,
    }];
  }));

  process.stdout.write(`${JSON.stringify({
    seed, zone, lag: probeConstants().marketLagSecs, radius: SERVICES.park.radius, base, rows,
  })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(180000);
for (const seed of SEEDS) {
  test(`M5-5 park seed ${seed}: home demand rises at least ${RISE} in the district a park reaches`, () => {
    const r = row(seed);
    const { base, rows, zone } = r;
    expect(r.radius, `seed ${seed}: the catchment is the documented ${RADIUS} m`).toBe(RADIUS);
    // The window is long enough for the demand to land on the quoted price, so
    // what is measured is a rise the district settles at and not a transient.
    for (const [name, m] of [['untouched', base], ...Object.entries(rows)]) {
      expect(Math.abs(m.demand - m.price),
        `seed ${seed}: the ${name} district settled its demand at ${m.demand} on the price ${m.price} over ${r.lag * LAGS} s`)
        .toBeLessThan(0.01);
    }
    // The park stands on a lot, and reaches standing buildings in the district.
    expect(rows.one.services, `seed ${seed}: the park stands in district ${zone}`).toBe(1);
    expect(rows.one.served, `seed ${seed}: the park serves buildings inside its catchment`)
      .toBeGreaterThan(0);
    const lift = rows.one.demand - base.demand;
    expect(lift, `seed ${seed}: with the park home demand sits at ${rows.one.demand} against ${base.demand} untouched`)
      .toBeGreaterThanOrEqual(RISE);
    // Capacity, not a second lift: the second park serves the buildings the
    // first left unreachable, and demand rises no further.
    expect(rows.two.services, `seed ${seed}: two parks stand in district ${zone}`).toBe(2);
    expect(rows.two.served, `seed ${seed}: the second park adds capacity`)
      .toBeGreaterThanOrEqual(rows.one.served);
    const pair = rows.two.demand - base.demand;
    expect(pair, `seed ${seed}: the second park does not lift demand further (${pair.toFixed(3)} against one park's ${lift.toFixed(3)})`)
      .toBeLessThanOrEqual(lift + 0.02);
  });
}
