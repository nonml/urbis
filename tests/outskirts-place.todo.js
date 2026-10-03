// The farmland belongs to the city it surrounds. Its two bands were fixed at
// hand-map coordinates, so on every one of 300 generated cities about six
// skyline towers stood on fields, hedges and sheds, and on 80 the fields
// reached up to 20 m into the walkable streets. bandsFor(district, vistas) now
// lays the south and east bands just past the skyline, on the ground's lattice.
import { test, expect } from '@playwright/test';
import { bandsFor, HAND_BANDS } from '../src/render/outskirts.js';
import { generateDistrict } from '../src/sim/citygen.js';
import { planVistas } from '../src/sim/vistas.js';

const SEEDS = [...Array.from({ length: 300 }, (_, i) => i + 1), 1234567];
// A band thinner than this is a strip, not farmland.
const MIN_SIDE = 60;
// Fields start this close behind the last tower, or the city ends in a void.
const MAX_GAP = 24;

const towerRect = (t) => ({ x0: t.x - t.w / 2, x1: t.x + t.w / 2, z0: t.z - t.d / 2, z1: t.z + t.d / 2 });
const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
const onLattice = (v) => ((v - 2) % 4 + 4) % 4 === 0;

function world(seed) {
  const district = generateDistrict(seed);
  const vistas = planVistas(district, seed);
  const towers = [...vistas.caps, ...vistas.ring].map(towerRect);
  return { district, towers, bands: bandsFor(district, vistas) };
}

test('the hand map keeps its farmland', () => {
  expect(HAND_BANDS).toEqual([
    { x0: -22, x1: 86, z0: -206, z1: -122, inner: 'z' },
    { x0: 86, x1: 190, z0: -206, z1: 74, inner: 'x' },
  ]);
});

test('farmland never reaches into a generated city or under its skyline', () => {
  for (const seed of SEEDS) {
    const { district, towers, bands } = world(seed);
    const { walk } = district;
    const city = { x0: walk.minX, x1: walk.maxX, z0: walk.minZ, z1: walk.maxZ };
    expect(bands.length, `seed ${seed}`).toBe(2);
    for (const b of bands) {
      expect(overlaps(b, city), `seed ${seed}: band ${JSON.stringify(b)} inside the city`).toBe(false);
      for (const t of towers) {
        expect(overlaps(b, t), `seed ${seed}: a tower at ${t.x0}..${t.x1}, ${t.z0}..${t.z1} stands on a field`).toBe(false);
      }
    }
  }
});

test('farmland sits on the ground lattice and is a real place', () => {
  for (const seed of SEEDS) {
    const [south, east] = world(seed).bands;
    expect(south.inner, `seed ${seed}`).toBe('z');
    expect(east.inner, `seed ${seed}`).toBe('x');
    for (const b of [south, east]) {
      for (const v of [b.x0, b.x1, b.z0, b.z1]) expect(onLattice(v), `seed ${seed}: ${v} is off the 2 (mod 4) lattice`).toBe(true);
      expect(b.x1 - b.x0, `seed ${seed}`).toBeGreaterThanOrEqual(MIN_SIDE);
      expect(b.z1 - b.z0, `seed ${seed}`).toBeGreaterThanOrEqual(MIN_SIDE);
    }
  }
});

test('farmland starts just past the skyline, not a field away', () => {
  for (const seed of SEEDS) {
    const { district, towers, bands: [south, east] } = world(seed);
    const eastFace = Math.max(district.walk.maxX, ...towers.map((t) => t.x1));
    const southFace = Math.min(district.walk.minZ, ...towers.map((t) => t.z0));
    expect(east.x0 - eastFace, `seed ${seed}: gap east of the skyline`).toBeLessThanOrEqual(MAX_GAP);
    expect(southFace - south.z1, `seed ${seed}: gap south of the skyline`).toBeLessThanOrEqual(MAX_GAP);
  }
});
