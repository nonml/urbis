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
import { WATER_BED } from './river.js';
import { IN_NODE, fetchModel, glbMeshes, readModel } from './models.js';

// The massifs are baked models (tools/models/make_landscape.py): two forms in
// one GLB in public/assets/models/, and the peaks a range draws are copies of
// them. The file is loaded the way the props are — over HTTP in the browser,
// off the disk in Node, where the specs and the sweeps call the builder
// synchronously and there is no fetch.

// The ground of a map, live: the map's own terrain when it has one (a generated
// map's, rebuilt from its graph after every road op), the load-time world's
// otherwise. All the meshes here read the same one, so the ground a road is
// laid on is the ground they follow (M5.T3c).
export function terrainOf(map = worldMap()) {
  return map.terrain?.heightAt ?? heightAt;
}

// Inside a map water rect (M4.T8b). The rects are sim/map.js's [cx, cz, hw, hd];
// the sink is below the sheet at -WATER_DROP and the bank foot, so the water is
// the surface a camera and a pick see.
function inWater(x, z, water) {
  return water.some(([cx, cz, hw, hd]) => Math.abs(x - cx) <= hw && Math.abs(z - cz) <= hd);
}

// Lift every vertex of an already-positioned geometry onto the field. A slab's
// top and bottom move together, so its thickness and its vertical sides survive
// and no face cracks open. A vertex inside a water rect drops to WATER_BED
// instead of riding the relief: every displaced ground reads this — the base
// plane and the build frame (block.js, landscape.js) and the outskirts ground —
// because the river is the world's, not one builder's, and the field still
// carries relief over the corridor.
export function displaceToTerrain(geo, heightOf = terrainOf()) {
  const water = worldMap().water ?? [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, water.length && inWater(x, z, water) ? WATER_BED : pos.getY(i) + heightOf(x, z));
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
// and VERGE_REACH_Z, on every cell no street, building row, lot, skyline tower
// or water rect touches, one slab per clear run along z, and tufts inset on
// every slab. `water` keeps a generated city's grass off the river (M4.T8b);
// the hand map has no map.water and keeps its own table.
export function grassFor(district, plan, vistas, water = []) {
  const keepOff = [
    ...district.avenues.map((a) => rectAt(a.x, (a.z0 + a.z1) / 2, BUILD_LINE * 2, a.z1 - a.z0)),
    ...district.crossings.map((c) => rectAt((c.x0 + c.x1) / 2, c.z, c.x1 - c.x0, CROSSING_BAND * 2)),
    ...plan.rows.flatMap((r) => r.runs.map(([z0, z1]) => rectAt(r.ax + r.side * (BUILD_LINE + r.depth / 2), (z0 + z1) / 2, r.depth, z1 - z0))),
    ...plan.lots.map(([x, z, w, d]) => rectAt(x, z, w, d)),
    ...[...vistas.caps, ...vistas.ring].map((t) => rectAt(t.x, t.z, t.w, t.d)),
    ...water.map(([cx, cz, hw, hd]) => rectAt(cx, cz, hw * 2, hd * 2)),
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
  return grassFor(map.district, planLayout(map.district, map.seed, pinned), vistasOf(map), map.water ?? []);
}

// The ground a player can build on (M5.T3c): the map's own build box, drawn as
// one mesh outside the fixed 700 m base plane (block.js). A generated town's
// graph spans kilometres, so without this its outer roads and lots stand over
// void. The frame keeps the base plane's own 4 m lattice so the two surfaces
// meet exactly, and it is displaced by the live map terrain, which flattens
// under every road and parcel pad — so tarmac and lots meet the ground.
const BASE_PLANE_HALF = 350;  // block.js GROUND_EXTENT / 2 — keep in step
const GROUND_STEP = 4;        // matches GROUND_CELL in block.js
const GROUND_SINK = 0.08;     // the base plane's own drop (block.js)
const GROUND_LATTICE = 2;     // the 700 m plane's vertices sit on 2 (mod 4)
const GROUND_HEX = 0x14171c;  // the base plane's colour, so the two read as one

// The nearest lattice line at or under `v`, and at or over it.
const latticeLo = (v) => Math.floor((v - GROUND_LATTICE) / GROUND_STEP) * GROUND_STEP + GROUND_LATTICE;
const latticeHi = (v) => Math.ceil((v - GROUND_LATTICE) / GROUND_STEP) * GROUND_STEP + GROUND_LATTICE;

// The frame a road op re-displaces keeps the river bed: the same drop
// displaceToTerrain applies at boot, run over the Ys refreshBuildGround just
// wrote (M4.T8b).
function sinkWater(geo, map) {
  const water = map.water ?? [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (inWater(x, z, water)) pos.setY(i, WATER_BED);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// The frame as up to four strips around the square the base plane covers.
function frameRects(bounds) {
  const x0 = latticeLo(bounds.minX), x1 = latticeHi(bounds.maxX);
  const z0 = latticeLo(bounds.minZ), z1 = latticeHi(bounds.maxZ);
  const hx0 = Math.max(x0, -BASE_PLANE_HALF), hx1 = Math.min(x1, BASE_PLANE_HALF);
  const hz0 = Math.max(z0, -BASE_PLANE_HALF), hz1 = Math.min(z1, BASE_PLANE_HALF);
  if (hx1 <= hx0 || hz1 <= hz0) return [[x0, x1, z0, z1]];
  const rects = [];
  if (z0 < hz0) rects.push([x0, x1, z0, hz0]);
  if (z1 > hz1) rects.push([x0, x1, hz1, z1]);
  if (x0 < hx0) rects.push([x0, hx0, hz0, hz1]);
  if (x1 > hx1) rects.push([hx1, x1, hz0, hz1]);
  return rects;
}

function buildGroundFrame(map) {
  if (!map.bounds) return null;
  const geos = frameRects(map.bounds).map(([x0, x1, z0, z1]) => {
    const w = x1 - x0;
    const d = z1 - z0;
    const g = new THREE.PlaneGeometry(w, d, Math.round(w / GROUND_STEP), Math.round(d / GROUND_STEP));
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    return g;
  });
  const mesh = new THREE.Mesh(displaceToTerrain(mergeGeometries(geos), terrainOf(map)),
    new THREE.MeshStandardMaterial({ color: GROUND_HEX, roughness: 1, metalness: 0 }));
  mesh.name = 'ground';
  mesh.position.y = -GROUND_SINK;
  mesh.receiveShadow = true;
  return mesh;
}

// The frame's vertex grid is fixed once its bounds are: a road op changes the
// ground under it, not the grid. A refresh reads the terrain Ys again only when
// the graph's counts changed, so zoning and bulldozing never re-displace it;
// bounds that moved get the geometry rebuilt, because a drag may leave the box
// the frame was first cut for.
let groundRig = null;

const sameBounds = (a, b) => a && b && a.minX === b.minX && a.maxX === b.maxX
  && a.minZ === b.minZ && a.maxZ === b.maxZ;

export function refreshBuildGround(map = worldMap()) {
  if (!groundRig || groundRig.map !== map || !map.graph) return;
  const nodes = map.graph.nodes.length;
  const edges = map.graph.edges.length;
  if (nodes === groundRig.nodes && edges === groundRig.edges && sameBounds(map.bounds, groundRig.bounds)) return;
  if (!sameBounds(map.bounds, groundRig.bounds)) {
    const next = buildGroundFrame(map);
    if (!next) return;
    groundRig.mesh.geometry.dispose();
    groundRig.mesh.geometry = next.geometry;
    groundRig.bounds = { ...map.bounds };
  } else {
    const pos = groundRig.mesh.geometry.attributes.position;
    const heightOf = terrainOf(map);
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightOf(pos.getX(i), pos.getZ(i)));
    pos.needsUpdate = true;
    sinkWater(groundRig.mesh.geometry, map);
    groundRig.mesh.geometry.computeBoundingSphere();
  }
  groundRig.nodes = nodes;
  groundRig.edges = edges;
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
  const frame = buildGroundFrame(map);
  if (!frame) return mesh;
  groundRig = {
    mesh: frame, map, bounds: { ...map.bounds },
    nodes: map.graph.nodes.length, edges: map.graph.edges.length,
  };
  const group = new THREE.Group();
  group.add(mesh, frame);
  return group;
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

// Smooth terrain, not cones — and not built by hand either. The massifs are
// baked models (tools/models/make_landscape.py): a range is copies of one of
// the file's two forms dropped onto the peak table the ranges have always had.
// One merged mesh, one draw, whatever the count.
//
// A range stands this far outside the district's walk box, which also clears the
// vista ring, so a peak can never rise over a street.
export const MOUNTAIN_CLEAR = 60;
// The farthest a peak reaches from its centre: largest r plus half the jitter.
const PEAK_REACH = 140 + 12;
const MOUNTAIN_FLOOR = -4; // the cones sat 4 m sunk; keep their bases hidden
// How far the two ridges run past the walk box's south and west ends: the same
// leads the hand map used, so their ridges start where they always did.
const RIDGE_SOUTH_LEAD = 82;
const RIDGE_WEST_LEAD = 18;
// The massif file and where it lives: the tag the merged mesh wears.
const MOUNTAIN_MODEL = 'assets/models/mountain_massif.glb';

// A form's own footprint and height, read off the mesh: a copy is scaled by
// these against the peak it stands for, so a peak of radius r reaches r and a
// peak of height h peaks at h however tall the model was baked.
function formExtent(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  return { xz: Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z), y: bb.max.y };
}

function massifForms(bytes) {
  return glbMeshes(bytes).map((part) => ({ geo: part.geometry, extent: formExtent(part.geometry) }));
}

// The two forms, read once: every peak of every range is a copy of one of them.
// Node has them on the first call. The browser has not — the GLB is in flight,
// and the range lands the frame it arrives, into the group the builder handed
// out. buildMountains() is called from a synchronous builder, so it cannot
// await; it registers, and the load fills what it registered.
let forms = null;
let loading = null;
const waiting = [];

function massifFormsReady() {
  if (forms) return forms;
  if (IN_NODE) {
    forms = massifForms(readModel(MOUNTAIN_MODEL));
    return forms;
  }
  loading ??= fetchModel(MOUNTAIN_MODEL)
    .then((bytes) => {
      forms = massifForms(bytes);
      for (const [district, group] of waiting.splice(0)) group.add(rangeMesh(district, forms));
    })
    .catch(() => null);
  return null;
}

function rangeMesh(district, massifs) {
  const rand = mulberry32(133);
  const peaks = ridgePeaks(district, rand);
  const copies = [];
  const dummy = new THREE.Object3D();
  peaks.forEach((p, i) => {
    // The two forms dealt round the table, each turned to face its own way, so
    // no two peaks of a range read as the same mountain.
    const { geo, extent } = massifs[i % massifs.length];
    dummy.position.set(p.px, MOUNTAIN_FLOOR, p.pz);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.set(p.r / extent.xz, p.h / extent.y, p.r / extent.xz);
    dummy.updateMatrix();
    copies.push(geo.clone().applyMatrix4(dummy.matrix));
  });
  const mesh = new THREE.Mesh(
    mergeGeometries(copies),
    // Rock and snow are baked into the model's vertex colours, so the material
    // is nothing but a surface.
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1.0 }),
  );
  mesh.name = 'mountain-massif';
  mesh.userData.model = MOUNTAIN_MODEL;
  return mesh;
}

export function buildMountains(district) {
  const group = new THREE.Group();
  const massifs = massifFormsReady();
  if (massifs) {
    group.add(rangeMesh(district, massifs));
    return group;
  }
  waiting.push([district, group]);
  return group;
}

// The peak table of the two ranges: the same leads, spacing and jitter the
// hand map has always used, so a range starts and ends where it did. Heights
// stay 45–80 m and radii 90–140 m, so every copy stands clear of the streets.
function ridgePeaks(district, rand) {
  const peaks = [];
  const ridge = (cx, cz, n, alongX) => {
    for (let i = 0; i < n; i++) {
      const r = 90 + rand() * 50;
      const h = 45 + rand() * 35;
      const px = alongX ? cx + i * 26 + rand() * 10 : cx + (rand() - 0.5) * 24;
      const pz = alongX ? cz + (rand() - 0.5) * 24 : cz + i * 26 + rand() * 10;
      peaks.push({ px, pz, r, h });
    }
  };
  ridge(district.walk.minX - MOUNTAIN_CLEAR - PEAK_REACH,
    district.walk.minZ - RIDGE_SOUTH_LEAD, 12, false);
  ridge(district.walk.minX - RIDGE_WEST_LEAD,
    district.walk.maxZ + MOUNTAIN_CLEAR + PEAK_REACH, 9, true);
  return peaks;
}
