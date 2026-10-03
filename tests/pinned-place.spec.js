// The noodle-bar and roof towers stand clear of the roads on every generated world
// (milestone 2): a crossing that runs where the hand map put a tower moves the
// tower along its avenue, never onto the road. The hand preset keeps its towers.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import { HAND_PINNED, PINNED_TOWERS, PIN_BAND, PIN_GAP, placePinned } from '../src/sim/landmarks.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(300);
const EPS = 1e-6;

const clearOf = (t, z0, z1) => t.z + t.d / 2 <= z0 + EPS || t.z - t.d / 2 >= z1 - EPS;
const crossingClear = (t, z, crossings) =>
  crossings.every((c) => clearOf({ ...t, z }, c.z - PIN_BAND - PIN_GAP, c.z + PIN_BAND + PIN_GAP));

test('every pinned tower stands clear of the crossings, the avenue ends and each other', () => {
  let moved = 0;
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const a = d.avenues[0];
    const towers = placePinned(HAND_PINNED, a, d.crossings);
    expect(towers.length).toBe(HAND_PINNED.length);
    towers.forEach((t, i) => {
      const hand = HAND_PINNED[i];
      expect({ ...t, z: hand.z }, `seed ${seed}: only z may change`).toEqual(hand);
      expect(Math.abs(t.z * 2 - Math.round(t.z * 2)) < EPS, `seed ${seed} ${t.id} at ${t.z}`).toBe(true);
      expect(crossingClear(t, t.z, d.crossings), `seed ${seed}: ${t.id} at ${t.z} on a crossing`).toBe(true);
      expect(t.z - t.d / 2 >= a.z0 + PIN_GAP - EPS && t.z + t.d / 2 <= a.z1 - PIN_GAP + EPS, `seed ${seed} ${t.id}`)
        .toBe(true);
      towers.slice(0, i).forEach((u) => {
        expect(clearOf(t, u.z - u.d / 2 - PIN_GAP, u.z + u.d / 2 + PIN_GAP), `seed ${seed}: ${t.id} meets ${u.id}`)
          .toBe(true);
      });
      if (t.z !== hand.z) moved += 1;
    });
  }
  expect(moved, 'some seed has a crossing where a hand tower stood').toBeGreaterThan(0);
});

test('a tower keeps its hand place when that is clear, and otherwise moves the least it can', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const towers = placePinned(HAND_PINNED, d.avenues[0], d.crossings);
    towers.forEach((t, i) => {
      const hand = HAND_PINNED[i];
      const free = (z) => crossingClear(hand, z, d.crossings)
        && towers.slice(0, i).every((u) => clearOf({ ...hand, z }, u.z - u.d / 2 - PIN_GAP, u.z + u.d / 2 + PIN_GAP));
      const shift = Math.abs(t.z - hand.z);
      for (let s = 0; s < shift - EPS; s += 0.5) {
        expect(free(hand.z - s) || free(hand.z + s), `seed ${seed}: ${t.id} moved ${shift} m, ${s} m was free`)
          .toBe(false);
      }
    });
  }
});

test('the hand preset keeps its towers exactly', () => {
  expect(PINNED_TOWERS).toEqual(HAND_PINNED);
  expect(PINNED_TOWERS.map((t) => t.z)).toEqual([-48, -14]);
});
