// M4-3 (docs/ROADMAP.md): hills you can see. M4.T6 landed relief of 3.4 m at
// most over the whole map, which reads as flat from the street and the city
// view. On every seed, inside the town, the ground off the roads must rise at
// least 8 m above the road, the tarmac stays at 0, and no step between samples
// 2 m apart is steeper than 0.6 (a bank, not a wall).
import { test, expect } from '@playwright/test';
import { createMap } from '../../src/sim/map.js';
import { createTerrain } from '../../src/sim/terrain.js';

const SEEDS = [7, 11, 22, 33, 73];
const RISE = 8, STEEP = 0.6, STEP = 2, REACH = 150;

for (const seed of SEEDS) {
  test(`M4-3 seed ${seed}: the town has hills of ${RISE} m, banks not walls`, () => {
    const map = createMap(seed);
    const { heightAt } = createTerrain(map);
    let top = 0, steep = 0, at = null;
    for (let x = -REACH; x <= REACH; x += STEP) for (let z = -REACH; z <= REACH; z += STEP) {
      const h = heightAt(x, z);
      top = Math.max(top, h);
      const s = Math.max(Math.abs(heightAt(x + STEP, z) - h), Math.abs(heightAt(x, z + STEP) - h)) / STEP;
      if (s > steep) { steep = s; at = { x, z }; }
    }
    const roads = map.graph.nodes.map((n) => heightAt(n.x, n.z));
    expect(Math.max(...roads.map(Math.abs)), `seed ${seed}: junctions sit at 0`).toBeLessThan(0.01);
    expect(top, `seed ${seed}: highest ground within ${REACH} m`).toBeGreaterThanOrEqual(RISE);
    expect(steep, `seed ${seed}: steepest step, at ${JSON.stringify(at)}`).toBeLessThanOrEqual(STEEP);
  });
}
