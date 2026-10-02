// Where the hack, the chase and the story stand in the world being played. The
// hand preset keeps the coordinates they were written for; a generated world
// moves each onto its own streets (docs/PROCGEN.md): the substations stand on
// the main avenue's pavements, the chase cars start on the main avenue, and
// every story place and sign keeps its offset from the avenue it was written
// against (main, east or west), so "the Tavern on Main" is still on the main
// avenue's pavement and the first mission's substation is the one the hack
// sparks at.
// Pure (law 5): render/hackfx.js and main.js read SUBSTATIONS, sim/wanted.js
// reads PURSUIT_HOMES, sim/arc.js reads worldArc.
//
// Milestone 2 skeleton: the constants and hand tables are final; counterpartX,
// placeX, substationsFor, pursuitHomesFor and arcFor are stubs with their test
// in tests/anchors-place.todo.js.
import { DISTRICTS } from './world.js';
import { worldSeed } from './seedstore.js';

// The hand preset's avenues, main first, then east, then west.
export const HAND_AVENUE_X = [0, 44, -44];
// A substation is { x, z, zone, face }: its cabinet's centre, the power zone it
// feeds (0 is z < 0, 1 is z >= 0), and which way along x its slits face, toward
// the road. These two are where the hand preset has always had them.
export const HAND_SUBSTATIONS = [
  { x: 8.3, z: -30, zone: 0, face: -1 },
  { x: -8.3, z: 30, zone: 1, face: 1 },
];
// Where each chase car waits until the heat brings it out.
export const HAND_PURSUIT_HOMES = [
  { x: 0, z: -55 },
  { x: 0, z: 55 },
];

// On a generated world a cabinet stands on the pavement against the wall, this
// far off the main avenue's centre-line: zone 0 on the east side (face -1),
// zone 1 on the west (face 1).
export const SUB_OUT = 6.3;
// It keeps this far (in z) from the centre-line of any crossing that meets the
// main avenue, and this far inside the walk box's z ends.
export const SUB_CLEAR = 8;
// A story place anchored to a substation stands this far from the cabinet
// toward the road, as the first mission's place does on the hand preset.
export const SUB_PLACE_IN = 1.5;
// Story places that are a substation: place id -> substation index.
export const SUBSTATION_PLACES = { substation_s: 0 };

// The x of the generated avenue that plays the part of hand avenue handAx: 0 is
// district.avenues[0]; 44 is the nearest avenue east of it (the smallest x
// greater than avenues[0].x), or failing that the nearest west; -44 is the
// nearest west (the largest x less than avenues[0].x), or failing that the
// nearest east.
export function counterpartX(handAx, district) {
  void handAx;
  void district;
  return 0;
}

// A hand x moved onto a generated world: find the HAND_AVENUE_X entry nearest x
// (on a tie the earlier entry), and keep x's offset from it on its counterpart:
// counterpartX(ax, district) + (x - ax).
export function placeX(x, district) {
  void district;
  return x;
}

// A generated world's substations, zone 0 then zone 1. Zone 0 is { x:
// avenues[0].x + SUB_OUT, face: -1 }, zone 1 { x: avenues[0].x - SUB_OUT, face:
// 1 }. Each one's z is the first z in the order hand z, hand z - 0.5, hand z +
// 0.5, hand z - 1, hand z + 1, ... (its HAND_SUBSTATIONS z) that is in its own
// zone (z < 0 for zone 0, z >= 0 for zone 1), lies within district.walk.minZ +
// SUB_CLEAR to district.walk.maxZ - SUB_CLEAR, and is at least SUB_CLEAR from
// the z of every crossing that meets the main avenue (c.x0 <= a.x <= c.x1).
export function substationsFor(district) {
  void district;
  return HAND_SUBSTATIONS;
}

// A generated world's chase cars wait on its main avenue: each HAND_PURSUIT_HOMES
// entry with x = district.avenues[0].x and its z unchanged.
export function pursuitHomesFor(district) {
  void district;
  return HAND_PURSUIT_HOMES;
}

// The arc definition (content/arc.json) moved onto a generated world: a new
// object with every key of def, where places and signs are new objects too.
// Each place keeps its fields but x becomes placeX(x, district), except a place
// named in SUBSTATION_PLACES: it stands at { x: sub.x + sub.face * SUB_PLACE_IN,
// z: sub.z } of substationsFor(district)[index]. Each sign keeps its fields but
// x becomes placeX(x, district). def itself is never changed.
export function arcFor(def, district) {
  void district;
  return def;
}

// The world being played: generated games move everything, the hand preset
// keeps its tables.
const GENERATE = worldSeed().generate;
export const SUBSTATIONS = GENERATE ? substationsFor(DISTRICTS[0]) : HAND_SUBSTATIONS;
export const PURSUIT_HOMES = GENERATE ? pursuitHomesFor(DISTRICTS[0]) : HAND_PURSUIT_HOMES;
export function worldArc(def) {
  return GENERATE ? arcFor(def, DISTRICTS[0]) : def;
}
