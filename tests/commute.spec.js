// The street follows the clock (milestone 3): the morning rush walks to work,
// the evening rush walks home, 3am is nearly empty, and nobody pops in or out
// of sight near the player.
import { test, expect } from '@playwright/test';
import {
  ARRIVE, GOLDEN, HIDE_DIST, RUSH_AM, RUSH_PM, SHARE, commuteGoal, commuteLabel, shareOut, threshold, tickCommute,
} from '../src/sim/commute.js';

const parcels = [
  { x: 0, z: -40, use: 'res' }, // 0: a home
  { x: 0, z: 60, use: 'com' },  // 1: a job
  { x: 44, z: 0, use: 'ind' },  // 2: a job
];
const city = { parcels };
const people = {
  list: [
    { id: 1, name: 'Ana Baker', age: 30, home: 0, job: 1 },
    { id: 2, name: 'Ben Chen', age: 41, home: 0, job: null },
    { id: 3, name: 'Chloe Diaz', age: 25, home: 0, job: 2 },
  ],
};
const walker = (axis, x, z, dir) => ({ axis, x, z, dir });

test('the share of walkers out follows the hour', () => {
  const at = { 0: 0.2, 3: 0.2, 4.99: 0.2, 5: 0.4, 6.5: 0.4, 7: 1, 9.49: 1, 9.5: 0.6, 12: 0.6, 16.99: 0.6, 17: 1, 19.49: 1, 19.5: 0.7, 22: 0.7, 23.99: 0.7 };
  for (const [h, s] of Object.entries(at)) expect(shareOut(Number(h)), `hour ${h}`).toBe(s);
  expect(SHARE.at(-1).to).toBe(24);
  for (let i = 0; i < 50; i += 1) expect(threshold(i)).toBeCloseTo((i * GOLDEN) % 1, 12);
  expect(threshold(1)).not.toBe(threshold(2));
});

test('commuters walk to work in the morning and home in the evening', () => {
  const [ana, ben, chloe] = people.list;
  expect(commuteGoal(ana, parcels, 8)).toBe(parcels[1]);
  expect(commuteGoal(chloe, parcels, RUSH_AM[0])).toBe(parcels[2]);
  expect(commuteGoal(ben, parcels, 8)).toBe(null);
  expect(commuteGoal(ana, parcels, 18)).toBe(parcels[0]);
  expect(commuteGoal(ben, parcels, RUSH_PM[0])).toBe(parcels[0]);
  for (const h of [3, 6.99, RUSH_AM[1], 12, RUSH_PM[1], 22]) expect(commuteGoal(ana, parcels, h), `hour ${h}`).toBe(null);
  expect(commuteLabel(ana, 8)).toBe('heading to work');
  expect(commuteLabel(ben, 8)).toBe(null);
  expect(commuteLabel(ben, 18)).toBe('heading home');
  expect(commuteLabel(ana, 12)).toBe(null);
});

test('a tick steers the commuters on the avenues and leaves the rest alone', () => {
  const street = {
    npcs: [
      walker('z', 3, 0, -1),   // Ana: job at z 60, so +1 at 8am
      walker('z', 3, 0, -1),   // Ben: no job, keeps -1
      walker('z', 3, 0, 1),    // Chloe: job at z 0, already there, keeps 1
      walker('x', 10, 40, -1), // a cross-street walker keeps its dir
      walker('z', 3, 50, 1),   // Ben again (4 % 3): keeps 1 at 8am, home at -40 is -1 at 6pm
    ],
  };
  tickCommute(street, people, city, 8, 500, 500);
  expect(street.npcs.map((n) => n.dir)).toEqual([1, -1, 1, -1, 1]);
  tickCommute(street, people, city, 18, 500, 500);
  expect(street.npcs.map((n) => n.dir)).toEqual([-1, -1, -1, -1, -1]);
  street.npcs[0].z = -40 + ARRIVE - 0.5;
  street.npcs[0].dir = 1;
  tickCommute(street, people, city, 18, 500, 500);
  expect(street.npcs[0].dir, 'arrived home, walks on').toBe(1);
  for (const n of street.npcs) n.dir = 1;
  tickCommute(street, people, city, 12, 500, 500);
  expect(street.npcs.map((n) => n.dir), 'midday: nobody steers').toEqual([1, 1, 1, 1, 1]);
  const empty = { npcs: [walker('z', 3, 0, -1)] };
  tickCommute(empty, { list: [] }, city, 8, 500, 500);
  expect(empty.npcs[0].dir, 'no people, no steering').toBe(-1);
});

test('the street empties at night and fills at the rush, but never in front of the player', () => {
  const street = { npcs: Array.from({ length: 72 }, (_, i) => walker('z', 3, -100 + i * 3, 1)) };
  const count = () => street.npcs.filter((n) => n.out).length;
  tickCommute(street, people, city, 3, 1000, 1000);
  expect(count()).toBe(street.npcs.filter((_, i) => threshold(i) < 0.2).length);
  expect(count()).toBeGreaterThan(10);
  expect(count()).toBeLessThan(20);
  tickCommute(street, people, city, 8, 1000, 1000);
  expect(count(), 'everyone out at the rush').toBe(72);
  // Back to night with the player standing among them: only the far ones go in.
  tickCommute(street, people, city, 3, 3, 0);
  for (const [i, n] of street.npcs.entries()) {
    const far = Math.hypot(n.x - 3, n.z) >= HIDE_DIST;
    expect(n.out, `walker ${i}`).toBe(far ? threshold(i) < 0.2 : true);
  }
});
