// Where the street furniture stands on a generated world: lamps, parked cars,
// utility boxes, the zebra crossings, and the rhythm every kerbside fitting
// follows, all derived from the district's roads (docs/PROCGEN.md), so nothing
// stands in a crossing or hangs off an avenue the world does not have. On the
// hand preset the render keeps its own tables and WORLD_FURNITURE is null.
// Pure (law 5): render/lamps.js, render/block.js and sim/street.js read it.
//
// Milestone 2 skeleton: the constants are final, the bodies are stubs that each
// have a test in tests/furniture-*.todo.js.
import { AVENUES, CROSSINGS, DISTRICTS, ROAD_HALF_WIDTH, WALKWAY_WIDTH } from './world.js';
import { worldSeed } from './seedstore.js';
import { mulberry32 } from './rng.js';

// Its own random stream, so furniture never moves a lot, a vista or a person.
export const FURN_SALT = 0xf00d;
// Kerbside furniture on one road keeps this far from the centre-line of a road
// it meets: that road's carriageway, a walkway and a step more.
export const FURN_CLEAR = 1.5;
export const BAND = ROAD_HALF_WIDTH + WALKWAY_WIDTH + FURN_CLEAR;
// And stops this far short of its own road's ends.
export const END_CLEAR = 4;

// Lamps: the hand map's rhythm, a pole every LAMP_STEP metres on alternate
// sides, the pole POLE_X off an avenue's centre-line with its head ARM back
// over the road; a crossing's narrower footway puts its poles CROSS_POLE_OUT
// off the centre-line and their heads CROSS_HEAD_OUT.
export const LAMP_STEP = 18;
export const LAMP_PHASE = 9;
export const POLE_X = 5.4;
export const ARM = 1.8;
export const CROSS_POLE_OUT = 4.2;
export const CROSS_HEAD_OUT = 2.4;

// Parked cars: a kerb slot every PARK_STEP metres down each side of every
// avenue, and PARK_SHARE of them hold a car.
export const PARK_STEP = 12;
export const PARK_PHASE = 6;
export const PARK_SHARE = 0.3;

// Utility boxes out against the building line, every BOX_STEP on alternate sides.
export const BOX_STEP = 40;
export const BOX_PHASE = 20;
export const BOX_OUT = ROAD_HALF_WIDTH + 2.7;

// The z's down avenue `av` on the rhythm phase + k * step (k any integer), from
// av.z0 + END_CLEAR to av.z1 - END_CLEAR inclusive, leaving out every z closer
// than BAND to a crossing that meets the avenue (c.x0 <= av.x <= c.x1).
// Ascending.
export function avenueSpots(av, crossings, phase, step) {
  const near = crossings.filter((c) => c.x0 <= av.x && av.x <= c.x1);
  const out = [];
  for (let k = Math.ceil((av.z0 + END_CLEAR - phase) / step); phase + k * step <= av.z1 - END_CLEAR; k++) {
    const z = phase + k * step;
    if (near.every((c) => Math.abs(z - c.z) >= BAND)) out.push(z);
  }
  return out;
}

// The x's along crossing `c` on the rhythm phase + k * step, from c.x0 +
// END_CLEAR to c.x1 - END_CLEAR inclusive, leaving out every x closer than BAND
// to any avenue's centre-line. Ascending.
export function crossingSpots(c, avenues, phase, step) {
  const out = [];
  for (let k = Math.ceil((c.x0 + END_CLEAR - phase) / step); phase + k * step <= c.x1 - END_CLEAR; k++) {
    const x = phase + k * step;
    if (avenues.every((a) => Math.abs(x - a.x) >= BAND)) out.push(x);
  }
  return out;
}

// A kerbside rhythm for the avenue at x = ax, as the render's loops write it:
// `from` to `to` inclusive, every `step`. On the hand preset exactly that range;
// on a generated world the same rhythm down that avenue's whole length, off its
// crossings: avenueSpots(the avenue at ax, CROSSINGS, from, step).
export function rhythm(ax, from, to, step) {
  if (!worldSeed().generate) {
    const out = [];
    for (let z = from; z <= to; z += step) out.push(z);
    return out;
  }
  return avenueSpots(AVENUES.find((a) => a.x === ax), CROSSINGS, from, step);
}

// Street lamps { x, z, hx, hz, rotY, zone }, the shape render/lamps.js draws.
// Every avenue in order, at avenueSpots(a, crossings, LAMP_PHASE, LAMP_STEP),
// alternating sides from the west (side -1 first): pole at a.x + side * POLE_X,
// head at a.x + side * (POLE_X - ARM) and the same z, rotY 0 for side 1 and
// Math.PI for side -1. Then every crossing in order, at crossingSpots(c,
// avenues, LAMP_PHASE, LAMP_STEP), alternating from the south (side -1 first):
// pole at z = c.z + side * CROSS_POLE_OUT, head at hx = x, hz = c.z + side *
// CROSS_HEAD_OUT, rotY -Math.PI / 2 for side 1 and Math.PI / 2 for side -1.
// zone is 0 for a pole at z < 0 and 1 otherwise (the blackout's two halves).
export function lampsFor(district) {
  void district;
  return [];
}

// Parked cars [avenueX, side, z], the shape sim/street.js parks. Every avenue in
// order, its west side (-1) then its east (1), at avenueSpots(a, crossings,
// PARK_PHASE, PARK_STEP): one draw of mulberry32((seed ^ FURN_SALT) >>> 0) per
// spot in that order, and the spot holds a car when the draw is < PARK_SHARE.
export function parkedFor(district, seed) {
  void district;
  void mulberry32(seed ^ FURN_SALT);
  return [];
}

// Utility boxes [x, z]. Every avenue in order, at avenueSpots(a, crossings,
// BOX_PHASE, BOX_STEP), alternating sides from the west: x = a.x + side * BOX_OUT.
export function boxesFor(district) {
  void district;
  return [];
}

// Where a crossing meets an avenue { x, z }: zebra stripes and drain grates go
// here. Every crossing in order, and for each every avenue it meets (c.x0 <=
// a.x <= c.x1) in order: { x: a.x, z: c.z }.
export function junctionsOf(district) {
  void district;
  return [];
}

export function planFurniture(district, seed) {
  return {
    lamps: lampsFor(district),
    parked: parkedFor(district, seed),
    boxes: boxesFor(district),
    junctions: junctionsOf(district),
  };
}

// The furniture of the world being played: null on the hand preset.
export const WORLD_FURNITURE = worldSeed().generate ? planFurniture(DISTRICTS[0], worldSeed().seed) : null;
