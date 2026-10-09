// M4.T13 (M4-8): the farmland follows the town's outline, not one district's
// edge. A generated town is 4-6 cells about 600 m across each, but the bands
// were cut from the downtown district's own walk box, so on every seed
// hedgerows, sheds, yards and scrub stood inside the town's other districts
// and, where the town's river crossed the band, in the water.
//
// A browser check, because the bands are only ever placed by the frame loop's
// streamer: the player drives, main.js calls chunks.update, the manager asks
// render/outskirts.js to build the tiles the eye is near, and the props it
// claims show up in the pools __game.chunks.stats() reports. A Node-only call of
// bandsFor would prove the arithmetic and not the world. The town's outline is
// the box its own roads span (map.js's graph): inside it is town, just outside
// it is the farmland the city thins out into. Every probe point comes from that
// box and the town's water — never from the placement code under test.
import { test, expect } from '@playwright/test';
import { createMap, graphBounds } from '../../src/sim/map.js';
import { bandsFor, outlineFor } from '../../src/render/outskirts.js';
import { vistasOf } from '../../src/sim/vistas.js';

// The sweep's five seeds (scripts/sweep.mjs, "five seeds" always means these).
const SEEDS = [7, 11, 22, 33, 73];
const TILE = 64;
const DRAW_BUDGET = 175;
// Measured, not estimated: one merged ground slab plus one InstancedMesh per
// prop kind — the 10 draws the district-sized bands cost too (law 4).
const FIELD_DRAWS = 10;

const inWater = (water, x, z) => water
  .some(([cx, cz, hw, hd]) => Math.abs(x - cx) <= hw && Math.abs(z - cz) <= hd);

// The town as data, from the same createMap the page boots on.
function world(seed) {
  const map = createMap(seed);
  const box = graphBounds(map.graph);
  const water = map.water ?? [];
  const midX = (box.minX + box.maxX) / 2;
  return {
    map,
    box,
    water,
    // The middle of the town: the spot the district-edge bands used to cover.
    middle: { x: midX, z: (box.minZ + box.maxZ) / 2 },
    // The town's own river: nothing grows in a stream.
    stream: { x: midX, z: map.town.river.z },
    // Just past each face the bands wrap, clear of the water.
    faces: {
      east: { x: box.maxX + 30, z: map.town.river.z + 140 },
      south: { x: midX, z: box.minZ - 30 },
    },
  };
}

// The rule, over the whole town rather than at one probe point: the bands lie
// outside every district the map holds and past its outline, and they start at
// that outline and not a field away from it.
const overlaps = (b, r) => b.x0 < r.x1 && b.x1 > r.x0 && b.z0 < r.z1 && b.z1 > r.z0;
// A district's walk box, or the graph's own, in the band rect's shape.
const rectOf = (box) => ({ x0: box.minX, x1: box.maxX, z0: box.minZ, z1: box.maxZ });
const onLattice = (v) => ((v - 2) % 4 + 4) % 4 === 0;

test('the farmland wraps the town, and no district of it stands on a field', () => {
  for (const seed of SEEDS) {
    const { map, box } = world(seed);
    const bands = bandsFor(map.district, vistasOf(map), outlineFor(map));
    const districts = [map.district, ...map.cells].map((d) => rectOf(d.walk));
    const town = rectOf(box);
    expect(bands.length, `seed ${seed}`).toBe(2);
    for (const [i, b] of bands.entries()) {
      for (const v of [b.x0, b.x1, b.z0, b.z1]) expect(onLattice(v), `seed ${seed}: ${v} is off the 2 (mod 4) lattice`).toBe(true);
      expect(b.x1 - b.x0, `seed ${seed}: the band is a strip, not a field`).toBeGreaterThanOrEqual(60);
      expect(b.z1 - b.z0, `seed ${seed}: the band is a strip, not a field`).toBeGreaterThanOrEqual(60);
      expect(overlaps(b, town), `seed ${seed}: band ${i} lies inside the town's own outline`).toBe(false);
      for (const [j, d] of districts.entries()) {
        expect(overlaps(b, d), `seed ${seed}: band ${i} covers district ${j} at ${JSON.stringify(d)}`).toBe(false);
      }
    }
    const [south, east] = bands;
    expect(town.z0 - south.z1, `seed ${seed}: the south band starts this far past the town's south face`).toBeLessThanOrEqual(16);
    expect(east.x0 - town.x1, `seed ${seed}: the east band starts this far past the town's east face`).toBeLessThanOrEqual(16);
  }
});

