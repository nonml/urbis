// M3.T21 (M3-4, docs/ROADMAP.md): fuzz the map editor on five seeds. 200 random
// ops (zone, bulldoze, place, addRoad, removeRoad) then their undos in reverse
// must return the created map's golden hash; each op and undo must take at most
// 2 ms in Node; and every parcel outside the tiles an op dirtied must keep its
// exact state, so lots and frontage are only recomputed there (M3.T20). The op
// sequence runs twice, identically seeded: once tracked, then once timed with
// no bookkeeping, so the fuzz's own snapshots cannot push a GC pause into the
// measured window. Node only: a map is built in a fresh process because parts
// of the derivation still read the world seed at module load (M3.T14).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [1, 2, 3, 4, 5];
const OPS = 200;
const OP_MS = 2;
const TILE = 64;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, mapHash, drainDirty } = await import('../../src/sim/map.js');
  const { zone, bulldoze, place, addRoad, removeRoad } = await import('../../src/sim/ops.js');
  const { mulberry32 } = await import('../../src/sim/rng.js');

  const map = createMap(seed);
  const golden = mapHash(map);
  const SOURCE = (seed * 0x9e3779b1) >>> 0;
  const pick = (rand, xs) => xs[Math.floor(rand() * xs.length)];
  const tileBox = (key) => {
    const [tx, tz] = key.split(',').map(Number);
    return [tx * TILE, tz * TILE];
  };
  const meets = (p, [x0, z0]) => p.x - p.w / 2 <= x0 + TILE && p.x + p.w / 2 >= x0
    && p.z - p.d / 2 <= z0 + TILE && p.z + p.d / 2 >= z0;

  // One random op on the map as it now stands. Zone, bulldoze and place take a
  // random parcel (bulldoze one that can come down); addRoad runs from an
  // existing node along one axis; removeRoad takes an existing edge.
  function nextOp(rand) {
    const roll = rand();
    if (roll < 0.2) {
      const p = pick(rand, map.parcels);
      return { kind: 'zone', run: () => zone(map, p, pick(rand, [null, 'res', 'com', 'ind'])) };
    }
    if (roll < 0.4) {
      const up = map.parcels.filter((q) => q.stage > 0);
      const p = up.length ? pick(rand, up) : pick(rand, map.parcels);
      return { kind: 'bulldoze', run: () => bulldoze(map, p) };
    }
    if (roll < 0.6) {
      const p = pick(rand, map.parcels);
      return { kind: 'place', run: () => place(map, pick(rand, ['tower', 'cap', 'row']), p) };
    }
    if (roll < 0.8 && map.graph.nodes.length) {
      const n = pick(rand, map.graph.nodes);
      const d = (0.5 + Math.floor(rand() * 40) * 0.5) * (rand() < 0.5 ? -1 : 1);
      const end = rand() < 0.5 ? [n.x + d, n.z] : [n.x, n.z + d];
      return { kind: 'addRoad', run: () => addRoad(map, [n.x, n.z], end) };
    }
    if (map.graph.edges.length) {
      const e = pick(rand, map.graph.edges);
      return { kind: 'removeRoad', run: () => removeRoad(map, e) };
    }
    const p = pick(rand, map.parcels);
    return { kind: 'zone', run: () => zone(map, p, pick(rand, [null, 'res', 'com', 'ind'])) };
  }

  // Apply 200 ops then their undos in reverse. `tracked` keeps a before-state
  // per op and reports any parcel outside the op's dirty tiles whose state
  // moved; the untracked run's timing is the one that counts, so no snapshot
  // garbage sits between the clock reads.
  function fuzz(tracked) {
    const rand = mulberry32(SOURCE);
    const undos = [];
    const violations = [];
    const effective = { zone: 0, bulldoze: 0, place: 0, addRoad: 0, removeRoad: 0 };
    let maxApply = 0;
    let maxUndo = 0;
    for (let i = 0; i < OPS; i++) {
      drainDirty(map);
      const before = tracked ? new Map(map.parcels.map((p) => [p, JSON.stringify(p)])) : null;
      const version = map.version;
      const { kind, run } = nextOp(rand);
      const t0 = process.hrtime.bigint();
      const undo = run();
      maxApply = Math.max(maxApply, Number(process.hrtime.bigint() - t0) / 1e6);
      if (tracked) {
        if (map.version !== version) effective[kind] += 1;
        const boxes = drainDirty(map).map(tileBox);
        const after = new Set(map.parcels);
        for (const p of new Set([...before.keys(), ...map.parcels])) {
          const was = before.get(p);
          if (was !== undefined && after.has(p) && JSON.stringify(p) === was) continue;
          if (!boxes.some((b) => meets(p, b))) violations.push(`op ${i} ${kind}: ${p.id} outside its tiles`);
        }
      }
      undos.push(undo);
    }
    for (let i = undos.length - 1; i >= 0; i--) {
      const t0 = process.hrtime.bigint();
      undos[i]();
      maxUndo = Math.max(maxUndo, Number(process.hrtime.bigint() - t0) / 1e6);
    }
    return { maxApply, maxUndo, violations, effective };
  }

  // The tracked pass runs first: it warms every op path, and its snapshot
  // garbage is collected before the timed pass starts, so the timed pass pays
  // only for its own allocations.
  const tracked = fuzz(true);
  const afterTracked = mapHash(map);
  globalThis.gc();
  const timed = fuzz(false);
  process.stdout.write(`${JSON.stringify({
    seed,
    golden,
    afterTracked,
    hash: mapHash(map),
    version: map.version,
    maxMs: { apply: timed.maxApply, undo: timed.maxUndo },
    effective: tracked.effective,
    violations: tracked.violations,
  })}\n`);
  process.exit(0);
}

// One child per seed, kept so the three tests share the sim work.
const WORLDS = new Map();
function world(seed) {
  if (!WORLDS.has(seed)) {
    const out = execFileSync(process.execPath, ['--expose-gc', FILE, '--worker', String(seed)], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    WORLDS.set(seed, JSON.parse(out.trim().split('\n').pop()));
  }
  return WORLDS.get(seed);
}

test('M3-4: 200 random ops then their undos give the golden map back', () => {
  for (const seed of SEEDS) {
    const r = world(seed);
    expect(r.afterTracked, `seed ${seed}: the tracked run ends on the golden hash`).toBe(r.golden);
    expect(r.hash, `seed ${seed}: the undos must end on the golden hash`).toBe(r.golden);
    expect(r.version, `seed ${seed}: the version is back to 0`).toBe(0);
  }
});

test('M3-4: every op and its undo takes at most 2 ms', () => {
  for (const seed of SEEDS) {
    const r = world(seed);
    expect(r.maxMs.apply, `seed ${seed}: slowest of ${OPS} ops`).toBeLessThanOrEqual(OP_MS);
    expect(r.maxMs.undo, `seed ${seed}: slowest of ${OPS} undos`).toBeLessThanOrEqual(OP_MS);
  }
});

test('M3-4: lots and frontage are recomputed only on the tiles an op dirtied', () => {
  for (const seed of SEEDS) {
    const r = world(seed);
    expect(r.violations, `seed ${seed}: an op reached outside its tiles`).toEqual([]);
    for (const [kind, n] of Object.entries(r.effective)) {
      expect(n, `seed ${seed}: ${kind} ops actually ran`).toBeGreaterThan(0);
    }
  }
});
