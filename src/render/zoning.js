// Growth on the district's empty lots (sim/zoning.js). A parcel is a fenced site,
// then a shell rising under a tower crane, then a finished building. All of it
// is a unit box instanced at any size, so a stage change is a matrix write and
// the whole programme costs a fixed handful of draws, whatever it is doing:
//
//   shells    one InstancedMesh per architecture, wearing the shipped tower
//             materials — a grown building is made of the same city as its
//             neighbours, and it goes dark in a blackout with them (VGA-007):
//             each instance carries its lot's power zone. Two meshes; a mesh
//             with nothing standing costs zero.
//   site kit  one InstancedMesh with per-instance colour: hoarding, crane,
//             netting, plinth, parapet, plant.
import * as THREE from 'three';
import { STAGE, builtHeight } from '../sim/zoning.js';

// towerMaterials() in block.js: kinds 0 and 1 are curtain glass, 2 is concrete.
// Offices go up in glass; homes and workshops in concrete.
const GLASS = 0;
const CONCRETE = 2;
const ARCHITECTURE = { com: GLASS, res: CONCRETE, ind: CONCRETE };
// Per-building tint over the shared material, so what grew reads as new against
// the grey concrete it stands in front of: homes in warm stone, sheds cooler.
const TINT = { com: [1, 1, 1], res: [1.16, 1.02, 0.86], ind: [0.86, 0.9, 0.96] };

// The shell stands this far inside the hoarding line on every side.
const SETBACK = 1.2;
const HOARDING_HEIGHT = 2.4;
const HOARDING_THICK = 0.12;
const PAD_RISE = 0.5;          // gravel over the lot, above the verge swell (<= 0.45)
const NETTING_BAND = 4.5;      // the working floors wrapped while a shell climbs

// A tower crane climbs inside the core, its jib a storey or two above the
// working floor. That keeps it low enough to read from the pavement, which
// means it stands below most of its neighbours — so, like a real city crane, it
// is zoned: it slews only through the widest arc where jib and counter-jib clear
// every tower, silhouette and other lot. Found once at boot, never re-checked.
const MAST = 1.6;
const JIB = 18;
const COUNTER_JIB = 6;
const JIB_DEPTH = 1.1;
const JIB_CLEAR = 0.9;         // half the jib's width plus a margin
const WORK_CLEAR = 6;          // mast top above the working floor
const MAST_MIN = 12;
const TROLLEY_AT = 0.6;        // how far out the hook hangs, as a share of the jib
const HEADINGS = 72;           // headings tested around the mast
// The jib slews with the work: one full swing per stage of progress, and it only
// moves while progress moves. A blackout freezes the site, so it freezes the jib.
const SWING_MAX = 0.9;

const PAINT = {
  hoarding: 0x8f8c84, pad: 0x4d4a45, skip: 0xa8791e, plinth: 0x2a2d33,
  parapet: 0x1b1f27, plant: 0x3a3f47, netting: 0x8a9688,
  crane: 0xc49a2c, ballast: 0x6c6b66, cab: 0xd6d4cc, cable: 0x1a1a1a,
};
const KIT_PER_PARCEL = 17;

function unitBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);      // base on the ground, so scale.y is height
  return g;
}

// Whether the whole boom — counter-jib behind the mast, jib ahead — clears
// every rect when it points along `yaw`.
function boomClears(p, yaw, rects) {
  const dx = Math.cos(yaw);
  const dz = -Math.sin(yaw);
  for (let along = -COUNTER_JIB; along <= JIB; along += 0.5) {
    const x = p.x + dx * along;
    const z = p.z + dz * along;
    for (const r of rects) {
      if (r !== p && Math.abs(x - r.x) < r.w / 2 + JIB_CLEAR && Math.abs(z - r.z) < r.d / 2 + JIB_CLEAR) return false;
    }
  }
  return true;
}

// The crane's zoning: the middle of the longest run of clear headings, and how
// far either side of it the jib may slew.
function slewZone(p, rects) {
  const clear = Array.from({ length: HEADINGS }, (_, k) => boomClears(p, (k / HEADINGS) * Math.PI * 2, rects));
  let best = { from: 0, run: 0 };
  for (let from = 0; from < HEADINGS; from++) {
    let run = 0;
    while (run < HEADINGS && clear[(from + run) % HEADINGS]) run++;
    if (run > best.run) best = { from, run };
  }
  const step = (Math.PI * 2) / HEADINGS;
  // A run of n clear headings spans n - 1 steps between its end samples.
  const half = (Math.max(1, best.run) - 1) * step / 2;
  return { rest: best.from * step + half, swing: Math.min(SWING_MAX, half) };
}

const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scale = new THREE.Vector3();
const matrix = new THREE.Matrix4();
const paint = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

// One box of the kit, `along` metres out from (x, z) on heading `yaw`.
function kitBox(rig, hex, x, y, z, sx, sy, sz, yaw = 0, along = 0) {
  const i = rig.kitCount++;
  pos.set(x + Math.cos(yaw) * along, y, z - Math.sin(yaw) * along);
  quat.setFromAxisAngle(UP, yaw);
  scale.set(sx, sy, sz);
  rig.kit.setMatrixAt(i, matrix.compose(pos, quat, scale));
  rig.kit.setColorAt(i, paint.setHex(hex));
}

