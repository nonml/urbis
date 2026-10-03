// The hack, the chase and the story stand on a generated world's own streets
// (milestone 2): substations on the main avenue's pavements in their own power
// zones, off the junctions; chase cars on the main avenue; every story place and
// sign at its old offset from the avenue it was written against. The hand
// preset keeps its coordinates.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { generateDistrict } from '../src/sim/citygen.js';
import { ROAD_HALF_WIDTH, WALKWAY_WIDTH } from '../src/sim/world.js';
import {
  HAND_AVENUE_X, HAND_PURSUIT_HOMES, HAND_SUBSTATIONS, PURSUIT_HOMES, SUBSTATIONS, SUBSTATION_PLACES, SUB_CLEAR,
  SUB_OUT, SUB_PLACE_IN, arcFor, counterpartX, placeX, pursuitHomesFor, substationsFor, worldArc,
} from '../src/sim/anchors.js';
import { sweep } from './sweep.js';

const ARC = JSON.parse(fs.readFileSync('src/content/arc.json', 'utf8'));
const SEEDS = sweep(200);
const meets = (d) => d.crossings.filter((c) => c.x0 <= d.avenues[0].x && d.avenues[0].x <= c.x1);

function expectedCounterpart(ax, d) {
  const a0 = d.avenues[0].x;
  const east = d.avenues.map((a) => a.x).filter((x) => x > a0);
  const west = d.avenues.map((a) => a.x).filter((x) => x < a0);
  if (ax === 0) return a0;
  if (ax === 44) return east.length ? Math.min(...east) : Math.max(...west);
  return west.length ? Math.max(...west) : Math.min(...east);
}

test('the hand preset keeps its substations, chase homes and story', () => {
  expect(SUBSTATIONS).toBe(HAND_SUBSTATIONS);
  expect(PURSUIT_HOMES).toBe(HAND_PURSUIT_HOMES);
  expect(worldArc(ARC)).toBe(ARC);
  expect(HAND_SUBSTATIONS).toEqual([{ x: 8.3, z: -30, zone: 0, face: -1 }, { x: -8.3, z: 30, zone: 1, face: 1 }]);
  expect(HAND_PURSUIT_HOMES).toEqual([{ x: 0, z: -55 }, { x: 0, z: 55 }]);
});

test('every hand avenue has a counterpart, and a hand x keeps its offset from it', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    for (const ax of HAND_AVENUE_X) expect(counterpartX(ax, d), `seed ${seed} avenue ${ax}`).toBe(expectedCounterpart(ax, d));
    for (const x of [-50, -44, -39.5, -22.5, -5.4, 0, 6.8, 21.5, 22.5, 40, 44, 49.8]) {
      const ax = HAND_AVENUE_X.reduce((b, v) => (Math.abs(x - v) < Math.abs(x - b) ? v : b));
      expect(placeX(x, d), `seed ${seed} x ${x}`).toBeCloseTo(expectedCounterpart(ax, d) + (x - ax), 9);
    }
  }
});

test('substations stand on the main avenue pavements, in their own zones, off the junctions', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const a0 = d.avenues[0].x;
    const subs = substationsFor(d);
    expect(subs.map((s) => [s.zone, s.face]), `seed ${seed}`).toEqual([[0, -1], [1, 1]]);
    expect(subs[0].x).toBe(a0 + SUB_OUT);
    expect(subs[1].x).toBe(a0 - SUB_OUT);
    expect(SUB_OUT).toBeGreaterThan(ROAD_HALF_WIDTH);
    expect(SUB_OUT + 0.6).toBeLessThanOrEqual(ROAD_HALF_WIDTH + WALKWAY_WIDTH + 0.5);
    for (const [k, s] of subs.entries()) {
      const fits = (z) => (s.zone === 0 ? z < 0 : z >= 0)
        && z >= d.walk.minZ + SUB_CLEAR && z <= d.walk.maxZ - SUB_CLEAR
        && meets(d).every((c) => Math.abs(z - c.z) >= SUB_CLEAR);
      expect(fits(s.z), `seed ${seed} zone ${s.zone} at z ${s.z}`).toBe(true);
      expect(Number.isInteger(s.z * 2)).toBe(true);
      // Nothing on the half-metre grid nearer the hand z fits; on a tie the smaller z wins.
      const hz = HAND_SUBSTATIONS[k].z;
      const off = Math.abs(s.z - hz);
      for (let z = hz - off + 0.5; z < hz + off; z += 0.5) {
        if (Math.abs(z - hz) < off) expect(fits(z), `seed ${seed}: ${z} fits nearer than ${s.z}`).toBe(false);
      }
      if (s.z > hz) expect(fits(hz - off)).toBe(false);
    }
  }
});

test('the chase waits on the main avenue', () => {
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    expect(pursuitHomesFor(d)).toEqual(HAND_PURSUIT_HOMES.map((h) => ({ x: d.avenues[0].x, z: h.z })));
  }
});

test('the story moves with the streets and its first substation is the hack\'s', () => {
  const before = JSON.stringify(ARC);
  for (const seed of SEEDS) {
    const d = generateDistrict(seed);
    const moved = arcFor(ARC, d);
    expect(moved).not.toBe(ARC);
    expect(Object.keys(moved).sort()).toEqual(Object.keys(ARC).sort());
    expect(moved.missions).toEqual(ARC.missions);
    for (const [id, p] of Object.entries(ARC.places)) {
      const q = moved.places[id];
      if (id in SUBSTATION_PLACES) {
        const sub = substationsFor(d)[SUBSTATION_PLACES[id]];
        expect(q, `seed ${seed} ${id}`).toEqual({ ...p, x: sub.x + sub.face * SUB_PLACE_IN, z: sub.z });
      } else {
        expect(q, `seed ${seed} ${id}`).toEqual({ ...p, x: placeX(p.x, d) });
      }
    }
    expect(moved.signs).toEqual(ARC.signs.map((s) => ({ ...s, x: placeX(s.x, d) })));
  }
  expect(JSON.stringify(ARC), 'arcFor never changes its input').toBe(before);
  // On the hand map the first substation place sits SUB_PLACE_IN from its cabinet.
  const s0 = HAND_SUBSTATIONS[0];
  expect(ARC.places.substation_s.x).toBeCloseTo(s0.x + s0.face * SUB_PLACE_IN, 9);
  expect(ARC.places.substation_s.z).toBe(s0.z);
});
