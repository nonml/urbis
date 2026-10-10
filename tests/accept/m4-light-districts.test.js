// M4.T12r (docs/ROADMAP.md): the night lighting follows any number of
// districts. A lamp, a shop sign, a light pool and a wet-road mirror belong to
// the district they stand in (sim/map.js districtAt), not to one of the two
// halves of z, so a blackout darkens exactly the district the street sim
// (sim/street.js isDark) darkened — for any count up to the 16 the per-district
// uniforms in render/materials.js hold. Draws must not rise with the count.
//
// Node only: the lamp rig is assembled for real against a 6-district test map,
// the way M3.T36's six areas split the town, and read back through the same
// handles game/scene.js drives. No page, no WebGL.
import { test, expect } from '@playwright/test';
import { createMap, districtAt as areaAt } from '../../src/sim/map.js';
import { MAX_DISTRICTS } from '../../src/render/materials.js';
import { buildLamps } from '../../src/render/lamps.js';
import {
  createStreet, tickStreet, hackBlackout, isDark, zoneGlow,
  districtAt as zoneOf, zoneAt,
} from '../../src/sim/street.js';

const NAMES = ['mill', 'market', 'heights', 'yards', 'park', 'oldtown'];

// The test map: the real map's walk box cut into 2 columns x 3 rows of areas
// with map-given names, exactly as tests/accept/m3-districts.test.js splits it.
// The furniture plan and the graph stay the real map's, so the lamps the
// renderer builds are the town's own.
function sixMap(seed) {
  const base = createMap(seed);
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
      k += 1;
    }
  }
  return { ...base, districts };
}

function centre(d) {
  return { x: (d.walk.minX + d.walk.maxX) / 2, z: (d.walk.minZ + d.walk.maxZ) / 2 };
}

// What the frame loop does when a district's power moves: one glow per zone,
// handed to the rig (game/scene.js updateScene).
function lightThem(lamps, street) {
  const glows = street.zones.map((_, z) => zoneGlow(street, z));
  street.zones.forEach((_, z) => lamps.setZoneLight(z, glows[z]));
  lamps.tick(street.time);
  return glows;
}

test('the lamps build on six districts, one lamp per district it stands in', () => {
  const testMap = sixMap(7);
  expect(testMap.districts).toHaveLength(6);
  expect(() => buildLamps(testMap)).not.toThrow();
  const lamps = buildLamps(testMap);
  expect(lamps.drawn()).toBeGreaterThan(0);
  // Every lamp takes the district it stands in, and more than two of them are
  // in play: a two-halves map cannot pass this.
  const zones = lamps.lamps.map((l) => l.zone);
  expect(zones.length).toBe(lamps.drawn());
  for (const [i, l] of lamps.lamps.entries()) {
    expect(l.zone, `lamp ${i} at ${l.x},${l.z}`).toBe(areaAt(testMap, l.x, l.z)?.id);
  }
  expect(new Set(zones).size, `zones in play: ${[...new Set(zones)].sort().join(',')}`).toBeGreaterThanOrEqual(4);
  for (const zone of zones) expect(zone).toBeLessThan(MAX_DISTRICTS);
  // One light pool per district, never one per lamp: the quads a district's
  // lamps throw, and nothing else.
  const pooled = lamps.poolsByZone.reduce((n, list) => n + (list?.length ?? 0), 0);
  expect(pooled).toBe(lamps.drawn());
  for (const [zone, quads] of lamps.poolsByZone.entries()) {
    for (const q of quads ?? []) expect(areaAt(testMap, q.x, q.z)?.id).toBe(+zone);
  }
  for (const zone of zones) expect(lamps.poolsByZone[zone]?.length).toBeGreaterThan(0);
});

