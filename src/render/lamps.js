// Street lighting: the street_lamp_01 model on the kerb, instanced through the
// model pool per zone, plus the light shaft and glare that make a lit street.
// Zones (z<0 / z>=0) can go dark for the blackout hack — one material set per
// zone, so a zone's lanterns and their light die together.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';
import { blink } from '../sim/street.js';
import { worldMap } from '../sim/patrol.js';
import { WORLD_FURNITURE } from '../sim/furniture.js';
import { signalGreen, signalHeads } from '../sim/traffic.js';
import { loadModelPool } from './models.js';

// Which street a fixture belongs to comes from the map's district; how it
// stands on that street is this file's business.
// Explicit per-lamp placement: pole base (x,z), head offset toward the road,
// instance yaw, blackout zone. Main + east avenues share the z rhythm.
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
        zone: z < 0 ? 0 : 1,
      }));
    }),
    ...[-2, 12, 26, 40].map((x) => ({
      x,
      z: SOUTH_Z - CROSS_POLE_OUT,
      hx: x,
      hz: SOUTH_Z - CROSS_HEAD_OUT,
      rotY: Math.PI / 2,
      zone: 0,
    })),
    { x: -8, z: -28.5, hx: -9.8, hz: -28.5, rotY: 0, zone: 0 },
    { x: -24, z: -35.5, hx: -22.2, hz: -35.5, rotY: Math.PI, zone: 0 },
    // West avenue (sparser rhythm — different mood, fewer fixtures)
    ...[-27, -9, 9, 27].flatMap((z, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      return [{
        x: WEST_X + side * POLE_X, z,
        hx: WEST_X + side * (POLE_X - ARM), hz: z,
        rotY: side > 0 ? 0 : Math.PI, zone: z < 0 ? 0 : 1,
      }];
    }),
    // North extension + cross street. The two on main keep their written head
    // offset rather than POLE_X - ARM, which is the same 3.6 m one ulp away.
    { x: MAIN_X + POLE_X, z: 63, hx: MAIN_X + 3.6, hz: 63, rotY: 0, zone: 1 },
    { x: MAIN_X - POLE_X, z: 81, hx: MAIN_X - 3.6, hz: 81, rotY: Math.PI, zone: 1 },
    {
      x: -20,
      z: PLAZA_Z - CROSS_POLE_OUT,
      hx: -20,
      hz: PLAZA_Z - CROSS_HEAD_OUT,
      rotY: Math.PI / 2,
      zone: 1,
    },
    {
      x: 20,
      z: PLAZA_Z + CROSS_POLE_OUT,
      hx: 20,
      hz: PLAZA_Z + CROSS_HEAD_OUT,
      rotY: -Math.PI / 2,
      zone: 1,
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

export function buildLamps(map = worldMap()) {
  // On a generated world the plan places the lamps; the hand preset keeps its table.
  const LAMPS = (map.furniture ?? WORLD_FURNITURE)?.lamps ?? handLamps(map.district);
  const group = new THREE.Group();
  const poolsByZone = [[], []];
  const dummy = new THREE.Object3D();

  // The lantern: street_lamp_01 through the pool loader (M2.T2), one pool per
  // power zone, so a blackout takes one side of the street dark and leaves the
  // other lit (VGA-010). Each pool's meshes carry userData.model for M2-6.
  const lanternMats = [[], []];
  let pending = 0;
  for (const zone of [0, 1]) {
    const mine = LAMPS.filter((l) => l.zone === zone);
    pending += 1;
    loadModelPool(LAMP_MODEL, mine.length).then((pool) => {
      mine.forEach((l) => {
        dummy.position.set(l.x, 0, l.z);
        dummy.rotation.set(0, l.rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pool.set(pool.claim(), dummy.matrix);
      });
      for (const mesh of pool.meshes) {
        if (/glass|bulb/i.test(mesh.material.name ?? '')) lanternMats[zone].push(mesh.material);
      }
      group.add(pool.group);
      pending -= 1;
      if (pending === 0) reportKit({ lamps: LAMPS.length, models: ['street_lamp_01'] });
    }).catch(() => { pending -= 1; });
  }

  // Shafts fade head-to-ground via a gradient alphaMap: light falloff, not a
  // solid pyramid. Same instanced mesh, +1 draw (VGA-082 partial).
  const shaftTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#909090');
    grad.addColorStop(0.55, '#404040');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  })();
  const coneGeo = new THREE.ConeGeometry(1.5, LANTERN_Y, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a, transparent: true, opacity: 0.05, alphaMap: shaftTex,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
    forceSinglePass: true,     // both faces of the shaft add light, in either order: see glowMaterial
  });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, LAMPS.length);
  const glowMat = glowMaterial();
  const glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(GLOW_SIZE, GLOW_SIZE), glowMat, LAMPS.length);
  const glowLevel = new THREE.Color();

  LAMPS.forEach((l, i) => {
    dummy.position.set(l.x, LANTERN_Y, l.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    glows.setMatrixAt(i, dummy.matrix);
    glows.setColorAt(i, glowLevel.setScalar(GLOW_OPACITY));
    dummy.position.set(l.x, LANTERN_Y / 2, l.z);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);

    poolsByZone[l.zone].push({ x: l.x, z: l.z, size: 11, color: '#b97c3a' });
  });
  cones.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  group.add(cones, glows);

  // The signal pool: one head per junction approach from the sim's placement,
  // the housing facing the traffic that must stop for it.
  const SIGNALS = signalHeads(map);
  const sigParts = [
    new THREE.CylinderGeometry(0.08, 0.11, SIGNAL_Y, 6),
    new THREE.BoxGeometry(SIGNAL_ARM, 0.09, 0.09),
    new THREE.BoxGeometry(0.4, 0.95, 0.28),
  ];
  sigParts[0].translate(0, SIGNAL_Y / 2, 0);
  sigParts[1].translate(SIGNAL_ARM / 2, SIGNAL_Y, 0);
  sigParts[2].translate(SIGNAL_ARM, SIGNAL_Y - 0.55, 0.06);
  const sigGeo = mergeGeometries(sigParts);
  const sigs = new THREE.InstancedMesh(sigGeo, new THREE.MeshStandardMaterial({
    color: 0x14171d, roughness: 0.4, metalness: 0.7,
  }), SIGNALS.length);
  const lenses = new THREE.InstancedMesh(new THREE.CircleGeometry(0.12, 10), new THREE.MeshBasicMaterial({
    color: 0xffffff, side: THREE.DoubleSide,
  }), SIGNALS.length * 2);
  SIGNALS.forEach((h, i) => {
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
  group.add(sigs, lenses);

  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const zoneLight = [1, 1];
  let nightF = 1;
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  // Per-fixture brightness: mid-phase zones sputter per lamp (seeded blink).
  function setZoneLight(zone, v) {
    zoneLight[zone] = v;
  }
  function tick(time) {
    LAMPS.forEach((l, i) => {
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
    // blackout puts them out for their zone only.
    for (const zone of [0, 1]) {
      const b = zoneLight[zone] >= 1 ? 1 : zoneLight[zone] <= 0 ? 0 : blink(time, zone * 3.7);
      const lit = (0.15 + 0.85 * nightF) * b;
      for (const mat of lanternMats[zone]) mat.emissiveIntensity = 1.5 * lit;
    }
    SIGNALS.forEach((h, i) => {
      const green = signalGreen(h.axis, time);
      lenses.setColorAt(i * 2, green ? LENS_RED_OFF : LENS_RED);
      lenses.setColorAt(i * 2 + 1, green ? LENS_GREEN : LENS_GREEN_OFF);
    });
    cones.instanceMatrix.needsUpdate = true;
    glows.instanceColor.needsUpdate = true;
    if (lenses.instanceColor) lenses.instanceColor.needsUpdate = true;
  }

  // Daylight: lantern glass goes dull, cones and glows fade with the night.
  function setDaylight(n) {
    nightF = n;
    coneMat.opacity = 0.03 * n;
  }

  const headPositions = LAMPS.map((l) => new THREE.Vector3(l.x, LANTERN_Y, l.z));
  return { group, poolsByZone, setZoneLight, setDaylight, tick, heads: headPositions, cones };
}
