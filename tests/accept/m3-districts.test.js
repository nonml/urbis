// M3.T36 (M3-7, docs/ROADMAP.md): districts are areas. `districtAt(x, z)`
// replaces `zoneAt(z)`; a test map of 6 districts runs 6 power zones and 6
// economy districts named by the map; H blacks out the district the player
// stands in; M1-5 stays green on areas. Node only: no page opens.
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { createMap, districtAt as areaAt } from '../../src/sim/map.js';
import {
  createStreet, tickStreet, hackBlackout, isDark, districtAt as zoneOf, zoneAt,
} from '../../src/sim/street.js';
import { createCity, builtHeight, tickZoning } from '../../src/sim/zoning.js';
import { createEconomy } from '../../src/sim/economy.js';
import { createStreams } from '../../src/sim/rng.js';

const DT = 0.05;
const NAMES = ['mill', 'market', 'heights', 'yards', 'park', 'oldtown'];

// The test map: the real map's walk box cut into 2 columns x 3 rows of areas
// with map-given names. Graph, furniture and parcels stay the real map's, so
// walkers, traffic and the economy boot exactly as in the game.
function sixMap(seed) {
  const base = createMap(seed);
  // Tile what the town stands on: the walk box plus every lot and building,
  // since grown lots can stand just outside the walk bounds.
  const xs = [base.district.walk.minX, base.district.walk.maxX];
  const zs = [base.district.walk.minZ, base.district.walk.maxZ];
  for (const [x, z] of base.lots) { xs.push(x); zs.push(z); }
  for (const b of base.buildings) { xs.push(b.x); zs.push(b.z); }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const mx = (minX + maxX) / 2;
  const cuts = [minZ, minZ + (maxZ - minZ) / 3, minZ + (2 * (maxZ - minZ)) / 3, maxZ];
  const districts = [];
  let k = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const box = {
        minX: c === 0 ? minX : mx, maxX: c === 0 ? mx : maxX,
        minZ: cuts[r], maxZ: cuts[r + 1],
      };
      districts.push({ id: k, name: NAMES[k], walk: { ...box }, drive: { ...box } });
      k++;
    }
  }
  return { base, testMap: { ...base, districts } };
}

function centre(d) {
  return { x: (d.walk.minX + d.walk.maxX) / 2, z: (d.walk.minZ + d.walk.maxZ) / 2 };
}

// A live world on the test map: lots grown by the city, every parcel's power
// zone assigned by the area it stands in, the economy sized from those areas.
function buildWorld(seed) {
  const { base, testMap } = sixMap(seed);
  const city = createCity(seed, base);
  for (const p of city.parcels) {
    const d = areaAt(testMap, p.x, p.z);
    expect(d, `parcel ${p.id} stands in an area`).not.toBeNull();
    p.powerZone = d.id;
  }
  testMap.parcels = city.parcels;
  city.economy = createEconomy(city.parcels, builtHeight, createStreams(seed + 1000).sim, testMap);
  const street = createStreet(seed, testMap);
  return { testMap, city, street };
}

function step(world, dt = DT) {
  tickStreet(world.street, dt);
  tickZoning(world.city, dt, world.street);
}

function districtHash(world, id) {
  return createHash('sha256').update(JSON.stringify({
    parcels: world.city.parcels.filter((p) => p.powerZone === id),
    district: world.city.economy.districts[id],
  })).digest('hex');
}

test('areas have bounds and districtAt names the area a point stands in', () => {
  const { testMap } = sixMap(7);
  expect(testMap.districts).toHaveLength(6);
  for (const d of testMap.districts) {
    expect(d.walk.minX).toBeLessThan(d.walk.maxX);
    expect(d.walk.minZ).toBeLessThan(d.walk.maxZ);
  }
  testMap.districts.forEach((d, id) => {
    const c = centre(d);
    expect(areaAt(testMap, c.x, c.z)?.id).toBe(id);
  });
  expect(areaAt(testMap, 1e6, 1e6)).toBeNull();
});

