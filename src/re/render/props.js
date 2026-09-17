// Street props: CC0 GLBs (hydrant, trash can) loaded once, merged per material,
// instanced down the sidewalks. Plus procedural street trees (2 draws).
// Static decor — positions are authored constants, not sim.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../sim/rng.js';

// Static decor — placement lists live at the call site, not here.

function clean(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
  }
  // GLB UVs may be missing on some parts — merge needs uniform attributes.
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

// One InstancedMesh per source material. Original PBR materials kept as-is.
export async function loadPropInstances(relPath, placements) {
  const gltf = await new GLTFLoader().loadAsync(relPath);
  gltf.scene.updateMatrixWorld(true);
  const byMat = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geos = Array.isArray(o.geometry) ? o.geometry : [o.geometry];
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    geos.forEach((g, gi) => {
      const m = mats[Math.min(gi, mats.length - 1)];
      const baked = clean(g.clone());
      baked.applyMatrix4(o.matrixWorld);
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push(baked);
    });
  });
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos);
    const inst = new THREE.InstancedMesh(merged, mat, placements.length);
    placements.forEach(([x, z], i) => {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, (x * 13 + z * 7) % 6.28, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    // Small props skip the shadow pass: their shadows are subpixel at play distance.
    group.add(inst);
  }
  return group;
}

function treeSpots() {
  const spots = [];
  for (const baseX of [-7.3, 7.3, 44 - 7.3, 44 + 7.3, -44 - 7.3, -44 + 7.3]) {
    for (let z = -86; z <= 86; z += 17) spots.push([baseX, z]);
  }
  for (const bx of [-29, -39.5]) {
    for (let z = -50; z <= 50; z += 20) spots.push([bx, z]);
  }
  for (let x = 56; x <= 66; x += 5) {
    for (let z = -6; z <= 16; z += 7) spots.push([x, z]);
  }
  spots.push([-4, -69.5], [14, -69.5], [32, -69.5], [48, -69.5]);
  return spots;
}

export function buildTrees() {
  const group = new THREE.Group();
  const rand = mulberry32(77);
  // Tapered trunk with slight bend — reads as wood, not a pipe.
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.16, 3.0, 8);
  trunkGeo.translate(0, 1.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 });
  // Multi-cluster canopy: 3 overlapping blobs at different heights for organic silhouette.
  const canopyGeo = mergeGeometries([
    (() => { const g = new THREE.IcosahedronGeometry(1.6, 2); g.translate(0, 3.2, 0); g.scale(1, 0.75, 1); return g; })(),
    (() => { const g = new THREE.IcosahedronGeometry(1.1, 2); g.translate(0.6, 4.2, 0.3); return g; })(),
    (() => { const g = new THREE.IcosahedronGeometry(0.8, 2); g.translate(-0.4, 4.8, -0.2); return g; })(),
  ]);
  // Branch stubs: 2–3 short limbs poking from the trunk into the canopy.
  const branchGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.03, 0.06, 1.0, 5); g.rotateZ(0.6); g.translate(0.35, 2.6, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.025, 0.05, 0.8, 5); g.rotateZ(-0.5); g.translate(-0.3, 3.0, 0.2); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.02, 0.04, 0.6, 5); g.rotateX(0.4); g.translate(0.1, 2.2, -0.35); return g; })(),
  ]);
  // Organic displacement: break the perfect icosahedron silhouette.
  {
    const hash3 = (x, y, z) => {
      const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
      return s - Math.floor(s);
    };
    for (const geo of [canopyGeo, branchGeo]) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const ix = Math.round(p.getX(i) * 4);
        const iy = Math.round(p.getY(i) * 4);
        const iz = Math.round(p.getZ(i) * 4);
        p.setXYZ(i,
          p.getX(i) + (hash3(ix, iy, iz) - 0.5) * 0.45,
          p.getY(i) + (hash3(iy, iz, ix) - 0.5) * 0.35,
          p.getZ(i) + (hash3(iz, ix, iy) - 0.5) * 0.45);
      }
      geo.computeVertexNormals();
    }
  }
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x14271a, roughness: 1.0, envMapIntensity: 0.55 });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 });
  const spots = treeSpots();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const branches = new THREE.InstancedMesh(branchGeo, branchMat, spots.length);
  trunks.castShadow = true;
  canopies.castShadow = true;
  branches.castShadow = true;
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    const s = 0.8 + rand() * 0.5;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);
    branches.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  group.add(trunks, canopies, branches);
  return group;
}
