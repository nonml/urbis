// A new city leaves the player land to zone (milestone 4): a rezone that must
// knock a building down first takes jobs away before it adds any, so empty land
// is where a zoning change starts a chain. Every district of a generated city
// starts with FREE_LOTS empty, unzoned lots; the hand preset keeps every lot zoned.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createCity } from '../src/sim/zoning.js';

test('the hand preset keeps every lot zoned', () => {
  expect(createCity(20260916).parcels.filter((p) => p.zoned === null)).toEqual([]);
});

test('every district of a generated city starts with its least-started empty lots free, and they stay free', () => {
  const run = (seed) => `
    const { setWorldSeed } = await import(process.cwd() + '/src/sim/seedstore.js');
    setWorldSeed(${seed}, true);
    const { createCity, tickZoning, FREE_LOTS } = await import(process.cwd() + '/src/sim/zoning.js');
    const { createStreet, tickStreet } = await import(process.cwd() + '/src/sim/street.js');
    const city = createCity(${seed}), again = createCity(${seed}), street = createStreet(${seed});
    const boot = city.parcels.map((p) => ({ zone: p.powerZone, use: p.use, zoned: p.zoned, stage: p.stage, progress: p.progress }));
    for (let i = 0; i < 600; i++) { tickStreet(street, 0.1); tickZoning(city, 0.1, street); }
    console.log(JSON.stringify({
      seed: ${seed}, FREE_LOTS, boot, same: JSON.stringify(again.parcels) === JSON.stringify(createCity(${seed}).parcels),
      later: city.parcels.map((p) => ({ use: p.use, zoned: p.zoned, stage: p.stage })),
      districts: city.economy.districts.map((d) => [d.jobs, d.homes, d.wealth].every(Number.isFinite)),
    }));`;
  const out = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
    JSON.parse(execFileSync('node', ['--input-type=module', '-e', run(seed)], { encoding: 'utf8' })));
  expect(new Set(out.map((o) => o.boot.length)).size, 'eight seeds, more than one layout').toBeGreaterThan(1);
  for (const { seed, FREE_LOTS, boot, same, later, districts } of out) {
    expect(FREE_LOTS).toBe(2);
    expect(same, `seed ${seed}: the same seed frees the same lots`).toBe(true);
    expect(districts.every(Boolean), `seed ${seed}: the economy boots`).toBe(true);
    for (const zone of new Set(boot.map((p) => p.zone))) {
      const lots = boot.filter((p) => p.zone === zone);
      const free = lots.filter((p) => p.zoned === null);
      const empty = lots.filter((p) => p.stage === 0);
      expect(free.length, `seed ${seed} zone ${zone}`).toBe(Math.min(FREE_LOTS, empty.length));
      expect(free.length, `seed ${seed} zone ${zone}: some land to zone`).toBeGreaterThan(0);
      for (const p of free) expect(p).toMatchObject({ use: null, stage: 0, progress: 0 });
    }
    boot.forEach((p, i) => {
      if (p.zoned !== null) expect(p.use, `seed ${seed} lot ${i}`).toBe(p.zoned);
      else expect(later[i], `seed ${seed} lot ${i}: nobody builds on unzoned land`).toEqual({ use: null, zoned: null, stage: 0 });
    });
  }
});