function fenceLot(rig, p) {
  const y = 0;
  kitBox(rig, PAINT.hoarding, p.x, y, p.z - p.d / 2, p.w, HOARDING_HEIGHT, HOARDING_THICK);
  kitBox(rig, PAINT.hoarding, p.x, y, p.z + p.d / 2, p.w, HOARDING_HEIGHT, HOARDING_THICK);
  kitBox(rig, PAINT.hoarding, p.x - p.w / 2, y, p.z, HOARDING_THICK, HOARDING_HEIGHT, p.d);
  kitBox(rig, PAINT.hoarding, p.x + p.w / 2, y, p.z, HOARDING_THICK, HOARDING_HEIGHT, p.d);
  kitBox(rig, PAINT.pad, p.x, y, p.z, p.w - 0.2, PAD_RISE, p.d - 0.2);
}

function raiseCrane(rig, p, i, h) {
  const mastTop = Math.max(h + WORK_CLEAR, MAST_MIN);
  const zone = rig.slew[i];
  const yaw = zone.rest + zone.swing * Math.sin((p.stage + p.progress) * Math.PI * 2);
  const hookY = h + 3;
  const jibY = mastTop - JIB_DEPTH;
  kitBox(rig, PAINT.crane, p.x, 0, p.z, MAST, mastTop, MAST);
  kitBox(rig, PAINT.crane, p.x, mastTop, p.z, 0.9, 4.5, 0.9);
  kitBox(rig, PAINT.crane, p.x, jibY, p.z, JIB + COUNTER_JIB, JIB_DEPTH, 1, yaw, (JIB - COUNTER_JIB) / 2);
  kitBox(rig, PAINT.ballast, p.x, jibY - 1.8, p.z, 2.2, 1.8, 1.8, yaw, -COUNTER_JIB + 1.2);
  kitBox(rig, PAINT.cab, p.x, jibY - 1.6, p.z, 1.6, 1.5, 1.6, yaw, 1.6);
  kitBox(rig, PAINT.cable, p.x, hookY, p.z, 0.07, jibY - hookY, 0.07, yaw, JIB * TROLLEY_AT);
  kitBox(rig, PAINT.cable, p.x, hookY - 0.6, p.z, 0.6, 0.6, 0.6, yaw, JIB * TROLLEY_AT);
}

function dressParcel(rig, p, i) {
  const h = builtHeight(p);
  const sw = p.w - SETBACK * 2;
  const sd = p.d - SETBACK * 2;
  if (p.stage === STAGE.EMPTY || p.building) fenceLot(rig, p);
  if (p.stage === STAGE.EMPTY) kitBox(rig, PAINT.skip, p.x + p.w / 4, 0, p.z, 3, 1.3, 1.7, 0.2);
  if (h > 0.05) {
    const shells = rig.shells[ARCHITECTURE[p.use]];
    pos.set(p.x, 0, p.z);
    scale.set(sw, h, sd);
    shells.setMatrixAt(shells.count, matrix.compose(pos, quat.identity(), scale));
    shells.geometry.attributes.zone.setX(shells.count, p.powerZone);
    shells.setColorAt(shells.count++, paint.setRGB(...TINT[p.use]));
    kitBox(rig, PAINT.plinth, p.x, 0, p.z, sw + 0.16, PAD_RISE + 0.12, sd + 0.16);
    kitBox(rig, PAINT.parapet, p.x, h, p.z, sw + 0.4, 0.5, sd + 0.4);
  }
  if (h > 0.05 && !p.building) kitBox(rig, PAINT.plant, p.x - sw * 0.2, h + 0.5, p.z, 2.2, 1.4, 1.8);
  if (p.building) {
    const net = Math.min(h, NETTING_BAND);
    kitBox(rig, PAINT.netting, p.x, h - net, p.z, sw + 0.5, net + 0.8, sd + 0.5);
    raiseCrane(rig, p, i, h);
  }
}

export function buildZoning(city, kinds, footprints) {
  const group = new THREE.Group();
  const geo = unitBox();
  const n = city.parcels.length;
  const shells = {};
  for (const kind of new Set(Object.values(ARCHITECTURE))) {
    // Its own box, because the zone rides on the geometry, one per instance.
    const shellGeo = unitBox();
    shellGeo.setAttribute('zone', new THREE.InstancedBufferAttribute(new Float32Array(n), 1));
    const m = new THREE.InstancedMesh(shellGeo, kinds[kind], n);
    // Colour from the first frame, or the program compiles without it.
    m.setColorAt(0, paint.setRGB(1, 1, 1));
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    shells[kind] = m;
  }
  const kit = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.82, metalness: 0.12, envMapIntensity: 0.5,
  }), n * KIT_PER_PARCEL);
  kit.castShadow = true;
  kit.receiveShadow = true;
  group.add(kit);
  const rects = [...footprints, ...city.parcels];
  const slew = city.parcels.map((p) => slewZone(p, rects));
  const rig = { shells, kit, kitCount: 0, slew };
  const meshes = [kit, ...Object.values(shells)];
  // Rewritten every frame: the sim moves a parcel a little every tick, and a
  // few dozen matrices cost less than tracking which of them changed.
  function update() {
    rig.kitCount = 0;
    for (const m of meshes) m.count = 0;
    city.parcels.forEach((p, i) => dressParcel(rig, p, i));
    kit.count = rig.kitCount;
    for (const m of meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      if (m.geometry.attributes.zone) m.geometry.attributes.zone.needsUpdate = true;
      // The bounds grow with the buildings; stale ones cull a tower that is there.
      m.computeBoundingSphere();
    }
  }
  update();
  return { group, update };
}