test('districtAt(x, z) replaces zoneAt(z): areas split what halves cannot', () => {
  const { testMap } = sixMap(7);
  const [west] = testMap.districts.filter((d) => d.id === 0);
  const east = testMap.districts.find((d) => d.id === 1);
  const z = (west.walk.minZ + west.walk.maxZ) / 2;
  const xw = (west.walk.minX + west.walk.maxX) / 2;
  const xe = (east.walk.minX + east.walk.maxX) / 2;
  // Same street height, two areas: districtAt tells them apart, zoneAt (z
  // only) cannot.
  expect(areaAt(testMap, xw, z)?.id).toBe(0);
  expect(areaAt(testMap, xe, z)?.id).toBe(1);
  expect(typeof zoneAt(z)).toBe('number');
});

test('a test map of 6 districts runs 6 power zones and 6 economy districts, named by the map', () => {
  const { testMap, city, street } = buildWorld(7);
  expect(street.zones).toHaveLength(6);
  expect(city.economy.districts).toHaveLength(6);
  expect(city.economy.districts.map((d) => d.name)).toEqual(NAMES);
  expect(city.economy.districts.map((d) => d.name)).not.toEqual(['south', 'north']);
  for (const p of city.parcels) {
    expect(areaAt(testMap, p.x, p.z)?.id).toBe(p.powerZone);
  }
  for (const d of city.economy.districts) {
    expect(d.size).toBeGreaterThan(0);
  }
});

test('H blacks out the district the player stands in', () => {
  const { testMap, street } = buildWorld(7);
  const target = testMap.districts[4];
  const stood = centre(target);
  const zone = zoneOf(street, stood.x, stood.z);
  expect(zone).toBe(target.id);
  expect(areaAt(testMap, stood.x, stood.z)?.id).toBe(target.id);
  expect(hackBlackout(street, zone)).toBeGreaterThan(0);
  street.zones.forEach((_, z) => {
    expect(isDark(street, z)).toBe(z === target.id);
  });
});

test.setTimeout(120000);

test('M1-5 stays green: the dark district loses 10% of its jobs and the other is bit-identical', () => {
  for (const seed of [7, 11, 22, 33, 73]) {
    const baseMap = createMap(seed);
    const baseCity = createCity(seed, baseMap);
    const baseStreet = createStreet(seed, baseMap);
    const copyMap = createMap(seed);
    const copyCity = createCity(seed, copyMap);
    const copyStreet = createStreet(seed, copyMap);
    const base = { city: baseCity, street: baseStreet };
    const poked = { city: copyCity, street: copyStreet };
    const height = [0, 0];
    for (const p of poked.city.parcels) height[p.powerZone] += builtHeight(p);
    const zone = height[1] > height[0] ? 1 : 0;
    for (let t = 0; t < 300; t += DT) {
      step(base);
      step(poked);
      // The M1-5 poke fires every step from minute 1; the zone cooldown gates
      // it, so the district is hacked again each time it recharges.
      if (t + DT >= 60) hackBlackout(poked.street, zone);
    }
    const bj = Math.round(base.city.economy.districts[zone].jobs);
    const pj = Math.round(poked.city.economy.districts[zone].jobs);
    expect((bj - pj) / bj, `seed ${seed}: district ${zone} jobs ${bj} -> ${pj}`).toBeGreaterThanOrEqual(0.10);
    const other = 1 - zone;
    expect(districtHash(poked, other), `seed ${seed}: district ${other} bit-identical`).toBe(districtHash(base, other));
  }
});

// On six areas the same consequence lands at the right size: the hacked
// district loses jobs and every other district is bit-identical.
test('a blackout on six districts stays local', () => {
  for (const seed of [7, 22]) {
    const base = buildWorld(seed);
    const poked = buildWorld(seed);
    const height = poked.city.economy.districts.map(() => 0);
    for (const p of poked.city.parcels) height[p.powerZone] += builtHeight(p);
    const zone = height.indexOf(Math.max(...height));
    for (let t = 0; t < 300; t += DT) {
      step(base);
      step(poked);
      if (t + DT >= 60) hackBlackout(poked.street, zone);
    }
    const bj = Math.round(base.city.economy.districts[zone].jobs);
    const pj = Math.round(poked.city.economy.districts[zone].jobs);
    expect(pj, `seed ${seed}: district ${zone} jobs ${bj} -> ${pj}`).toBeLessThan(bj);
    poked.city.economy.districts.forEach((_, z) => {
      if (z !== zone) {
        expect(districtHash(poked, z), `seed ${seed}: district ${z} bit-identical`).toBe(districtHash(base, z));
      }
    });
  }
});
