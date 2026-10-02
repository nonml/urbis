// The people are in the save (milestone 3): a continued game has the same
// residents with the same homes and jobs, and the next person to move in is the
// one who would have come without the save. A save from before the people
// (version 1) starts a new game, like any other old save.
import { test, expect } from '@playwright/test';
import { createClock, tickClock } from '../src/sim/clock.js';
import { createInterior } from '../src/sim/interior.js';
import { createMission } from '../src/sim/mission.js';
import { createPeople, newPerson, tickPeople } from '../src/sim/people.js';
import { createPlayer } from '../src/sim/player.js';
import { createStreet, tickStreet } from '../src/sim/street.js';
import { createPlayerCar } from '../src/sim/vehicle.js';
import { createCity, tickZoning } from '../src/sim/zoning.js';
import { SAVE_VERSION, deserialize, serialize } from '../src/sim/save.js';

const SEED = 20260916;
const DT = 0.05;

function boot() {
  return {
    seed: SEED,
    clock: createClock(),
    street: createStreet(SEED),
    city: createCity(SEED),
    player: Object.assign(createPlayer(), { mode: 'foot' }),
    car: createPlayerCar(),
    interior: createInterior(),
    mission: createMission(),
    people: createPeople(SEED),
  };
}

function run(world, secs) {
  for (let t = 0; t < secs; t += DT) {
    tickClock(world.clock, DT);
    tickStreet(world.street, DT);
    tickZoning(world.city, DT, world.street);
    tickPeople(world.people, world.city);
  }
}

const roundTrip = (world) => deserialize(JSON.parse(JSON.stringify(serialize(world))));

// A grown district with some churn behind it, so ids and the stream have moved on.
function grown() {
  const world = boot();
  run(world, 240);
  expect(world.people.list.length).toBeGreaterThan(10);
  return world;
}

test('the save is version 2', () => {
  expect(SAVE_VERSION).toBe(2);
});

test('a continued game has the same people, homes and jobs', () => {
  const world = grown();
  const restored = roundTrip(world);
  expect(restored).not.toBeNull();
  expect(restored.people.list).toEqual(world.people.list);
  expect(restored.people.nextId).toBe(world.people.nextId);
});

test('the next newcomer is the one who would have come', () => {
  const world = grown();
  const restored = roundTrip(world);
  expect(newPerson(restored.people, 0)).toEqual(newPerson(world.people, 0));
  run(world, 60);
  run(restored, 60);
  expect(restored.people.list).toEqual(world.people.list);
});

test('the clock comes back at the same hour of the same day', () => {
  const world = grown();
  const restored = roundTrip(world);
  expect(restored.clock.hour).toBe(world.clock.hour);
  expect(restored.clock.day).toBe(world.clock.day);
});

test('an old save or a corrupt person starts a new game', () => {
  const world = grown();
  const data = JSON.parse(JSON.stringify(serialize(world)));
  const without = { ...data };
  delete without.people;
  expect(deserialize(without)).toBeNull();
  expect(deserialize({ ...data, version: 1 })).toBeNull();
  const broken = (change) => {
    const s = JSON.parse(JSON.stringify(data));
    change(s.people);
    return deserialize(s);
  };
  expect(broken((p) => { p.list[0].home = 'x'; })).toBeNull();
  expect(broken((p) => { p.list[0].home = world.city.parcels.length; })).toBeNull();
  expect(broken((p) => { p.list[0].job = 1.5; })).toBeNull();
  expect(broken((p) => { p.list[0].name = 3; })).toBeNull();
  expect(broken((p) => { p.nextId = 'soon'; })).toBeNull();
  expect(broken((p) => { p.list = 'everyone'; })).toBeNull();
  expect(broken(() => {})).not.toBeNull();
});
