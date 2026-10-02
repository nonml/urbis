// Valley landscape: smooth mountain ranges, grass verges + park, grass tufts.
// Static merges — built once, then they sleep.
//
// The heightfield itself lives in sim/world.js — a mover has to ask how high the
// ground is, and it must not reach into the renderer to do it (law 5). This file
// owns only the part that needs a BufferGeometry: displacing a mesh onto it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../sim/rng.js';
import { heightAt } from '../sim/world.js';

// Lift every vertex of an already-positioned geometry onto the field. A slab's
// top and bottom move together, so its thickness and its vertical sides survive
// and no face cracks open.
export function displaceToTerrain(geo) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + heightAt(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// One vertex every GRASS_CELL metres, the same cadence as the ground plane, so
// the two surfaces bend together and the plane cannot poke up through a verge.
const GRASS_CELL = 4;

export function buildGrassGround() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c3020, roughness: 1.0, envMapIntensity: 0.2 });
  const geos = [];
  const slab = (w, d, x, z) => {
    const cells = (m) => Math.max(1, Math.round(m / GRASS_CELL));
    const g = new THREE.BoxGeometry(w, 0.3, d, cells(w), 1, cells(d));
    g.translate(x, -0.1, z);
    geos.push(g);
  };
  slab(2.5, 280, -50.75, -5); // far-west verge (west of the avenue)
  // West green strip. It used to be the river bank, cut at 1 m cells to resolve
  // a trench; with the channel gone it is ordinary verge on the ordinary 4 m
  // grid, and it stays because without it the west flank is bare ground plane.
  slab(12, 284, -32, -4);
  slab(15, 32, 61, 5); // pocket park east
  slab(60, 4, 22, -71.5); // connector verge south
  slab(60, 4, 22, -56.5); // connector verge north
  const mesh = new THREE.Mesh(displaceToTerrain(mergeGeometries(geos)), mat);
  mesh.receiveShadow = true;
  return mesh;
}

function bladeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 9; i++) {
    const x = 4 + i * 7;
    const h = 30 + ((i * 37) % 28);
    const grad = g.createLinearGradient(0, 64, 0, 64 - h);
    grad.addColorStop(0, '#0c1a10');
    grad.addColorStop(1, '#2d5a2e');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x, 64);
    g.lineTo(x + 3, 64 - h);
    g.lineTo(x + 6, 64);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TUFT_RECTS = [
  { x0: -52, x1: -50, z0: -60, z1: 55 }, // far-west verge (west of the avenue)
  { x0: -37, x1: -28, z0: -60, z1: 55 }, // west green strip (east of the avenue)
  { x0: 54, x1: 68, z0: -10, z1: 20 }, // park
  { x0: -7, x1: 51, z0: -73, z1: -70 }, // connector verges
];

export function buildGrassTufts() {
  const rand = mulberry32(9001);
  const blade = new THREE.PlaneGeometry(0.9, 0.7);
  blade.translate(0, 0.35, 0);
  const cross = mergeGeometries([blade, blade.clone().rotateY(Math.PI / 2)]);
  const mat = new THREE.MeshStandardMaterial({
    map: bladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: 1.0, color: 0xbcc8b0,
  });
  const N = 1300;
  const inst = new THREE.InstancedMesh(cross, mat, N);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < N && guard++ < N * 20) {
    const r = TUFT_RECTS[Math.floor(rand() * TUFT_RECTS.length)];
    const x = r.x0 + rand() * (r.x1 - r.x0);
    const z = r.z0 + rand() * (r.z1 - r.z0);
    const s = 0.7 + rand() * 0.9;
    dummy.position.set(x, heightAt(x, z) + 0.02, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    inst.setMatrixAt(placed++, dummy.matrix);
  }
  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

// Smooth terrain, not cones. One displaced grid per range, merged, so the
// ranges read as rounded massifs instead of the pale spikes they replaced.
const MOUNTAIN_CELL = 3;
const MOUNTAIN_FLOOR = -4; // the cones sat 4 m sunk; keep their bases hidden
const NOISE_SEED = 0x9e37;
const ROCK_HEX = 0x232c3a;
const SNOW_HEX = 0xdfe8f2;
const ROCK_VARY = 0.08; // ±8% brightness, by the same noise as the detail

function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ NOISE_SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Value noise, [-1, 1]: the only texture the mountains need, and it must be
// hash-based so it stays deterministic frame to frame and run to run.
function valueNoise(x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz);
  const b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1);
  const d = hash2(ix + 1, iz + 1);
  const top = a + (b - a) * ux;
  const bot = c + (d - c) * ux;
  return (top + (bot - top) * uz) * 2 - 1;
}

