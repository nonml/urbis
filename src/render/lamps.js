// Street lighting: the street_lamp_01 model on the kerb, instanced through the
// model pool, plus the light shaft and glare that make a lit street. Every
// district on the map runs its own power (blackout hack), and a lantern, its
// glare and its shaft are dimmed by the district they stand in (materials.js
// districtOf) — one material set for the whole city, not one per district, so
// a town cut into sixteen districts costs no more to draw than one cut in two.
//
// A road the player lays replans the map's furniture (M5.T4b), and rebuild()
// re-seats every pool from the new plan: the lamps, cones, glows and signals of
// a street laid after the world was born are drawn like the ones it was born
// with. One mesh per material at any count, never a mesh per lamp (law 4).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blink } from '../sim/street.js';
import { worldMap } from '../sim/patrol.js';
import { WORLD_FURNITURE } from '../sim/furniture.js';
import { signalGreen, signalHeads } from '../sim/traffic.js';
import { loadModelPool } from './models.js';
import { MAX_DISTRICTS, districtOf, getGlowTex, zoneLit } from './materials.js';

// Which street a fixture belongs to comes from the map's district; how it
// stands on that street is this file's business.
// Explicit per-lamp placement: pole base (x,z), head offset toward the road,
// instance yaw. Main + east avenues share the z rhythm. The district itself is
// read off the map where the pole stands, never written into the table.
const POLE_X = 5.4;
const ARM = 1.8;
// A crossing's footway is narrower, so its poles stand closer to the kerb. The
// arm is the same length; both offsets are measured off the way's centre-line.
const CROSS_POLE_OUT = 4.2;
const CROSS_HEAD_OUT = 2.4;
// The hand preset's table: the map's district carries the avenues and crossings
// the fixtures are keyed to, in declaration order — a generated district places
// its lamps in its own plan (map.furniture) and never reads this.
function handLamps(district) {
  const [MAIN_X, EAST_X, WEST_X] = district.avenues.map((a) => a.x);
  const PLAZA_Z = district.crossings[0].z;
  const SOUTH_Z = district.crossings[district.crossings.length - 1].z;
  return [
    ...[-45, -27, -9, 9, 27, 45].flatMap((z, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return [MAIN_X, EAST_X].map((ax) => ({
        x: ax + side * POLE_X,
        z,
        hx: ax + side * (POLE_X - ARM),
        hz: z,
        rotY: side > 0 ? 0 : Math.PI,
      }));
    }),
    ...[-2, 12, 26, 40].map((x) => ({
      x,
      z: SOUTH_Z - CROSS_POLE_OUT,
      hx: x,
      hz: SOUTH_Z - CROSS_HEAD_OUT,
      rotY: Math.PI / 2,
    })),
    { x: -8, z: -28.5, hx: -9.8, hz: -28.5, rotY: 0 },
    { x: -24, z: -35.5, hx: -22.2, hz: -35.5, rotY: Math.PI },
    // West avenue (sparser rhythm — different mood, fewer fixtures)
    ...[-27, -9, 9, 27].flatMap((z, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return [{
        x: WEST_X + side * POLE_X, z,
        hx: WEST_X + side * (POLE_X - ARM), hz: z,
        rotY: side > 0 ? 0 : Math.PI,
      }];
    }),
    // North extension + cross street. The two on main keep their written head
    // offset rather than POLE_X - ARM, which is the same 3.6 m one ulp away.
    { x: MAIN_X + POLE_X, z: 63, hx: MAIN_X + 3.6, hz: 63, rotY: 0 },
    { x: MAIN_X - POLE_X, z: 81, hx: MAIN_X - 3.6, hz: 81, rotY: Math.PI },
    {
      x: -20,
      z: PLAZA_Z - CROSS_POLE_OUT,
      hx: -20,
      hz: PLAZA_Z - CROSS_HEAD_OUT,
      rotY: Math.PI / 2,
    },
    {
      x: 20,
      z: PLAZA_Z + CROSS_POLE_OUT,
      hx: 20,
      hz: PLAZA_Z + CROSS_HEAD_OUT,
      rotY: -Math.PI / 2,
    },
  ];
}
// The Poly Haven post-top lantern is 3.87 m; the glow, shaft and light pool
// hang off its glass at ~3.35 m. Kept at 1:1 scale — a bigger street lamp is a
// different lamp, and this one is real.
const LAMP_MODEL = 'assets/models/street_lamp_01/street_lamp_01_1k.gltf';
const LANTERN_Y = 3.35;
const LANTERN_EMIT = new THREE.Color(0xffd9a0);
const GLOW_COLOR = 0xffc98a;
const GLOW_SIZE = 3.2;
const GLOW_OPACITY = 0.38;
// The shaft's falloff, top to bottom: bright under the lantern, gone at the
// road. Percentages are the canvas gradient's own stops.
const SHAFT_STOPS = [[0, 0x90], [0.55, 0x40], [1, 0x00]];

