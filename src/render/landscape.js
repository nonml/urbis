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
import { planLayout, CROSSING_BAND, BUILD_LINE } from '../sim/layout.js';
import { vistasOf } from '../sim/vistas.js';
import { worldMap } from '../sim/patrol.js';

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

export const HAND_GRASS = {
  slabs: [
    { x: -50.75, z: -5, w: 2.5, d: 280 }, // far-west verge (west of the avenue)
    // West green strip. It used to be the river bank, cut at 1 m cells to resolve
    // a trench; with the channel gone it is ordinary verge on the ordinary 4 m
    // grid, and it stays because without it the west flank is bare ground plane.
    { x: -32, z: -4, w: 12, d: 284 },
    { x: 61, z: 5, w: 15, d: 32 }, // pocket park east
    { x: 22, z: -71.5, w: 60, d: 4 }, // connector verge south
    { x: 22, z: -56.5, w: 60, d: 4 }, // connector verge north
  ],
  tufts: [
    { x0: -52, x1: -50, z0: -60, z1: 55 }, // far-west verge (west of the avenue)
    { x0: -37, x1: -28, z0: -60, z1: 55 }, // west green strip (east of the avenue)
    { x0: 54, x1: 68, z0: -10, z1: 20 }, // park
    { x0: -7, x1: 51, z0: -73, z1: -70 }, // connector verges
  ],
};

// Grass runs out past the last row so the city's edge is not bare ground.
const VERGE_REACH_X = 24;
const VERGE_REACH_Z = 8;
// A tuft never hangs over a verge's edge.
const TUFT_INSET = 0.5;

const rectAt = (x, z, w, d) => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
const touches = (a, b) => Math.min(a.x1, b.x1) > Math.max(a.x0, b.x0) && Math.min(a.z1, b.z1) > Math.max(a.z0, b.z0);

// Lays verges on the 4 m grass grid over the walk box grown by VERGE_REACH_X
// and VERGE_REACH_Z, on every cell no street, building row, lot or skyline tower
// touches, one slab per clear run along z, and tufts inset on every slab.
export function grassFor(district, plan, vistas) {
  const keepOff = [
    ...district.avenues.map((a) => rectAt(a.x, (a.z0 + a.z1) / 2, BUILD_LINE * 2, a.z1 - a.z0)),
    ...district.crossings.map((c) => rectAt((c.x0 + c.x1) / 2, c.z, c.x1 - c.x0, CROSSING_BAND * 2)),
    ...plan.rows.flatMap((r) => r.runs.map(([z0, z1]) => rectAt(r.ax + r.side * (BUILD_LINE + r.depth / 2), (z0 + z1) / 2, r.depth, z1 - z0))),
    ...plan.lots.map(([x, z, w, d]) => rectAt(x, z, w, d)),
    ...[...vistas.caps, ...vistas.ring].map((t) => rectAt(t.x, t.z, t.w, t.d)),
  ];
  const { walk } = district;
  const zFrom = walk.minZ - VERGE_REACH_Z;
  const rows = Math.floor((walk.maxZ + VERGE_REACH_Z - zFrom) / GRASS_CELL);
  const slabs = [];
  for (let x = walk.minX - VERGE_REACH_X; x + GRASS_CELL <= walk.maxX + VERGE_REACH_X; x += GRASS_CELL) {
    let from = null;
    for (let k = 0; k <= rows; k++) {
      const z = zFrom + k * GRASS_CELL;
      const clear = k < rows && !keepOff.some((r) => touches({ x0: x, x1: x + GRASS_CELL, z0: z, z1: z + GRASS_CELL }, r));
      if (clear && from === null) from = z;
      if (!clear && from !== null) {
        slabs.push({ x: x + GRASS_CELL / 2, z: (from + z) / 2, w: GRASS_CELL, d: z - from });
        from = null;
      }
    }
  }
  const tufts = slabs.map((s) => ({ x0: s.x - s.w / 2 + TUFT_INSET, x1: s.x + s.w / 2 - TUFT_INSET, z0: s.z - s.d / 2 + TUFT_INSET, z1: s.z + s.d / 2 - TUFT_INSET }));
  return { slabs, tufts };
}

