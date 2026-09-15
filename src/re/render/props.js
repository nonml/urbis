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
    group.add(inst);
  }
  return group;
}

function treeSpots() {
  const spots = [];
  for (const baseX of [-7.3, 7.3, 44 - 7.3, 44 + 7.3]) {
    for (let z = -52; z <= 52; z += 17) spots.push([baseX, z]);
  }
  spots.push([-4, -69.5], [14, -69.5], [32, -69.5], [48, -69.5]);
  return spots;
}

export function buildTrees() {
  const group = new THREE.Group();
  const rand = mulberry32(77);
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.14, 2.6, 7);
  trunkGeo.translate(0, 1.3, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 });
  const canopyGeo = mergeGeometries([
    (() => { const g = new THREE.IcosahedronGeometry(1.5, 1); g.translate(0, 3.4, 0); g.scale(1, 0.85, 1); return g; })(),
    (() => { const g = new THREE.IcosahedronGeometry(1.0, 1); g.translate(0.5, 4.4, 0.3); return g; })(),
  ]);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x14271a, roughness: 1.0, envMapIntensity: 0.55 });
  const spots = treeSpots();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    const s = 0.8 + rand() * 0.5;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  group.add(trunks, canopies);
  return group;
}
