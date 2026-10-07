// M5.T9 (M5-4, docs/ROADMAP.md): new land grows. The empty lots the district
// leaves unzoned are its new land (sim/zoning.js freeLand), each fronting a
// road the city laid: zoned R, one shows its first floor within 60 game seconds
// (M1-1's bar). A lot the cap brush paints low-rise (M5.T8) reaches LOW and
// stops there, however long the market runs.
//
// Node only: the sim is pure (law 5), so the whole city runs in milliseconds
// without a page. The ticks are the frame loop's own 50 ms steps, street first,
// then the city reading its power — exactly how main.js ticks them.
import { test, expect } from '@playwright/test';
import { createMap, frontageRoad } from '../../src/sim/map.js';
import { createStreet, tickStreet } from '../../src/sim/street.js';
import { STAGE, builtHeight, capParcel, createCity, tickZoning, zoneParcel } from '../../src/sim/zoning.js';

const SEEDS = [7, 11, 22, 33, 73];
const DT = 0.05, FIRST = 60, CAPPED = 300;

// The city's new land: the empty lots it never zoned (sim/zoning.js freeLand).
const freeLots = (city) => city.parcels.map((p, i) => [p, i])
  .filter(([p]) => p.kind === 'lot' && p.stage === STAGE.EMPTY && p.zoned === null);

// The frame loop's tick order, at the fixed 50 ms step, for `secs` of game time.
function run(world, secs, each = () => {}) {
  for (let t = 0; t < secs; t += DT) {
    tickStreet(world.street, DT);
    tickZoning(world.city, DT, world.street);
    each();
  }
}

test('M5-T9: new land zoned R shows a first floor in 60 game s, and a capped lot stops at LOW', () => {
  const late = [], cappedWrong = [];
  for (const seed of SEEDS) {
    const map = createMap(seed);
    const city = createCity(seed, map);
    const street = createStreet(seed, map);
    const free = freeLots(city);
    expect(free.length, `seed ${seed}: the city left new land to zone`).toBeGreaterThanOrEqual(2);
    for (const [p] of free) {
      expect(frontageRoad(map, p), `seed ${seed}: new land fronts a road`).not.toBeNull();
    }

    // One free lot zoned R: its first floor inside M1-1's bar.
    const [grow] = free[0];
    expect(zoneParcel(city, free[0][1], 'res'), `seed ${seed}: the R brush zones the lot`).toBe(true);
    run({ city, street }, FIRST);
    if (!(builtHeight(grow) > 0)) {
      late.push(`seed ${seed}: no first floor in ${FIRST} game s (stage ${grow.stage})`);
    }

    // Another, capped low-rise before it is zoned: it reaches LOW and no further.
    const [capped] = free[1];
    expect(capParcel(city, free[1][1], STAGE.LOW), `seed ${seed}: the cap brush paints the lot low-rise`).toBe(true);
    zoneParcel(city, free[1][1], 'res');
    let tallest = capped.stage;
    run({ city, street }, CAPPED, () => { tallest = Math.max(tallest, capped.stage); });
    if (tallest !== STAGE.LOW) {
      cappedWrong.push(`seed ${seed}: capped lot reached stage ${tallest}, wanted LOW`);
    }
  }
  expect(late, `first floor within ${FIRST} game seconds:\n${late.join('\n')}`).toEqual([]);
  expect(cappedWrong, `capped lots stop at LOW:\n${cappedWrong.join('\n')}`).toEqual([]);
});
