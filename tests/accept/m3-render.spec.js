// M3.T22 (M3-5, docs/ROADMAP.md): row shells pooled. Every row building leaves
// the merged street wall (render/block.js) for one InstancedMesh per
// architecture (render/buildings.js, the render/zoning.js pattern): one fixed
// pool per architecture whatever the map does, so 50 buildings added or removed
// move no draw and a bulldoze empties exactly its slot. Every slot carries the
// parcel it stands on and its district, so a pick can still name the building.
//
// Node-only, a worker per seed: the map derives at import from the world seed
// (seedstore.js), the pattern m3-parcels.spec.js and m3-ops.test.js established.
// The browser part boots one generated city and picks a row in the live frame.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const DRAW_BUDGET = 175;
const REBUILD_MS = 1.5;
const FIFTY = 50;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const THREE = await import('three');
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap } = await import('../../src/sim/map.js');
  const { bulldoze } = await import('../../src/sim/ops.js');
  const { buildShellPools } = await import('../../src/render/buildings.js');

  const map = createMap(seed);
  const rows = map.buildings.filter((b) => b.kind === 'row');
  const slots = rows.map((b) => ({
    x: b.x, z: b.z, w: b.w, h: b.h, d: b.d, kind: b.facade,
    zone: b.z < 0 ? 0 : 1, parcel: b.id, district: map.district.id,
  }));
  // Throwaway materials: this checks the slot layout, not the facade shader.
  const mats = [0, 1, 2, 3, 4, 5].map(() => new THREE.MeshStandardMaterial());
  const pools = buildShellPools(mats, slots);
  const meshOk = pools.meshes.every((m) => m.isInstancedMesh
    && m.geometry.type === 'BoxGeometry' && m.castShadow
    && m.geometry.parameters.width === 1 && m.geometry.parameters.height === 1
    && m.geometry.parameters.depth === 1 && m.instanceMatrix.count >= m.count);
  const perKind = new Map();
  for (const s of slots) perKind.set(s.kind, (perKind.get(s.kind) ?? 0) + 1);

  // The instance matrix is float32 and the payload is the slot's own: match the
  // row's footprint within a millimetre and read back parcel, district and zone.
  const m4 = new THREE.Matrix4();
  const at = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const size = new THREE.Vector3();
  let matched = 0;
  for (const mesh of pools.meshes) {
    for (let i = 0; i < mesh.count; i++) {
      m4.fromArray(mesh.instanceMatrix.array, i * 16).decompose(at, quat, size);
      const s = slots.find((q) => q.kind === mesh.userData.kind
        && Math.abs(q.x - at.x) < 0.01 && Math.abs(q.z - at.z) < 0.01
        && Math.abs(q.w - size.x) < 0.01 && Math.abs(q.h - size.y) < 0.01
        && Math.abs(q.d - size.z) < 0.01);
      if (!s) continue;
      if (pools.parcelIds[mesh.geometry.attributes.parcel.getX(i)] === s.parcel
        && pools.districtIds[mesh.geometry.attributes.district.getX(i)] === s.district
        && mesh.geometry.attributes.zone.getX(i) === s.zone) matched += 1;
    }
  }

  // 50 real slot shapes added, then removed: pools, capacity and draws stay put.
  const snap = () => ({
    draws: pools.draws(), meshes: pools.meshes.length, caps: [...pools.capacity.values()].join(','),
  });
  const full = snap();
  const extra = Array.from({ length: FIFTY }, (_, i) => {
    const s = slots[i % slots.length];
    return { ...s, parcel: `${s.parcel}|+${i}` };
  });
  pools.update([...slots, ...extra]);
  const added = snap();
  pools.update(slots);
  const removed = snap();

  // A frame's pool rebuild, warm: the tile the map just dirtied is written back.
  pools.update(slots);
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) pools.update(slots);
  const rebuildMs = (performance.now() - t0) / 20;

  // A bulldoze to the ground empties exactly its slot: a ray down the footprint
  // finds no shell, which is what the pick finding ground means (M3-5).
  const victim = map.parcels.find((p) => p.kind === 'row');
  for (let i = 0; i < 10 && victim.kind !== 'lot'; i++) bulldoze(map, victim);
  pools.update(slots.filter((s) => s.parcel !== victim.id));
  const ray = new THREE.Raycaster(
    new THREE.Vector3(victim.x, 80, victim.z), new THREE.Vector3(0, -1, 0));
  const ground = ray.intersectObjects(pools.group.children, true)
    .every((h) => Math.abs(h.point.x - victim.x) > victim.w / 2
      || Math.abs(h.point.z - victim.z) > victim.d / 2);

  writeSync(1, `${JSON.stringify({
    rows: rows.length, matched, meshOk, oneMeshPerKind: pools.meshes.length === perKind.size,
    full, removed, added, rebuildMs: +rebuildMs.toFixed(4), ground, victimKind: victim.kind,
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

test('M3.T22: fixed shell pools, parcel-tagged slots, and a cheap map-following rebuild', () => {
  for (const seed of SEEDS) {
    const w = world(seed);
    expect(w.rows, `seed ${seed}: the wall has rows`).toBeGreaterThan(0);
    expect(w.matched, `seed ${seed}: every slot holds its row's footprint and parcel`).toBe(w.rows);
    expect(w.meshOk, `seed ${seed}: every pool is a unit-box InstancedMesh`).toBe(true);
    expect(w.oneMeshPerKind, `seed ${seed}: one pool per architecture, not per building`).toBe(true);
    expect(w.removed, `seed ${seed}: 50 rows added then removed move no draw`).toEqual(w.full);
    expect(w.added, `seed ${seed}: 50 rows added move no draw`).toEqual(w.full);
    expect(w.victimKind, `seed ${seed}: the bulldoze reached the ground`).toBe('lot');
    expect(w.ground, `seed ${seed}: no shell over the bulldozed footprint`).toBe(true);
    expect(w.rebuildMs, `seed ${seed}: a pool rebuild within ${REBUILD_MS} ms`).toBeLessThan(REBUILD_MS);
  }
});

