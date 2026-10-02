// Set dressing a street keeps by its walls and in its gutters: the trade signs
// over the shop doors, the water standing on the asphalt and the pavement, the
// steam off the pavement grates. The hand preset keeps the tables
// render/setdress.js has always drawn; a generated world derives its own from its
// rows, roads, pinned towers and start (docs/PROCGEN.md), so no sign hangs in
// mid-air or inside a wall and no puddle lies across a zebra.
// Pure (law 5): render/setdress.js reads SHOPS, PUDDLES and VENTS. A world may
// put every shop, or every puddle, in one power zone (z < 0 or z >= 0).
//
// Milestone 2 skeleton: the constants and hand tables are final; planDressing is
// a stub with its test in tests/dressing-place.todo.js.
import { DISTRICTS } from './world.js';
import { worldSeed } from './seedstore.js';
import { mulberry32 } from './rng.js';
import { planLayout } from './layout.js';
import { HAND_PINNED, placePinned } from './landmarks.js';
import { spawnFor } from './spawn.js';

// What the hand preset has always drawn. A shop is { x, z, ry, kind }: the sign
// line's x and z, the way the sign faces (Math.PI / 2 on a west-side wall,
// -Math.PI / 2 on an east-side one) and its trade, 0 RAMEN, 1 PAWN, 2 CLINIC.
export const HAND_SHOPS = [
  { x: -6.0, z: -12, ry: Math.PI / 2, kind: 0 },
  { x: 6.0, z: 2, ry: -Math.PI / 2, kind: 1 },
  { x: -6.0, z: 22, ry: Math.PI / 2, kind: 2 },
  { x: 35.5, z: -20, ry: Math.PI / 2, kind: 1 },
  { x: 50.0, z: 14, ry: -Math.PI / 2, kind: 0 },
  { x: 10, z: -60.9, ry: Math.PI, kind: 2 },
];
// A puddle is [x, z, size, surface y]. The first is the hero puddle: left-lane
// water a few metres from the start camera. Water far down the street is a few
// grey pixels, and a mirror laid over crosswalk paint reads as a stain.
export const HAND_PUDDLES = [
  [-1.5, 25.5, 8, 0.025], [2.2, -8, 9, 0.025], [42.5, 4, 8, 0.025], [46, -24, 6, 0.025],
  [20, -64, 8, 0.025], [1.2, 34, 6, 0.025], [43, 30, 7, 0.025],
  [-5.9, -3, 4, 0.145], [5.9, 30, 4, 0.145], [38.2, 22, 4, 0.145],
  [49.8, -12, 4, 0.145], [16, -69.3, 5, 0.145], [0.5, 2, 6, 0.025],
];
// A vent is { x, z, phase }: where its steam rises and how far into its puff
// cycle it starts, so neighbouring vents never breathe in step.
export const HAND_VENTS = [
  { x: -5.5, z: -30, phase: 0 },
  { x: 46.5, z: 8, phase: 0.8 },
  { x: -5.5, z: -14, phase: 1.6 },
];

export const DRESS_SALT = 0xd7e5;

// A sign line stands this far off its avenue's centre-line, as the hand shops
// at x = +-6 do.
export const SHOP_OUT = 6.0;
// The RAMEN board hangs this far up the avenue from the noodle bar's centre, as
// it does on the hand preset (tower z -14, sign z -12).
export const RAMEN_SIGN_DZ = 2;
// A row run shorter than this has no wall wide enough for a 7 m sign cap.
export const SHOP_RUN = 8;
export const SHOPS_MAX = 6;
// Steam rises from a pavement grate this far off the centre-line, VENT_BACK
// down the avenue from a shop's sign, the way the hand vent by the noodle bar
// stands. Every other shop has one, up to VENTS_MAX.
export const VENT_OUT = 5.5;
export const VENT_BACK = 2;
export const VENT_PHASE = 0.8;
export const VENTS_MAX = 3;

