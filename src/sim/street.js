// Living-street sim: sidewalk walkers, lane traffic, lamp-zone blackout hack.
// Pure data in, pure data out. Render reads state; only main ticks it.
import { createStreams } from './rng.js';
import { ROAD_HALF_WIDTH, LANE_OFFSET, AVENUES, AVENUE_X, CROSSINGS, wayLength } from './world.js';
import { WORLD_FURNITURE } from './furniture.js';

export const NPC_COUNT = 72;
export const CAR_COUNT = 16;

const [MAIN_X, EAST_X, WEST_X] = AVENUE_X;
// The two crossings street life is keyed to, in declaration order — generated
// districts carry no hand way names, and a one-crossing district plays both.
const PLAZA = CROSSINGS[0];
const SOUTH = CROSSINGS[CROSSINGS.length - 1];

// Parked cars sit just inside the kerb, and walkers keep two lines each side of
// an avenue: one off the kerb, one up against the shopfronts.
const PARKED_LANE_OUT = 3.4;
const KERB_LANE_OUT = ROAD_HALF_WIDTH + 2.2;
const WALL_LANE_OUT = ROAD_HALF_WIDTH + 2.7;
// A walker on a crossing's footway, and how far short of the junction mouth
// they turn back.
const SOUTH_WALK_OUT = 5.5;
const PLAZA_WALK_OUT = 5.2;
const WALK_INSET = 2;

// Curb parking slots: [avenueX, side, z]. Static, never ticked — density for
// +0 draws (they ride the same traffic InstancedMeshes as moving cars). On a
// generated world the plan parks them; the hand preset keeps its table.
const HAND_PARKED_SLOTS = [
  [MAIN_X, 1, -70], [MAIN_X, -1, -52], [MAIN_X, 1, -30],
  [MAIN_X, -1, -12], [MAIN_X, 1, 8], [MAIN_X, -1, 26],
  [EAST_X, 1, -58], [EAST_X, -1, -34], [EAST_X, 1, -8], [EAST_X, -1, 54], [EAST_X, 1, 72],
  [WEST_X, -1, -64], [WEST_X, 1, -20], [WEST_X, -1, 60],
];
const PARKED_SLOTS = WORLD_FURNITURE ? WORLD_FURNITURE.parked : HAND_PARKED_SLOTS;
export const LAMP_ZONES = 2;
export const BLACKOUT_SECS = 8;
export const COLLAPSE_SECS = 0.9;
export const RESTORE_SECS = 0.7;
export const ZONE_COOLDOWN_SECS = 3;
// Half an avenue's run. Walkers and traffic wrap here, so the loop is exactly
// as long as the tarmac is.
export const STREET_HALF = wayLength(AVENUES[0]) / 2;

const COAT_COLORS = [0x1c2733, 0x33231c, 0x1c3327, 0x2b1c33, 0x3d2f16, 0x101418, 0x5c1f2e, 0x1f4d5c, 0x2e3d4d, 0x4d3a2e, 0x7a2a3a, 0x2a6a7a];
export const SKIN_TONES = [0x9a7b62, 0x7a5a44, 0x5a4030, 0xc4a080, 0x8a6248];
const CAR_PAINTS = [0x7a1020, 0x10233d, 0x3d3d42, 0x0f3d2e, 0x4d4d10, 0x222222];
// How many body silhouettes the render layer knows how to build. A street
// where every car is the same shape is a toy car park, and the shape has to
// live here with the paint so a car keeps it for life instead of changing
// body every time its render slot is reused.
const SHAPE_COUNT = 5;
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

function makeBody(rng, i) {
  const body = {
    dir: rng.sim() < 0.5 ? -1 : 1,
    speed: 0.9 + rng.sim() * 0.8,
    phase: rng.sim() * Math.PI * 2,
    coat: COAT_COLORS[Math.floor(rng.sim() * COAT_COLORS.length)],
    h: 0.92 + rng.sim() * 0.22,
    hurryUntil: 0,
    profile: makeProfile(rng.sim, i),
  };
  // Appended after profile so existing names/speeds never shift.
  // (Coats resample across the widened palette — color only, no logic reads it.)
  body.bulk = 0.85 + rng.sim() * 0.5;
  body.hat = rng.sim() < 0.42 ? 1 + Math.floor(rng.sim() * 3) : 0;
  body.glasses = rng.sim() < 0.25;
  body.skin = Math.floor(rng.sim() * SKIN_TONES.length);
  return body;
}

function makeNSWalker(rng, i, npcSpots) {
  return {
    axis: 'z',
    x: npcSpots[Math.floor(rng.sim() * npcSpots.length)],
    z: (rng.sim() - 0.5) * STREET_HALF * 2,
    ...makeBody(rng, i),
  };
}

