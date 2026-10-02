// A generated game zones the derived lots; the hand preset keeps its LOTS table
// (milestone 2). world.js reads the seed once, when it is first imported, so each
// case runs in a fresh Node process, the way scripts/check_overlap.mjs does.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';

const SIM = new URL('../src/sim/', import.meta.url).href;

function probe(seed, generate) {
  const code = `
    const { setWorldSeed } = await import('${SIM}seedstore.js');
    setWorldSeed(${seed}, ${generate});
    const { DISTRICTS } = await import('${SIM}world.js');
    const { createCity } = await import('${SIM}zoning.js');
    const { planLayout } = await import('${SIM}layout.js');
    const parcels = createCity(${seed}).parcels.map(({ x, z, w, d }) => [x, z, w, d]);
    console.log(JSON.stringify({ parcels, plan: planLayout(DISTRICTS[0], ${seed}).lots }));
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

test('a generated city zones exactly the lots the layout plan derives', () => {
  for (const seed of [1, 2, 3, 11, 42]) {
    const { parcels, plan } = probe(seed, true);
    expect(plan.length, `seed ${seed}: the plan has lots`).toBeGreaterThan(0);
    expect(parcels, `seed ${seed}`).toEqual(plan);
  }
});

test('the hand preset still zones its ten hand-placed lots', () => {
  const { parcels } = probe(20260916, false);
  expect(parcels.length).toBe(10);
  expect(parcels[0]).toEqual([-15.25, 56, 16.5, 10]);
});
