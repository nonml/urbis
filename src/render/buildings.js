// Building pieces pooled (M3.T22 rows, M3.T23 towers and caps, M3.T24 podiums
// and shop glass, M3.T25 posters and roof trim, M3-5). A shaft, a podium slab,
// a pilaster, a shop pane, a parapet or a bill was merged geometry in
// render/block.js: permanent, and a rebuild a load-time hitch exactly when a
// building changes. Now every piece is one slot in a
// per-architecture InstancedMesh — the render/zoning.js pattern, at city scale
// — so the wall costs one fixed pool per architecture whatever the map does,
// and no merged building path is left (law 6). Each slot carries the parcel it
// stands on and its district (float indexes into the pools' id tables) and the
// blackout's power zone. ZONING.md's no-instancing line is superseded by M3.
// The facade pools wear the tower facade materials; their instanced UV rescale
// (materials.js) reads the instance matrix columns, so a unit shell tiles the
// same FACADE_TILE window grid the merged towers baked in.
import * as THREE from 'three';
import { loadModelPool } from './models.js';

const SHELL_SLACK = 64; // headroom for a re-planned frontage (M3.T20)
const NO_ID = -1; // the hand preset's buildings are not map parcels
function unitShell() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0); // base on the ground: scale.y is the height
  return g;
}