// Ridged detail: coarse relief plus half of it again at finer frequency, so a
// massif has broad shoulders and a broken crest rather than a smooth dome.
function mountainNoise(x, z) {
  return valueNoise(x / 18, z / 18) + 0.5 * valueNoise(x / 7, z / 7);
}

// The max over peaks, never the sum: overlapping cones used to bury each other,
// and a sum would stand a wall wherever two ranges meet.
function makeMountainHeight(peaks) {
  return (x, z) => {
    let base = 0;
    for (const p of peaks) {
      const t = Math.hypot(x - p.px, z - p.pz) / p.r;
      if (t < 1) base = Math.max(base, p.h * (1 - t) ** 1.6);
    }
    return base + 7 * mountainNoise(x, z) * (base / 110) - 4;
  };
}

function mountainGrid(rangePeaks, height, clamp) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of rangePeaks) {
    minX = Math.min(minX, p.px - p.r);
    maxX = Math.max(maxX, p.px + p.r);
    minZ = Math.min(minZ, p.pz - p.r);
    maxZ = Math.max(maxZ, p.pz + p.r);
  }
  if (clamp.maxX !== undefined) maxX = Math.min(maxX, clamp.maxX);
  if (clamp.minZ !== undefined) minZ = Math.max(minZ, clamp.minZ);
  const w = maxX - minX;
  const d = maxZ - minZ;
  const geo = new THREE.PlaneGeometry(
    w, d, Math.round(w / MOUNTAIN_CELL), Math.round(d / MOUNTAIN_CELL)
  );
  geo.rotateX(-Math.PI / 2);
  geo.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, Math.max(MOUNTAIN_FLOOR, height(pos.getX(i), pos.getZ(i))));
  }
  pos.needsUpdate = true;
  return geo;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Rock everywhere, snow only where it is both high and flat enough to settle.
function paintMountains(geo) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const rock = new THREE.Color(ROCK_HEX);
  const snow = new THREE.Color(SNOW_HEX);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    c.copy(rock).multiplyScalar(1 + ROCK_VARY * mountainNoise(x, pos.getZ(i)));
    c.lerp(snow, smoothstep(52, 64, y) * smoothstep(0.45, 0.7, nor.getY(i)));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function buildMountains() {
  const rand = mulberry32(133);
  const peaks = [];
  const ridge = (cx, cz, n, alongX) => {
    const from = peaks.length;
    for (let i = 0; i < n; i++) {
      const r = 24 + rand() * 16;
      const h = 60 + rand() * 50;
      const px = alongX ? cx + i * 26 + rand() * 10 : cx + (rand() - 0.5) * 24;
      const pz = alongX ? cz + (rand() - 0.5) * 24 : cz + i * 26 + rand() * 10;
      peaks.push({ px, pz, r, h });
    }
    return peaks.slice(from);
  };
  const west = ridge(-88, -150, 12, false); // west range
  const north = ridge(-70, 140, 9, true); // north range
  const height = makeMountainHeight(peaks);
  const geo = mergeGeometries([
    mountainGrid(west, height, { maxX: -36 }),
    mountainGrid(north, height, { minZ: 88 }),
  ]);
  geo.computeVertexNormals();
  paintMountains(geo);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 })
  );
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}
