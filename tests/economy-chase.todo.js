// A police chase scares a firm out (milestone 4c: a chase sets off a chain the
// player can watch, sized to the act). main tells the economy the suspect's zone
// and tier every frame (chaseIn); the firm that gives up on the district leaves
// FLIGHT_SECS after the chase does, and the news line says why.
import { test, expect } from '@playwright/test';
import { BLACKOUT_SECS, COLLAPSE_SECS, createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { createCity, tickZoning } from '../src/sim/zoning.js';
import { FLIGHT_PER_CHASE_SEC, FLIGHT_PER_DARK_SEC, FLIGHT_SECS, chaseIn } from '../src/sim/economy.js';
import { newsBetween, snapshot } from '../src/sim/news.js';

const SEED = 20260916;
const DT = 0.05;
const SOUTH = 0;
const NORTH = 1;

// No firm comes or goes on its own, so every move is the chase's or the cut's.
function boot() {
  const world = { city: createCity(SEED), street: createStreet(SEED) };
  for (const d of world.city.economy.districts) d.nextMove = Infinity;
  return world;
}

// One frame as main runs it: the city ticks, then the chase is told.
function run({ city, street }, secs, chase = null) {
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
    if (chase) chaseIn(city.economy, chase.zone, chase.tier);
  }
}

const fleeing = (d) => (d.firms.com >= d.firms.ind ? 'com' : 'ind');
const firmsOf = (d) => d.firms.com + d.firms.ind;

test('a firm leaves the district a chase ran through, FLIGHT_SECS after it, sized to its length and tier', () => {
  const world = boot();
  run(world, 40);
  const [south, north] = world.city.economy.districts;
  const before = { south: { ...south.firms }, north: { ...north.firms } };
  const use = fleeing(north);
  run(world, 30, { zone: NORTH, tier: 2 });
  expect(north.last, 'nobody leaves while the chase is on').toBe(null);
  run(world, FLIGHT_SECS - 0.5);
  expect(north.last, 'nobody leaves the moment it ends').toBe(null);
  run(world, 1);
  expect(north.last).toMatchObject({ use, cause: 'chase' });
  const sized = north.size * FLIGHT_PER_CHASE_SEC * 2 * 30;
  expect(Math.abs(-north.last.jobs / sized - 1), 'jobs for every second per tier').toBeLessThan(0.02);
  expect(north.firms[use]).toBeCloseTo(before.north[use] + north.last.jobs, 6);
  expect(south.last, 'the district the chase never touched keeps its firms').toBe(null);
  expect(south.firms).toEqual(before.south);
});

test('a hotter chase drives out more, and tier 0 or an unknown zone drives out nothing', () => {
  const lost = (tier) => {
    const world = boot();
    run(world, 40);
    const north = world.city.economy.districts[NORTH];
    const was = firmsOf(north);
    run(world, 20, { zone: NORTH, tier });
    run(world, FLIGHT_SECS + 1);
    return was - firmsOf(north);
  };
  expect(lost(0)).toBe(0);
  expect(lost(1)).toBeGreaterThan(0);
  expect(lost(3) / lost(1)).toBeCloseTo(3, 3);
  const world = boot();
  run(world, 40);
  const was = world.city.economy.districts.map(firmsOf);
  run(world, 20, { zone: 7, tier: 3 });
  run(world, FLIGHT_SECS + 1);
  expect(world.city.economy.districts.map(firmsOf)).toEqual(was);
});

test('a hack and the chase it starts each drive out their own firm, and the news says why', () => {
  const world = boot();
  run(world, 40);
  const south = world.city.economy.districts[SOUTH];
  const was = firmsOf(south);
  expect(hackBlackout(world.street, SOUTH)).toBeGreaterThan(0);
  const before = snapshot(world.city, { list: [] }, world.street);
  const lines = [];
  let last = before;
  const watch = (secs, chase) => {
    for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
      run(world, DT, chase);
      const now = snapshot(world.city, { list: [] }, world.street);
      lines.push(...newsBetween(last, now, world.city));
      last = now;
    }
  };
  while (isDark(world.street, SOUTH)) watch(DT, { zone: SOUTH, tier: 1 });
  watch(10, { zone: SOUTH, tier: 1 });
  watch(FLIGHT_SECS + 1);
  const dark = south.size * FLIGHT_PER_DARK_SEC * (BLACKOUT_SECS + COLLAPSE_SECS);
  const chase = south.size * FLIGHT_PER_CHASE_SEC * (BLACKOUT_SECS + COLLAPSE_SECS + 10);
  expect(Math.abs((was - firmsOf(south)) / (dark + chase) - 1), 'both flights, each its own size').toBeLessThan(0.02);
  expect(lines.some((l) => /jobs left the south district after the power cut$/.test(l)), lines.join('\n')).toBe(true);
  expect(lines.some((l) => /jobs left the south district after the police chase$/.test(l)), lines.join('\n')).toBe(true);
});
