// The ground gets a Y: one seeded heightfield and the predicate that says where
// a footprint may stand. Pure maths, no three, no DOM (law 5).
//
// The field never goes below zero. Every base in this world sits at y <= 0
// (buildings at 0, the ground plane at -0.08, the mountains at -4), so relief
// that only rises can bury a base but never expose one, and the shipped skyline
// cannot break. There was one dip once — a river channel, cut so the water would
// be visible under an opaque ground plane — and it went with the river: it put a
// 51-degree wall inside the drivable box with nothing to stop a car falling in,
// and the deepest ground it made was under the water anyway.
//
// This replaced world.js's own copy (M4.T2). The split used to look impossible:
// world.js re-exports heightAt, terrain would import world for DISTRICTS, and
// whichever module the bundler evaluated first would see the other's tables in
// its temporal dead zone. The way out is direction — createTerrain takes a
// map-shaped argument and imports nothing from world.js, so world.js and map.js
// both call in and neither is called back. A cycle that works by luck is worse
// than a long file; a cycle that cannot exist is better than both.
import { mulberry32 } from './rng.js';

// Carriageway half-width. It lives in this file because the flat road
// footprints need it and terrain.js imports nothing from world.js (the one-way
// rule above); world.js re-exports it so there is still one number.
export const ROAD_HALF_WIDTH = 3.5;

const TERRAIN_SEED = 70413;
// Below SHOP_SILL (0.55 in block.js), so a swell never buries a shopfront.
const VERGE_RISE = 0.45;
const HILL_RISE = 3.0;
// Metres of blend from a flat footprint's edge out to full relief. Short enough
// for a 15 m park to read, long enough that the lip is a slope and not a step.
const FLAT_BLEND = 11;
// Beyond the built district the relief opens up over this distance.
const WILD_BLEND = 70;

// A carriageway stays dead flat across its own width plus the 3 m walkway
// block.js lays beside it, plus a tenth of a metre, so the blend starts off the
// paving and the street frame never tilts.
const AVENUE_WALKWAY = 3;
const FLAT_MARGIN = 0.1;
const ROAD_FLAT_HALF = ROAD_HALF_WIDTH + AVENUE_WALKWAY + FLAT_MARGIN;

// The steepest ground a footprint may stand on, in metres of rise per metre run
// — 1 in 5. Past it a foundation wants the cut-and-fill this game does not
// model, so placement refuses. M4.T5 is the first caller.
export const MAX_BUILD_GRADIENT = 0.2;
// The step central differences read the field over, the same scale render/
// outskirts.js measures its normals over: 2 m is small enough that a 15 m verge
// is a slope and not one number.
const GRADIENT_STEP = 2;

// Footprints that stay dead flat. Every road in the district makes its own — add
// an avenue and the ground under it flattens without anyone editing a table.
// A caller that owns a whole flat table (the hand map, with its promenade) can
// hand one in as `map.flatRects` instead.
export function roadFlatRects(district) {
  const rects = [];
  for (const av of district.avenues) {
    rects.push([av.x, (av.z0 + av.z1) / 2, ROAD_FLAT_HALF, (av.z1 - av.z0) / 2]);
  }
  for (const cr of district.crossings) {
    rects.push([(cr.x0 + cr.x1) / 2, cr.z, (cr.x1 - cr.x0) / 2, ROAD_FLAT_HALF]);
  }
  return rects;
}

// The built district as one rect (cx, cz, half-width, half-depth). Inside it the
// relief is the verge swell only, so the merged towers and the skyline ring keep
// the flat ground they were authored against. M4.T6 makes this follow the town.
const DISTRICT_RELIEF = [7, 2.5, 73, 117.5];

// Two bands of randomly-oriented waves. The swell is short, so a 15 m verge
// actually rolls instead of being handed one constant offset; the hills are
// long, because a hill the size of a park is a mound. Every wavelength stays
// above twice the 4 m sampling grid, so the mesh cannot alias one into facets.
function seedWaves(rand, wavelengths) {
  const waves = wavelengths.map((wavelength, i) => {
    const angle = rand() * Math.PI * 2;
    const k = (Math.PI * 2) / wavelength;
    return {
      kx: Math.cos(angle) * k, kz: Math.sin(angle) * k,
      phase: rand() * Math.PI * 2, amp: 1 / (i + 1),
    };
  });
  const total = waves.reduce((sum, w) => sum + w.amp, 0);
  return waves.map((w) => ({ ...w, amp: w.amp / total }));
}

