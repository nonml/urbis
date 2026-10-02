// Every job on the lots is held by a real resident (milestone 3): a shop or a
// workshop fills from the people out of work who live nearest, keeps its
// longest-serving staff when it shrinks, and nobody loses a job for no reason.
import { test, expect } from '@playwright/test';
import { STAGE, createCity } from '../src/sim/zoning.js';
import { census, createPeople, lotPeople, tickPeople } from '../src/sim/people.js';

const SEED = 20260916;

function builtCity(uses) {
  const city = createCity(SEED);
  city.parcels.forEach((p, i) => {
    p.use = uses[i % uses.length];
    p.zoned = p.use;
    p.stage = STAGE.MID;
    p.progress = 0;
    p.vacancy = 0;
  });
  return city;
}

const staffOf = (people, j) => people.list.filter((q) => q.job === j);
const places = (city) => city.parcels.reduce((n, p) => n + (p.use === 'res' ? 0 : lotPeople(p)), 0);

function expectStaffed(people, city) {
  city.parcels.forEach((p, j) => {
    const staff = staffOf(people, j).length;
    if (p.use === 'res' || !p.use) expect(staff, `lot ${j} is not a workplace`).toBe(0);
    else expect(staff <= lotPeople(p), `lot ${j}: ${staff} staff for ${lotPeople(p)} places`).toBe(true);
  });
  const { residents, workers } = census(people);
  expect(workers, 'every place that can be filled is').toBe(Math.min(residents, places(city)));
}

test('jobs fill up to the places there are, whichever runs short', () => {
  for (const uses of [['res', 'com', 'ind'], ['res', 'res', 'res', 'com'], ['res', 'com', 'com', 'ind', 'ind']]) {
    const city = builtCity(uses);
    const people = createPeople(7);
    tickPeople(people, city);
    expectStaffed(people, city);
  }
});

test('a job goes to the nearest person out of work', () => {
  const city = builtCity(['res', 'res', 'res', 'com']);
  const people = createPeople(7);
  tickPeople(people, city);
  // More residents than places: everyone hired lives at least as near as anyone left out.
  const dist = (q, j) => Math.hypot(city.parcels[q.home].x - city.parcels[j].x, city.parcels[q.home].z - city.parcels[j].z);
  const idle = people.list.filter((q) => q.job === null);
  expect(idle.length).toBeGreaterThan(0);
  city.parcels.forEach((p, j) => {
    if (p.use === 'res') return;
    const staff = staffOf(people, j);
    if (!staff.length) return;
    const farthest = Math.max(...staff.map((q) => dist(q, j)));
    const nearestIdle = Math.min(...idle.map((q) => dist(q, j)));
    expect(farthest <= nearestIdle + 1e-9, `lot ${j}: hired from ${farthest.toFixed(1)} m, idle at ${nearestIdle.toFixed(1)} m`)
      .toBe(true);
  });
});

test('nobody changes job when nothing changed', () => {
  const city = builtCity(['res', 'com', 'ind']);
  const people = createPeople(7);
  tickPeople(people, city);
  const before = structuredClone(people.list);
  tickPeople(people, city);
  expect(people.list).toEqual(before);
});

test('a shrinking workplace keeps its longest-serving staff, and the rest find work or go idle', () => {
  const city = builtCity(['res', 'res', 'com', 'ind']);
  const people = createPeople(7);
  tickPeople(people, city);
  const j = city.parcels.findIndex((p) => p.use === 'com');
  const was = staffOf(people, j).map((q) => q.id);
  city.parcels[j].vacancy = 0.6;
  tickPeople(people, city);
  const kept = staffOf(people, j).map((q) => q.id);
  expect(kept.length).toBe(Math.min(was.length, lotPeople(city.parcels[j])));
  expect(kept).toEqual(was.slice(0, kept.length));
  expectStaffed(people, city);
});

test('when a home empties its people leave, and their places go to someone else', () => {
  const city = builtCity(['res', 'res', 'res', 'com']);
  const people = createPeople(7);
  tickPeople(people, city);
  const i = city.parcels.findIndex((p) => p.use === 'res');
  const leaving = new Set(people.list.filter((q) => q.home === i).map((q) => q.id));
  city.parcels[i].use = 'ind';
  tickPeople(people, city);
  expect(people.list.some((q) => leaving.has(q.id))).toBe(false);
  expectStaffed(people, city);
});
