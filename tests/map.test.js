// M3.T8 (M3-2, docs/ROADMAP.md): one live map. A seed builds the whole city —
// roads, district, buildings, lots, furniture, dressing, story places and the
// spawn — and it agrees with the frozen goldens field for field.
//
// map-golden.mjs (M0.T8) froze the derivations in a flat shape; createMap groups
// them, so this test rebuilds the golden's shape from the map before comparing.
// Like the golden checker, a map is built in a fresh process: parts of today's
// derivation still read the world seed at module load (M3.T14 removes that).
// Node only: no page opens. The queries and the hash are what the reader tasks
// and the ops test will use, so they are pinned by behaviour here.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const SCRATCH = new URL('../.scratch/', import.meta.url);

// A map is far more JSON than a pipe holds (~64 KB), so the worker writes it to
// a file: stdout would be truncated at the buffer and JSON.parse would fail.
if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const out = process.argv[4] || fileURLToPath(new URL(`map-${seed}-${process.pid}.json`, SCRATCH));
  const { setWorldSeed } = await import('../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap } = await import('../src/sim/map.js');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(createMap(seed)));
  process.exit(0);
}

const { mapHash, nodeAt, edgesNear, buildingsIn, districtAt } = await import('../src/sim/map.js');

const readGolden = (seed) => JSON.parse(readFileSync(`tests/golden/map-${seed}.json`, 'utf8'));

function liveMap(seed) {
  const path = fileURLToPath(new URL(`map-${seed}.json`, SCRATCH));
  execFileSync(process.execPath, [FILE, '--worker', String(seed), path]);
  return JSON.parse(readFileSync(path, 'utf8'));
}

// The golden's flat shape, rebuilt from the map's grouped one. `pinned` is the
// tower half of map.buildings in landmarks' raw shape (id, side, z, w, h, d).
function asGolden(map) {
  return {
    seed: map.seed,
    district: map.district,
    graph: map.graph,
    lots: map.lots,
    pinned: map.buildings.filter((b) => b.kind === 'tower').map((b) => ({
      id: b.id.slice('tower:'.length),
      side: -b.face[0],
      z: b.z,
      w: b.w,
      h: b.h,
      d: b.d,
    })),
    lamps: map.furniture.lamps,
    signs: map.dressing.signs,
    shops: map.dressing.shops,
    parked: map.furniture.parked,
    story: map.anchors,
    spawn: map.spawn,
  };
}

// The golden freezes the load-time district (M0.T8). createMap has since grown
// past it on purpose: the graph joins every cell (M4.T4) and the drive box spans
// the buildable land (M5.T3b). Those two keys are pinned elsewhere
// (golden.test.js reads the world modules; m4/m5 accept tests the growth); the
// rest of the play district must still read the golden exactly.
const GROWN = ['graph', 'district'];
for (const seed of SEEDS) {
  test(`seed ${seed}: createMap reads the golden map`, () => {
    const live = asGolden(liveMap(seed));
    const gold = readGolden(seed);
    for (const k of GROWN) { delete live[k]; delete gold[k]; }
    expect(live).toEqual(gold);
  });
}

test('nodeAt returns the nearest graph node', () => {
  const map = liveMap(22);
  for (const n of map.graph.nodes) {
    const hit = nodeAt(map, n.x, n.z);
    expect(hit.dist).toBe(0);
    expect(hit.node).toEqual(n);
  }
});

test('edgesNear measures to the edge, nearest first, inside the radius', () => {
  const map = liveMap(22);
  const { car } = map.spawn;
  const near = edgesNear(map, car.x, car.z, 4);
  expect(near.length).toBeGreaterThan(0);
  expect(near[0].edge.kind).toBe('avenue');
  expect(Math.abs(near[0].dist - 3)).toBeLessThan(0.001);
  for (let i = 1; i < near.length; i += 1) expect(near[i].dist).toBeGreaterThanOrEqual(near[i - 1].dist);
  expect(near.every((h) => h.dist <= 4)).toBe(true);
  expect(edgesNear(map, car.x, car.z, 2)).toEqual([]);
});

test('buildingsIn finds the footprint a box covers and nothing far away', () => {
  const map = liveMap(22);
  const tower = map.buildings.find((b) => b.kind === 'tower');
  const box = {
    minX: tower.x - tower.w / 2 + 0.1, maxX: tower.x + tower.w / 2 - 0.1,
    minZ: tower.z - tower.d / 2 + 0.1, maxZ: tower.z + tower.d / 2 - 0.1,
  };
  expect(buildingsIn(map, box).map((b) => b.id)).toEqual([tower.id]);
  expect(buildingsIn(map, { minX: 1e6, maxX: 1e6 + 1, minZ: 1e6, maxZ: 1e6 + 1 })).toEqual([]);
});

test('districtAt names the district a point stands in, null outside', () => {
  const map = liveMap(22);
  // The areas the map names (M3.T36), not the one load-time district.
  const at = districtAt(map, map.spawn.player.x, map.spawn.player.z);
  expect(map.districts ?? [map.district]).toContain(at);
  expect(districtAt(map, 1e6, 1e6)).toBeNull();
});

test('a fresh map is version 0, mapHash is stable, two seeds differ', () => {
  const a = liveMap(7);
  const b = liveMap(7);
  expect(a.version).toBe(0);
  expect(mapHash(a)).toBe(mapHash(b));
  expect(mapHash(a)).toMatch(/^[0-9a-f]{16}$/);
  expect(mapHash(a)).not.toBe(mapHash(liveMap(11)));
});
