// The mountains belong to the city they frame. They used to stand at fixed
// coordinates tuned to the hand map, so on 127 of 300 generated cities a range
// rose inside the streets (94 m over the road on seed 73), and their faces were
// needles: 99% of the slope above 10 m steeper than 55 degrees, the blue-cone
// look in slice-077. A range now stands MOUNTAIN_CLEAR outside its district's
// walk box, which also clears the vista ring, and its faces are slopes.
import { test, expect } from '@playwright/test';
import * as THREE from 'three';
import { buildMountains, MOUNTAIN_CLEAR } from '../src/render/landscape.js';
import { generateDistrict } from '../src/sim/citygen.js';
import { DISTRICTS } from '../src/sim/world.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
// Still a backdrop: a range a street-level player cannot see is dead tech.
const BACKDROP_MIN_H = 40;
const BACKDROP_MAX_OUT = 200;
// Real ranges are mostly 20-40 degrees; a cliff here and there is fine.
const P90_MAX_DEG = 50;
const OVER_55_MAX = 0.05;
const SLOPE_FROM_Y = 10;

function mountainPositions(district) {
  return buildMountains(district).children[0].geometry.attributes.position;
}

// How far (x, z) lies outside the walk box; 0 inside it.
function outside(walk, x, z) {
  const dx = Math.max(walk.minX - x, 0, x - walk.maxX);
  const dz = Math.max(walk.minZ - z, 0, z - walk.maxZ);
  return Math.hypot(dx, dz);
}

// The nearest above-ground mountain vertex to the city: { out, y }. One expect
// per seed, not per vertex: 300 seeds of a few thousand vertices each is
// millions of expect calls, past the test timeout.
function nearestMountain(district) {
  const pos = mountainPositions(district);
  let near = { out: Infinity, y: 0 };
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) <= 0) continue;
    const out = outside(district.walk, pos.getX(i), pos.getZ(i));
    if (out < near.out) near = { out, y: pos.getY(i) };
  }
  return near;
}

test('no mountain rises within MOUNTAIN_CLEAR of a generated city', () => {
  expect(MOUNTAIN_CLEAR).toBeGreaterThanOrEqual(60);
  for (const seed of [...SEEDS, 1234567]) {
    const { out, y } = nearestMountain(generateDistrict(seed));
    expect(out, `seed ${seed}: ${y.toFixed(1)} m of mountain ${out.toFixed(1)} m from the city`)
      .toBeGreaterThanOrEqual(MOUNTAIN_CLEAR);
  }
});

test('the hand map keeps its mountains clear too', () => {
  const { out, y } = nearestMountain(DISTRICTS[0]);
  expect(out, `${y.toFixed(1)} m of mountain ${out.toFixed(1)} m from the city`).toBeGreaterThanOrEqual(MOUNTAIN_CLEAR);
});

test('the mountains still stand where the street can see them', () => {
  for (const seed of [2, 7, 73, 1234567]) {
    const { walk } = generateDistrict(seed);
    const pos = mountainPositions(generateDistrict(seed));
    let tallNear = 0;
    for (let i = 0; i < pos.count; i++) {
      if (outside(walk, pos.getX(i), pos.getZ(i)) <= BACKDROP_MAX_OUT) tallNear = Math.max(tallNear, pos.getY(i));
    }
    expect(tallNear, `seed ${seed}`).toBeGreaterThanOrEqual(BACKDROP_MIN_H);
  }
});

function slopes(pos, index) {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const faces = [];
  for (let t = 0; t < index.count / 3; t++) {
    a.fromBufferAttribute(pos, index.getX(3 * t));
    b.fromBufferAttribute(pos, index.getX(3 * t + 1));
    c.fromBufferAttribute(pos, index.getX(3 * t + 2));
    if ((a.y + b.y + c.y) / 3 < SLOPE_FROM_Y) continue;
    n.subVectors(b, a).cross(c.sub(a));
    const area = n.length() / 2;
    faces.push({ area, deg: Math.acos(Math.abs(n.normalize().y)) * 180 / Math.PI });
  }
  return faces.sort((p, q) => p.deg - q.deg);
}

test('mountain faces are slopes, not spikes', () => {
  for (const seed of [7, 73]) {
    const geo = buildMountains(generateDistrict(seed)).children[0].geometry;
    const faces = slopes(geo.attributes.position, geo.index);
    const total = faces.reduce((s, f) => s + f.area, 0);
    let acc = 0;
    const p90 = faces.find((f) => (acc += f.area) >= 0.9 * total).deg;
    const over55 = faces.filter((f) => f.deg > 55).reduce((s, f) => s + f.area, 0) / total;
    expect(p90, `seed ${seed}: 90% of the slope is under this many degrees`).toBeLessThanOrEqual(P90_MAX_DEG);
    expect(over55, `seed ${seed}: share of slope over 55 degrees`).toBeLessThanOrEqual(OVER_55_MAX);
  }
});
