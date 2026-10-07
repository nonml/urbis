// M4-1 (docs/ROADMAP.md): on all five seeds the generated town is at least 4
// districts of at least 3 kinds (towers, housing, works, suburb), each its own
// power zone and economy district, with at least 400 buildings and at least 40
// lots free to zone. Node only: one seed per process, no page opens.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22, 33, 73];
const KINDS = ['towers', 'housing', 'works', 'suburb'];
const MIN_DISTRICTS = 4;
const MIN_KINDS = 3;
const MIN_BUILDINGS = 400;
const MIN_FREE = 40;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap, districtAt } = await import('../../src/sim/map.js');
  const { createCity } = await import('../../src/sim/zoning.js');
  const { createStreet } = await import('../../src/sim/street.js');
  const map = createMap(seed);
  const city = createCity(seed, map);
  const street = createStreet(seed, map);
  const free = city.parcels.filter((p) => p.kind === 'lot' && p.zoned === null).length;
  const stray = city.parcels
    .filter((p) => districtAt(map, p.x, p.z)?.id !== p.powerZone)
    .slice(0, 5).map((p) => p.id);
  process.stdout.write(`${JSON.stringify({
    seed,
    districts: map.districts.map((d) => ({ id: d.id, name: d.name, kind: d.kind ?? null })),
    buildings: map.buildings.length,
    free,
    zones: street.zones.length,
    economy: city.economy.districts.map((d) => d.name),
    stray,
  })}\n`);
  process.exit(0);
}

function row(seed) {
  return JSON.parse(execFileSync(process.execPath, [FILE, '--worker', String(seed)], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).trim().split('\n').pop());
}

test.setTimeout(120000);

for (const seed of SEEDS) {
  test(`M4-1 seed ${seed}: 4+ districts of 3+ kinds, 400+ buildings, 40+ free lots`, () => {
    // M4.T1's red check (2 districts, no kind, under 400 buildings today);
    // M4.T3-T5, the town plan and its buildings, make it pass: drop this then.
    const r = row(seed);
    const kinds = [...new Set(r.districts.map((d) => d.kind))];
    expect(r.districts.length, `seed ${seed}: districts`).toBeGreaterThanOrEqual(MIN_DISTRICTS);
    for (const d of r.districts) expect(KINDS, `seed ${seed}: ${d.name} kind ${d.kind}`).toContain(d.kind);
    expect(kinds.length, `seed ${seed}: kinds ${kinds}`).toBeGreaterThanOrEqual(MIN_KINDS);
    expect(r.buildings, `seed ${seed}: buildings`).toBeGreaterThanOrEqual(MIN_BUILDINGS);
    expect(r.free, `seed ${seed}: free lots`).toBeGreaterThanOrEqual(MIN_FREE);
    expect(r.zones, `seed ${seed}: power zones`).toBe(r.districts.length);
    expect(r.economy, `seed ${seed}: economy districts`).toEqual(r.districts.map((d) => d.name));
    expect(r.stray, `seed ${seed}: parcels outside their own area`).toEqual([]);
  });
}