test('M3.T22: a generated wall draws pooled and within budget', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?capture=1&gen=1&seed=7');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const draws = await page.evaluate(() => window.__game.draws());
  expect(draws, `draws ${draws} / ${DRAW_BUDGET}`).toBeLessThanOrEqual(DRAW_BUDGET);
  // Stand on the pavement the row faces: the pick has to name its pooled shell.
  const row = await page.evaluate(() => {
    const spawn = window.__game.player();
    const rows = window.__game.footprints()
      .filter((f) => typeof f.parcel === 'string' && f.parcel.startsWith('row:'));
    rows.sort((a, b) => Math.hypot(a.x - spawn.x, a.z - spawn.z)
      - Math.hypot(b.x - spawn.x, b.z - spawn.z));
    return rows[0];
  });
  await page.evaluate((f) => {
    const side = Math.sign(f.x) || -1;
    const px = f.x - side * (f.w / 2 + 8);
    window.__game.pose(px, f.z, Math.atan2(f.x - px, 0));
  }, row);
  await page.waitForTimeout(600);
  const hits = await page.evaluate((f) => {
    const at = window.__game.screenOf(f.x, Math.max(4.6, Math.min(f.h * 0.5, 8)), f.z);
    return window.__game.pick(at.x, at.y, window.innerWidth, window.innerHeight)
      .filter((t) => !t.see);
  }, row);
  const shell = hits.find((t) => t.parcel === row.parcel
    && t.geo === 'BoxGeometry' && typeof t.inst === 'number');
  expect(shell, `row ${row.parcel} shell: ${JSON.stringify(hits)}`).toBeTruthy();
  expect(errors).toEqual([]);
});
