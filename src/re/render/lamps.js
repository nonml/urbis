// Street lighting: instanced poles + heads + cones, glow sprites, per-zone pools.
// Zones (z<0 / z>=0) can go dark for the blackout hack — no draw-count change.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';
import { blink } from '../sim/street.js';

// Explicit per-lamp placement: pole base (x,z), head offset toward the road,
// instance yaw, blackout zone. Main + east avenues share the z rhythm.
const POLE_X = 5.4;
const LAMPS = [
  ...[-45, -27, -9, 9, 27, 45].flatMap((z, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    return [0, 44].map((ax) => ({
      x: ax + side * POLE_X,
      z,
      hx: ax + side * (POLE_X - 1.8),
      hz: z,
      rotY: side > 0 ? 0 : Math.PI,
      zone: z < 0 ? 0 : 1,
    }));
  }),
  ...[-2, 12, 26, 40].map((x) => ({
    x, z: -68.2, hx: x, hz: -66.4, rotY: Math.PI / 2, zone: 0,
  })),
  { x: -8, z: -28.5, hx: -9.8, hz: -28.5, rotY: 0, zone: 0 },
  { x: -24, z: -35.5, hx: -22.2, hz: -35.5, rotY: Math.PI, zone: 0 },
];
const HEAD_Y = 7;
const HEAD_LIT = new THREE.Color(0xffe2b0);
const HEAD_DARK = new THREE.Color(0x11100c);

export function buildLamps() {
  const group = new THREE.Group();
  const poolsByZone = [[], []];
  const spritesByZone = [[], []];
  const spriteOf = [];
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
  const coneGeo = new THREE.ConeGeometry(3.4, HEAD_Y, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xffc98a, transparent: true, opacity: 0.03,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, LAMPS.length);

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
    dummy.position.set(l.hx, HEAD_Y / 2, l.hz);
    dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xffc98a, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(l.hx, HEAD_Y, l.hz);
    glow.scale.set(3.2, 3.2, 1);
    group.add(glow);
    spritesByZone[l.zone].push(glow);
    spriteOf.push(glow);
    poolsByZone[l.zone].push({ x: l.hx, z: l.hz, size: 11, color: '#b97c3a' });
  });
  poles.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  cones.instanceMatrix.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  group.add(poles, heads, cones);

  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const spriteBase = 0.38;
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
      const s = spriteOf[i];
      s.visible = b > 0.02;
      s.material.opacity = spriteBase * nightF * b;
    });
    heads.instanceColor.needsUpdate = true;
    cones.instanceMatrix.needsUpdate = true;
  }

  // Daylight: heads go dull, cones and glows fade with the night.
  function setDaylight(n) {
    nightF = n;
    headMat.color.setScalar(0.35 + 0.65 * n);
    coneMat.opacity = 0.03 * n;
  }

  const headPositions = LAMPS.map((l) => new THREE.Vector3(l.hx, HEAD_Y, l.hz));
  return { group, poolsByZone, setZoneLight, setDaylight, tick, heads: headPositions };
}
