// Living-street sim: sidewalk walkers, lane traffic, lamp-zone blackout hack.
// Pure data in, pure data out. Render reads state; only main ticks it.
import { createStreams } from './rng.js';
import { WORLD_FURNITURE } from './furniture.js';
import { worldMap } from './patrol.js';
// Cars are traffic's (M3.T30): trips on the graph, not a wrap at the tarmac end.
// street.js owns the fleet's paint and shape and hands the sim its cars; the
// renderer still reads street.cars, so spawns and goings are invisible only
// because traffic re-tasks a car in place where the camera cannot see it.
import { createTraffic, tick as tickTraffic } from './traffic.js';
// Walkers are walkers' (M3.T33): trips on the graph, not a wrap at the
// pavement's end. street.js owns the bodies' paint and shape and hands the
// sim its walkers; the renderer still reads street.npcs, so trip changes are
// invisible only because walkers cross junctions through an interpolation.
import { createWalkers, tick as tickWalkers } from './walkers.js';
// Pure numbers, no DOM and no three: the game loop's snapshot (M0-9) is called
// here so every walker and car carries the pose the last step started from.
import { snap } from '../game/loop.js';

export const NPC_COUNT = 72;
export const CAR_COUNT = 16;

// Parked cars sit just inside the kerb.
const PARKED_LANE_OUT = 3.4;

// Curb parking slots for the hand preset: [avenue, side, z], the avenue by its
// index in the district's list (main, east, west — world.js's order). Static,
// never ticked — density for +0 draws (they ride the same traffic
// InstancedMeshes as moving cars). On a generated world the plan parks them.
const HAND_PARKED_SLOTS = [
  [0, 1, -70], [0, -1, -52], [0, 1, -30],
  [0, -1, -12], [0, 1, 8], [0, -1, 26],
  [1, 1, -58], [1, -1, -34], [1, 1, -8], [1, -1, 54], [1, 1, 72],
  [2, -1, -64], [2, 1, -20], [2, -1, 60],
];
export const LAMP_ZONES = 2;
export const BLACKOUT_SECS = 8;
export const COLLAPSE_SECS = 0.9;
export const RESTORE_SECS = 0.7;
export const ZONE_COOLDOWN_SECS = 3;

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

// The parked plan: the map's own on a generated world. WORLD_FURNITURE is the
// same plan built at load and stays the fallback until M3.T14 deletes it; the
// hand preset has no plan, so its table stands, its avenue x read off the map.
function parkedSlots(map, avenues) {
  if (map.furniture) return map.furniture.parked;
  if (WORLD_FURNITURE) return WORLD_FURNITURE.parked;
  return HAND_PARKED_SLOTS.map(([avenue, side, z]) => [avenues[avenue].x, side, z]);
}

export function createStreet(seed, map = worldMap()) {
  const rng = createStreams(seed);
  const { avenues } = map.district;
  // The power areas (M3.T36, M3-7): one zone per map district, in map order.
  // A map without districts (the hand preset) keeps the two halves.
  const areas = map.districts?.map((d) => ({ id: d.id, name: d.name, walk: { ...d.walk } })) ?? null;
  const zoneCount = areas?.length ?? LAMP_ZONES;
  const bodies = [];
  for (let i = 0; i < NPC_COUNT; i++) bodies.push(makeBody(rng, i));
  const walkers = createWalkers(map, seed, bodies);
  const npcs = [...walkers.walkers];
  const traffic = createTraffic(map, seed, CAR_COUNT);
  const cars = [...traffic.cars];
  cars.forEach((c, i) => {
    c.paint = CAR_PAINTS[(i * 5 + 1) % CAR_PAINTS.length];
    c.shape = (i * 3 + 1) % SHAPE_COUNT;
  });
  parkedSlots(map, avenues).forEach(([ax, side, z], k) => {
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
    traffic,
    walkers,
    // The bounds districtAt reads; null on a map without districts.
    districts: areas,
    zones: Array.from({ length: zoneCount }, () => (
      { darkUntil: 0, coolUntil: 0, collapseUntil: 0, restoreUntil: 0 }
    )),
    hurryUntil: 0,
    lastHack: null,
  };
}

// The halves zoneAt drew. Deprecated: areas (districtAt) replaced it, but the
// zoning, HUD and main still assign and read powerZone through it (M3.T37
// moves them). On today's two-area map it agrees with districtAt everywhere
// except the exact seam z = 0, which belongs to the south area.
export function zoneAt(z) {
  return z < 0 ? 0 : 1;
}

// The district a point stands in, as its power-zone id. This replaces
// zoneAt(z): zones are areas with bounds from the map, not halves of z. H
// blacks out the district the player stands in through this. Without stored
// areas (a save from before districts) it falls back to the halves.
export function districtAt(state, x, z) {
  const areas = state.districts;
  if (areas) {
    const hit = areas.find((d) => x >= d.walk.minX && x <= d.walk.maxX
      && z >= d.walk.minZ && z <= d.walk.maxZ);
    if (hit) return hit.id;
  }
  return zoneAt(z);
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
    if (n.out === false) continue;
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
  // Walkers freeze in a blackout and hurry after one; walkers' tick walks
  // each one along its route at the v set here, so nobody moves in the dark.
  for (const n of state.npcs) {
    snap(n);
    const dark = isDark(state, districtAt(state, n.x, n.z));
    let v = dark ? 0 : n.speed;
    if (hurrying && !dark) v *= 1.6;
    n.v = v;
  }
  tickWalkers(state.walkers, dt);
  tickTraffic(state.traffic, dt);
}