test('darkening district 5 dims only the lamps whose district is 5', () => {
  const testMap = sixMap(7);
  const street = createStreet(7, testMap);
  expect(street.zones).toHaveLength(6);
  const lamps = buildLamps(testMap);
  const target = testMap.districts[5];
  const stood = centre(target);
  // The same call the game makes on a blackout (main.js fireHack).
  const zone = zoneOf(street, stood.x, stood.z);
  expect(zone).toBe(5);
  expect(hackBlackout(street, zone)).toBeGreaterThan(0);
  // Past the collapse: the district is dark, not dying, so the rig's per-lamp
  // sputter is not what is being read here.
  tickStreet(street, 1.2);
  for (let z = 0; z < street.zones.length; z++) {
    expect(isDark(street, z), `zone ${z}`).toBe(z === 5);
  }
  const glows = lightThem(lamps, street);
  glows.forEach((g, z) => expect(g, `glow ${z}`).toBe(z === 5 ? 0 : 1));
  // The drawn brightness of every lamp: the hacked district's go out, and
  // every other district's stay lit.
  const lit = lamps.glows.instanceColor.array;
  const dark = [];
  lamps.lamps.forEach((l, i) => {
    expect(lit[i * 3] > 0.1, `lamp ${i} in district ${l.zone}`).toBe(l.zone !== 5);
    if (l.zone === 5) dark.push(i);
  });
  expect(dark.length).toBeGreaterThan(0);
  expect(dark.length).toBeLessThan(lamps.drawn());
  // The cones of a dark district are scaled to nothing rather than drawn black.
  const mats = lamps.cones.instanceMatrix.array;
  const scale = (i, e) => mats[i * 16 + e];
  for (const i of dark) {
    expect(scale(i, 0), `lamp ${i} x scale`).toBe(0);
    expect(scale(i, 5), `lamp ${i} y scale`).toBe(0);
    expect(scale(i, 10), `lamp ${i} z scale`).toBe(0);
  }
  const kept = lamps.lamps.map((l, i) => i).filter((i) => !dark.includes(i));
  for (const i of kept) expect(scale(i, 0)).toBeGreaterThan(0);
});

test('the district count costs no mesh: one pool and one shaft each, any number of districts', () => {
  const two = buildLamps();
  const six = buildLamps(sixMap(11));
  // Today's map is still the two halves, lamp for lamp.
  for (const l of two.lamps) expect(l.zone).toBe(zoneAt(l.z));
  expect(Math.max(...two.lamps.map((l) => l.zone))).toBe(1);
  expect(new Set(two.lamps.map((l) => l.zone)).size).toBe(2);
  expect(six.lamps.length).toBeGreaterThan(two.lamps.length);
  // Six districts, the same meshes: the shafts and the glare are one instanced
  // mesh each, holding every district's lamps however many districts there
  // are, and the lantern model itself is one pool for the whole city — the
  // district rides the instance, so a sixteenth district adds no draw (law 4).
  for (const rig of [two, six]) {
    expect(rig.cones.count).toBe(rig.lamps.length);
    expect(rig.glows.count).toBe(rig.lamps.length);
  }
  // And one merged light pool per district that has lamps: every lamp of a
  // district in its mesh, and a district's pool mesh dimming on its own.
  for (const rig of [two, six]) {
    const stands = new Set(rig.lamps.map((l) => l.zone));
    expect(rig.poolsByZone.length).toBeLessThanOrEqual(MAX_DISTRICTS);
    for (const zone of stands) {
      expect(rig.poolsByZone[zone].length).toBeGreaterThan(0);
    }
    const pooled = rig.poolsByZone.reduce((n, list) => n + (list?.length ?? 0), 0);
    expect(pooled).toBe(rig.drawn());
  }
  expect(six.poolsByZone.length).toBeGreaterThan(two.poolsByZone.length);
});

test('any district the map runs, up to MAX_DISTRICTS, can be lit and darkened', () => {
  const testMap = sixMap(22);
  const lamps = buildLamps(testMap);
  for (let zone = 0; zone < Math.min(MAX_DISTRICTS, testMap.districts.length); zone++) {
    expect(() => lamps.setZoneLight(zone, 0)).not.toThrow();
    lamps.setZoneLight(zone, 0);
    lamps.tick(0);
    lamps.lamps.forEach((l, i) => {
      expect(lamps.glows.instanceColor.array[i * 3] > 0.1).toBe(l.zone !== zone);
    });
    lamps.setZoneLight(zone, 1);
  }
  // A district id past the map's own still lands somewhere harmless: the rig
  // holds MAX_DISTRICTS of them, as the per-district uniforms do.
  for (const zone of [testMap.districts.length, MAX_DISTRICTS - 1, MAX_DISTRICTS, 40]) {
    expect(() => lamps.setZoneLight(zone, 0)).not.toThrow();
    lamps.tick(0);
    expect(lamps.cones.count).toBe(lamps.drawn());
  }
});
