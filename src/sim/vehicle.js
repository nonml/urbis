// Player vehicle: arcade handling, pure data. No collision yet —
// road-clamped only (cutover polish will add poles, cars, facades).
import { DRIVE_BOUNDS, clampToBounds } from './world.js';

export const CAR_TOP = 12;
export const CAR_REVERSE = 4;
const ACCEL = 9;
const BRAKE = 17;
const TURN = 1.9;

export function createPlayerCar() {
  // Curb-parked beside the player spawn (2.5, 26) — the F prompt greets you.
  return { x: 3.0, z: 23.5, yaw: Math.PI, speed: 0 };
}

// input: {throttle -1..1, steer -1..1}. Returns {braking} for taillights.
export function tickPlayerCar(car, input, dt) {
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
  const inside = clampToBounds(DRIVE_BOUNDS, car.x, car.z);
  if (inside.hit) {
    car.x = inside.x;
    car.z = inside.z;
    car.speed = 0;
  }
  return { braking };
}
