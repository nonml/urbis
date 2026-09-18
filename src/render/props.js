// Street props: CC0 GLBs (hydrant, trash can) loaded once, merged per material,
// instanced down the sidewalks. Plus procedural street trees (2 draws).
// Static decor — positions are authored constants, not sim.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mulberry32 } from '../sim/rng.js';

// Static decor — placement lists live at the call site, not here.

// Leaf clumps: [x, y, z, radius]. Roughly a shell from y2.7 to y5.1, deliberately
// asymmetric so no two profiles of the same tree read the same.
const CANOPY_CLUMPS = [
  [0, 3.05, 0, 1.15], [0.88, 3.30, 0.28, 0.82], [-0.78, 3.20, -0.38, 0.86],
  [0.26, 3.90, -0.72, 0.72], [-0.36, 4.02, 0.66, 0.68], [0.56, 4.48, 0.16, 0.58],
  [-0.62, 4.40, -0.22, 0.54], [0.04, 4.92, 0.06, 0.48], [1.12, 2.85, -0.52, 0.52],
  [-1.08, 2.95, 0.50, 0.58],
];
const CANOPY_LOW = 2.3;      // shaded underside
const CANOPY_HIGH = 5.3;     // the face the sky actually reaches
const CANOPY_FLOOR = 0.42;   // how dark the underside goes
// Summer greens, plus one ochre and one rust: a street of identical green is
// the other half of the moulded look. Index picked per tree, so a whole block
// can turn — see the autumn run in buildTrees().
const LEAF_GREENS = [0x35502c, 0x2a4526, 0x3d5730, 0x24401f, 0x466033];
const LEAF_AUTUMN = [0x8a5a1c, 0x9c4a18, 0x7a5520, 0xa8621f];

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
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2c251c, roughness: 0.95 });
  // Canopy as a cluster of leaf clumps, not three big spheres. Three spheres
  // give a convex outline, and a convex green outline at play distance reads as
  // a boulder — that is the single thing that made these trees look moulded.
  // Ten small clumps on a rough shell put notches in the silhouette instead.
  const canopyGeo = mergeGeometries(CANOPY_CLUMPS.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, 0.85, 1);
    g.translate(x, y, z);
    return g;
  }));
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
    // Clumps are small now, so they get a small jitter; a 0.45 shove that suited
    // 1.6m spheres turns a 0.5m clump inside out.
    for (const [geo, amp] of [[canopyGeo, 0.16], [branchGeo, 0.4]]) {
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
  // Baked sky occlusion down the canopy. Foliage is dark underneath and bright
  // where the sky reaches it; without that gradient a green shell is just a
  // shape, however broken its outline. Costs nothing at runtime.
  {
    const p = canopyGeo.attributes.position;
    const shade = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) - CANOPY_LOW) / (CANOPY_HIGH - CANOPY_LOW);
      const v = CANOPY_FLOOR + (1 - CANOPY_FLOOR) * Math.max(0, Math.min(1, t)) ** 0.8;
      shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = v;
    }
    canopyGeo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  }
  const canopyMat = new THREE.MeshStandardMaterial({
    roughness: 1.0, envMapIntensity: 0.55, vertexColors: true,
  });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.95 });
  const spots = treeSpots();
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length);
  const branches = new THREE.InstancedMesh(branchGeo, branchMat, spots.length);
  trunks.castShadow = true;
  canopies.castShadow = true;
  branches.castShadow = true;
  const dummy = new THREE.Object3D();
  const leaf = new THREE.Color();
  spots.forEach(([x, z], i) => {
    const s = 0.8 + rand() * 0.5;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, rand() * 6.28, 0);
    // Non-uniform scale: real street trees are not spheres on sticks.
    dummy.scale.set(s * (0.88 + rand() * 0.26), s, s * (0.88 + rand() * 0.26));
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    canopies.setMatrixAt(i, dummy.matrix);
    branches.setMatrixAt(i, dummy.matrix);
    // The east avenue has turned; every other street is still in leaf.
    const palette = x > 30 && x < 55 ? LEAF_AUTUMN : LEAF_GREENS;
    canopies.setColorAt(i, leaf.setHex(palette[Math.floor(rand() * palette.length)]));
  });
  canopies.instanceColor.needsUpdate = true;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  group.add(trunks, canopies, branches);
  return group;
}
