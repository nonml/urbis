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
import { SETBACK } from './townplan.js';

// Carriageway half-width. It lives in this file because the flat road
// footprints need it and terrain.js imports nothing from world.js (the one-way
// rule above); world.js re-exports it so there is still one number.
export const ROAD_HALF_WIDTH = 3.5;

const TERRAIN_SEED = 70413;
// Below SHOP_SILL (0.55 in block.js), so a swell never buries a shopfront.
const VERGE_RISE = 0.45;
// Tall enough that the ground off the roads reaches 8 m+ within 150 m of the
// centre on every seed (M4.T6b): 12 m of hill plus the swell, minus the road
// and pad blends, peaks near 10 m. The gradient it costs is bounded by the
// longer FLAT_BLEND below, so the hill banks instead of walling (M4-3).
const HILL_RISE = 12;
// Metres of blend from a flat footprint's edge out to full relief. At 46 m the
// steepest bank a 12 m hill makes is 12 * 1.5 / 46 = 0.39 m/m, and where the
// wild ramp and the hill's own slope stack on it the sum stays under the
// 0.6 m per 2 m sample M4-3 caps; a bank this long reads as a verge, not a
// kerb. The park-scale swell stays short inside it.
const FLAT_BLEND = 46;
// Beyond the built district the relief opens up over this distance. The
// district's own edge is the datum: every seed's district ends at z = +/-100
// and the M4-3 sweep reaches z = +/-150, so a 50 m ramp is at full relief by
// the reach edge — the field's own peaks, no wall (M4.T6b).
const WILD_BLEND = 50;

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

// Flat footprints from a road table's own spans: the fallback for a caller with
// no graph (world.js's own district). Every road makes its own, so a new avenue
// flattens the ground under it without anyone editing this file.
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

// One flat rect per road edge and one per junction, read from the graph the sim
// actually drives (M4.T6). Edges are cut at every junction (M3.T8) and each runs
// along one axis (D2), so an edge rect is exactly its tarmac plus walks; the
// junction square covers the four corner quadrants no edge reaches, so the
// ground through a junction is as level as the tarmac through it. Deriving from
// the graph means a road op (M5.T3) grades its own road without touching this
// file.
function graphFlatRects(graph) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const rects = [];
  for (const e of graph.edges) {
    const a = byId.get(e.a);
    const b = byId.get(e.b);
    if (!a || !b) continue;
    rects.push(a.x === b.x
      ? [a.x, (a.z + b.z) / 2, ROAD_FLAT_HALF, Math.abs(b.z - a.z) / 2]
      : [(a.x + b.x) / 2, a.z, Math.abs(b.x - a.x) / 2, ROAD_FLAT_HALF]);
  }
  for (const n of graph.nodes) rects.push([n.x, n.z, ROAD_FLAT_HALF, ROAD_FLAT_HALF]);
  return rects;
}

// Every parcel's footprint, as the pad the hills stay out from under. Hills
// ramp off these over FLAT_BLEND, so the ground between them rolls across the
// town while no base is ever buried by more than VERGE_RISE — which SHOP_SILL
// already clears. The map's record of what stands there (buildings, lots, later
// services) is the only list needed.
function padRects(map) {
  return (map.parcels ?? []).map((p) => [p.x, p.z, p.w / 2, p.d / 2]);
}

// The shelf the hills crest off: the district's own road spans. Derived, so a
// new seed's district carries its hills in its own place instead of under a
// rect tuned to the hand map. No margin: the WILD_BLEND ramp starts at this
// edge, so a district ending at the usual z = +/-100 is at full relief on the
// M4-3 sample at +/-150. Parcels past the roads are still pad-flat, so lots
// keep their ground.
function reliefRect(district) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const av of district.avenues) {
    minX = Math.min(minX, av.x);
    maxX = Math.max(maxX, av.x);
    minZ = Math.min(minZ, av.z0);
    maxZ = Math.max(maxZ, av.z1);
  }
  for (const cr of district.crossings) {
    minX = Math.min(minX, cr.x0);
    maxX = Math.max(maxX, cr.x1);
    minZ = Math.min(minZ, cr.z);
    maxZ = Math.max(maxZ, cr.z);
  }
  return [
    (minX + maxX) / 2, (minZ + maxZ) / 2,
    (maxX - minX) / 2, (maxZ - minZ) / 2,
  ];
}

// Two bands of randomly-oriented waves. The swell is short, so a 15 m verge
// actually rolls instead of being handed one constant offset; the hills are
// long, because a hill the size of a park is a mound and a long wave spends
// its amplitude on height rather than on the slope budget. Every wavelength
// stays above twice the 4 m sampling grid, so the mesh cannot alias one into
// facets.
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
// 300 m and 150 m: the same 2:1 weighting as the swell, stretched so a 12 m
// hill's own slope (12 * 0.5 * (2/3 * 2pi/300 + 1/3 * 2pi/150) = 0.17 m/m)
// leaves the M4-3 bank budget to the road and pad blends.
const HILL_WAVES = seedWaves(TERRAIN_RAND, [300, 150]);

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

function wildness(relief, x, z) {
  return smoothstep01(rectDistance(x, z, ...relief) / WILD_BLEND);
}

// A footprint is refused near water when its box comes within the building
// setback of a water rect — on the water or within 8 m of it
// (townplan.SETBACK), the world-scale placement rule (M4-2). map.water rects
// share the [cx, cz, hw, hd] shape of the flat footprints.
export function waterBlocked(water, x, z, w, d) {
  return water.some(([cx, cz, hw, hd]) =>
    Math.abs(x - cx) <= hw + SETBACK + w / 2 && Math.abs(z - cz) <= hd + SETBACK + d / 2);
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
// caller owns one, otherwise the roads make it — from the map's graph when it
// has one, from its district's spans when it does not; `map.water` is the water
// a footprint may never touch. Exactly zero on every road and never negative
// anywhere.
export function createTerrain(map) {
  const flats = map.flatRects
    ?? (map.graph ? graphFlatRects(map.graph) : roadFlatRects(map.district));
  const pads = padRects(map);
  const water = map.water ?? [];
  const relief = reliefRect(map.district);

  const heightAt = (x, z) => {
    const open = 1 - holdFlat(flats, FLAT_BLEND, x, z);
    // On the tarmac the answer is exactly zero, and a mover asks here often.
    if (open === 0) return 0;
    const swell = VERGE_RISE * band01(SWELL_WAVES, x, z);
    const hills = HILL_RISE * band01(HILL_WAVES, x, z);
    const tuck = pads.length ? holdFlat(pads, FLAT_BLEND, x, z) : 0;
    return open * (swell + hills * wildness(relief, x, z) * (1 - tuck));
  };

  // What a w x d footprint centred on (x, z) would stand on: `water` when any
  // part of it is over map water or its setback, `gradient` the steepest rise
  // in metres per metre across it, `ok` the placement verdict — dry and gentle
  // enough.
  const buildable = (x, z, w, d) => {
    const wet = waterBlocked(water, x, z, w, d);
    const gradient = footprintGradient(heightAt, x, z, w, d);
    return { ok: !wet && gradient <= MAX_BUILD_GRADIENT, water: wet, gradient };
  };

  return { heightAt, buildable };
}
