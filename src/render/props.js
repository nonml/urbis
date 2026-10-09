// Street props: CC0 GLBs (hydrant, trash can) through the model pool loader
// (M2.T2), instanced down the sidewalks, plus the three baked street-tree
// models (M2.F5: a stem, a set of limbs and a canopy per model — five meshes,
// ten draws once they cast).
// Static decor — positions are authored constants, not sim.
import * as THREE from 'three';
import { mulberry32 } from '../sim/rng.js';
import { loadModelPool } from './models.js';
import { treePools } from './trees.js';

// Static decor — placement lists live at the call site, not here.

// Three street-tree models (M2.F5), each its own baked GLB: one spreading oak,
// one columnar lime, one broad plane. `model` is the pool the loader in trees.js
// keys each canopy by and the tag its mesh wears, so the silhouette a street
// reads is the file it was baked from.
const TREE_MODELS = [
  { model: 'tree-canopy-oak' },
  { model: 'tree-canopy-lime' },
  { model: 'tree-canopy-plane' },
];
// Summer greens, plus one ochre and one rust: a street of identical green is
// the other half of the moulded look. Index picked per tree, so a whole block
// can turn — see the autumn run in buildTrees().
const LEAF_GREENS = [0x35502c, 0x2a4526, 0x3d5730, 0x24401f, 0x466033];
const LEAF_AUTUMN = [0x8a5a1c, 0x9c4a18, 0x7a5520, 0xa8621f];

function centreX(geos) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const g of geos) {
    g.computeBoundingBox();
    lo = Math.min(lo, g.boundingBox.min.x);
    hi = Math.max(hi, g.boundingBox.max.x);
  }
  return (lo + hi) / 2;
}

// These Poly Haven props ship as showcase pairs: a clean copy and an aged
// copy standing side by side on the X axis. Instancing the file as one object
// planted BOTH at every position, so the whole city had its bins and hydrants
// in identical twos about a metre apart — a clone tell on every corner.
//
// Split them by which side of the model each material mesh sits on, recentre
// each variant on its own origin, and deal the placements out between them.
// Same material count, so the same number of draws, and now there are two bins
// in the city instead of one bin twice.
function splitVariants(meshes) {
  const mids = meshes.map((m) => centreX([m.geometry]));
  const lo = Math.min(...mids);
  const hi = Math.max(...mids);
  const single = hi - lo < 0.05;
  const variantOf = mids.map((x) => (single || x >= (lo + hi) / 2 ? 0 : 1));
  const centres = [0, 1].map((v) => {
    const geos = meshes.filter((_, i) => variantOf[i] === v).map((m) => m.geometry);
    return geos.length ? centreX(geos) : 0;
  });
  return meshes.map((mesh, i) => {
    const v = variantOf[i];
    mesh.geometry.translate(-centres[v], 0, 0);
    return { mesh, variant: single ? -1 : v };
  });
}

// A prop model loads through the pool loader (M2.T2): one InstancedMesh per
// material, each carrying its file in `userData.model`. Small props skip the
// shadow pass: their shadows are subpixel at play distance.
export async function loadPropInstances(relPath, placements) {
  const pool = await loadModelPool(relPath, placements.length);
  const dummy = new THREE.Object3D();
  for (const { mesh, variant } of splitVariants(pool.meshes)) {
    const mine = placements.filter((_, i) => variant < 0 || i % 2 === variant);
    mesh.count = mine.length;
    mine.forEach(([x, z], i) => {
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, (x * 13 + z * 7) % 6.28, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return pool.group;
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
  // Named so a pick that lands in a canopy says which mesh it hit.
  group.name = 'street-trees';
  const spots = treeSpots();
  const { kit, ready } = treePools(TREE_MODELS.map(({ model }) => model), spots.length);
  // In Node the GLBs are read off the disk and the street is here now. In the
  // browser they land a frame after boot, and the group is already in the scene:
  // it fills the frame they arrive, the way the props do.
  if (kit) placeTrees(group, kit, spots);
  else ready?.then((k) => k && placeTrees(group, k, spots));
  return group;
}

function placeTrees(group, { trunk, branch, canopies }, spots) {
  const rand = mulberry32(77);
  // Dealt round-robin, so no street is all one model.
  const dealt = spots.map((_, i) => i % TREE_MODELS.length);
  const canopyMeshes = TREE_MODELS.map(({ model }) => canopies[model]);
  const dummy = new THREE.Object3D();
  const leaf = new THREE.Color();
  const placed = TREE_MODELS.map(() => 0);
  spots.forEach(([x, z], i) => {
    const s = 0.8 + rand() * 0.5;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    // Non-uniform scale: real street trees are not spheres on sticks.
    dummy.scale.set(s * (0.88 + rand() * 0.26), s, s * (0.88 + rand() * 0.26));
    dummy.updateMatrix();
    trunk.setMatrixAt(i, dummy.matrix);
    branch.setMatrixAt(i, dummy.matrix);
    const v = dealt[i];
    canopyMeshes[v].setMatrixAt(placed[v], dummy.matrix);
    // The east avenue has turned; every other street is still in leaf. The leaf
    // colour multiplies the model's own shade, so a tree reads as foliage
    // whatever it is painted.
    const palette = x > 30 && x < 55 ? LEAF_AUTUMN : LEAF_GREENS;
    canopyMeshes[v].setColorAt(placed[v], leaf.setHex(palette[Math.floor(rand() * palette.length)]));
    placed[v]++;
  });
  trunk.count = spots.length;
  branch.count = spots.length;
  canopyMeshes.forEach((m, v) => { m.count = placed[v]; });
  for (const m of [trunk, branch, ...canopyMeshes]) m.instanceMatrix.needsUpdate = true;
  group.add(trunk, branch, ...canopyMeshes);
}
