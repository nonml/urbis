// Living-street sim: sidewalk walkers, lane traffic, lamp-zone blackout hack.
// Pure data in, pure data out. Render reads state; only main ticks it.
import { createStreams } from './rng.js';

export const NPC_COUNT = 36;
export const CAR_COUNT = 9;
export const LAMP_ZONES = 2;
export const BLACKOUT_SECS = 8;
export const COLLAPSE_SECS = 0.9;
export const RESTORE_SECS = 0.7;
export const ZONE_COOLDOWN_SECS = 3;
export const STREET_HALF = 60;

const COAT_COLORS = [0x1c2733, 0x33231c, 0x1c3327, 0x2b1c33, 0x3d2f16, 0x101418, 0x5c1f2e, 0x1f4d5c];
const CAR_PAINTS = [0x7a1020, 0x10233d, 0x3d3d42, 0x0f3d2e, 0x4d4d10, 0x222222];
const FIRST = ['Mara', 'Kaito', 'Iris', 'Dario', 'Yuki', 'Petra', 'Sol', 'Nadia', 'Rook', 'Esen', 'Milo', 'Aya', 'Corv', 'Lena', 'Juno', 'Theo'];
const LAST = ['Vane', 'Kuro', 'Dax', 'Mori', 'Lark', 'Voss', 'Quill', 'Reyes', 'Hale', 'Ito', 'Fenn', 'Okafor', 'Rill', 'Sable', 'Thorn', 'Vale'];
const JOBS = [
  ['courier', 2100], ['noodle vendor', 1800], ['corp clerk', 3400], ['drone tech', 4100],
  ['street doc', 5200], ['fixer', 6100], ['busker', 900], ['night guard', 2400],
];
const SECRETS = [
  'owes the Red Lanterns', 'runs night drops', 'snitches for precinct 9',
  'skimming corp creds', 'hides a fugitive sibling', 'sells patched optics',
  'blackmailed by a fixer', 'maps patrol routes',
];

function makeProfile(rng, i) {
  const job = JOBS[Math.floor(rng() * JOBS.length)];
  return {
    name: `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`.toUpperCase(),
    age: 19 + Math.floor(rng() * 38),
    job: job[0],
    income: `₡${(job[1] + Math.floor(rng() * 900)).toLocaleString('en-US')}/mo`,
    secret: SECRETS[(i * 3 + 1) % SECRETS.length],
  };
}

export function createStreet(seed) {
  const rng = createStreams(seed);
  const npcSpots = [];
  for (const baseX of [0, 44]) {
    npcSpots.push(baseX - 6.2, baseX - 5.7, baseX + 5.7, baseX + 6.2);
  }
  const npcs = [];
  for (let i = 0; i < NPC_COUNT; i++) {
    const x = npcSpots[Math.floor(rng.sim() * npcSpots.length)];
    npcs.push({
      x,
      z: (rng.sim() - 0.5) * STREET_HALF * 2,
      dir: rng.sim() < 0.5 ? -1 : 1,
      speed: 0.9 + rng.sim() * 0.8,
      phase: rng.sim() * Math.PI * 2,
      coat: COAT_COLORS[Math.floor(rng.sim() * COAT_COLORS.length)],
      h: 0.92 + rng.sim() * 0.22,
      hurryUntil: 0,
      profile: makeProfile(rng.sim, i),
    });
  }
  const cars = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const avenue = i >= 6 ? 44 : 0;
    cars.push({
      lane: avenue + (dir > 0 ? 2 : -2),
      dir,
      z: -STREET_HALF + ((i * 37) % CAR_COUNT) / CAR_COUNT * STREET_HALF * 2,
      speed: 7 + rng.sim() * 3,
      paint: CAR_PAINTS[(i * 5 + 1) % CAR_PAINTS.length],
    });
  }
  return {
    time: 0,
    npcs,
    cars,
    zones: [
      { darkUntil: 0, coolUntil: 0, collapseUntil: 0, restoreUntil: 0 },
      { darkUntil: 0, coolUntil: 0, collapseUntil: 0, restoreUntil: 0 },
    ],
    hurryUntil: 0,
    lastHack: null,
  };
}

export function zoneAt(z) {
  return z < 0 ? 0 : 1;
}

// Zone power phase: lit → dying (collapse flicker) → dark → restoring → lit.
export function zonePhase(state, zone) {
  const t = state.time;
  const z = state.zones[zone];
  if (z.darkUntil > 0 && t < z.collapseUntil) return 'dying';
  if (t < z.darkUntil) return 'dark';
  if (t < z.restoreUntil) return 'restoring';
  return 'lit';
}

// Target brightness: mid-phase flicker is resolved per-fixture by blink().
export function zoneGlow(state, zone) {
  const p = zonePhase(state, zone);
  return p === 'lit' ? 1 : p === 'dark' ? 0 : 0.5;
}

// Deterministic sputter: full or near-off. Pure in time+seed, sim-safe.
export function blink(time, seed) {
  const h = (time * 11 + seed * 13.7) % 1;
  return h < 0.5 ? 1 : 0.06;
}

export function isDark(state, zone) {
  return state.time < state.zones[zone].darkUntil;
}

// The hack: kill a lamp zone. Each zone recharges on its own clock, so chaining
// two zones inside one 8s window is possible — by car, not on foot.
// Returns affected lamp count (0 = that zone recharging).
export function hackBlackout(state, zone) {
  if (state.time < state.zones[zone].coolUntil) return 0;
  state.zones[zone].collapseUntil = state.time + COLLAPSE_SECS;
  state.zones[zone].darkUntil = state.time + COLLAPSE_SECS + BLACKOUT_SECS;
  state.zones[zone].coolUntil = state.time + COLLAPSE_SECS + BLACKOUT_SECS + ZONE_COOLDOWN_SECS;
  state.zones[zone].restoreUntil = 0;
  state.hurryUntil = state.time + BLACKOUT_SECS + 5;
  state.lastHack = { zone, at: state.time };
  return 3; // 3 lamps per zone on the main avenue
}

export function hackCooldownLeft(state, zone) {
  return Math.max(0, state.zones[zone].coolUntil - state.time);
}

// Nearest NPC inside a ~30° facing cone within 12m. Null when nobody qualifies.
export function profilerTarget(street, px, pz, fx, fz) {
  let best = null;
  let bestD = 12;
  for (const n of street.npcs) {
    const dx = n.x - px;
    const dz = n.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > bestD || d < 0.5) continue;
    if ((dx * fx + dz * fz) / (d || 1) < 0.86) continue;
    best = n;
    bestD = d;
  }
  return best ? { npc: best, dist: bestD } : null;
}

export function tickStreet(state, dt) {
  state.time += dt;
  for (const z of state.zones) {
    if (z.darkUntil > 0 && state.time >= z.darkUntil && z.restoreUntil === 0) {
      z.restoreUntil = state.time + RESTORE_SECS;
    }
  }
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
