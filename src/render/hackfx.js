// Hack theater (re-012): origin pulse ring, zone substations with slits that
// die per zone, and a pooled spark burst. Draws: body 1 + slits 2 + pulse 1
// (transient) + sparks 1. Render-only; main triggers, sim owns the clock.
import * as THREE from 'three';
import { getGlowTex } from './signs.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SPARKS = 24;
const HALF = 12;

export const SUBSTATIONS = [
  { x: 8.3, z: -30, zone: 0 },
  { x: -8.3, z: 30, zone: 1 },
];

export function buildHackFx() {
  const group = new THREE.Group();

  // Origin pulse: expanding flat ring, hidden unless firing.
  const pulseMat = new THREE.MeshBasicMaterial({
    color: 0xe6ecef, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 48), pulseMat);
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.15;
  pulse.visible = false;
  group.add(pulse);

  // Substation cabinets: one merged body, slits as one 2-instance mesh dimmed per zone.
  const bodies = [];
  const slitGeo = new THREE.PlaneGeometry(0.9, 0.12);
  const slitMesh = new THREE.InstancedMesh(slitGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), SUBSTATIONS.length);
  slitMesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const white = new THREE.Color(1, 1, 1);
  for (const [si, s] of SUBSTATIONS.entries()) {
    const cab = new THREE.BoxGeometry(1.2, 2.0, 0.8);
    cab.translate(s.x, 1.0, s.z);
    bodies.push(cab);
    const post = new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6);
    post.translate(s.x - 0.35, 2.4, s.z);
    bodies.push(post);
    const post2 = new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6);
    post2.translate(s.x + 0.35, 2.4, s.z);
    bodies.push(post2);
    const face = s.x > 0 ? -1 : 1;
    dummy.position.set(s.x + face * 0.61, 1.6, s.z);
    dummy.rotation.set(0, face > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    slitMesh.setMatrixAt(si, dummy.matrix);
    slitMesh.setColorAt(si, white);
  }
  slitMesh.instanceColor.needsUpdate = true;
  group.add(slitMesh);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x232a33, roughness: 0.4, metalness: 0.7 });
  const bodyMesh = new THREE.Mesh(mergeGeometries(bodies), bodyMat);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Spark burst: one Points cloud, golden-angle velocities (deterministic).
  const pos = new Float32Array(SPARKS * 3);
  for (let i = 0; i < SPARKS; i++) pos[i * 3 + 1] = -10;
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    color: 0xffd9a0, size: 0.35, map: getGlowTex(), transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  sparks.visible = false;
  sparks.frustumCulled = false;
  group.add(sparks);

  const state = {
    group, slits: slitMesh,
    pulseT: 1e9,
    sparkT: new Float32Array(SPARKS).fill(1e9),
    sparkV: new Float32Array(SPARKS * 3),
  };
  return state;
}

const _slitTint = new THREE.Color();
export function setSlit(fx, zone, v) {
  const si = SUBSTATIONS.findIndex((s) => s.zone === zone);
  if (si < 0) return;
  fx.slits.setColorAt(si, _slitTint.setScalar(0.06 + 0.94 * v));
  fx.slits.instanceColor.needsUpdate = true;
}

export function firePulse(fx, x, z) {
  fx.group.children[0].position.set(x, 0.15, z);
  fx.pulseT = 0;
}

export function fireSparks(fx, x, y, z, time, start = 0, count = HALF) {
  const p = fx.group.children[fx.group.children.length - 1].geometry.attributes.position;
  for (let k = 0; k < count; k++) {
    const i = (start + k) % SPARKS;
    const a = (i * 2.39996 + time * 1.3) % (Math.PI * 2);
    const sp = 3 + (i % 4);
    fx.sparkV[i * 3] = Math.cos(a) * sp;
    fx.sparkV[i * 3 + 1] = 4 + (i % 3) * 1.5;
    fx.sparkV[i * 3 + 2] = Math.sin(a) * sp;
    fx.sparkT[i] = 0;
    p.setXYZ(i, x, y, z);
  }
  p.needsUpdate = true;
  fx.group.children[fx.group.children.length - 1].visible = true;
}

export function tickHackFx(fx, dt) {
  const pulse = fx.group.children[0];
  fx.pulseT += dt;
  const k = fx.pulseT / 0.8;
  if (k < 1) {
    pulse.visible = true;
    const r = 1 + k * 17;
    pulse.scale.set(r, r, 1);
    pulse.material.opacity = 0.7 * (1 - k);
  } else {
    pulse.visible = false;
  }
  const pts = fx.group.children[fx.group.children.length - 1];
  const p = pts.geometry.attributes.position;
  let alive = false;
  for (let i = 0; i < SPARKS; i++) {
    if (fx.sparkT[i] > 1.1) continue;
    alive = true;
    fx.sparkT[i] += dt;
    fx.sparkV[i * 3 + 1] -= 12 * dt;
    p.setXYZ(
      i,
      p.getX(i) + fx.sparkV[i * 3] * dt,
      Math.max(0.1, p.getY(i) + fx.sparkV[i * 3 + 1] * dt),
      p.getZ(i) + fx.sparkV[i * 3 + 2] * dt
    );
  }
  p.needsUpdate = true;
  pts.visible = alive;
}
