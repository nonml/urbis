// Kerbside furniture on a generated world follows the roads (milestone 2): the
// spots down an avenue or along a crossing keep the hand map's rhythm, run the
// road's whole length, and leave the junctions clear. The hand preset keeps its
// rhythms exactly. world.js reads the seed at import, so a generated world runs
// in a fresh Node process.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { generateDistrict } from '../src/sim/citygen.js';
import { AVENUE_X } from '../src/sim/world.js';
import { BAND, END_CLEAR, avenueSpots, crossingSpots, rhythm } from '../src/sim/furniture.js';
import { sweep } from './sweep.js';

const SEEDS = sweep(200);
const SIM = new URL('../src/sim/', import.meta.url).href;
const RHYTHMS = [[9, 18], [-80, 16], [6, 12], [20, 40], [-48, 24], [-66, 22]];

const onRhythm = (v, phase, step) => Number.isInteger((v - phase) / step);
const meets = (c, a) => c.x0 <= a.x && a.x <= c.x1;

// Every value on the rhythm between lo and hi inclusive, the slow way.
function every(phase, step, lo, hi) {
  const out = [];
  for (let k = Math.ceil((lo - phase) / step); phase + k * step <= hi; k++) out.push(phase + k * step);
  return out;
}

test('down an avenue: on the rhythm, end to end, never at a junction', () => {
  let skipped = 0;
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    for (const a of d.avenues) {
      for (const [phase, step] of RHYTHMS) {
        const zs = avenueSpots(a, d.crossings, phase, step);
        const near = d.crossings.filter((c) => meets(c, a));
        const want = every(phase, step, a.z0 + END_CLEAR, a.z1 - END_CLEAR)
          .filter((z) => near.every((c) => Math.abs(z - c.z) >= BAND));
        expect(zs, `seed ${seed} ${a.id} ${phase}/${step}`).toEqual(want);
        zs.forEach((z) => expect(onRhythm(z, phase, step)).toBe(true));
        skipped += every(phase, step, a.z0 + END_CLEAR, a.z1 - END_CLEAR).length - zs.length;
      }
    }
  }
  expect(skipped, 'some spot fell on a junction and was left out').toBeGreaterThan(0);
});

test('along a crossing: on the rhythm, between its ends, never on an avenue', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    for (const c of d.crossings) {
      for (const [phase, step] of RHYTHMS) {
        const xs = crossingSpots(c, d.avenues, phase, step);
        const want = every(phase, step, c.x0 + END_CLEAR, c.x1 - END_CLEAR)
          .filter((x) => d.avenues.every((a) => Math.abs(x - a.x) >= BAND));
        expect(xs, `seed ${seed} ${c.id} ${phase}/${step}`).toEqual(want);
      }
    }
  }
});

test('the hand preset keeps its rhythms exactly', () => {
  for (const ax of AVENUE_X) {
    expect(rhythm(ax, -80, 80, 16)).toEqual(every(-80, 16, -80, 80));
    expect(rhythm(ax, -48, 48, 24)).toEqual([-48, -24, 0, 24, 48]);
    expect(rhythm(ax, -66, 66, 22)).toEqual(every(-66, 22, -66, 66));
  }
});

test('on a generated world a rhythm runs the whole avenue, off its crossings', () => {
  for (const seed of [3, 7, 12]) {
    const code = `
      const { setWorldSeed } = await import('${SIM}seedstore.js');
      setWorldSeed(${seed}, true);
      const { AVENUES, CROSSINGS } = await import('${SIM}world.js');
      const { avenueSpots, rhythm } = await import('${SIM}furniture.js');
      const out = AVENUES.map((a) => ({
        got: rhythm(a.x, -80, 80, 16),
        want: avenueSpots(a, CROSSINGS, -80, 16),
      }));
      console.log(JSON.stringify(out));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    for (const { got, want } of JSON.parse(run.stdout)) {
      expect(want.length).toBeGreaterThan(0);
      expect(got, `seed ${seed}`).toEqual(want);
    }
  }
});