// Signals (M3.T31): a two-lamp head on every junction approach, built from the
// sim's own placements so lights and the stopping rule cannot drift apart. Two
// instanced draws for the whole city — pole+arm+housing, then the lenses, whose
// instanceColor carries red/green.
const SIGNAL_Y = 5.6;
const SIGNAL_ARM = 1.7;
const SIGNAL_LENS_Z = 0.21;
const LENS_RED = new THREE.Color(0xff3a26);
const LENS_GREEN = new THREE.Color(0x2fd257);
const LENS_RED_OFF = new THREE.Color(0x2a0f0b);
const LENS_GREEN_OFF = new THREE.Color(0x0b1a0d);

// Headroom in every pooled InstancedMesh, so the handful of lamps a drag adds
// are seated in the pool the frame already has; a plan that outgrows its pool
// asks for a wider one, still one mesh per material at any count (law 4).
const POOL_SLACK = 64;

// One instanced quad per glow instead of one Sprite each (law 4): the vertex patch
// offsets the corners in view space, so the quad faces the camera and keeps the
// instance's depth exactly like the sprite it replaces. Per-lamp brightness rides on
// instanceColor — additive blending makes scaling the colour and scaling the alpha
// the same multiplication, so blackout dimming reads identically.
// A transparent double-sided material draws twice, back faces then front, unless it
// is forced into one pass. A view-space billboard only ever shows its front, and
// additive light does not care which face lands first: one pass, same pixels.
function glowMaterial() {
  const mat = new THREE.MeshBasicMaterial({
    map: getGlowTex(), color: GLOW_COLOR, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', [
      'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );',
      'mvPosition.xy += transformed.xy; // billboard',
      'gl_Position = projectionMatrix * mvPosition;',
    ].join('\n'));
    if (!sh.vertexShader.includes('billboard')) console.error('[lampglow] patch missed');
  };
  mat.customProgramCacheKey = () => 'lamp-glow-billboard';
  return mat;
}