// Fixed seed: every world gets the same ground until the town plan carries its
// own. The order of the two calls is part of the field.
const TERRAIN_RAND = mulberry32(TERRAIN_SEED);
const SWELL_WAVES = seedWaves(TERRAIN_RAND, [34, 19]);
const HILL_WAVES = seedWaves(TERRAIN_RAND, [190, 88, 43]);

function band01(waves, x, z) {
  let n = 0;
  for (const w of waves) n += w.amp * Math.sin(w.kx * x + w.kz * z + w.phase);
  return 0.5 + 0.5 * n;
}

function smoothstep01(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

function rectDistance(x, z, cx, cz, hw, hd) {
  const dx = Math.max(0, Math.abs(x - cx) - hw);
  const dz = Math.max(0, Math.abs(z - cz) - hd);
  return Math.hypot(dx, dz);
}

// 1 inside any of the rects, 0 once the blend has run out.
function holdFlat(rects, blend, x, z) {
  let held = 0;
  for (const [cx, cz, hw, hd] of rects) {
    held = Math.max(held, 1 - smoothstep01(rectDistance(x, z, cx, cz, hw, hd) / blend));
    if (held >= 1) return 1;
  }
  return held;
}

function wildness(x, z) {
  return smoothstep01(rectDistance(x, z, ...DISTRICT_RELIEF) / WILD_BLEND);
}

// A footprint is over water when its box overlaps a water rect; map.water rects
// share the [cx, cz, hw, hd] shape of the flat footprints.
function overWater(water, x, z, w, d) {
  return water.some(([cx, cz, hw, hd]) =>
    Math.abs(x - cx) <= hw + w / 2 && Math.abs(z - cz) <= hd + d / 2);
}

function gradientAt(heightAt, x, z) {
  const gx = (heightAt(x + GRADIENT_STEP, z) - heightAt(x - GRADIENT_STEP, z)) / (2 * GRADIENT_STEP);
  const gz = (heightAt(x, z + GRADIENT_STEP) - heightAt(x, z - GRADIENT_STEP)) / (2 * GRADIENT_STEP);
  return Math.hypot(gx, gz);
}

// A footprint's steepest sample: its four corners and its centre.
function footprintGradient(heightAt, x, z, w, d) {
  let steepest = 0;
  for (const sx of [-w / 2, 0, w / 2]) {
    for (const sz of [-d / 2, 0, d / 2]) {
      steepest = Math.max(steepest, gradientAt(heightAt, x + sx, z + sz));
    }
  }
  return steepest;
}

// The ground a map stands on. `map.flatRects` is the whole flat table when a
// caller owns one, otherwise the district's roads make it; `map.water` is the
// water a footprint may never touch. Exactly zero on every road and never
// negative anywhere.
export function createTerrain(map) {
  const flats = map.flatRects ?? roadFlatRects(map.district);
  const water = map.water ?? [];

  const heightAt = (x, z) => {
    const open = 1 - holdFlat(flats, FLAT_BLEND, x, z);
    const swell = VERGE_RISE * band01(SWELL_WAVES, x, z);
    const hills = HILL_RISE * band01(HILL_WAVES, x, z) * wildness(x, z);
    return open * (swell + hills);
  };

  // What a w x d footprint centred on (x, z) would stand on: `water` when any
  // part of it is over map water, `gradient` the steepest rise in metres per
  // metre across it, `ok` the placement verdict — dry and gentle enough.
  const buildable = (x, z, w, d) => {
    const wet = overWater(water, x, z, w, d);
    const gradient = footprintGradient(heightAt, x, z, w, d);
    return { ok: !wet && gradient <= MAX_BUILD_GRADIENT, water: wet, gradient };
  };

  return { heightAt, buildable };
}
