// Every home on the lots is a real person (milestone 3): a res lot houses exactly
// as many people as its floor holds, people move in as it grows and the newest
// leave as it empties, and everyone else keeps their record.
import { test, expect } from '@playwright/test';
import { STAGE, createCity } from '../src/sim/zoning.js';
import { FIRST, LAST, AGE, createPeople, lotPeople, moveHomes } from '../src/sim/people.js';

const SEED = 20260916;

// A city whose lots all stand finished, alternating uses, nothing empty.
function builtCity() {
  const city = createCity(SEED);
  city.parcels.forEach((p, i) => {
    p.use = ['res', 'com', 'ind'][i % 3];
    p.zoned = p.use;
    p.stage = STAGE.MID;
    p.progress = 0;
    p.vacancy = 0;
  });
  return city;
}

const homesOf = (people, i) => people.list.filter((q) => q.home === i);

function expectHoused(people, city) {
  city.parcels.forEach((p, i) => {
    const want = p.use === 'res' ? lotPeople(p) : 0;
    expect(homesOf(people, i).length, `lot ${i} (${p.use})`).toBe(want);
  });
}

test('every res lot houses exactly what its floor holds, and no one lives elsewhere', () => {
  const city = builtCity();
  const people = createPeople(7);
  moveHomes(people, city);
  expect(people.list.length).toBeGreaterThan(0);
  expectHoused(people, city);
  const ids = people.list.map((q) => q.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const q of people.list) {
    const [first, last] = q.name.split(' ');
    expect(FIRST.includes(first) && LAST.includes(last), q.name).toBe(true);
    expect(q.age >= AGE[0] && q.age <= AGE[1], `${q.name} is ${q.age}`).toBe(true);
    expect(q.job).toBe(null);
  }
});

test('nothing changes when nothing changed', () => {
  const city = builtCity();
  const people = createPeople(7);
  moveHomes(people, city);
  const before = structuredClone(people.list);
  moveHomes(people, city);
  expect(people.list).toEqual(before);
});

test('a lot that grows keeps its residents and takes new ones', () => {
  const city = builtCity();
  const people = createPeople(7);
  moveHomes(people, city);
  const i = city.parcels.findIndex((p) => p.use === 'res');
  const stayed = homesOf(people, i).map((q) => ({ ...q }));
  city.parcels[i].stage = STAGE.HIGH;
  moveHomes(people, city);
  expectHoused(people, city);
  const now = homesOf(people, i);
  expect(now.length).toBeGreaterThan(stayed.length);
  expect(now.slice(0, stayed.length)).toEqual(stayed);
});

test('a lot that empties sends its newest residents away, and its rezoning sends them all', () => {
  const city = builtCity();
  const people = createPeople(7);
  moveHomes(people, city);
  const i = city.parcels.findIndex((p) => p.use === 'res');
  const was = homesOf(people, i).map((q) => q.id);
  city.parcels[i].vacancy = 0.5;
  moveHomes(people, city);
  expectHoused(people, city);
  const kept = homesOf(people, i).map((q) => q.id);
  expect(kept).toEqual(was.slice(0, kept.length));
  city.parcels[i].use = 'com';
  moveHomes(people, city);
  expect(homesOf(people, i)).toEqual([]);
  expectHoused(people, city);
});

test('the same seed grows the same people, another seed other names', () => {
  const a = createPeople(7);
  const b = createPeople(7);
  const c = createPeople(8);
  for (const people of [a, b, c]) moveHomes(people, builtCity());
  expect(a.list).toEqual(b.list);
  expect(c.list.map((q) => q.name)).not.toEqual(a.list.map((q) => q.name));
});