function makeEWWalker(rng, i) {
  // Cross-street walkers: stroll the connector sidewalks (E-W), not the avenues.
  const onSouth = i >= 56;
  const z = onSouth
    ? SOUTH.z + SOUTH_WALK_OUT
    : PLAZA.z + (rng.sim() < 0.5 ? -PLAZA_WALK_OUT : PLAZA_WALK_OUT);
  const cross = onSouth ? SOUTH : PLAZA;
  const xMin = cross.x0 + WALK_INSET;
  const xMax = cross.x1 - WALK_INSET;
  return {
    axis: 'x',
    x: xMin + rng.sim() * (xMax - xMin),
    z: z + (rng.sim() - 0.5) * 1.2,
    xMin,
    xMax,
    ...makeBody(rng, i),
  };
}

function makeNSCar(rng, i) {
  const dir = i % 2 === 0 ? 1 : -1;
  const avenue = AVENUE_X[i % AVENUE_X.length];
  return {
    axis: 'z',
    lane: avenue + dir * LANE_OFFSET,
    dir,
    z: -STREET_HALF + ((i * 37) % 12) / 12 * STREET_HALF * 2,
    speed: 7 + rng.sim() * 3,
    paint: CAR_PAINTS[(i * 5 + 1) % CAR_PAINTS.length],
    shape: (i * 3 + 1) % SHAPE_COUNT,
  };
}

function makeEWCar(rng, i) {
  // Cross-street traffic: run the plaza connector + south road E-W.
  const onSouth = i >= 15;
  const cross = onSouth ? SOUTH : PLAZA;
  const dir = i % 2 === 0 ? 1 : -1;
  const xMin = cross.x0;
  const xMax = cross.x1;
  return {
    axis: 'x',
    x: xMin + ((i * 53) % 10) / 10 * (xMax - xMin),
    z: cross.z + dir * LANE_OFFSET,
    dir,
    speed: 7 + rng.sim() * 3,
    paint: CAR_PAINTS[(i * 5 + 1) % CAR_PAINTS.length],
    shape: (i * 3 + 2) % SHAPE_COUNT,
    xMin,
    xMax,
  };
}

export function createStreet(seed) {
  const rng = createStreams(seed);
  const npcSpots = [];
  for (const baseX of AVENUE_X) {
    npcSpots.push(
      baseX - WALL_LANE_OUT, baseX - KERB_LANE_OUT,
      baseX + KERB_LANE_OUT, baseX + WALL_LANE_OUT
    );
  }
  const npcs = [];
  for (let i = 0; i < NPC_COUNT; i++) {
    if (i < 48 || i >= 60) npcs.push(makeNSWalker(rng, i, npcSpots));
    else npcs.push(makeEWWalker(rng, i));
  }
  const cars = [];
  for (let i = 0; i < CAR_COUNT; i++) {
    cars.push(i < 12 ? makeNSCar(rng, i) : makeEWCar(rng, i));
  }
  PARKED_SLOTS.forEach(([ax, side, z], k) => {
    cars.push({
      axis: 'z',
      lane: ax + side * PARKED_LANE_OUT,
      dir: side > 0 ? 1 : -1,
      z,
      speed: 0,
      parked: true,
      paint: CAR_PAINTS[(k * 5 + 3) % CAR_PAINTS.length],
      shape: (k * 3) % SHAPE_COUNT,
    });
  });
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
    if (n.axis === 'x') {
      n.x += n.dir * v * dt;
      const lo = n.xMin ?? PLAZA.x0 + WALK_INSET;
      const hi = n.xMax ?? PLAZA.x1 - WALK_INSET;
      if (n.x > hi) n.x = lo;
      if (n.x < lo) n.x = hi;
    } else {
      n.z += n.dir * v * dt;
      if (n.z > STREET_HALF) n.z = -STREET_HALF;
      if (n.z < -STREET_HALF) n.z = STREET_HALF;
    }
    n.phase += dt * (dark ? 0 : v * 4);
  }
  for (const c of state.cars) {
    if (c.parked) continue;
    if (c.axis === 'x') {
      c.x += c.dir * c.speed * dt;
      const lo = (c.xMin ?? PLAZA.x0) - 3;
      const hi = (c.xMax ?? PLAZA.x1) + 3;
      if (c.x > hi) c.x = lo;
      if (c.x < lo) c.x = hi;
    } else {
      c.z += c.dir * c.speed * dt;
      if (c.z > STREET_HALF + 5) c.z = -STREET_HALF - 5;
      if (c.z < -STREET_HALF - 5) c.z = STREET_HALF + 5;
    }
  }
}
