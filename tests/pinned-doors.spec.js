// The noodle-bar door and the roof stairs move with their towers (milestone 2):
// on every generated world each street door stands where it stands on the hand
// map, relative to its own tower, and no tower stands on a road. world.js reads
// the seed once, at import, so each world runs in a fresh Node process.
import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';

const SIM = new URL('../src/sim/', import.meta.url).href;
const SEEDS = [1, 2, 3, 4, 5, 10, 11, 12];
const DOORS = { 'ramen-front': 'ramen', 'roof-stair': 'roof' };

function probe(seed, generate) {
  const code = `
    const { setWorldSeed } = await import('${SIM}seedstore.js');
    setWorldSeed(${seed}, ${generate});
    const { PINNED_TOWERS, towerCentreX } = await import('${SIM}landmarks.js');
    const { doorEnds } = await import('${SIM}interior.js');
    const towers = Object.fromEntries(PINNED_TOWERS.map((t) => [t.id, { x: towerCentreX(t), z: t.z }]));
    const ends = doorEnds().filter((e) => e.space === 'street')
      .map((e) => ({ door: e.door, x: e.x, z: e.z, ax: e.arrive.x, az: e.arrive.z, yaw: e.arrive.yaw }));
    console.log(JSON.stringify({ towers, ends }));
  `;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  expect(run.status, run.stderr).toBe(0);
  return JSON.parse(run.stdout);
}

// Each street door relative to its tower's centre.
function offsets({ towers, ends }) {
  return Object.fromEntries(Object.entries(DOORS).map(([door, tower]) => {
    const e = ends.find((q) => q.door === door);
    const t = towers[tower];
    return [door, [e.x - t.x, e.z - t.z, e.ax - t.x, e.az - t.z, e.yaw].map((v) => +v.toFixed(6))];
  }));
}

test('the hand preset keeps its doors exactly', () => {
  const { ends } = probe(20260916, false);
  const ramen = ends.find((e) => e.door === 'ramen-front');
  const roof = ends.find((e) => e.door === 'roof-stair');
  const round = (vs) => vs.map((v) => +v.toFixed(6));
  expect(round([ramen.ax, ramen.az, ramen.yaw])).toEqual([-5.8, -9.0, 0]);
  expect(round([roof.x, roof.z, roof.ax, roof.az])).toEqual([-13.5, -41.4, -12.0, -40.9]);
});

test('on a generated world each door stands where it does on the hand map, relative to its tower', () => {
  const hand = offsets(probe(20260916, false));
  for (const seed of SEEDS) expect(offsets(probe(seed, true)), `seed ${seed}`).toEqual(hand);
});

test('no pinned tower stands on a road on a generated world', () => {
  for (const seed of SEEDS) {
    const run = spawnSync(process.execPath, ['scripts/check_overlap.mjs', '--seed', String(seed)], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const bad = run.stdout.split('\n').filter((l) => l.includes('PINNED_TOWERS') && l.includes('  on  road'));
    expect(bad, `seed ${seed}`).toEqual([]);
  }
});