// The unit pieces a pool instances: a shell sitting on its base, a centred box
// (a tilted cap bracket pivots about its middle) and a poster plane.
const SHAPES = {
  shell: unitShell,
  box: () => new THREE.BoxGeometry(1, 1, 1),
  plane: () => new THREE.PlaneGeometry(1, 1),
};

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
// crown, a part's own foot for a podium piece) or its centre on a centred
// shape. A rotation is optional per slot (`rx`, `ry`, `rz`, radians, XYZ
// order). `extra` names per-instance attributes a slot also carries (a shop
// pane's atlas cell); `kind` indexes `materials`; `shape` names the unit piece
// every mesh of the pool instances. A slot past capacity is dropped, not
// grown: the pool's size is fixed at build (M3.T27 reclaims the tiles).
export function buildInstancePools(materials, slots, {
  slack = SHELL_SLACK, extra = [], castShadow = true, receiveShadow = true,
  shape = 'shell',
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
    const geo = SHAPES[shape]();
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
    // The VGA-084 sweep (M2-6) reads this tag to tell a building model from
    // a raw box: every shell and kit part carries it, like the pool loader's.
    mesh.userData.model = `building-${shape}`;
    mesh.count = 0;
    byKind.set(kind, mesh);
    capacity.set(kind, n + slack);
    meshes.push(mesh);
    group.add(mesh);
  }
  const at = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
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
      size.set(s.w, s.h, s.d ?? 1);
      const turn = s.rx || s.ry || s.rz
        ? quat.setFromEuler(euler.set(s.rx ?? 0, s.ry ?? 0, s.rz ?? 0))
        : quat.identity();
      mesh.setMatrixAt(i, matrix.compose(at, turn, size));
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

// The building kit (M2.T13): what the merged street wall never built — window
// reveals at least 0.15 m deep on every facade, window frames, shopfronts and
// roof plant — as pooled parts on every building parcel. Three pools (frames,
// shopfronts, plant), one draw each however many buildings stand, keyed to
// their parcel like the shells so a bulldoze frees them with the shaft.
export const REVEAL_DEPTH = 0.18;
export const FACADE_COUNT = 6;
export const KIT_DRAW_BUDGET = 12;
const KIT_SLACK = 64;
const FRAME_W = 1.6;
const FRAME_H = 1.8;
const SHOP_H = 2.6;

// One reveal frame per face per level: the box's wall-normal span is the
// reveal depth, so the glass sits REVEAL_DEPTH inside the brick. Faces are
// 0:+X, 1:-X, 2:+Z, 3:-Z; `reveal` is what the check reads, not the renderer.
function frameSlotsFor(b, districtId) {
  const out = [];
  const levels = b.h > 20 ? 2 : 1;
  for (let face = 0; face < 4; face += 1) {
    const alongX = face < 2;
    for (let l = 0; l < levels; l += 1) {
      const y = Math.min(6 + l * Math.max(6, b.h - 12), b.h - 2);
      out.push({
        x: alongX ? b.x + (face === 0 ? b.w / 2 : -b.w / 2) : b.x,
        y, z: alongX ? b.z : b.z + (face === 2 ? b.d / 2 : -b.d / 2),
        w: alongX ? REVEAL_DEPTH : FRAME_W,
        h: FRAME_H, d: alongX ? FRAME_W : REVEAL_DEPTH,
        kind: 0, zone: b.z < 0 ? 0 : 1, parcel: b.id, district: districtId,
        face, reveal: REVEAL_DEPTH,
      });
    }
  }
  return out;
}

// One shopfront per parcel, on the building's own front face.
function shopSlotFor(b, districtId) {
  const [fx, fz] = Array.isArray(b.face) ? b.face : [-1, 0];
  const alongX = fx !== 0;
  const span = Math.min(6, (alongX ? b.d : b.w) - 1);
  return {
    x: b.x + (alongX ? fx * (b.w / 2 + 0.06) : 0),
    y: 0.5 + SHOP_H / 2, z: b.z + (alongX ? 0 : fz * (b.d / 2 + 0.06)),
    w: alongX ? 0.12 : Math.max(1.2, span), h: SHOP_H,
    d: alongX ? Math.max(1.2, span) : 0.12,
    kind: 0, zone: b.z < 0 ? 0 : 1, parcel: b.id, district: districtId,
  };
}

// Two roof boxes per parcel: the lift overrun and a plant condenser.
function plantSlotsFor(b, districtId) {
  const zone = b.z < 0 ? 0 : 1;
  const tag = { kind: 0, zone, parcel: b.id, district: districtId };
  return [
    { x: b.x - b.w * 0.15, y: b.h + 0.7, z: b.z, w: 2.2, h: 1.4, d: 1.8, ...tag },
    { x: b.x + b.w * 0.22, y: b.h + 0.45, z: b.z + b.d * 0.18, w: 1.2, h: 0.9, d: 1, ...tag },
  ];
}

// Every kit slot of a building list, by pool. Pure, so the check counts parts
// without a texture loader.
export function buildingKitSlots(buildings, districtId = null) {
  const frames = [];
  const shops = [];
  const plants = [];
  for (const b of buildings) {
    frames.push(...frameSlotsFor(b, districtId));
    shops.push(shopSlotFor(b, districtId));
    plants.push(...plantSlotsFor(b, districtId));
  }
  return { frames, shops, plants };
}

// The three kit pools for a building list. `materials` is one array per pool;
// every slot is kind 0, so one draw per pool whatever the map does.
export function buildBuildingKit(materials, buildings, districtId = null) {
  const slots = buildingKitSlots(buildings, districtId);
  const group = new THREE.Group();
  const frame = buildInstancePools(materials.frame, slots.frames, { shape: 'box', slack: KIT_SLACK });
  const shop = buildInstancePools(materials.shop, slots.shops, { shape: 'box', slack: KIT_SLACK });
  const plant = buildInstancePools(materials.plant, slots.plants, { shape: 'box', slack: KIT_SLACK });
  for (const pool of [frame, shop, plant]) group.add(pool.group);
  function update(next = buildings, nextDistrict = districtId) {
    const s = buildingKitSlots(next, nextDistrict);
    frame.update(s.frames);
    shop.update(s.shops);
    plant.update(s.plants);
    return s;
  }
  return {
    group, pools: { frame, shop, plant }, slots, update,
    draws: () => frame.draws() + shop.draws() + plant.draws(),
  };
}

// The six service buildings (M5.T10), one pool per kind through the M2 pool
// loader (models.js): each model's meshes are merged by material, so one
// placed kind costs its material count in draws however many stand — and a
// kind with nothing placed costs zero. `front +Z` is the model's own facing;
// `yaw` turns it, so the sim (M5.T11) faces a service at its avenue. Slots are
// reclaimed and rewritten whole on every `place`, because a service is placed
// or bulldozed one at a time and the list is short.
const UP = new THREE.Vector3(0, 1, 0);
export const SERVICE_KINDS = ['substation', 'police', 'fire', 'clinic', 'school', 'park'];
export const SERVICE_CAPACITY = 8;
export const SERVICE_MODEL = (kind) => `assets/models/service_${kind}/service_${kind}.glb`;

// `services` is [{ kind, x, z, yaw? }]. A slot past capacity is dropped, like
// a buildInstancePools slot: the pools never grow after load.
export async function loadServicePools() {
  const group = new THREE.Group();
  const pools = new Map();
  for (const kind of SERVICE_KINDS) {
    const pool = await loadModelPool(SERVICE_MODEL(kind), SERVICE_CAPACITY);
    pools.set(kind, pool);
    group.add(pool.group);
  }
  const placed = new Map();
  const at = new THREE.Vector3(), turn = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  const matrix = new THREE.Matrix4();
  function place(services = []) {
    for (const [kind, ids] of placed) {
      for (const i of ids) pools.get(kind).free(i);
    }
    placed.clear();
    for (const s of services) {
      const pool = pools.get(s.kind);
      if (!pool) continue;
      const i = pool.claim();
      if (i < 0) continue;
      at.set(s.x, s.y ?? 0, s.z);
      turn.setFromAxisAngle(UP, s.yaw ?? 0);
      pool.set(i, matrix.compose(at, turn, one));
      if (!placed.has(s.kind)) placed.set(s.kind, []);
      placed.get(s.kind).push(i);
    }
  }
  return {
    group, pools, place,
    // One draw per material an occupied pool actually draws.
    draws: () => [...pools.values()].reduce(
      (n, p) => n + p.meshes.filter((m) => m.count > 0).length, 0),
  };
}
