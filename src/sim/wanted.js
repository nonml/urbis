// Wanted: heat 0-3, pursuit cars that seek the player, busted on catch.
// Crimes: blackouts (+1). Speeding holds heat. Darkness + distance shed it.
import { DRIVE_BOUNDS, clampToBounds, heightAt } from './world.js';
import { PURSUIT_HOMES } from './anchors.js';

export const MAX_HEAT = 3;
export const PURSUIT_SPEED = 10;
const CATCH_DIST_FOOT = 3.5;
const CATCH_DIST_CAR = 4.5;
const BUSTED_SECS = 2.5;
const SHED_DIST = 42;
const DECAY_SECS = 25;

export function createWanted() {
  return {
    heat: 0,
    catchT: 0,
    decayT: 0,
    speedT: 0,
    bustedUntil: 0,
    bustedFlashUntil: 0,
    pursuit: [
      ...PURSUIT_HOMES.map((h, i) => ({ active: false, x: h.x, y: heightAt(h.x, h.z), z: h.z, yaw: i === 0 ? 0 : Math.PI, speed: 0 })),
    ],
  };
}

export function wantedOnBlackout(w) {
  w.heat = Math.min(MAX_HEAT, w.heat + 1);
  w.decayT = 0;
  syncPursuit(w);
}

export function wantedOnBusted(w, time) {
  w.heat = 0;
  w.catchT = 0;
  w.decayT = 0;
  w.speedT = 0;
  w.bustedUntil = time + 3;
  w.bustedFlashUntil = time + 3;
  syncPursuit(w);
}

export function isBusted(w, time) {
  return time < w.bustedUntil;
}

function syncPursuit(w) {
  const want = w.heat >= 2 ? 2 : w.heat >= 1 ? 1 : 0;
  w.pursuit.forEach((p, i) => { p.active = i < want; });
}

// One chase car's step. Returns its distance to the target *before* it moved,
// which is the distance the catch test has always read.
function stepPursuit(p, tx, tz, dt) {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const d = Math.hypot(dx, dz);
  let diff = Math.atan2(dx, dz) - p.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  p.yaw += Math.max(-1, Math.min(1, diff * 3)) * 1.8 * dt;
  p.speed += ((d > 6 ? PURSUIT_SPEED : PURSUIT_SPEED * 0.4) - p.speed) * Math.min(1, dt * 2);
  const inside = clampToBounds(
    DRIVE_BOUNDS, p.x + Math.sin(p.yaw) * p.speed * dt, p.z + Math.cos(p.yaw) * p.speed * dt
  );
  p.x = inside.x;
  p.z = inside.z;
  p.y = heightAt(p.x, p.z);
  return d;
}

// tx,tz target pos. cover=true when target hides in a dark zone.
export function tickWanted(w, dt, tx, tz, inCar, carSpeed, cover, time) {
  if (isBusted(w, time)) return 'busted';
  const catchDist = inCar ? CATCH_DIST_CAR : CATCH_DIST_FOOT;
  // Speeding sustains heat; cleanliness sheds it.
  if (inCar && Math.abs(carSpeed) > 9.5) {
    w.speedT += dt;
    if (w.speedT > 8 && w.heat < MAX_HEAT) {
      w.heat++;
      w.speedT = 0;
      syncPursuit(w);
    }
  } else {
    w.speedT = 0;
  }
  let nearest = Infinity;
  for (const p of w.pursuit) {
    if (p.active) nearest = Math.min(nearest, stepPursuit(p, tx, tz, dt));
  }
  if (w.heat === 0) {
    w.catchT = 0;
    return 'clean';
  }
  if (nearest < catchDist) {
    w.catchT += dt;
    if (w.catchT >= BUSTED_SECS) {
      wantedOnBusted(w, time);
      return 'busted';
    }
    return 'closing';
  }
  w.catchT = Math.max(0, w.catchT - dt * 2);
  const hidden = cover || nearest > SHED_DIST;
  if (hidden) {
    w.decayT += dt;
    if (w.decayT >= DECAY_SECS) {
      w.heat = Math.max(0, w.heat - 1);
      w.decayT = 0;
      syncPursuit(w);
    }
  } else {
    w.decayT = 0;
  }
  return 'pursued';
}
