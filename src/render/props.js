// Street props: CC0 GLBs (hydrant, trash can) through the model pool loader
// (M2.T2), instanced down the sidewalks, plus three procedural street-tree
// models (M2.T10: trunk, one canopy pool per model, branch — five draws).
// Static decor — positions are authored constants, not sim.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../sim/rng.js';
import { loadModelPool } from './models.js';

// Static decor — placement lists live at the call site, not here.

// Leaf masses: [x, y, z, radius]. Each is a roughly spherical volume of leaf
// cards; the ten sit on a shell from y2.7 to y5.1, deliberately asymmetric so no
// two profiles of the same tree read the same.
const CANOPY_CLUMPS = [
  [0, 3.05, 0, 1.15], [0.88, 3.30, 0.28, 0.82], [-0.78, 3.20, -0.38, 0.86],
  [0.26, 3.90, -0.72, 0.72], [-0.36, 4.02, 0.66, 0.68], [0.56, 4.48, 0.16, 0.58],
  [-0.62, 4.40, -0.22, 0.54], [0.04, 4.92, 0.06, 0.48], [1.12, 2.85, -0.52, 0.52],
  [-1.08, 2.95, 0.50, 0.58],
];
const CANOPY_LOW = 2.3;      // shaded underside
const CANOPY_HIGH = 5.3;     // the face the sky actually reaches
const CANOPY_FLOOR = 0.42;   // how dark the underside goes
// Three street-tree models (M2.T10): one spreading oak, one columnar lime,
// one broad plane. Same leaf-card technique in each — the silhouettes differ,
// so a block reads as planted trees rather than one clone stamped down it.
const CANOPY_TALL = [
  [0, 3.10, 0, 0.95], [0.40, 3.50, 0.20, 0.70], [-0.35, 3.40, -0.20, 0.68],
  [0.15, 4.10, -0.30, 0.62], [-0.15, 4.20, 0.30, 0.60], [0.25, 4.70, 0.10, 0.50],
  [-0.25, 4.65, -0.10, 0.48], [0.05, 5.20, 0.05, 0.42], [0.50, 3.00, -0.25, 0.45],
  [-0.50, 3.10, 0.25, 0.48],
];
const CANOPY_WIDE = [
  [0, 2.90, 0, 1.25], [1.00, 3.10, 0.30, 0.80], [-0.95, 3.05, -0.35, 0.84],
  [0.30, 3.60, -0.80, 0.70], [-0.40, 3.70, 0.75, 0.66], [0.60, 4.10, 0.20, 0.55],
  [-0.65, 4.05, -0.20, 0.52], [0.05, 4.50, 0.05, 0.45], [1.30, 2.70, -0.55, 0.50],
  [-1.25, 2.80, 0.55, 0.54],
];
const TREE_CANOPIES = [
  { model: 'tree-canopy-oak', clumps: CANOPY_CLUMPS, seed: 79 },
  { model: 'tree-canopy-lime', clumps: CANOPY_TALL, seed: 179 },
  { model: 'tree-canopy-plane', clumps: CANOPY_WIDE, seed: 279 },
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

// Alpha-cut leaf card sprite: 26 white ellipses on transparent. White so the
// per-instance leaf colour set by setColorAt tints each card through the map.
function leafTexture() {
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
    const angle = rng() * Math.PI * 2;
    ctx.save();
    ctx.translate(rng() * size, rng() * size);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One canopy model: 18 small alpha-cut quads seeded inside each leaf mass.
// The cut outline breaks the silhouette and lets sky through, so it reads as
// foliage instead of green balls. 10 masses x 18 cards = 360 triangles.
function buildCanopyGeo(clumps, seed) {
  const cardRng = mulberry32(seed);
  const geo = mergeGeometries(clumps.flatMap(([x, y, z, r]) => {
    const cards = [];
    for (let i = 0; i < 18; i++) {
      const g = new THREE.PlaneGeometry(1.1 * r, 1.1 * r);
      g.rotateX(cardRng() * Math.PI * 2);
      g.rotateY(cardRng() * Math.PI * 2);
      g.rotateZ(cardRng() * Math.PI * 2);
      const rad = 0.8 * r * Math.cbrt(cardRng());
      const theta = cardRng() * Math.PI * 2;
      const phi = Math.acos(2 * cardRng() - 1);
      g.translate(
        x + rad * Math.sin(phi) * Math.cos(theta),
        y + rad * Math.cos(phi),
        z + rad * Math.sin(phi) * Math.sin(theta),
      );
      cards.push(g);
    }
    return cards;
  }));
  // Baked sky occlusion down the canopy. Foliage is dark underneath and bright
  // where the sky reaches it; without that gradient a green shell is just a
  // shape, however broken its outline. Costs nothing at runtime.
  const p = geo.attributes.position;
  const shade = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - CANOPY_LOW) / (CANOPY_HIGH - CANOPY_LOW);
    const v = CANOPY_FLOOR + (1 - CANOPY_FLOOR) * Math.max(0, Math.min(1, t)) ** 0.8;
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  return geo;
}

export function buildTrees() {
  const group = new THREE.Group();
  const rand = mulberry32(77);
  // Tapered trunk with slight bend — reads as wood, not a pipe.
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.16, 3.0, 8);
  trunkGeo.translate(0, 1.5, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2c251c, roughness: 0.95 });
  // Branch stubs: 2–3 short limbs poking from the trunk into the canopy.
  const branchGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.03, 0.06, 1.0, 5); g.rotateZ(0.6); g.translate(0.35, 2.6, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.025, 0.05, 0.8, 5); g.rotateZ(-0.5); g.translate(-0.3, 3.0, 0.2); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.02, 0.04, 0.6, 5); g.rotateX(0.4); g.translate(0.1, 2.2, -0.35); return g; })(),
  ]);
  // Organic displacement: break the branch silhouette. Leaf cards are already
  // irregular, and jittering their corners would warp the alpha cut.
  {
    const hash3 = (x, y, z) => {
      const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
      return s - Math.floor(s);
    };
    // Branches are thin, so they take a modest shove.
    for (const [geo, amp] of [[branchGeo, 0.4]]) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const ix = Math.round(p.getX(i) * 4);
        const iy = Math.round(p.getY(i) * 4);
        const iz = Math.round(p.getZ(i) * 4);
        p.setXYZ(i,
          p.getX(i) + (hash3(ix, iy, iz) - 0.5) * amp,
          p.getY(i) + (hash3(iy, iz, ix) - 0.5) * amp * 0.8,
          p.getZ(i) + (hash3(iz, ix, iy) - 0.5) * amp);
      }
      geo.computeVertexNormals();
    }
  }
  const canopyMat = new THREE.MeshStandardMaterial({
    roughness: 1.0, envMapIntensity: 0.55, vertexColors: true,
    map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide,
  });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 });
  const spots = treeSpots();
  // Dealt round-robin, so no street is all one model.
  const dealt = spots.map((_, i) => i % TREE_CANOPIES.length);
  const counts = TREE_CANOPIES.map((_, v) => dealt.filter((d) => d === v).length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const branches = new THREE.InstancedMesh(branchGeo, branchMat, spots.length);
  const canopyMeshes = TREE_CANOPIES.map(({ model, clumps, seed }, v) => {
    const m = new THREE.InstancedMesh(buildCanopyGeo(clumps, seed), canopyMat, counts[v]);
    m.name = model;
    m.castShadow = true;
    return m;
  });
  trunks.castShadow = true;
  branches.castShadow = true;
  const dummy = new THREE.Object3D();
  const leaf = new THREE.Color();
  const placed = TREE_CANOPIES.map(() => 0);
  spots.forEach(([x, z], i) => {
    const s = 0.8 + rand() * 0.5;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    // Non-uniform scale: real street trees are not spheres on sticks.
    dummy.scale.set(s * (0.88 + rand() * 0.26), s, s * (0.88 + rand() * 0.26));
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    branches.setMatrixAt(i, dummy.matrix);
    const v = dealt[i];
    canopyMeshes[v].setMatrixAt(placed[v], dummy.matrix);
    // The east avenue has turned; every other street is still in leaf.
    const palette = x > 30 && x < 55 ? LEAF_AUTUMN : LEAF_GREENS;
    canopyMeshes[v].setColorAt(placed[v], leaf.setHex(palette[Math.floor(rand() * palette.length)]));
    placed[v]++;
  });
  for (const m of canopyMeshes) {
    m.instanceColor.needsUpdate = true;
    m.instanceMatrix.needsUpdate = true;
  }
  trunks.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  group.add(trunks, ...canopyMeshes, branches);
  return group;
}
