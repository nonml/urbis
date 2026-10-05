// Row shells pooled (M3.T22, M3-5). A row's shaft was merged geometry in
// render/block.js: permanent, and a rebuild a load-time hitch exactly when a
// building changes. Now it is one slot in a per-architecture InstancedMesh —
// the render/zoning.js pattern, at city scale — so the wall costs one fixed
// pool per architecture whatever the map does. Each slot carries the parcel it
// stands on and its district (float indexes into the pools' id tables) and the
// blackout's power zone. ZONING.md's no-instancing line is superseded by M3.
// The pools wear the tower facade materials; their instanced UV rescale
// (materials.js) reads the instance matrix columns, so a unit shell tiles the
// same FACADE_TILE window grid the merged towers bake in.
import * as THREE from 'three';

const SHELL_SLACK = 64; // headroom for a re-planned frontage (M3.T20)
const NO_ID = -1; // the hand preset's rows are not map parcels
function unitShell() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0); // base on the ground: scale.y is the height
  return g;
}

// The float a slot stores for an id, adding it to the pool's table the first
// time it appears (an op can name a parcel the first wall never drew).
function idIndex(ids, id) {
  if (id == null) return NO_ID;
  const i = ids.indexOf(id);
  if (i >= 0) return i;
  ids.push(id);
  return ids.length - 1;
}
// One pool per architecture the wall uses, sized once. `shells` is what to draw
// now: { x, y, z, w, h, d, kind, zone, parcel, district }; `y` is the slot's
// base (0 for a shaft, the shaft height for its setback crown).
export function buildShellPools(materials, shells, slack = SHELL_SLACK) {
  const group = new THREE.Group();
  const meshes = [];
  const capacity = new Map();
  const byKind = new Map();
  const parcelIds = [];
  const districtIds = [];
  const counts = new Map();
  for (const s of shells) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  for (const [kind, n] of counts) {
    const geo = unitShell();
    geo.setAttribute('zone', new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    geo.setAttribute('parcel', new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    geo.setAttribute('district', new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    const mesh = new THREE.InstancedMesh(geo, materials[kind], n + slack);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.kind = kind;
    mesh.count = 0;
    byKind.set(kind, mesh);
    capacity.set(kind, n + slack);
    meshes.push(mesh);
    group.add(mesh);
  }
  const at = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const size = new THREE.Vector3();
  const matrix = new THREE.Matrix4();

  // Rewrite the wall the map now carries. A slot past capacity is dropped, not
  // grown: the pool's size is fixed at build (M3.T27 reclaims the tiles).
  function update(list = shells) {
    for (const mesh of meshes) mesh.count = 0;
    for (const s of list) {
      const mesh = byKind.get(s.kind);
      if (!mesh || mesh.count >= mesh.instanceMatrix.count) continue;
      const i = mesh.count++;
      at.set(s.x, s.y ?? 0, s.z);
      size.set(s.w, s.h, s.d);
      mesh.setMatrixAt(i, matrix.compose(at, quat.identity(), size));
      const attrs = mesh.geometry.attributes;
      attrs.zone.setX(i, s.zone ?? 0);
      attrs.parcel.setX(i, idIndex(parcelIds, s.parcel));
      attrs.district.setX(i, idIndex(districtIds, s.district));
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      const attrs = mesh.geometry.attributes;
      attrs.zone.needsUpdate = true;
      attrs.parcel.needsUpdate = true;
      attrs.district.needsUpdate = true;
      // The bounds grow with the wall; stale ones cull a building that is there.
      mesh.computeBoundingSphere();
    }
  }
  update(shells);
  return {
    group,
    meshes,
    capacity,
    parcelIds,
    districtIds,
    update,
    // The pools a frame actually draws: a count of zero costs nothing.
    draws: () => meshes.filter((m) => m.count > 0).length,
  };
}
