// A power cut drives a firm out (milestone 4: a poke sets off a chain the player
// can watch, sized to the act). The cut is the player's hack; the firm that gives
// up on the dark district is the line the news reports; the floor the district
// then wants less of is what its lots show over the next minutes.
import { test, expect } from '@playwright/test';
import { BLACKOUT_SECS, COLLAPSE_SECS, createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { createCity, tickZoning } from '../src/sim/zoning.js';
import { FLIGHT_PER_DARK_SEC, FLIGHT_SECS, districtReport } from '../src/sim/economy.js';

const SEED = 20260916;
const DT = 0.05;
const SOUTH = 0;
const NORTH = 1;

// No firm comes or goes on its own, so every move is the cut's.
function boot() {
  const world = { city: createCity(SEED), street: createStreet(SEED) };
  for (const d of world.city.economy.districts) d.nextMove = Infinity;
  return world;
}

function run({ city, street }, secs) {
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
  }
}

function sitOutTheCut(world, zone) {
  expect(hackBlackout(world.street, zone)).toBeGreaterThan(0);
  while (isDark(world.street, zone)) run(world, DT);
}

const fleeing = (d) => (d.firms.com >= d.firms.ind ? 'com' : 'ind');

test('a firm leaves the district that went dark, FLIGHT_SECS after the power is back, sized to the cut', () => {
  const world = boot();
  run(world, 40);
  const [south, north] = world.city.economy.districts;
  const before = { south: { ...south.firms }, north: { ...north.firms } };
  const use = fleeing(south);
  sitOutTheCut(world, SOUTH);
  run(world, FLIGHT_SECS - 0.5);
  expect(south.last, 'nobody leaves while the lights are barely back').toBe(null);
  run(world, 1);
  expect(south.last).toMatchObject({ use, cause: 'dark' });
  const sized = south.size * FLIGHT_PER_DARK_SEC * (BLACKOUT_SECS + COLLAPSE_SECS);
  expect(Math.abs(-south.last.jobs / sized - 1), 'jobs for every second dark').toBeLessThan(0.02);
  expect(south.firms[use]).toBeCloseTo(before.south[use] + south.last.jobs, 6);
  const other = use === 'com' ? 'ind' : 'com';
  expect(south.firms[other]).toBe(before.south[other]);
  expect(north.last, 'the lit district keeps its firms').toBe(null);
  expect(north.firms).toEqual(before.north);
});

test('every cut drives out its own firm, and a district with none has none to lose', () => {
  const world = boot();
  run(world, 40);
  const south = world.city.economy.districts[SOUTH];
  sitOutTheCut(world, SOUTH);
  run(world, FLIGHT_SECS + 0.5);
  const first = south.last;
  expect(first?.cause).toBe('dark');
  run(world, 5);
  expect(south.last, 'one cut, one firm').toBe(first);
  sitOutTheCut(world, SOUTH);
  run(world, FLIGHT_SECS + 0.5);
  expect(south.last).not.toBe(first);
  expect(south.last?.cause).toBe('dark');

  const empty = boot();
  run(empty, 40);
  const bare = empty.city.economy.districts[SOUTH];
  bare.firms = { com: 0, ind: 0 };
  sitOutTheCut(empty, SOUTH);
  run(empty, FLIGHT_SECS + 1);
  expect(bare.last).toBe(null);
  expect(bare.firms).toEqual({ com: 0, ind: 0 });
});

test('the flight leaves the other district alone, and the dark one wants less of what left', () => {
  const hacked = boot();
  const twin = boot();
  run(hacked, 40);
  run(twin, 40);
  const use = fleeing(hacked.city.economy.districts[SOUTH]);
  expect(hackBlackout(hacked.street, SOUTH)).toBeGreaterThan(0);
  for (let s = 0; s < 90; s++) {
    run(hacked, 1);
    run(twin, 1);
    expect(districtReport(hacked.city)[NORTH]).toEqual(districtReport(twin.city)[NORTH]);
  }
  // A minute and a half on, the wealth the cut drained is earned back; what is
  // still missing is the firm.
  const [h, t] = [districtReport(hacked.city)[SOUTH], districtReport(twin.city)[SOUTH]];
  expect(Math.abs(h.wealth - t.wealth)).toBeLessThan(0.03);
  expect(h.demand[use]).toBeLessThan(t.demand[use] - 0.1);
});
