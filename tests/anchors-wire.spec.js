// The game reads its anchors (milestone 2): the hack sparks at this world's
// substations, the chase starts on this world's main avenue, and the story's
// places and signs stand on this world's streets.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const SIM = new URL('../src/sim/', import.meta.url).href;

test.use({ viewport: { width: 480, height: 270 } });

test('hackfx and main read the substations from sim/anchors.js', () => {
  const fx = fs.readFileSync('src/render/hackfx.js', 'utf8');
  expect(fx).toMatch(/from '\.\.\/sim\/anchors\.js'/);
  expect(fx).not.toMatch(/SUBSTATIONS = \[/);
  expect(fx).toMatch(/s\.face/);
  expect(fs.readFileSync('src/main.js', 'utf8')).toMatch(/import \{ SUBSTATIONS \} from '\.\/sim\/anchors\.js'/);
});

test('a generated world\'s chase and story stand on its own streets', () => {
  for (const seed of [3, 7, 12]) {
    const code = `
      const { setWorldSeed } = await import('${SIM}seedstore.js');
      setWorldSeed(${seed}, true);
      const { PURSUIT_HOMES, arcFor } = await import('${SIM}anchors.js');
      const { DISTRICTS } = await import('${SIM}world.js');
      const { createWanted } = await import('${SIM}wanted.js');
      const { ARC, createArc } = await import('${SIM}arc.js');
      const fs = await import('node:fs');
      const raw = JSON.parse(fs.readFileSync('src/content/arc.json', 'utf8'));
      const arc = createArc();
      console.log(JSON.stringify({
        homes: PURSUIT_HOMES,
        pursuit: createWanted().pursuit.map((p) => ({ x: p.x, z: p.z })),
        arc: ARC, want: arcFor(raw, DISTRICTS[0]),
        firstPlace: arc.run.steps.find((s) => s.place)?.at ?? null,
      }));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const { homes, pursuit, arc, want, firstPlace } = JSON.parse(run.stdout);
    expect(pursuit, `seed ${seed}`).toEqual(homes);
    expect(arc, `seed ${seed}`).toEqual(want);
    const first = want.places.substation_s;
    expect(firstPlace && [firstPlace.x, firstPlace.z], `seed ${seed}`).toEqual([first.x, first.z]);
  }
});

for (const world of ['', '&gen=1&seed=7']) {
  test(`the hack still fires${world ? ` (${world.slice(1)})` : ' (hand preset)'}`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`/?capture=1${world}`);
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.evaluate(() => window.__game.hack());
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => window.__game.dark().some(Boolean))).toBe(true);
    expect(await page.evaluate(() => window.__game.draws())).toBeLessThanOrEqual(175);
    expect(errors).toEqual([]);
  });
}
