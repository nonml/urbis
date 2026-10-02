// What closes the view on a generated world: a cap tower at each end of every
// avenue, so driving down one ends in lit towers, and a skyline ring past the
// built edge, so the horizon reads as more city. Derived from the district and
// the seed (docs/PROCGEN.md); on the hand preset render/block.js keeps its tables.
// Pure (law 5): render/block.js reads WORLD_VISTAS, scripts/check_overlap.mjs
// measures what it builds.
//
// Milestone 2 skeleton: the constants are final, the bodies are stubs that each
// have a test in tests/vistas-*.todo.js.
import { DISTRICTS } from './world.js';
import { worldSeed } from './seedstore.js';
import { mulberry32 } from './rng.js';

// Its own random stream, so a vista never moves a lot or a row building.
export const VISTA_SALT = 0x51a7;
// A cap's near face stands exactly this far past its avenue's road end.
export const CAP_GAP = 2;
// A cap's size: w along x, d along z, h tall. Every value lands on a half-metre.
export const CAP_W = [14, 18];
export const CAP_D = [11, 13];
export const CAP_H = [36, 52];
// Ring towers stand at least this far past what is built: the walk's east edge
// (the pocket park), and the deepest cap north and south.
export const RING_GAP = 12;
// The west keeps its open valley: only RING_WEST towers, past the drive's west
// edge by at least this.
export const WEST_GAP = 30;
export const RING_W = [18, 26];
export const RING_D = [16, 20];
export const RING_H = [50, 88];
// How many ring towers stand on each side.
export const RING_EAST = 5;
export const RING_NORTH = 3;
export const RING_SOUTH = 3;
export const RING_WEST = 2;
// Two ring towers on one side keep at least this between them, so a tower may
// come out narrower than RING_W when a side is short. Never narrower than RING_MIN.
export const RING_SPACE = 2;
export const RING_MIN = 10;

// A cap tower { x, z, w, d, h, face } at both ends of every avenue, centred on
// its x. The north cap's near face is CAP_GAP past the avenue's z1 and its front
// looks back down the avenue (face [0, -1]); the south cap mirrors it past z0
// (face [0, 1]). w, d and h are drawn from CAP_W, CAP_D and CAP_H with
// mulberry32(seed ^ VISTA_SALT).
export function capsFor(district, seed) {
  void district;
  void seed;
  return [];
}

// The skyline ring { x, z, w, d, h }: RING_EAST towers down the east side,
// RING_NORTH and RING_SOUTH across the north and south rims behind the caps,
// RING_WEST far out in the west valley. Spread each side's towers evenly along
// it. No tower may stand inside the built area plus its margins: x from the
// drive's minX - WEST_GAP to the walk's maxX + RING_GAP, z from the avenues' z0
// to z1 widened by CAP_GAP + CAP_D[1] + RING_GAP. No two ring towers overlap.
export function ringFor(district, seed) {
  void district;
  void mulberry32(seed ^ VISTA_SALT);
  return [];
}

export function planVistas(district, seed) {
  return { caps: capsFor(district, seed), ring: ringFor(district, seed) };
}

// The vistas of the world being played: null on the hand preset.
export const WORLD_VISTAS = worldSeed().generate ? planVistas(DISTRICTS[0], worldSeed().seed) : null;
