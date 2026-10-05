// Building pieces pooled (M3.T22 rows, M3.T23 towers and caps, M3.T24 podiums
// and shop glass, M3-5). A shaft, a podium slab, a pilaster or a shop pane was
// merged geometry in render/block.js: permanent, and a rebuild a load-time
// hitch exactly when a building changes. Now every piece is one slot in a
// per-architecture InstancedMesh — the render/zoning.js pattern, at city scale
// — so the wall costs one fixed pool per architecture whatever the map does,
// and no merged building path is left (law 6). Each slot carries the parcel it
// stands on and its district (float indexes into the pools' id tables) and the
// blackout's power zone. ZONING.md's no-instancing line is superseded by M3.
// The facade pools wear the tower facade materials; their instanced UV rescale
// (materials.js) reads the instance matrix columns, so a unit shell tiles the
// same FACADE_TILE window grid the merged towers baked in.
import * as THREE from 'three';

const SHELL_SLACK = 64; // headroom for a re-planned frontage (M3.T20)
const NO_ID = -1; // the hand preset's buildings are not map parcels
function unitShell() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0); // base on the ground: scale.y is the height
  return g;
}

// The float a slot stores for an id, adding it to the pool's table the first
// time it appears (an op can name a parcel the first wall never drew). The
// table stays an array for the pick; `seen` is the same key's slot in it, so
// rewriting a wall of thousands of slots is O(slots), not O(slots x ids).
function idIndex(ids, seen, id) {
  if (id == null) return NO_ID;
  let i = seen.get(id);
  if (i === undefined) {
    i = ids.length;
    ids.push(id);
    seen.set(id, i);
  }
  return i;
}

// One fixed pool per architecture material, filled from parcel-keyed slots.
// `slots` is what to draw now: { x, y, z, w, h, d, kind, zone, parcel,
// district }; `y` is the slot's base (0 for a shaft, the shaft height for its
// crown, a part's own foot for a podium piece). `extra` names per-instance
// attributes a slot also carries (a shop pane's atlas cell); `kind` indexes
// `materials`. A slot past capacity is dropped, not grown: the pool's size is
// fixed at build (M3.T27 reclaims the tiles).
export function buildInstancePools(materials, slots, {
  slack = SHELL_SLACK, extra = [], castShadow = true, receiveShadow = true,
} = {}) {
  const group = new THREE.Group();
  const meshes = [];
  const capacity = new Map();
  const byKind = new Map();
  const parcelIds = [];
  const districtIds = [];
  const parcelSlot = new Map();
  const districtSlot = new Map();
  const counts = new Map();
  for (const s of slots) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  for (const [kind, n] of counts) {
    const geo = unitShell();
    geo.setAttribute('zone', new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    geo.setAttribute('parcel', new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    geo.setAttribute('district', new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    for (const name of extra) {
      geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(n + slack), 1));
    }
    const mesh = new THREE.InstancedMesh(geo, materials[kind], n + slack);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
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

  // Rewrite the wall the map now carries.
  function update(list = slots) {
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
      attrs.parcel.setX(i, idIndex(parcelIds, parcelSlot, s.parcel));
      attrs.district.setX(i, idIndex(districtIds, districtSlot, s.district));
      for (const name of extra) attrs[name].setX(i, s[name] ?? 0);
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true;
      const attrs = mesh.geometry.attributes;
      attrs.zone.needsUpdate = true;
      attrs.parcel.needsUpdate = true;
      attrs.district.needsUpdate = true;
      for (const name of extra) attrs[name].needsUpdate = true;
      // The bounds grow with the wall; stale ones cull a building that is there.
      mesh.computeBoundingSphere();
    }
  }
  update(slots);
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

// The building shells: one pool per architecture (M3.T22/T23).
export function buildShellPools(materials, shells, slack = SHELL_SLACK) {
  return buildInstancePools(materials, shells, { slack });
}
