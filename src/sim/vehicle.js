// Player vehicle: arcade handling, pure data. No collision yet —
// road-clamped only (cutover polish will add poles, cars, facades).
import { clampToBounds, heightAt } from './world.js';
import { worldMap } from './patrol.js';

export const CAR_TOP = 12;
export const CAR_REVERSE = 4;
const ACCEL = 9;
const BRAKE = 17;
const TURN = 1.9;

// The ground under a mover (M4.T10): the map's own field when it has one
// (M4.T2, the field the render draws); the load-time world field is the hand
// preset's fallback.
const groundAt = (map, x, z) => (map.terrain?.heightAt ?? heightAt)(x, z);

export function createPlayerCar(map = worldMap()) {
  // Curb-parked beside the player's spawn — the F prompt greets you.
  const { x, z, yaw } = map.spawn.car;
  return { x, y: groundAt(map, x, z), z, yaw, speed: 0 };
}

// input: {throttle -1..1, steer -1..1}. Returns {braking} for taillights.
export function tickPlayerCar(car, input, dt, map = worldMap()) {
  let braking = false;
  if (input.throttle > 0) {
    car.speed = Math.min(CAR_TOP, car.speed + ACCEL * input.throttle * dt);
  } else if (input.throttle < 0) {
    if (car.speed > 0.5) {
      car.speed = Math.max(0, car.speed - BRAKE * dt);
      braking = true;
    } else {
      car.speed = Math.max(-CAR_REVERSE, car.speed + ACCEL * 0.6 * input.throttle * dt);
    }
  }
  car.speed -= car.speed * 0.55 * dt;
  if (Math.abs(car.speed) < 0.02 && input.throttle === 0) car.speed = 0;
  const grip = Math.max(-1, Math.min(1, car.speed / 4));
  car.yaw += input.steer * TURN * grip * dt;
  car.x += Math.sin(car.yaw) * car.speed * dt;
  car.z += Math.cos(car.yaw) * car.speed * dt;
  const inside = clampToBounds(map.district.drive, car.x, car.z);
  if (inside.hit) {
    car.x = inside.x;
    car.z = inside.z;
    car.speed = 0;
  }
  // The wheels are on the ground, always — the map's own field, the same one
  // the render draws. No slope limit: the car follows whatever surface it is
  // on, on the graded roads at 0 and on the relief off them alike.
  car.y = groundAt(map, car.x, car.z);
  return { braking };
}