// Stream the world to one point the way the frame loop does, and report what the
// outskirts claimed in the ring around it. The streamer is the same one play
// drives (`chunks.update(eye)` in main.js), so a tile built here is one the
// player would have driven into.
async function outskirtsAt(page, at) {
  await page.evaluate((o) => {
    // The frame loop's own budget is two tiles a frame; a test standing the
    // streamer far away wants the ring now, not over twenty frames.
    window.__game.chunks.budget(400, 100000);
    window.__game.chunks.origin(o.x, o.z);
  }, at);
  const key = `${Math.floor(at.x / TILE)},${Math.floor(at.z / TILE)}`;
  await page.waitForFunction((k) => window.__game.chunks.resident().includes(k), key, { timeout: 30000 });
  return page.evaluate(() => {
    const stats = window.__game.chunks.stats();
    return {
      used: Object.values(stats.pools).reduce((n, p) => n + p.used, 0),
      pools: stats.pools,
      draws: window.__game.draws(),
    };
  });
}

// draws() counts the frame just rendered, so a toggle needs a frame in hand.
const frameDraws = (page) => page.evaluate(() => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve(window.__game.draws())));
}));

for (const seed of SEEDS) {
  test(`seed ${seed}: farmland follows the town's outline`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const w = world(seed);

    await page.goto(`/?capture=1&gen=1&seed=${seed}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForFunction(() => !!window.__game?.chunks, null, { timeout: 30000 });

    const where = (at) => `(${at.x}, ${at.z})`;
    const inside = await outskirtsAt(page, w.middle);
    expect(inside.used, `seed ${seed}: ${inside.used} farm props standing inside the town at ${where(w.middle)}`).toBe(0);

    const stream = await outskirtsAt(page, w.stream);
    expect(inWater(w.water, w.stream.x, w.stream.z), `seed ${seed}: the stream probe is not on the town's water`).toBe(true);
    expect(stream.used, `seed ${seed}: ${stream.used} farm props standing in the town's river at ${where(w.stream)}`).toBe(0);

    for (const [face, at] of Object.entries(w.faces)) {
      expect(inWater(w.water, at.x, at.z), `seed ${seed}: the ${face} probe stands on the town's water`).toBe(false);
      const edge = await outskirtsAt(page, at);
      expect(edge.used, `seed ${seed}: no farmland 30 m past the town's ${face} face at ${where(at)}`).toBeGreaterThan(0);
      for (const [kind, pool] of Object.entries(edge.pools)) {
        expect(pool.starved, `seed ${seed}: the ${kind} pool ran out at the town's ${face} face`).toBe(0);
      }
      expect(edge.draws, `seed ${seed}: draws at the town's ${face} face`).toBeLessThanOrEqual(DRAW_BUDGET);
    }

    // Same frame, farmland hidden: a whole town's fields cost what one
    // district's did, so a bigger town is not a bigger frame.
    const withFields = await frameDraws(page);
    await page.evaluate(() => window.__game.chunks.visible(false));
    const withoutFields = await frameDraws(page);
    await page.evaluate(() => window.__game.chunks.visible(true));
    expect(withFields - withoutFields, `seed ${seed}: the farmland's draw cost at the town's edge`).toBe(FIELD_DRAWS);

    expect(errors).toEqual([]);
  });
}
