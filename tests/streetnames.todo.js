// A generated world's streets have names a player can read (milestone 2): Main,
// East and West where the story expects them, the rest from the pools, never
// "Av0 & Cr1". The hand preset reads exactly as it always has.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { generateDistrict } from '../src/sim/citygen.js';
import { counterpartX } from '../src/sim/anchors.js';
import { mulberry32 } from '../src/sim/rng.js';
import { AVENUE_NAMES, CROSSING_NAMES, NAME_SALT, nameStreets, streetName } from '../src/sim/streetnames.js';
import { address } from '../src/sim/decline.js';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

// The rule, written out a second way.
function expected(d, seed) {
  const main = d.avenues[0];
  const out = { [main.id]: 'Main' };
  for (const hand of [44, -44]) {
    const a = d.avenues.find((v) => v.x === counterpartX(hand, d));
    if (!(a.id in out)) out[a.id] = a.x > main.x ? 'East' : 'West';
  }
  const rand = mulberry32((seed ^ NAME_SALT) >>> 0);
  const avenuePool = AVENUE_NAMES.slice();
  const crossingPool = CROSSING_NAMES.slice();
  const take = (pool) => pool.splice(Math.floor(rand() * pool.length), 1)[0];
  for (const a of d.avenues) if (!(a.id in out)) out[a.id] = take(avenuePool);
  for (const c of d.crossings) out[c.id] = take(crossingPool);
  return out;
}

test('the hand preset keeps its street names', () => {
  expect(['main', 'east', 'west', 'plaza', 'south'].map((id) => streetName({ id })))
    .toEqual(['Main', 'East', 'West', 'Plaza', 'South']);
  expect(address(0, 30)).toBe('Main & Plaza');
  expect(address(44, 0)).toBe('East Ave');
});

test('a generated world names its streets exactly by the rule', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    expect(nameStreets(d, seed), `seed ${seed}`).toEqual(expected(d, seed));
  }
});

test('every street has one name of its own, and East and West lie where they say', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const names = nameStreets(d, seed);
    const ways = [...d.avenues, ...d.crossings];
    expect(Object.keys(names).sort(), `seed ${seed}`).toEqual(ways.map((w) => w.id).sort());
    expect(new Set(Object.values(names)).size, `seed ${seed}: a name repeats`).toBe(ways.length);
    expect(names[d.avenues[0].id]).toBe('Main');
    for (const a of d.avenues.slice(1)) {
      if (names[a.id] === 'East') expect(a.x, `seed ${seed}`).toBeGreaterThan(d.avenues[0].x);
      if (names[a.id] === 'West') expect(a.x, `seed ${seed}`).toBeLessThan(d.avenues[0].x);
    }
  }
});

test('a lot note on a generated world reads street names, not ids', () => {
  expect(fs.readFileSync('src/sim/decline.js', 'utf8')).toMatch(/import \{ streetName \} from '\.\/streetnames\.js'/);
  const src = `
    const { setWorldSeed } = await import('./src/sim/seedstore.js');
    setWorldSeed(7, true);
    const { address } = await import('./src/sim/decline.js');
    const { WORLD_PLAN } = await import('./src/sim/layout.js');
    console.log(JSON.stringify(WORLD_PLAN.lots.map(([x, z]) => address(x, z))));
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', src], { encoding: 'utf8' });
  const lines = JSON.parse(out.trim().split('\n').pop());
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(line).not.toMatch(/\b(Av|Cr)\d/);
    expect(line).toMatch(/^[A-Z][a-z]+( Ave| & [A-Z][a-z]+)$/);
  }
});
