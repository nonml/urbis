// One GLB in, one InstancedMesh per material out (M2.T2). Every model in the
// city loads through here, so a model costs its material count in draws however
// many times it stands. A slot is claimed, written and handed back; nothing is
// created after boot. Every mesh it makes carries the file in `userData.model`,
// which the VGA-084 sweep (M2-6) reads to tell a model from a raw box.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Only ever read in Node: the browser loads the same files over HTTP (below).
// Vite externalises it for the browser bundle, where this namespace is never
// touched — the import has to be a namespace, because a named one does not
// survive the externalisation.
import * as nodeFs from 'node:fs';

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// A baked model is shipped as a file in public/assets/models/ and read twice
// over: in the browser over HTTP, and in Node — the accept specs and the
// sweeps, where there is no fetch — off the disk. The path is the tag a mesh
// from the file wears (`userData.model`), so a model is named by its URL and
// `public/` is prepended only where the disk needs it.
export const IN_NODE = typeof process !== 'undefined' && !!process.versions?.node;

export function readModel(url) {
  // Pulled off the namespace inside the function: a named import of a builtin
  // does not survive Vite's browser externalisation, and this never runs there.
  const { readFileSync } = nodeFs;
  return new Uint8Array(readFileSync(`public/${url}`));
}

export async function fetchModel(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[models] ${url}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// A model may carry baked vertex colours (the landscape's rock and snow, a
// canopy's sky occlusion). They survive the round trip through the pool, so a
// part missing them is filled white rather than merged black.
function colourOf(geo) {
  if (geo.attributes.color) return;
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
}

function clean(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const name of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
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
      colourOf(baked);
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

// --- the baked landscape models -------------------------------------------
// The trees and the mountains are baked offline (tools/models/make_landscape.py)
// and shipped as GLBs beside the CC0 props. In the browser they are loaded the
// same way those are — loadModelPool over HTTP, awaited before the builder that
// draws them runs; in Node the specs read the same file off the disk and parse
// it with the reader below, because there is no fetch and the builders are
// synchronous.
//
// It is the whole of the glTF those files use, and nothing more: one BIN chunk,
// one buffer view per attribute, float attributes, unsigned short indices. If
// it is handed anything else it says so instead of guessing at it.
const FLOAT = 5126;
const USHORT = 5123;
const HEAD = 20; // magic + version + length + the JSON chunk's own header

function glbOf(glb) {
  const bytes = glbBytes(glb);
  const tag = new TextDecoder().decode(bytes.subarray(0, 4));
  if (tag !== 'glTF') throw new Error(`[models] not a GLB: ${tag}`);
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(HEAD, HEAD + len)));
  const bin = HEAD + Math.ceil(len / 4) * 4 + 8;
  return { json, bytes, bin };
}

// A data URL's bytes: the inline form the specs used to carry. A model that is
// already bytes (read off the disk, fetched) is handed back untouched.
function glbBytes(glb) {
  if (glb instanceof Uint8Array) return glb;
  const raw = atob(glb.slice(glb.indexOf(',') + 1));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function attribute(glb, index, itemSize) {
  const acc = glb.json.accessors[index];
  if (acc.componentType !== FLOAT || acc.type !== `VEC${itemSize}`) {
    throw new Error(`[models] accessor ${index} is ${acc.type}, not a vec${itemSize}`);
  }
  const view = glb.json.bufferViews[acc.bufferView];
  const data = new DataView(glb.bytes.buffer, glb.bytes.byteOffset);
  const out = new Float32Array(acc.count * itemSize);
  const stride = view.byteStride || itemSize * 4;
  const at = (i) => glb.bin + view.byteOffset + stride * i;
  for (let i = 0; i < acc.count; i++) {
    for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = data.getFloat32(at(i) + c * 4, true);
  }
  return new THREE.BufferAttribute(out, itemSize);
}

// The meshes of a baked model: [{ name, material, geometry }], one entry per
// glTF mesh, which is what the material a part of the model belongs to.
export function glbMeshes(glb) {
  const parsed = glbOf(glb);
  return parsed.json.meshes.map((mesh) => {
    const prim = mesh.primitives[0];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', attribute(parsed, prim.attributes.POSITION, 3));
    geo.setAttribute('normal', attribute(parsed, prim.attributes.NORMAL, 3));
    geo.setAttribute('color', attribute(parsed, prim.attributes.COLOR_0, 3));
    if (prim.attributes.TEXCOORD_0) {
      geo.setAttribute('uv', attribute(parsed, prim.attributes.TEXCOORD_0, 2));
    }
    const idx = parsed.json.accessors[prim.indices];
    if (idx.componentType !== USHORT) {
      throw new Error(`[models] ${mesh.name}: indices not unsigned short`);
    }
    const bytes = parsed.bytes;
    const view = parsed.json.bufferViews[idx.bufferView];
    const start = parsed.bin + view.byteOffset;
    const tris = new Uint16Array(idx.count);
    for (let i = 0; i < idx.count; i++) {
      tris[i] = bytes[start + i * 2] | (bytes[start + i * 2 + 1] << 8);
    }
    geo.setIndex(new THREE.BufferAttribute(tris, 1));
    geo.name = mesh.name;
    return {
      name: mesh.name,
      material: parsed.json.materials[prim.material].name,
      geometry: geo,
    };
  });
}

// The pool for a baked model: every slot written with the same static pose would
// be a plastic tree, so the caller places the instances and this only builds the
// pools, tags them with the file they came from and hands them back.
export function loadBakedPool(name, count, bytes, materials) {
  const group = new THREE.Group();
  const meshes = [];
  const byMaterial = new Map();
  for (const part of glbMeshes(bytes)) {
    const mat = materials[part.material];
    if (!mat) throw new Error(`[models] ${part.name} has no material for ${part.material}`);
    const mesh = new THREE.InstancedMesh(part.geometry, mat, count);
    mesh.userData.model = name;
    mesh.name = part.name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, HIDDEN);
    mesh.count = 0;
    meshes.push(mesh);
    byMaterial.set(part.material, mesh);
    group.add(mesh);
  }
  return { name, group, meshes, byMaterial, capacity: count };
}
