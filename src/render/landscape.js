// Valley landscape: mountain ring, grass verges + park, grass tufts.
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

export function buildMountains() {
  const rand = mulberry32(133);
  const rock = [];
  const snow = [];
  const ridge = (cx, cz, n, alongX) => {
    for (let i = 0; i < n; i++) {
      const r = 24 + rand() * 16;
      const h = 60 + rand() * 50;
      const px = alongX ? cx + i * 26 + rand() * 10 : cx + (rand() - 0.5) * 24;
      const pz = alongX ? cz + (rand() - 0.5) * 24 : cz + i * 26 + rand() * 10;
      const cone = new THREE.ConeGeometry(r, h, 6);
      cone.translate(px, h / 2 - 4, pz);
      rock.push(cone);
      const sr = r * 0.42;
      const sh = h * 0.42;
      const cap = new THREE.ConeGeometry(sr, sh, 6);
      cap.translate(px, h - 4 - sh / 2 + 1, pz);
      snow.push(cap);
    }
  };
  ridge(-88, -150, 12, false); // west range
  ridge(-70, 140, 9, true); // north range
  const rockMesh = new THREE.Mesh(
    mergeGeometries(rock),
    new THREE.MeshStandardMaterial({ color: 0x232c3a, roughness: 1.0, flatShading: true })
  );
  const snowMesh = new THREE.Mesh(
    mergeGeometries(snow),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.9, flatShading: true })
  );
  const g = new THREE.Group();
  g.add(rockMesh, snowMesh);
  return g;
}
