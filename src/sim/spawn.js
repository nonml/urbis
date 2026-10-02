// Where a new game starts: the player standing in the kerb lane of the main
// avenue, just ahead of the hero car parked at the east kerb, facing down the
// street. On the hand preset that is the spot the game has always started on; a
// generated world derives it from its own main avenue and crossings
// (docs/PROCGEN.md), so a new city never starts the player inside a wall.
// Pure (law 5): sim/player.js and sim/vehicle.js read SPAWN.
//
// Milestone 2 skeleton: the constants are final; spawnFor is a stub with its
// test in tests/spawn-place.todo.js.
import { DISTRICTS, ROAD_HALF_WIDTH } from './world.js';
import { worldSeed } from './seedstore.js';

export const HAND_SPAWN = {
  player: { x: 2.5, z: 26, yaw: Math.PI },
  car: { x: 3.0, z: 23.5, yaw: Math.PI },
};
// Off the main avenue's centre-line, east: the car at the kerb, the player a
// step into the lane ahead of its bonnet.
export const CAR_OUT = 3.0;
export const PLAYER_OUT = 2.5;
export const PLAYER_AHEAD = 2.5;
// The car's z is a multiple of SPAWN_STEP: midway between two kerb parking
// slots (sim/furniture.js parks at 6 + 12k), so no parked car sits on it.
export const SPAWN_STEP = 12;
// The car's z nearest this wins: the hand map's start, rounded onto the step.
export const SPAWN_Z = 24;
// The car stays at least this far from the centre-line of a crossing that
// meets the main avenue, and this far inside the walk box's north and south
// edges, so the player starts on a plain stretch of street they can walk.
export const SPAWN_CLEAR = 12;
// The player stands in the kerb lane, never on the pavement or past it.
export const LANE_EDGE = ROAD_HALF_WIDTH;

// { player: { x, z, yaw }, car: { x, z, yaw } } for a generated district. The
// main avenue is district.avenues[0]; the crossings that meet it are those with
// c.x0 <= a.x <= c.x1. The car's z is the multiple of SPAWN_STEP nearest
// SPAWN_Z (on a tie, the smaller z) that is at least SPAWN_CLEAR from each of
// those crossings' z and lies within district.walk.minZ + SPAWN_CLEAR to
// district.walk.maxZ - SPAWN_CLEAR. The car stands at x = a.x + CAR_OUT, the
// player at x = a.x + PLAYER_OUT and z = car z + PLAYER_AHEAD, both with yaw
// Math.PI (facing -z, down the street).
export function spawnFor(district) {
  void district;
  return HAND_SPAWN;
}

// The start of the world being played.
export const SPAWN = worldSeed().generate ? spawnFor(DISTRICTS[0]) : HAND_SPAWN;
