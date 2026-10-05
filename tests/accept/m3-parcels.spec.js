// M3.T15 / M3-3 (docs/ROADMAP.md): parcels for all. Every building the renderer
// draws — a row building, a pinned tower and an end cap — is one parcel in the
// map, with an id, a kind (row | tower | cap), a use taken from its own style
// and stage HIGH. The lots are parcels too (kind 'lot'), and only the lots grow
// or decline on their own. The street wall is the world seed's own plan: the
// rows the map carries are exactly planBuildings(district, seed), not the hand
// map's ax === 0 && z < 40 table.
//
// Node only: no page opens. The map and the city are built in a fresh process
// because world.js reads the seed once, when it is imported — the pattern
// tests/map.test.js and tests/layout-zoning.spec.js established.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILE = fileURLToPath(import.meta.url);
const SEEDS = [7, 11, 22];
const DT = 0.05;
const IDLE_SECS = 180;

if (process.argv[2] === '--worker') {
  const seed = Number(process.argv[3]);
  const { setWorldSeed } = await import('../../src/sim/seedstore.js');
  setWorldSeed(seed, true);
  const { createMap } = await import('../../src/sim/map.js');
  const { BUILD_LINE, planBuildings } = await import('../../src/sim/layout.js');
  const { STAGE, USES, builtHeight, createCity, tickZoning } = await import('../../src/sim/zoning.js');
  const { createStreet, tickStreet } = await import('../../src/sim/street.js');

  const map = createMap(seed);
  const city = createCity(seed, map);
  const street = createStreet(seed, map);
  const brief = (p) => ({
    id: p.id, kind: p.kind, use: p.use, stage: p.stage,
    x: p.x, z: p.z, w: p.w, d: p.d, h: p.h,
  });
  // The map's own standing parcels, before and after 180 game seconds: only a
  // lot may move. Comparing them in the child keeps the payload under the
  // pipe's 64 KB, which truncates a bigger write.
  const standing = () => map.parcels.filter((p) => p.kind !== 'lot');
  const heldBefore = JSON.stringify(standing().map(brief));
  const lotsBefore = city.parcels.map(brief);
  for (let i = 0; i < Math.round(IDLE_SECS / DT); i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
  }
  const heldAfter = JSON.stringify(standing().map(brief));
  const lotsAfter = city.parcels.map(brief);
  const rows = map.buildings.filter((b) => b.kind === 'row').map((b) => ({
    id: b.id, style: b.style, x: b.x, z: b.z, w: b.w, d: b.d, h: b.h,
  }));
  const planned = planBuildings(map.district, seed).map((b) => ({
    id: `row:${b.ax}:${b.side}:${b.z}`,
    style: b.style,
    x: b.ax + b.side * (BUILD_LINE + b.w / 2),
    z: b.z, w: b.w, d: b.d, h: b.h,
  }));
  const json = Buffer.from(`${JSON.stringify({
    high: STAGE.HIGH,
    uses: USES,
    buildings: map.buildings.map((b) => ({ ...brief(b), style: b.style })),
    parcels: map.parcels.map(brief),
    lots: lotsBefore,
    rows,
    planned,
    standingHeld: heldBefore === heldAfter,
    standingHigh: standing().every((p) => p.stage === STAGE.HIGH && builtHeight(p) > 0),
    lotsMoved: JSON.stringify(lotsBefore) !== JSON.stringify(lotsAfter),
    lotsKind: lotsAfter.every((p) => p.kind === 'lot'),
  })}\n`);
  writeSync(1, json);
  process.exit(0);
}

// One child per seed, kept so the three tests share the sim work.
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

test('every building the renderer draws is a parcel with an id, a kind, a use and stage HIGH', () => {
  for (const seed of SEEDS) {
    const m = world(seed);
    expect(m.buildings.length, `seed ${seed}: the wall has buildings`).toBeGreaterThan(0);
    const kinds = new Set(m.buildings.map((b) => b.kind));
    expect(kinds, `seed ${seed}: rows, towers and caps`).toEqual(new Set(['row', 'tower', 'cap']));

    const byId = new Map(m.parcels.map((p) => [p.id, p]));
    expect(byId.size, `seed ${seed}: parcel ids are unique`).toBe(m.parcels.length);
    for (const b of m.buildings) {
      const p = byId.get(b.id);
      expect(p, `seed ${seed}: ${b.id} is a parcel`).toBeTruthy();
      expect(p.kind, `seed ${seed}: ${b.id} keeps its kind`).toBe(b.kind);
      for (const k of ['x', 'z', 'w', 'd', 'h']) {
        expect(p[k], `seed ${seed}: ${b.id}.${k} is the footprint drawn`).toBe(b[k]);
      }
      expect(p.stage, `seed ${seed}: ${b.id} stands at HIGH`).toBe(m.high);
      expect(m.uses, `seed ${seed}: ${b.id} has a use`).toContain(p.use);
    }

    // "A use from their style": one style, one use, whatever the style is.
    const useOfStyle = new Map();
    for (const b of m.buildings.filter((b) => b.style !== null)) {
      if (!useOfStyle.has(b.style)) useOfStyle.set(b.style, byId.get(b.id).use);
      expect(byId.get(b.id).use, `seed ${seed}: style ${b.style} carries one use`).toBe(useOfStyle.get(b.style));
    }
    expect(useOfStyle.size, `seed ${seed}: the wall carries district styles`).toBeGreaterThan(0);

    // The lots are parcels too, next to the buildings in the map's list.
    expect(m.lots.length, `seed ${seed}: lots are parcels`).toBeGreaterThan(0);
    for (const l of m.lots) {
      expect(l.kind, `seed ${seed}: a lot parcel`).toBe('lot');
      expect(l.id, `seed ${seed}: a lot has an id`).toBeTruthy();
    }
    expect(m.parcels.length, `seed ${seed}: buildings plus lots, no others`)
      .toBe(m.buildings.length + m.lots.length);
  }
});

test('only lot parcels grow or decline on their own', () => {
  for (const seed of SEEDS) {
    const m = world(seed);
    // The standing buildings are finished and hold: 180 game seconds move nothing.
    expect(m.standingHeld, `seed ${seed}: the buildings hold still`).toBe(true);
    expect(m.standingHigh, `seed ${seed}: every standing building is HIGH`).toBe(true);
    // And the lots, left alone, did move: the city lives.
    expect(m.lotsMoved, `seed ${seed}: the lots grow or decline on their own`).toBe(true);
    expect(m.lotsKind, `seed ${seed}: the growth list is lots`).toBe(true);
  }
});

test('the street wall comes from the world seed, styled by the district plan', () => {
  for (const seed of SEEDS) {
    const m = world(seed);
    expect(m.rows.length, `seed ${seed}: the wall has row buildings`).toBeGreaterThan(0);
    expect(m.rows, `seed ${seed}: the wall is planBuildings(district, seed), not a hand table`).toEqual(m.planned);
  }
  // A different seed is a different wall: the buildings are the seed's own.
  const [a, b] = [world(SEEDS[0]), world(SEEDS[1])];
  expect(a.rows, 'two seeds build different rows').not.toEqual(b.rows);
});