// A lens sits on the housing's front face, offset from the head's own pole in
// the head's local frame: +x toward the road, +z at oncoming traffic.
function setLens(mesh, dummy, idx, head, y) {
  const c = Math.cos(head.yaw);
  const s = Math.sin(head.yaw);
  dummy.position.set(
    head.x + SIGNAL_ARM * c + SIGNAL_LENS_Z * s,
    y,
    head.z - SIGNAL_ARM * s + SIGNAL_LENS_Z * c,
  );
  dummy.rotation.set(0, head.yaw, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  mesh.setMatrixAt(idx, dummy.matrix);
}

// What the M2-5 check reads: the kit the renderer actually instanced. The
// model pool resolves a frame or two after boot, so the test waits on these
// counts instead of guessing. Render-only; the sim never sees it.
export function reportKit(fields) {
  if (typeof window === 'undefined') return;
  const kit = window.__streetKit ?? { models: [] };
  window.__streetKit = {
    ...kit,
    ...fields,
    models: [...kit.models, ...(fields.models ?? []).filter((m) => !kit.models.includes(m))],
  };
}

// The shaft's fade as texels: the stops the canvas gradient this replaces ran
// from top to bottom, over the texture's own 128 rows. An alphaMap needs one
// channel, so a 2 kB buffer paints it instead of a document.
function shaftTexels() {
  const W = 4;
  const H = 128;
  const data = new Uint8Array(W * H * 4);
  const greyAt = (t) => {
    for (let i = 1; i < SHAFT_STOPS.length; i += 1) {
      const [t1, v1] = SHAFT_STOPS[i];
      if (t > t1) continue;
      const [t0, v0] = SHAFT_STOPS[i - 1];
      return Math.round(v0 + ((v1 - v0) * (t - t0)) / (t1 - t0));
    }
    return SHAFT_STOPS[SHAFT_STOPS.length - 1][1];
  };
  for (let row = 0; row < H; row += 1) {
    const g = greyAt(row / H);
    for (let col = 0; col < W; col += 1) {
      const o = (row * W + col) * 4;
      data[o] = data[o + 1] = data[o + 2] = g;
      data[o + 3] = 255;
    }
  }
  return data;
}

export function buildLamps(map = worldMap()) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  const glowLevel = new THREE.Color();

  // Shafts fade head-to-ground via a gradient alphaMap: light falloff, not a
  // solid pyramid. Same instanced mesh, +1 draw (VGA-082 partial). Static across
  // rebuilds, so a road op never re-makes a texture or a buffer. The fade is
  // data — 4 x 128 grey texels the shader reads exactly as it read the canvas.
  const shaftTex = new THREE.DataTexture(shaftTexels(), 4, 128, THREE.RGBAFormat);
  const coneGeo = new THREE.ConeGeometry(1.5, LANTERN_Y, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a, transparent: true, opacity: 0.05, alphaMap: shaftTex,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    forceSinglePass: true,     // both faces of the shaft add light, in either order: see glowMaterial
  });
  const glowGeo = new THREE.PlaneGeometry(GLOW_SIZE, GLOW_SIZE);
  const glowMat = glowMaterial();
  const sigParts = [
    new THREE.CylinderGeometry(0.08, 0.11, SIGNAL_Y, 6),
    new THREE.BoxGeometry(SIGNAL_ARM, 0.09, 0.09),
    new THREE.BoxGeometry(0.4, 0.95, 0.28),
  ];
  sigParts[0].translate(0, SIGNAL_Y / 2, 0);
  sigParts[1].translate(SIGNAL_ARM / 2, SIGNAL_Y, 0);
  sigParts[2].translate(SIGNAL_ARM, SIGNAL_Y - 0.55, 0.06);
  const sigGeo = mergeGeometries(sigParts);
  const sigMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.4, metalness: 0.7 });
  const lensGeo = new THREE.CircleGeometry(0.12, 10);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });

  // What is drawn from the current plan. The plan, the heads and the light
  // pools are mutated in place on rebuild, so every handle scene.js took at
  // boot (fadedDraws' cones, the pools, the fireHack spark heads) stays live.
  const rig = {
    lamps: [],
    heads: [],
    // One light pool per district that has lamps, at the district's index: a
    // blackout dims a district's own pools and no other's.
    poolsByZone: [],
    cones: null,
    glows: null,
    signals: [],
    sigs: null,
    lenses: null,
  };
  const zoneLight = Array.from({ length: MAX_DISTRICTS }, () => 1);
  let nightF = 1;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();

  // One lantern model pool for the whole city, with its headroom: the slot list
  // is every slot currently seated, so a rebuild gives them back and seats the
  // new plan. Only a plan wider than the pool loads a wider model. The district
  // a seated lamp stands in rides on the instance, so the glass and the bulb of
  // this one pool are dimmed per district by the 16-entry uniforms materials.js
  // wears — a city's second, third or sixteenth district costs what its first did.
  const lanterns = { pool: null, slots: [], group: null, lit: [] };
  let poolBusy = 0;
  let poolAgain = false;

  // The pool's lit parts (its glass and its bulb) carry the district per
  // instance and wear the per-district uniforms; the pole and the housing never
  // light, so they carry nothing.
  function adoptLitParts(pool) {
    lanterns.lit.length = 0;
    for (const mesh of pool.meshes) {
      if (!/glass|bulb/i.test(mesh.material.name ?? '')) continue;
      mesh.geometry.setAttribute('zone', new THREE.InstancedBufferAttribute(
        new Float32Array(pool.capacity), 1,
      ).setUsage(THREE.DynamicDrawUsage));
      lanterns.lit.push({
        attr: mesh.geometry.attributes.zone, mat: zoneLit(mesh.material, 'lantern'),
      });
    }
  }

  function seatLanterns() {
    const { pool } = lanterns;
    if (!pool) return;
    for (const i of lanterns.slots) pool.free(i);
    lanterns.slots.length = 0;
    for (const l of rig.lamps) {
      const i = pool.claim();
      if (i < 0) break;         // a wider pool is already on its way
      dummy.position.set(l.x, 0, l.z);
      dummy.rotation.set(0, l.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pool.set(i, dummy.matrix);
      for (const part of lanterns.lit) part.attr.setX(i, l.zone);
      lanterns.slots.push(i);
    }
    for (const part of lanterns.lit) part.attr.needsUpdate = true;
  }

  // Seat the plan's lamps in the pool the frame already draws, loading a wider
  // pool only when a plan has outgrown the one it has. One pool per model, so a
  // plan of any size or any district count adds no mesh (law 4).
  function syncLanterns() {
    if (poolBusy > 0) { poolAgain = true; return; }
    if (lanterns.pool && lanterns.pool.capacity >= rig.lamps.length) {
      seatLanterns();
      return;
    }
    poolBusy += 1;
    loadModelPool(LAMP_MODEL, rig.lamps.length + POOL_SLACK)
      .then((pool) => {
        if (lanterns.group) {
          group.remove(lanterns.group);
          for (const m of lanterns.group.children) {
            m.geometry.dispose();
            m.material.dispose();
            m.dispose();
          }
          lanterns.lit.length = 0;
        }
        lanterns.pool = pool;
        lanterns.slots = [];
        lanterns.group = pool.group;
        adoptLitParts(pool);
        group.add(pool.group);
      }).catch(() => {}).finally(() => {
      poolBusy -= 1;
      if (poolBusy > 0) return;
      if (poolAgain) { poolAgain = false; syncLanterns(); return; }
      seatLanterns();
      reportKit({ lamps: rig.lamps.length, models: ['street_lamp_01'] });
    });
  }

  function buildCones() {
    const n = rig.lamps.length;
    if (!rig.cones || rig.cones.instanceMatrix.count < n) {
      const capacity = Math.max(n, 1) + POOL_SLACK;
      if (rig.cones) { group.remove(rig.cones, rig.glows); rig.cones.dispose(); rig.glows.dispose(); }
      rig.cones = new THREE.InstancedMesh(coneGeo, coneMat, capacity);
      rig.glows = new THREE.InstancedMesh(glowGeo, glowMat, capacity);
      group.add(rig.cones, rig.glows);
    }
    const { cones, glows } = rig;
    cones.count = n;
    glows.count = n;
    rig.lamps.forEach((l, i) => {
      dummy.position.set(l.x, LANTERN_Y, l.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      glows.setMatrixAt(i, dummy.matrix);
      glows.setColorAt(i, glowLevel.setScalar(GLOW_OPACITY));
      dummy.position.set(l.x, LANTERN_Y / 2, l.z);
      dummy.updateMatrix();
      cones.setMatrixAt(i, dummy.matrix);
    });
    cones.instanceMatrix.needsUpdate = true;
    glows.instanceMatrix.needsUpdate = true;
    if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
  }

  // The signal pool: one head per junction approach from the sim's placement,
  // the housing facing the traffic that must stop for it. A road op that makes
  // a junction adds them; the pool grows to hold what the new graph asks.
  function buildSignals(nextMap) {
    rig.signals = signalHeads(nextMap);
    const n = rig.signals.length;
    if (!rig.sigs || rig.sigs.instanceMatrix.count < n || rig.lenses.instanceMatrix.count < n * 2) {
      const capacity = Math.max(n, 1) + POOL_SLACK;
      if (rig.sigs) { group.remove(rig.sigs, rig.lenses); rig.sigs.dispose(); rig.lenses.dispose(); }
      rig.sigs = new THREE.InstancedMesh(sigGeo, sigMat, capacity);
      rig.lenses = new THREE.InstancedMesh(lensGeo, lensMat, capacity * 2);
      group.add(rig.sigs, rig.lenses);
    }
    const { sigs, lenses } = rig;
    sigs.count = n;
    lenses.count = n * 2;
    rig.signals.forEach((h, i) => {
      dummy.position.set(h.x, 0, h.z);
      dummy.rotation.set(0, h.yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sigs.setMatrixAt(i, dummy.matrix);
      setLens(lenses, dummy, i * 2, h, SIGNAL_Y - 0.32);
      setLens(lenses, dummy, i * 2 + 1, h, SIGNAL_Y - 0.78);
      lenses.setColorAt(i * 2, LENS_RED_OFF);
      lenses.setColorAt(i * 2 + 1, LENS_GREEN_OFF);
    });
    sigs.instanceMatrix.needsUpdate = true;
    lenses.instanceMatrix.needsUpdate = true;
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
  }

  // Redraw every pool from the plan a road op just wrote (M5.T4b): the district
  // plan plus the lamps, boxes and junctions of every edge the player laid
  // (sim/furniture.js). Boot calls it once; main calls it whenever the map's
  // furniture is replanned.
  //
  // Each lamp is copied with the district it stands in, so the plan the map
  // holds is never written to and a rebuild re-derives where every pole stands
  // from the map's own districts.
  function rebuild(nextMap = worldMap()) {
    const plan = (nextMap.furniture ?? WORLD_FURNITURE)?.lamps ?? handLamps(nextMap.district);
    rig.lamps = plan.map((l) => ({ ...l, zone: districtOf(nextMap, l.x, l.z) }));
    rig.heads.length = 0;
    rig.poolsByZone.length = 0;
    for (const l of rig.lamps) {
      rig.heads.push(new THREE.Vector3(l.x, LANTERN_Y, l.z));
      (rig.poolsByZone[l.zone] ??= []).push({ x: l.x, z: l.z, size: 11, color: '#b97c3a' });
    }
    buildCones();
    buildSignals(nextMap);
    syncLanterns();
  }

  // Per-district brightness: mid-phase districts sputter per lamp (seeded
  // blink). A district id past the uniforms is held at the last slot, the same
  // way districtOf holds a fixture that stands past it.
  function setZoneLight(zone, v) {
    zoneLight[Math.min(zone, zoneLight.length - 1)] = v;
  }
  function tick(time) {
    const { lamps, cones, glows, signals, lenses } = rig;
    lamps.forEach((l, i) => {
      const v = zoneLight[l.zone];
      const b = v >= 1 ? 1 : v <= 0 ? 0 : blink(time, i * 1.7 + l.zone);
      if (b <= 0.02) {
        cones.setMatrixAt(i, zero);
      } else {
        const s = 0.25 + 0.75 * b;
        v3.set(l.x, (LANTERN_Y / 2) * b, l.z);
        s3.set(s, Math.max(b, 0.02), s);
        m4.compose(v3, q0, s3);
        cones.setMatrixAt(i, m4);
      }
      glows.setColorAt(i, glowLevel.setScalar(b > 0.02 ? GLOW_OPACITY * nightF * b : 0));
    });
    // The lantern glass and bulb carry the light: daylight dulls them, a
    // blackout puts them out for their own district only.
    for (let zone = 0; zone < zoneLight.length; zone += 1) {
      const b = zoneLight[zone] >= 1 ? 1 : zoneLight[zone] <= 0 ? 0 : blink(time, zone * 3.7);
      const lit = (0.15 + 0.85 * nightF) * b;
      for (const { mat } of lanterns.lit) mat.userData.zoneEmissive.value[zone] = 1.5 * lit;
    }
    signals.forEach((h, i) => {
      const green = signalGreen(h.axis, time);
      lenses.setColorAt(i * 2, green ? LENS_RED_OFF : LENS_RED);
      lenses.setColorAt(i * 2 + 1, green ? LENS_GREEN : LENS_GREEN_OFF);
    });
    cones.instanceMatrix.needsUpdate = true;
    if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
  }

  // Daylight: lantern glass goes dull, cones and glows fade with the night.
  function setDaylight(n) {
    nightF = n;
    coneMat.opacity = 0.03 * n;
  }

  // The number of lamp instances the current plan draws: the M5.T4b check reads
  // it before and after a drag, so "the street is lit" is a measured number.
  function drawn() {
    return rig.lamps.length;
  }

  rebuild(map);
  return {
    group,
    // The plan as it was seated: each lamp with the district it stands in.
    lamps: rig.lamps,
    heads: rig.heads,
    poolsByZone: rig.poolsByZone,
    get cones() { return rig.cones; },
    get glows() { return rig.glows; },
    setZoneLight,
    setDaylight,
    tick,
    rebuild,
    drawn,
  };
}