// A generated map's grass: its own plan, rebuilt from the district, seed and
// pinned towers the map carries, and its vistas. A map without buildings is the
// hand preset, which keeps its table.
function grassOf(map) {
  if (!map.buildings) return HAND_GRASS;
  const pinned = map.buildings.filter((b) => b.kind === 'tower')
    .map((b) => ({ side: -b.face[0], z: b.z, d: b.d }));
  return grassFor(map.district, planLayout(map.district, map.seed, pinned), vistasOf(map));
}

export function buildGrassGround(map = worldMap()) {
  const grass = grassOf(map);
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c3020, roughness: 1.0, envMapIntensity: 0.2 });
  const geos = [];
  const slab = (w, d, x, z) => {
    const cells = (m) => Math.max(1, Math.round(m / GRASS_CELL));
    const g = new THREE.BoxGeometry(w, 0.3, d, cells(w), 1, cells(d));
    g.translate(x, -0.1, z);
    geos.push(g);
  };
  for (const s of grass.slabs) slab(s.w, s.d, s.x, s.z);
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

export function buildGrassTufts(map = worldMap()) {
  const grass = grassOf(map);
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
    const r = grass.tufts[Math.floor(rand() * grass.tufts.length)];
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
// A range stands this far outside the district's walk box, which also clears the
// vista ring, so a peak can never rise over a street.
export const MOUNTAIN_CLEAR = 60;
// The farthest a peak reaches from its centre: largest r plus half the jitter.
const PEAK_REACH = 140 + 12;
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
// and a sum would stand a wall wherever two ranges meet. Each peak falls off as
// (1 - t^2)^2, so every face is a rounded massif rather than a spike.
function makeMountainHeight(peaks) {
  return (x, z) => {
    let base = 0;
    for (const p of peaks) {
      const t = Math.hypot(x - p.px, z - p.pz) / p.r;
      if (t < 1) base = Math.max(base, p.h * (1 - t * t) ** 2);
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

// How far the two ridges run past the walk box's south and west ends: the same
// leads the hand map used, so their ridges start where they always did.
const RIDGE_SOUTH_LEAD = 82;
const RIDGE_WEST_LEAD = 18;

export function buildMountains(district) {
  const rand = mulberry32(133);
  const peaks = [];
  const ridge = (cx, cz, n, alongX) => {
    const from = peaks.length;
    for (let i = 0; i < n; i++) {
      const r = 90 + rand() * 50;
      const h = 45 + rand() * 35;
      const px = alongX ? cx + i * 26 + rand() * 10 : cx + (rand() - 0.5) * 24;
      const pz = alongX ? cz + (rand() - 0.5) * 24 : cz + i * 26 + rand() * 10;
      peaks.push({ px, pz, r, h });
    }
    return peaks.slice(from);
  };
  const westEdge = district.walk.minX - MOUNTAIN_CLEAR;
  const northEdge = district.walk.maxZ + MOUNTAIN_CLEAR;
  const west = ridge(westEdge - PEAK_REACH, district.walk.minZ - RIDGE_SOUTH_LEAD, 12, false);
  const north = ridge(district.walk.minX - RIDGE_WEST_LEAD, northEdge + PEAK_REACH, 9, true);
  const height = makeMountainHeight(peaks);
  const geo = mergeGeometries([
    mountainGrid(west, height, { maxX: westEdge }),
    mountainGrid(north, height, { minZ: northEdge }),
  ]);
  geo.computeVertexNormals();
  paintMountains(geo);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 })
  );
  // A model tag like the pool loader sets, so the VGA-084 sweep reads this
  // smooth terrain as a model rather than a raw primitive.
  mesh.userData.model = 'mountain-range';
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}
