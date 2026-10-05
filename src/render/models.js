// One GLB in, one InstancedMesh per material out (M2.T2). Every model in the
// city loads through here, so a model costs its material count in draws however
// many times it stands. A slot is claimed, written and handed back; nothing is
// created after boot. Every mesh it makes carries the file in `userData.model`,
// which the VGA-084 sweep (M2-6) reads to tell a model from a raw box.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

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

// The GLB's meshes merged by material: one geometry per material, every node's
// world transform baked in.
async function materialGroups(name) {
  const gltf = await new GLTFLoader().loadAsync(name);
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
  return byMat;
}

export async function loadModelPool(name, count) {
  const byMat = await materialGroups(name);
  const group = new THREE.Group();
  const meshes = [];
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.InstancedMesh(mergeGeometries(geos), mat, count);
    mesh.userData.model = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Instances stream in and out; a stale bound would cull one standing right
    // there, so the pool never frustum-culls (the render/outskirts.js shape).
    mesh.frustumCulled = false;
    // A slot that is never written draws at the origin: all start hidden.
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, HIDDEN);
    mesh.count = 0;
    meshes.push(mesh);
    group.add(mesh);
  }
  const free = [];
  for (let i = count - 1; i >= 0; i--) free.push(i);
  const live = new Uint8Array(count);
  let top = 0;
  let starved = 0;
  function flush() {
    for (const m of meshes) {
      m.count = top;
      m.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    name,
    group,
    meshes,
    capacity: count,
    // Take a slot, write it with `set`, hand it back with `free`.
    claim() {
      const i = free.pop();
      if (i === undefined) {
        starved++;
        return -1;
      }
      live[i] = 1;
      if (i >= top) top = i + 1;
      flush();
      return i;
    },
    set(i, matrix) {
      for (const m of meshes) m.setMatrixAt(i, matrix);
      flush();
    },
    free(i) {
      for (const m of meshes) m.setMatrixAt(i, HIDDEN);
      live[i] = 0;
      free.push(i);
      while (top > 0 && !live[top - 1]) top--;
      flush();
    },
    stats: () => ({ used: count - free.length, capacity: count, starved }),
  };
}
