// Street lighting: instanced poles + heads + cones + glows, per-zone pools.
// Zones (z<0 / z>=0) can go dark for the blackout hack — no draw-count change.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';
import { blink } from '../sim/street.js';
import { worldMap } from '../sim/patrol.js';
import { WORLD_FURNITURE } from '../sim/furniture.js';

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
const HEAD_Y = 7;
const HEAD_LIT = new THREE.Color(0xffe2b0);
const HEAD_DARK = new THREE.Color(0x11100c);
const GLOW_COLOR = 0xffc98a;
const GLOW_SIZE = 3.2;
const GLOW_OPACITY = 0.38;

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

export function buildLamps(map = worldMap()) {
  // On a generated world the plan places the lamps; the hand preset keeps its table.
  const LAMPS = (map.furniture ?? WORLD_FURNITURE)?.lamps ?? handLamps(map.district);
  const group = new THREE.Group();
  const poolsByZone = [[], []];
  const dummy = new THREE.Object3D();

  const poleGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.09, 0.12, HEAD_Y, 8); g.translate(0, HEAD_Y / 2, 0); return g; })(),
    (() => { const g = new THREE.BoxGeometry(1.9, 0.1, 0.1); g.translate(-0.85, HEAD_Y, 0); return g; })(),
  ]);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.35, metalness: 0.8 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, LAMPS.length);
  const headGeo = new THREE.BoxGeometry(0.55, 0.14, 0.3);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const heads = new THREE.InstancedMesh(headGeo, headMat, LAMPS.length);
  // Shafts fade head-to-ground via a gradient alphaMap: light falloff, not a
  // solid pyramid. Same instanced mesh, +0 draws (VGA-082 partial).
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
  const coneGeo = new THREE.ConeGeometry(1.5, HEAD_Y, 20, 1, true);
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
    dummy.position.set(l.x, 0, l.z);
    dummy.rotation.set(0, l.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(l.hx, HEAD_Y, l.hz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, HEAD_LIT);
    glows.setMatrixAt(i, dummy.matrix);
    glows.setColorAt(i, glowLevel.setScalar(GLOW_OPACITY));
    dummy.position.set(l.hx, HEAD_Y / 2, l.hz);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);

    poolsByZone[l.zone].push({ x: l.hx, z: l.hz, size: 11, color: '#b97c3a' });
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  cones.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  group.add(poles, heads, cones, glows);

  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const zoneLight = [1, 1];
  let nightF = 1;
  const litColor = new THREE.Color();
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
      litColor.copy(HEAD_DARK).lerp(HEAD_LIT, b);
      heads.setColorAt(i, litColor);
      if (b <= 0.02) {
        cones.setMatrixAt(i, zero);
      } else {
        const s = 0.25 + 0.75 * b;
        v3.set(l.hx, (HEAD_Y / 2) * b, l.hz);
        s3.set(s, Math.max(b, 0.02), s);
        m4.compose(v3, q0, s3);
        cones.setMatrixAt(i, m4);
      }
      glows.setColorAt(i, glowLevel.setScalar(b > 0.02 ? GLOW_OPACITY * nightF * b : 0));
    });
    heads.instanceColor.needsUpdate = true;
    cones.instanceMatrix.needsUpdate = true;
    glows.instanceColor.needsUpdate = true;
  }

  // Daylight: heads go dull, cones and glows fade with the night.
  function setDaylight(n) {
    nightF = n;
    headMat.color.setScalar(0.35 + 0.65 * n);
    coneMat.opacity = 0.03 * n;
  }

  const headPositions = LAMPS.map((l) => new THREE.Vector3(l.hx, HEAD_Y, l.hz));
  return { group, poolsByZone, setZoneLight, setDaylight, tick, heads: headPositions, cones };
}
