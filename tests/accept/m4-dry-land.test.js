// M4-2 (docs/ROADMAP.md): nothing is built in the river. After M4.T8b the
// river reads as water, but on seed 7 the plan still stands 8 buildings, 6
// building rows and 5 lots inside the water rect, drawn as towers in the
// stream. On every seed no building, row run or lot overlaps map water; only
// bridges cross it.
import { test, expect } from '@playwright/test';
import { setWorldSeed } from '../../src/sim/seedstore.js';
import { createMap } from '../../src/sim/map.js';
import { planLayout } from '../../src/sim/layout.js';

const SEEDS = [7, 11, 22, 33, 73];

for (const seed of SEEDS) {
  test(`M4-2 seed ${seed}: nothing stands in the river`, () => {
    setWorldSeed(seed, true);
    const map = createMap(seed);
    const water = map.water ?? [];
    const wet = (x, z, w, d) => water.some(([cx, cz, hw, hd]) =>
      Math.abs(x - cx) < hw + w / 2 && Math.abs(z - cz) < hd + d / 2);
    const pinned = (map.buildings ?? []).filter((b) => b.kind === 'tower')
      .map((b) => ({ side: -b.face[0], z: b.z, d: b.d }));
    const plan = planLayout(map.district, map.seed, pinned);
    const bad = [
      ...(map.buildings ?? []).filter((b) => wet(b.x, b.z, b.w ?? 0, b.d ?? 0))
        .map((b) => `building ${b.kind} at ${b.x},${b.z}`),
      ...plan.rows.flatMap((r) => r.runs
        .filter(([z0, z1]) => wet(r.ax + r.side * r.depth / 2, (z0 + z1) / 2, r.depth, z1 - z0))
        .map(([z0, z1]) => `row x=${r.ax} side ${r.side} z ${z0.toFixed(1)}..${z1.toFixed(1)}`)),
      ...plan.lots.filter(([x, z, w, d]) => wet(x, z, w, d)).map(([x, z]) => `lot at ${x},${z}`),
    ];
    expect(bad, `seed ${seed}: built in the river:\n${bad.join('\n')}`).toEqual([]);
  });
}
