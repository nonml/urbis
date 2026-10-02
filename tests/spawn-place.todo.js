// A new game on a generated world starts on its main avenue (milestone 2): the
// hero car at the east kerb on a plain stretch of street, the player in the lane
// just ahead of it, never at a junction, never outside the walk box, never in a
// wall. The hand preset keeps the start it has always had.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';
import {
  CAR_OUT, HAND_SPAWN, LANE_EDGE, PLAYER_AHEAD, PLAYER_OUT, SPAWN, SPAWN_CLEAR, SPAWN_STEP, SPAWN_Z, spawnFor,
} from '../src/sim/spawn.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);

function fits(d, z) {
  const a = d.avenues[0];
  return d.crossings.filter((c) => c.x0 <= a.x && a.x <= c.x1).every((c) => Math.abs(z - c.z) >= SPAWN_CLEAR)
    && z >= d.walk.minZ + SPAWN_CLEAR && z <= d.walk.maxZ - SPAWN_CLEAR;
}

test('the hand preset starts where it always has', () => {
  expect(SPAWN).toEqual(HAND_SPAWN);
  expect(HAND_SPAWN).toEqual({ player: { x: 2.5, z: 26, yaw: Math.PI }, car: { x: 3.0, z: 23.5, yaw: Math.PI } });
});

test('a generated world starts on its main avenue, beside the car, facing down the street', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const a = d.avenues[0];
    const { player, car } = spawnFor(d);
    expect(car, `seed ${seed}`).toEqual({ x: a.x + CAR_OUT, z: car.z, yaw: Math.PI });
    expect(player, `seed ${seed}`).toEqual({ x: a.x + PLAYER_OUT, z: car.z + PLAYER_AHEAD, yaw: Math.PI });
    expect(Math.abs(player.x - a.x)).toBeLessThan(LANE_EDGE);
    expect(Math.abs(car.x - a.x)).toBeLessThan(LANE_EDGE);
  }
});

test('the car stands between parking slots on a plain stretch the player can walk', () => {
  let moved = 0;
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const { car } = spawnFor(d);
    expect(Number.isInteger(car.z / SPAWN_STEP), `seed ${seed}: ${car.z}`).toBe(true);
    expect(fits(d, car.z), `seed ${seed}: ${car.z}`).toBe(true);
    // Nothing nearer SPAWN_Z on the step fits; on a tie the smaller z wins.
    for (let z = SPAWN_Z - 40 * SPAWN_STEP; z <= SPAWN_Z + 40 * SPAWN_STEP; z += SPAWN_STEP) {
      const nearer = Math.abs(z - SPAWN_Z) < Math.abs(car.z - SPAWN_Z)
        || (Math.abs(z - SPAWN_Z) === Math.abs(car.z - SPAWN_Z) && z < car.z);
      if (nearer) expect(fits(d, z), `seed ${seed}: ${z} fits and is nearer than ${car.z}`).toBe(false);
    }
    if (car.z !== SPAWN_Z) moved += 1;
  }
  expect(moved, 'some seed has a crossing at the hand start').toBeGreaterThan(0);
});
