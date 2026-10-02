// The police radio names streets the way the lot note and the news line do
// (milestone 4): 'Main Avenue', 'Bridge Street', the same names a player reads
// everywhere else, and never 'undefined' on a generated city.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createDispatch, streetWord, tickDispatch } from '../src/sim/dispatch.js';
import CHATTER from '../src/content/dispatch.json' with { type: 'json' };

test('the hand preset radio says the names the lot note uses', () => {
  expect(streetWord(0, 10)).toBe('Main Avenue');
  expect(streetWord(44, 10)).toBe('East Avenue');
  expect(streetWord(-44, 10)).toBe('West Avenue');
  expect(streetWord(10, 40)).toBe('Plaza Street');
  expect(CHATTER.streets, 'the radio keeps no street list of its own').toBeUndefined();
});

test('a call made on Main says Main Avenue, and nothing says undefined', () => {
  const texts = [];
  for (let seed = 1; seed <= 30; seed++) {
    const d = createDispatch(seed);
    tickDispatch(d, [{ type: 'tier_up_1', x: 0, z: 10, yaw: 0, inCar: true, cause: 'blackout' }], 0);
    texts.push(...d.lines.map((l) => l.text));
  }
  expect(texts.length).toBe(30);
  for (const t of texts) expect(t).not.toMatch(/undefined|1st Avenue|3rd Avenue|Main Street|Dock Street/);
  expect(texts.some((t) => t.includes('Main Avenue'))).toBe(true);
});

test('a generated city names every street on the radio by its own name', () => {
  for (const seed of [7, 2, 15]) {
    const src = `
      const { setWorldSeed } = await import('./src/sim/seedstore.js');
      setWorldSeed(${seed}, true);
      const { AVENUES, CROSSINGS } = await import('./src/sim/world.js');
      const { streetName } = await import('./src/sim/streetnames.js');
      const { streetWord } = await import('./src/sim/dispatch.js');
      const rows = [];
      for (const a of AVENUES) {
        const zs = CROSSINGS.map((c) => c.z).concat([a.z0, a.z1]).sort((p, q) => p - q);
        let best = 0; let at = 0;
        for (let i = 1; i < zs.length; i++) if (zs[i] - zs[i - 1] > best) { best = zs[i] - zs[i - 1]; at = (zs[i] + zs[i - 1]) / 2; }
        rows.push([streetWord(a.x, at), streetName(a) + ' Avenue']);
      }
      for (const c of CROSSINGS) {
        const xs = AVENUES.map((a) => a.x).filter((x) => x > c.x0 && x < c.x1).concat([c.x0, c.x1]).sort((p, q) => p - q);
        let best = 0; let at = 0;
        for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > best) { best = xs[i] - xs[i - 1]; at = (xs[i] + xs[i - 1]) / 2; }
        rows.push([streetWord(at, c.z), streetName(c) + ' Street']);
      }
      console.log(JSON.stringify(rows));`;
    const rows = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8' }).trim().split('\n').pop());
    expect(rows.length).toBeGreaterThan(3);
    for (const [said, want] of rows) expect(said, `seed ${seed}`).toBe(want);
  }
});
