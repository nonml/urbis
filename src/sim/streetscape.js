// What the street wears that the hand preset placed by hand: the neon blade
// signs over the shopfronts and the one mid-block zebra on each avenue. The hand
// preset keeps its coordinates; a generated world hangs each blade sign on a
// real building front of the avenue it was written against (main, east or west,
// as sim/anchors.js maps them), the noodle bar's ラーメン blade over its RAMEN
// board (sim/dressing.js), and paints each avenue's zebra between two kerb
// parking slots, clear of every junction and of the car the player starts by.
// Pure (law 5): render/signs.js reads worldSigns, render/block.js MIDBLOCK.
//
// Milestone 2 skeleton: the constants and hand tables are final; zebrasFor and
// placeSigns are stubs with their test in tests/streetscape-place.todo.js.
import { DISTRICTS } from './world.js';
import { WORLD_PLAN } from './layout.js';
import { spawnFor } from './spawn.js';
import { SHOPS } from './dressing.js';
import { counterpartX } from './anchors.js';

// The mid-block zebra on each hand avenue (main, east, west), as block.js has
// always drawn them: each at its own z so they never line up across the city.
export const HAND_MIDBLOCK = [
  { x: 0, z: 20 },
  { x: 44, z: -20 },
  { x: -44, z: 10 },
];
// A generated zebra's z is a multiple of ZEBRA_STEP: midway between two kerb
// parking slots (sim/furniture.js parks at 6 + 12k), so no parked car sits on
// the stripes.
export const ZEBRA_STEP = 12;
// It keeps this far from the centre-line of every crossing that meets its
// avenue: the junction, its footway and the zebra's own width.
export const ZEBRA_CLEAR = 12;
// And this far inside its avenue's ends and the walk box's z ends.
export const ZEBRA_END = 8;
// On the main avenue it keeps at least this far from the start car's z, so the
// player never starts parked on the stripes.
export const ZEBRA_CAR = 12;

// A blade sign stands this far inside the ends of the building run it hangs on
// (in z), so its arm meets a wall, not a gap.
export const SIGN_IN = 2;
// Two blade signs on one side of one avenue keep this far apart in z.
export const SIGN_GAP = 8;

// A generated world's zebras, one per avenue in district.avenues order, as
// { x: avenue x, z }. For avenue k, with lo = max(a.z0, walk.minZ) + ZEBRA_END
// and hi = min(a.z1, walk.maxZ) - ZEBRA_END, the candidates are the multiples
// of ZEBRA_STEP from lo to hi inclusive that are at least ZEBRA_CLEAR from the z
// of every crossing that meets the avenue (c.x0 <= a.x <= c.x1) and, on avenue
// 0 only, at least ZEBRA_CAR from carZ. The zebra is the candidate nearest
// HAND_MIDBLOCK[k % 3].z (a tie goes to the lower z); an avenue with no
// candidate gets no zebra.
export function zebrasFor(district, carZ) {
  const { walk } = district;
  const out = [];
  district.avenues.forEach((a, k) => {
    const lo = Math.max(a.z0, walk.minZ) + ZEBRA_END;
    const hi = Math.min(a.z1, walk.maxZ) - ZEBRA_END;
    const near = district.crossings.filter((c) => c.x0 <= a.x && a.x <= c.x1);
    const hz = HAND_MIDBLOCK[k % 3].z;
    let best = null;
    for (let z = Math.ceil(lo / ZEBRA_STEP) * ZEBRA_STEP; z <= hi; z += ZEBRA_STEP) {
      if (near.some((c) => Math.abs(z - c.z) < ZEBRA_CLEAR)) continue;
      if (k === 0 && Math.abs(z - carZ) < ZEBRA_CAR) continue;
      if (best === null || Math.abs(z - hz) < Math.abs(best - hz)) best = z;
    }
    if (best !== null) out.push({ x: a.x, z: best });
  });
  return out;
}

// A generated world's blade signs: `defs` (content/signs.json, already
// validated) in order, each kept sign returned as { ...def, ax, side, z }.
// - A def with face 'south' is dropped: it hangs on the hand map's south row.
// - The def whose sub is 'RAMEN' hangs over the RAMEN board: ax =
//   district.avenues[0].x, side = ramen.side, z = ramen.z.
// - Any other def: ax = counterpartX(def.ax ?? 0, district) and side = def.side.
//   Its row is the rows entry with that ax and side; each of the row's runs
//   [r0, r1] gives the span max(r0, walk.minZ) + SIGN_IN .. min(r1, walk.maxZ) -
//   SIGN_IN (spans with lo > hi are skipped). z is def.z clamped into the span
//   that leaves it nearest def.z (a tie goes to the earlier span); a def with no
//   row or no span is dropped.
// - A sign is then dropped when a sign kept before it has the same ax and side
//   and a z closer than SIGN_GAP.
// `rows` is planLayout's rows, `ramen` the RAMEN board as { side, z }.
export function placeSigns(defs, district, rows, ramen) {
  const { walk } = district;
  const out = [];
  for (const def of defs) {
    if (def.face === 'south') continue;
    let ax;
    let side;
    let z;
    if (def.sub === 'RAMEN') {
      ax = district.avenues[0].x;
      side = ramen.side;
      z = ramen.z;
    } else {
      ax = counterpartX(def.ax ?? 0, district);
      side = def.side;
      const row = rows.find((r) => r.ax === ax && r.side === side);
      if (!row) continue;
      z = null;
      for (const [r0, r1] of row.runs) {
        const lo = Math.max(r0, walk.minZ) + SIGN_IN;
        const hi = Math.min(r1, walk.maxZ) - SIGN_IN;
        if (lo > hi) continue;
        const c = Math.min(hi, Math.max(lo, def.z));
        if (z === null || Math.abs(c - def.z) < Math.abs(z - def.z)) z = c;
      }
      if (z === null) continue;
    }
    if (out.some((o) => o.ax === ax && o.side === side && Math.abs(o.z - z) < SIGN_GAP)) continue;
    out.push({ ...def, ax, side, z });
  }
  return out;
}

// The RAMEN board (sim/dressing.js shops[0]) as { side, z }: it faces the road
// from side -1 when its ry is Math.PI / 2.
export function ramenBoard(shop) {
  return { side: shop.ry === Math.PI / 2 ? -1 : 1, z: shop.z };
}

// The zebras of the world being played: a generated world's own, or the hand
// preset's.
export const MIDBLOCK = WORLD_PLAN ? zebrasFor(DISTRICTS[0], spawnFor(DISTRICTS[0]).car.z) : HAND_MIDBLOCK;

// The blade signs of the world being played: the hand preset draws `defs` as
// written; a generated world places them on its own streets.
export function worldSigns(defs) {
  return WORLD_PLAN ? placeSigns(defs, DISTRICTS[0], WORLD_PLAN.rows, ramenBoard(SHOPS[0])) : defs;
}
