// M2.T13 (M2-3, docs/ROADMAP.md): building kit. After the building pools
// (M3.T22-T25) every building parcel carries pooled kit parts: window reveals
// at least 0.15 m deep on every facade, window frames, shopfronts and roof
// plant. At least 3 facade materials appear, frontage stays at or above
// check:overlap's ratchet (98.2%), and the kit costs at most 12 more draws.
//
// Node-only, a worker per seed: the pattern m3-render.spec.js established.
// The kit lives in render/buildings.js, so no page opens.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const REVEAL_MIN = 0.15;
const KIT_DRAWS = 12;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const THREE = await import('three');
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap } = await import('../../src/sim/map.js');
  const {
    REVEAL_DEPTH, FACADE_COUNT, KIT_DRAW_BUDGET, buildingKitSlots, buildBuildingKit,
  } = await import('../../src/render/buildings.js');

  const map = createMap(seed);
  const buildings = map.buildings;
  const facades = [...new Set(buildings.map((b) => b.facade))];
  const kit = buildingKitSlots(buildings, map.district.id);
  const byParcel = new Map(buildings.map((b) => [b.id, b]));
  const facesOf = (id) => new Set(kit.frames.filter((s) => s.parcel === id).map((s) => s.face));
  const uncovered = buildings.filter((b) => facesOf(b.id).size < 4
    || !kit.shops.some((s) => s.parcel === b.id)
    || !kit.plants.some((s) => s.parcel === b.id)).map((b) => b.id);
  const thin = kit.frames.filter((s) => s.reveal < REVEAL_MIN).length;
  // Kit parts dress a footprint, never widen it: everything stays within the
  // shaft plus trim allowance, so no new overlap and no lost frontage.
  const TRIM_ALLOW = 1.0;
  const escaped = [...kit.frames, ...kit.shops, ...kit.plants].filter((s) => {
    const b = byParcel.get(s.parcel);
    return !b || Math.abs(s.x - b.x) > b.w / 2 + TRIM_ALLOW
      || Math.abs(s.z - b.z) > b.d / 2 + TRIM_ALLOW;
  }).length;

  const mat = () => new THREE.MeshStandardMaterial();
  const pools = buildBuildingKit(
    { frame: [mat()], shop: [mat()], plant: [mat()] }, buildings, map.district.id,
  );
  writeSync(1, `${JSON.stringify({
    buildings: buildings.length, facades: facades.length,
    revealDepth: REVEAL_DEPTH, facadeCount: FACADE_COUNT, kitBudget: KIT_DRAW_BUDGET,
    frames: kit.frames.length, shops: kit.shops.length, plants: kit.plants.length,
    uncovered: uncovered.slice(0, 5), uncoveredCount: uncovered.length,
    thin, escaped, draws: pools.draws(),
  })}\n`);
  process.exit(0);
}

const WORLDS = new Map();
function world(seed) {
  if (!WORLDS.has(seed)) {
    const out = execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    WORLDS.set(seed, JSON.parse(out.trim().split('\n').pop()));
  }
  return WORLDS.get(seed);
}

test('M2.T13: every parcel carries deep reveals, frames, a shopfront and roof plant', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    expect(w.buildings, `seed ${seed}: the map has buildings`).toBeGreaterThan(0);
    expect(w.facadeCount, `seed ${seed}: six facade architectures`).toBeGreaterThanOrEqual(3);
    expect(w.facades, `seed ${seed}: at least 3 facade materials appear`).toBeGreaterThanOrEqual(3);
    expect(w.revealDepth, `seed ${seed}: reveals at least ${REVEAL_MIN} m deep`).toBeGreaterThanOrEqual(REVEAL_MIN);
    expect(w.thin, `seed ${seed}: no reveal under ${REVEAL_MIN} m`).toBe(0);
    expect(w.uncoveredCount, `seed ${seed}: every parcel has 4 faces, a shop and plant (${w.uncovered})`).toBe(0);
    expect(w.escaped, `seed ${seed}: kit never widens a footprint`).toBe(0);
    expect(w.kitBudget, 'kit budget is 12 draws').toBeLessThanOrEqual(KIT_DRAWS);
    expect(w.draws, `seed ${seed}: pooled kit parts cost no more than ${KIT_DRAWS} draws`).toBeLessThanOrEqual(KIT_DRAWS);
  }
});

test('M2.T13: frontage stays at or above the overlap ratchet', () => {
  const out = execFileSync(process.execPath, ['scripts/check_overlap.mjs'], {
    encoding: 'utf8', cwd: fileURLToPath(new URL('../../', import.meta.url)),
  });
  expect(out).toContain('frontage: worst row');
});