// The hero puddle lies this far from the car the player starts beside.
export const HERO_DX = -4.5;
export const HERO_DZ = 2;
export const HERO_SIZE = 8;
// Water stands on the road or on the pavement, a hair above each.
export const ROAD_Y = 0.025;
export const WALK_Y = 0.145;
// Each avenue gets this many road puddles and one pavement puddle.
export const ROAD_PUDDLES = 3;
// A road puddle's centre lies this far off its avenue's centre-line, either way;
// its size is a whole number of metres in this range.
export const PUDDLE_LANE = [0.5, 2];
export const PUDDLE_SIZE = [6, 9];
// A pavement puddle lies this far off its avenue's centre-line, this big.
export const WALK_PUDDLE_OUT = 5.9;
export const WALK_PUDDLE_SIZE = 4;
// Water keeps this far (in z) from a crossing's centre-line where the crossing
// meets its avenue, and from the mid-block zebra render/block.js paints on
// avenue k at MIDBLOCK_ZEBRA[k]; and this far inside the drive box's z ends.
export const PUDDLE_CLEAR = 12;
export const MIDBLOCK_ZEBRA = [20, -20, 10];
export const PUDDLE_END = 6;
// A puddle draws until it lands clear, at most this many times; past that the
// avenue goes without it.
export const PUDDLE_TRIES = 20;

// { shops, puddles, vents } for a generated district, in the hand tables' shapes.
//
// shops: shops[0] is the RAMEN board on the noodle bar, the 'ramen' tower of
// placePinned(HAND_PINNED, district.avenues[0], district.crossings): x =
// avenues[0].x + tower.side * SHOP_OUT, z = tower.z + RAMEN_SIGN_DZ. The rest
// come from planLayout(district, seed).rows, where the player can walk: in row
// order, every run clipped to district.walk.minZ .. district.walk.maxZ (z0 =
// Math.max(z0, minZ), z1 = Math.min(z1, maxZ)) that is still SHOP_RUN or longer
// is a candidate at x = row.ax + row.side * SHOP_OUT and z = the clipped run's
// midpoint rounded to the half metre (Math.round(mid * 2) / 2).
// With n candidates and m = Math.min(n, SHOPS_MAX - 1), shop i + 1 is
// candidate Math.floor(i * n / m) for i = 0 .. m - 1. Every shop faces the
// street from its own side, ry = Math.PI / 2 on side -1 and -Math.PI / 2 on
// side 1, and shop k has kind k % 3.
//
// vents: one for each of shops 0, 2, 4, ... up to VENTS_MAX. With side = -1
// when the shop's ry is Math.PI / 2 and 1 otherwise, a vent is { x: shop.x -
// side * (SHOP_OUT - VENT_OUT), z: shop.z - VENT_BACK, phase: vent index *
// VENT_PHASE }, so it stands VENT_OUT off the shop's avenue.
//
// puddles: puddles[0] is the hero puddle [car.x + HERO_DX, car.z + HERO_DZ,
// HERO_SIZE, ROAD_Y] where car is spawnFor(district).car. Then, with rand =
// mulberry32((seed ^ DRESS_SALT) >>> 0), for each avenue in order: ROAD_PUDDLES
// road puddles, then one pavement puddle. A road puddle draws z, then a side
// (-1 when rand() < 0.5, else 1), then an offset, then a size, and is
// [a.x + side * offset, z, size, ROAD_Y]; a pavement puddle draws z, then a
// side, and is [a.x + side * WALK_PUDDLE_OUT, z, WALK_PUDDLE_SIZE, WALK_Y].
// z = district.drive.minZ + PUDDLE_END + rand() * (drive.maxZ - drive.minZ -
// 2 * PUDDLE_END), rounded to the half metre; offset = PUDDLE_LANE[0] +
// Math.round(rand() * 2 * (PUDDLE_LANE[1] - PUDDLE_LANE[0])) / 2; size =
// PUDDLE_SIZE[0] + Math.floor(rand() * (PUDDLE_SIZE[1] - PUDDLE_SIZE[0] + 1)).
// A puddle is kept once its z is at least PUDDLE_CLEAR from every crossing that
// meets the avenue (c.x0 <= a.x <= c.x1) and from the avenue's MIDBLOCK_ZEBRA
// entry, if it has one; otherwise it draws everything again, PUDDLE_TRIES times
// in all, then is skipped.
const half = (v) => Math.round(v * 2) / 2;
const face = (side) => (side < 0 ? Math.PI / 2 : -Math.PI / 2);

