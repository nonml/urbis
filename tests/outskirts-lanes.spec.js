// The farm tracks belong to the city too. Like the bands, they were hand-map
// polylines, so on a generated city they started nowhere near its roads and
// ran through fields that had moved. lanesFor(district, bands) lays the same
// four tracks inside a generated city's bands: one carries an east-reaching
// crossing on out east, one carries an avenue on out south, and one spine runs
// down the middle of each band.
import { test, expect } from '@playwright/test';
import { bandsFor, lanesFor, HAND_LANES } from '../src/render/outskirts.js';
import { generateDistrict } from '../src/sim/citygen.js';
import { planVistas } from '../src/sim/vistas.js';
import { sweep } from './sweep.js';

const SEEDS = [...sweep(300), 1234567];
const inside = (b, [x, z]) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;

function world(seed) {
  const district = generateDistrict(seed);
  const bands = bandsFor(district, planVistas(district, seed));
  return { district, bands, lanes: lanesFor(district, bands) };
}

test('the hand map keeps its tracks', () => {
  expect(HAND_LANES).toEqual([
    [[86, 40], [118, 45], [152, 37], [190, 41]],
    [[104, -62], [110, -4], [106, 44], [101, 74]],
    [[-22, -150], [20, -159], [60, -150], [86, -157]],
    [[30, -122], [35, -151], [29, -206]],
  ]);
});

test('every track lies on the farmland', () => {
  for (const seed of SEEDS) {
    const { bands, lanes } = world(seed);
    expect(lanes.length, `seed ${seed}`).toBe(4);
    for (const lane of lanes) {
      expect(lane.length, `seed ${seed}`).toBeGreaterThanOrEqual(3);
      for (const p of lane) expect(bands.some((b) => inside(b, p)), `seed ${seed}: ${p} is off the farmland`).toBe(true);
    }
  }
});

test('the east track carries a city crossing on out of town', () => {
  for (const seed of SEEDS) {
    const { district, bands: [, east], lanes: [track] } = world(seed);
    const [x, z] = track[0];
    expect(x, `seed ${seed}`).toBe(east.x0);
    const reaching = district.crossings.filter((c) => c.x1 === district.drive.maxX).map((c) => c.z);
    expect(reaching, `seed ${seed}: the track starts at z ${z}`).toContain(z);
    expect(track.at(-1)[0], `seed ${seed}`).toBe(east.x1);
  }
});

test('the south track carries an avenue on out of town', () => {
  for (const seed of SEEDS) {
    const { district, bands: [south], lanes } = world(seed);
    const track = lanes[3];
    const [x, z] = track[0];
    expect(z, `seed ${seed}`).toBe(south.z1);
    expect(district.avenues.map((a) => a.x), `seed ${seed}: the track starts at x ${x}`).toContain(x);
    expect(track.at(-1)[1], `seed ${seed}`).toBe(south.z0);
  }
});
