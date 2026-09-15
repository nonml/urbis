// Living-street sim: sidewalk walkers, lane traffic, lamp-zone blackout hack.
// Pure data in, pure data out. Render reads state; only main ticks it.
import { createStreams } from './rng.js';

export const NPC_COUNT = 24;
export const CAR_COUNT = 6;
export const LAMP_ZONES = 2;
export const BLACKOUT_SECS = 8;
export const HACK_COOLDOWN_SECS = 5;
export const STREET_HALF = 60;

const COAT_COLORS = [0x1c2733, 0x33231c, 0x1c3327, 0x2b1c33, 0x3d2f16, 0x101418, 0x5c1f2e, 0x1f4d5c];
const CAR_PAINTS = [0x7a1020, 0x10233d, 0x3d3d42, 0x0f3d2e, 0x4d4d10, 0x222222];

export function createStreet(seed) {
  const rng = createStreams(seed);
  const npcs = [];
  for (let i = 0; i < NPC_COUNT; i++) {
    const side = rng.sim() < 0.5 ? -1 : 1;
    npcs.push({
      side,
      x: side * (5.6 + rng.sim() * 1.2),
      z: (rng.sim() - 0.5) * STREET_HALF * 2,
      dir: rng.sim() < 0.5 ? -1 : 1,
      speed: 0.9 + rng.sim() * 0.8,
      phase: rng.sim() * Math.PI * 2,
      coat: COAT_COLORS[Math.floor(rng.sim() * COAT_COLORS.length)],
      hurryUntil: 0,
    });
  }
  const cars = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    cars.push({
      lane: dir > 0 ? 2 : -2,
      dir,
      z: -STREET_HALF + (i / CAR_COUNT) * STREET_HALF * 2,
      speed: 7 + rng.sim() * 3,
      paint: CAR_PAINTS[i % CAR_PAINTS.length],
    });
  }
  return {
    time: 0,
    npcs,
    cars,
    zones: [{ darkUntil: 0 }, { darkUntil: 0 }],
    hurryUntil: 0,
    cooldownUntil: 0,
    lastHack: null,
  };
}

export function zoneAt(z) {
  return z < 0 ? 0 : 1;
}

export function isDark(state, zone) {
  return state.time < state.zones[zone].darkUntil;
}

// The hack: kill a lamp zone. Returns affected lamp count (0 = on cooldown).
export function hackBlackout(state, zone) {
  if (state.time < state.cooldownUntil) return 0;
  state.zones[zone].darkUntil = state.time + BLACKOUT_SECS;
  state.hurryUntil = state.time + BLACKOUT_SECS + 5;
  state.cooldownUntil = state.time + BLACKOUT_SECS + HACK_COOLDOWN_SECS;
  state.lastHack = { zone, at: state.time };
  return 3; // 3 lamps per zone
}

export function hackCooldownLeft(state) {
  return Math.max(0, state.cooldownUntil - state.time);
}

export function tickStreet(state, dt) {
  state.time += dt;
  const hurrying = state.time < state.hurryUntil;
  for (const n of state.npcs) {
    const dark = isDark(state, zoneAt(n.z));
    let v = dark ? 0 : n.speed;
    if (hurrying && !dark) v *= 1.6;
    n.z += n.dir * v * dt;
    if (n.z > STREET_HALF) n.z = -STREET_HALF;
    if (n.z < -STREET_HALF) n.z = STREET_HALF;
    n.phase += dt * (dark ? 0 : v * 4);
  }
  for (const c of state.cars) {
    c.z += c.dir * c.speed * dt;
    if (c.z > STREET_HALF + 5) c.z = -STREET_HALF - 5;
    if (c.z < -STREET_HALF - 5) c.z = STREET_HALF + 5;
  }
}