function shopsFor(district, seed) {
  const a0 = district.avenues[0];
  const ramen = placePinned(HAND_PINNED, a0, district.crossings).find((t) => t.id === 'ramen');
  const shops = [{ x: a0.x + ramen.side * SHOP_OUT, z: ramen.z + RAMEN_SIGN_DZ, ry: face(ramen.side), kind: 0 }];
  const cands = [];
  for (const r of planLayout(district, seed).rows) {
    for (const [r0, r1] of r.runs) {
      const z0 = Math.max(r0, district.walk.minZ);
      const z1 = Math.min(r1, district.walk.maxZ);
      if (z1 - z0 >= SHOP_RUN) cands.push({ x: r.ax + r.side * SHOP_OUT, z: half((z0 + z1) / 2), ry: face(r.side) });
    }
  }
  const m = Math.min(cands.length, SHOPS_MAX - 1);
  for (let i = 0; i < m; i += 1) shops.push({ ...cands[Math.floor((i * cands.length) / m)], kind: (i + 1) % 3 });
  return shops;
}

function ventsFor(shops) {
  const vents = [];
  for (let k = 0; k < shops.length && vents.length < VENTS_MAX; k += 2) {
    const s = shops[k];
    const side = s.ry === Math.PI / 2 ? -1 : 1;
    vents.push({ x: s.x - side * (SHOP_OUT - VENT_OUT), z: s.z - VENT_BACK, phase: vents.length * VENT_PHASE });
  }
  return vents;
}

function puddlesFor(district, seed) {
  const car = spawnFor(district).car;
  const puddles = [[car.x + HERO_DX, car.z + HERO_DZ, HERO_SIZE, ROAD_Y]];
  const rand = mulberry32((seed ^ DRESS_SALT) >>> 0);
  const { minZ, maxZ } = district.drive;
  const drawZ = () => half(minZ + PUDDLE_END + rand() * (maxZ - minZ - 2 * PUDDLE_END));
  const drawSide = () => (rand() < 0.5 ? -1 : 1);
  district.avenues.forEach((a, k) => {
    const zebra = MIDBLOCK_ZEBRA[k];
    for (let p = 0; p <= ROAD_PUDDLES; p += 1) {
      for (let t = 0; t < PUDDLE_TRIES; t += 1) {
        const z = drawZ();
        const side = drawSide();
        let q;
        if (p < ROAD_PUDDLES) {
          const off = PUDDLE_LANE[0] + Math.round(rand() * 2 * (PUDDLE_LANE[1] - PUDDLE_LANE[0])) / 2;
          const size = PUDDLE_SIZE[0] + Math.floor(rand() * (PUDDLE_SIZE[1] - PUDDLE_SIZE[0] + 1));
          q = [a.x + side * off, z, size, ROAD_Y];
        } else {
          q = [a.x + side * WALK_PUDDLE_OUT, z, WALK_PUDDLE_SIZE, WALK_Y];
        }
        const meets = district.crossings.filter((c) => c.x0 <= a.x && a.x <= c.x1);
        const clear = meets.every((c) => Math.abs(z - c.z) >= PUDDLE_CLEAR)
          && (zebra === undefined || Math.abs(z - zebra) >= PUDDLE_CLEAR);
        if (clear) { puddles.push(q); break; }
      }
    }
  });
  return puddles;
}

export function planDressing(district, seed) {
  const shops = shopsFor(district, seed);
  return { shops, puddles: puddlesFor(district, seed), vents: ventsFor(shops) };
}

// The dressing of the world being played: generated games only, null on the hand preset.
export const WORLD_DRESSING = worldSeed().generate ? planDressing(DISTRICTS[0], worldSeed().seed) : null;
export const SHOPS = WORLD_DRESSING ? WORLD_DRESSING.shops : HAND_SHOPS;
export const PUDDLES = WORLD_DRESSING ? WORLD_DRESSING.puddles : HAND_PUDDLES;
export const VENTS = WORLD_DRESSING ? WORLD_DRESSING.vents : HAND_VENTS;
