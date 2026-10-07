// M4-2 (docs/ROADMAP.md), drawn: the river reads as water and its bridges as
// bridges. 2980add drew the river in render/river.js, but from the city view
// over seed 73 it is the same dark grey as the ground. On every seed, with the
// city view aimed at the river's middle in daylight: the first thing picked at
// the river's centre is a mesh named for the river, its material is
// blue-green and lighter than black, and a pick on each bridge deck names a
// bridge. The frame stays within 175 draws.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SEEDS = [7, 11, 22, 33, 73];
test.setTimeout(120000);

// Where the river and its bridges are, from the sim in a Node child (the seed
// store is per process).
function riverOf(seed) {
  const code = `const { setWorldSeed } = await import('./src/sim/seedstore.js'); setWorldSeed(${seed}, true);
    const { createMap } = await import('./src/sim/map.js'); const m = createMap(${seed});
    const byId = new Map(m.graph.nodes.map((n) => [n.id, n]));
    const w = (m.water ?? []).reduce((a, b) => (b[2] * b[3] > a[2] * a[3] ? b : a));
    const decks = m.graph.edges.filter((e) => e.kind === 'bridge').map((e) => { const a = byId.get(e.a), b = byId.get(e.b);
      return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }; });
    process.stdout.write(JSON.stringify({ x: w[0], z: w[1], decks }));`;
  return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' }));
}

for (const seed of SEEDS) {
  test(`M4-2 seed ${seed}: the river looks like water, the bridges like bridges`, async ({ page }) => {
    const river = riverOf(seed);
    await page.goto(`/?capture=1&gen=1&seed=${seed}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.keyboard.press('t');   // daylight, as in scripts/shot.mjs
    await page.keyboard.press('z');
    await page.waitForFunction(() => window.__game.cityview.state().lift >= 1, null, { polling: 'raf', timeout: 30000 });
    const near = river.decks.length ? river.decks[0] : river;
    await page.evaluate((p) => window.__game.cityview.aim({ x: p.x, z: p.z }), near);
    await page.waitForTimeout(1500);
    const pickAt = async (p) => {
      const s = await page.evaluate((q) => window.__game.screenOf(q.x, 0, q.z), p);
      // See-through quads (glow, rain) are not what the eye lands on.
      return (await page.evaluate(([x, y]) => window.__game.pick(x, y, window.innerWidth, window.innerHeight), [s.x, s.y]))
        .filter((h) => !h.see);
    };
    // Water away from every deck: bridges can stand under 20 m apart.
    const clear = [15, -15, 30, -30, 8, -8].map((k) => ({ x: near.x + k, z: river.z }))
      .map((p) => ({ p, gap: Math.min(...river.decks.map((d) => Math.hypot(d.x - p.x, d.z - p.z))) }))
      .reduce((a, b) => (b.gap > a.gap ? b : a)).p;
    const water = (await pickAt(clear))[0];
    expect(water?.path ?? 'nothing', `seed ${seed}: the river's centre is drawn as river`).toMatch(/river|water/i);
    const [r, g, b] = (water.color ?? '000000').match(/../g).map((h) => parseInt(h, 16));
    expect(b + g, `seed ${seed}: the water is blue-green (#${water.color})`).toBeGreaterThan(2 * r);
    expect(Math.max(r, g, b), `seed ${seed}: the water is not black (#${water.color})`).toBeGreaterThan(40);
    expect(river.decks.length, `seed ${seed}: the map has bridges`).toBeGreaterThanOrEqual(2);
    const deck = (await pickAt(near))[0];
    expect(deck?.path ?? 'nothing', `seed ${seed}: the bridge deck is drawn as a bridge`).toMatch(/bridge/i);
    expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
    mkdirSync('docs/shots', { recursive: true });
    writeFileSync(`docs/shots/m4-river-${seed}.png`, Buffer.from((await page.evaluate(() => window.__game.shot())).split(',')[1], 'base64'));
  });
}
