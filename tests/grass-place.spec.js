// The grass belongs to the city it grows in. The verges, the pocket park and the
// tufts stood at hand-map coordinates 5 cm above the road, so on all 300 generated
// cities grass lay across a carriageway: 826 m2 on seed 73, where a crossing runs
// into a lawn with trees on it, and up to 1,798 m2 on others (D14,
// docs/shots/REVIEW.md). A generated city now lays its own grass off its roads
// and pavements, its building rows, its lots and its skyline towers; the hand map
// keeps its own.
import { test, expect } from '@playwright/test';
import { grassFor, HAND_GRASS } from '../src/render/landscape.js';
import { generateDistrict } from '../src/sim/citygen.js';
import { planLayout, CROSSING_BAND, BUILD_LINE } from '../src/sim/layout.js';
import { planVistas } from '../src/sim/vistas.js';

const SEEDS = [...Array.from({ length: 300 }, (_, i) => i + 1), 1234567];
// Still green: the hand map has 5,068 m2 of verge and park.
const GRASS_MIN_M2 = 2000;

const box = (x0, x1, z0, z1) => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
const centred = (x, z, w, d) => box(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

// Where grass may not lie: each avenue out to its building line (carriageway and
// pavement), each crossing with its walkways, every building row, every lot and
// every skyline tower.
function hard(district, plan, vistas) {
  return [
    ...district.avenues.map((a) => box(a.x - BUILD_LINE, a.x + BUILD_LINE, a.z0, a.z1)),
    ...district.crossings.map((c) => box(c.x0, c.x1, c.z - CROSSING_BAND, c.z + CROSSING_BAND)),
    ...plan.rows.flatMap((r) => r.runs.map(([z0, z1]) => box(r.ax + r.side * BUILD_LINE, r.ax + r.side * (BUILD_LINE + r.depth), z0, z1))),
    ...plan.lots.map(([x, z, w, d]) => centred(x, z, w, d)),
    ...[...vistas.caps, ...vistas.ring].map((t) => centred(t.x, t.z, t.w, t.d)),
  ];
}

function rectsOf(grass) {
  return [...grass.slabs.map((s) => centred(s.x, s.z, s.w, s.d)), ...grass.tufts];
}

// A generated city's grass, the way main.js asks for it.
function grassOf(seed) {
  const district = generateDistrict(seed);
  const plan = planLayout(district, seed);
  const vistas = planVistas(district, seed);
  return { district, plan, vistas, grass: grassFor(district, plan, vistas) };
}

test('no generated city grows grass on a street, a building row, a lot or a tower', () => {
  for (const seed of SEEDS) {
    const { district, plan, vistas, grass } = grassOf(seed);
    const keepOff = hard(district, plan, vistas);
    let bad = 0;
    for (const g of rectsOf(grass)) for (const h of keepOff) bad += overlap(g, h);
    expect(bad, `seed ${seed}: m2 of grass on a street, row, lot or tower`).toBeLessThan(0.01);
  }
});

test('every generated city still has its verges', () => {
  for (const seed of SEEDS) {
    const area = grassOf(seed).grass.slabs.reduce((s, g) => s + g.w * g.d, 0);
    expect(area, `seed ${seed}: m2 of verge`).toBeGreaterThanOrEqual(GRASS_MIN_M2);
  }
});

test('every tuft patch lies on a verge', () => {
  for (const seed of SEEDS) {
    const { grass } = grassOf(seed);
    const slabs = grass.slabs.map((s) => centred(s.x, s.z, s.w, s.d));
    const loose = grass.tufts.filter((t) => {
      const area = (t.x1 - t.x0) * (t.z1 - t.z0);
      return slabs.reduce((s, g) => s + overlap(t, g), 0) < area - 0.01;
    });
    expect(loose.length, `seed ${seed}: tuft patches off the verge`).toBe(0);
  }
});

test('the hand map keeps its own grass', () => {
  expect(HAND_GRASS.slabs).toEqual([
    { x: -50.75, z: -5, w: 2.5, d: 280 },
    { x: -32, z: -4, w: 12, d: 284 },
    { x: 61, z: 5, w: 15, d: 32 },
    { x: 22, z: -71.5, w: 60, d: 4 },
    { x: 22, z: -56.5, w: 60, d: 4 },
  ]);
  expect(HAND_GRASS.tufts).toEqual([
    { x0: -52, x1: -50, z0: -60, z1: 55 },
    { x0: -37, x1: -28, z0: -60, z1: 55 },
    { x0: 54, x1: 68, z0: -10, z1: 20 },
    { x0: -7, x1: 51, z0: -73, z1: -70 },
  ]);
});
