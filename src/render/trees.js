// The street trees are models (M2.F5): baked by tools/models/make_landscape.py
// and shipped as GLBs in public/assets/models/, one file per part — the stem,
// the limbs, and a canopy for each of the three tree models. The pools come from
// models.js, which tags every mesh with the file it was built from, exactly as
// the pool loader tags the CC0 props. Five meshes, ten draws once they cast,
// at any count.
import * as THREE from 'three';
import { mulberry32 } from '../sim/rng.js';
import { IN_NODE, loadBakedPool, loadModelPool, readModel } from './models.js';

const TRUNK = 'assets/models/tree_trunk.glb';
const BRANCH = 'assets/models/tree_branch.glb';
// A canopy per tree model, keyed by the name props.js deals the streets out by.
const CANOPY = {
  'tree-canopy-oak': 'assets/models/tree_canopy_oak.glb',
  'tree-canopy-lime': 'assets/models/tree_canopy_lime.glb',
  'tree-canopy-plane': 'assets/models/tree_canopy_plane.glb',
};
// The material the canopy's GLB asks for — the one that wears the leaf sprite.
const CANOPY_MAT = 'tree-canopy';

// Alpha-cut leaf card sprite: 26 white ellipses on transparent. White so the
// per-instance leaf colour set by setColorAt tints each card through the map.
export function leafTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  const rng = mulberry32(78);
  for (let i = 0; i < 26; i++) {
    const rx = 6 + rng() * 5;
    const ry = 3 + rng() * 2;
    ctx.save();
    ctx.translate(rng() * size, rng() * size);
    ctx.rotate(rng() * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One material per part, keyed by the material the GLB's mesh asks for. The
// canopy carries baked sky-occlusion in its vertex colours, which multiply the
// per-instance leaf colour, so the autumn palettes keep working.
function treeMaterials() {
  const canopy = new THREE.MeshStandardMaterial();
  tuneCanopy(canopy, leafTexture());
  return {
    'tree-trunk': new THREE.MeshStandardMaterial({ color: 0x2c251c, roughness: 0.95 }),
    'tree-branch': new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 }),
    [CANOPY_MAT]: canopy,
  };
}

// What the canopy is, wherever its material came from: the GLB's own pbr block
// when the pool loader built it, or this when Node did. Same surface either way,
// or a street would change colour between the browser and a spec.
function tuneCanopy(mat, leaf) {
  Object.assign(mat, {
    map: leaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true,
    roughness: 1.0, envMapIntensity: 0.55,
  });
}

// A tree's shadow is the reason a street reads as planted, so every part casts
// one, and the pools never cull: an instance streams in and out of a slot.
function wear(mesh) {
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// Node has no fetch, and the specs call the builder synchronously, so there the
// GLBs are read off the disk and parsed by models.js's reader.
function diskPools(names, count) {
  const materials = treeMaterials();
  const canopies = {};
  for (const name of names) {
    const file = CANOPY[name];
    canopies[name] = wear(loadBakedPool(file, count, readModel(file), materials).meshes[0]);
  }
  return {
    trunk: wear(loadBakedPool(TRUNK, count, readModel(TRUNK), materials).meshes[0]),
    branch: wear(loadBakedPool(BRANCH, count, readModel(BRANCH), materials).meshes[0]),
    canopies,
  };
}

// The browser loads a part the way it loads every other model: through the
// pool, which merges the model's meshes by material and tags them with the file.
async function poolOf(file, count, leaf) {
  const mesh = wear((await loadModelPool(file, count)).meshes[0]);
  if (mesh.material.name === CANOPY_MAT) tuneCanopy(mesh.material, leaf);
  return mesh;
}

async function loadTreePools(names, count) {
  const leaf = leafTexture();
  const files = [TRUNK, BRANCH, ...names.map((name) => CANOPY[name])];
  const parts = await Promise.all(files.map((file) => poolOf(file, count, leaf)));
  return {
    trunk: parts[0],
    branch: parts[1],
    canopies: Object.fromEntries(names.map((name, i) => [name, parts[2 + i]])),
  };
}

// The pools for one street's trees: a stem, a set of limbs, and a canopy per
// tree model, every one capacity `count` with every slot hidden until the caller
// writes it.
//
// `kit` is there on the first call in Node, where the GLBs are read off the
// disk. In the browser it is null and `ready` is the promise that has them: the
// builder is synchronous, so it hands back the group it has and this fills it
// when the files arrive.
let loading = null;

export function treePools(names, count) {
  if (IN_NODE) return { kit: diskPools(names, count), ready: null };
  loading ??= loadTreePools(names, count).catch(() => null);
  return { kit: null, ready: loading };
}
