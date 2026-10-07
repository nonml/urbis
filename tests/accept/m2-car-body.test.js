// M2.F2 and M2.F4 (M2-0, M2-1, M2-2, docs/ROADMAP.md): the models the game loads
// are in the repo, not made in a temp dir by a test. The person is a skinned GLB
// with a walk clip; the car is one believable modern saloon body with no flat
// slab under it (the trellis "showcase racer" came out as shards on a plane).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

function glb(path) {
  const b = readFileSync(path);
  return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
}

test('M2.F4 node: car.glb is a saloon-sized body with no slab', () => {
  const j = glb('public/assets/models/car/car.glb');
  const info = JSON.parse(readFileSync('public/assets/models/car/info.json', 'utf8'));
  expect(info.source, 'not the trellis showcase racer').not.toMatch(/showcase|racer/i);
  let lo = [Infinity, Infinity, Infinity];
  let hi = [-Infinity, -Infinity, -Infinity];
  for (const m of j.meshes) {
    for (const p of m.primitives) {
      const a = j.accessors[p.attributes.POSITION];
      const span = a.max.map((v, i) => v - a.min[i]);
      expect(Math.min(...span), `${m.name}: a flat plane is not part of a car`).toBeGreaterThan(0.05);
      lo = lo.map((v, i) => Math.min(v, a.min[i]));
      hi = hi.map((v, i) => Math.max(v, a.max[i]));
    }
  }
  const [w, h, l] = hi.map((v, i) => v - lo[i]);
  expect(l, 'length, m').toBeGreaterThan(4.3);
  expect(l, 'length, m').toBeLessThan(4.9);
  expect(w, 'width, m').toBeGreaterThan(1.7);
  expect(w, 'width, m').toBeLessThan(2.0);
  expect(h, 'height, m').toBeGreaterThan(1.35);
  expect(h, 'height, m').toBeLessThan(1.6);
});
