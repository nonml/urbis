// Pedestrians: flared raincoats, faces, skin tones, swinging arms + legs,
// hats, cyber visors — all instanced. Matrices from sim; swing freezes when
// the walker freezes. Hats/visors hide via zero-scale for wearers without.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NPC_COUNT, SKIN_TONES, isDark, zoneAt } from '../sim/street.js';

const HAT_COLORS = [0x14161c, 0x3a2a1a, 0x1a3a4a, 0x5c1f2e];
const VISOR_COLORS = [0x35e0ff, 0xff4df0, 0xffb14e];

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 48);
  g.fillStyle = '#1a1210';
  g.beginPath(); g.ellipse(22, 18, 5, 7, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(42, 18, 5, 7, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(20, 36, 24, 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildNPCs(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  // Short rain jacket + long legs + small head: human ratio, not garden gnome.
  // Jacket hem sits at 0.70 so most of the leg reads; head is ~1/8 of height.
  const profile = [[0.40, 0], [0.36, 0.25], [0.28, 0.55], [0.23, 0.75], [0.21, 0.85]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const coatGeo = new THREE.LatheGeometry(profile, 9);
  coatGeo.translate(0, 0.70, 0);
  const coatMat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.05, envMapIntensity: 1.1 });
  const bodies = new THREE.InstancedMesh(coatGeo, coatMat, NPC_COUNT);
  bodies.castShadow = true;
  const headGeo = new THREE.SphereGeometry(0.11, 10, 8);
  headGeo.translate(0, 1.68, 0);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, NPC_COUNT);
  const legGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.85, 8);
  legGeo.translate(0, -0.425, 0);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.85 });
  const legL = new THREE.InstancedMesh(legGeo, legMat, NPC_COUNT);
  const legR = new THREE.InstancedMesh(legGeo, legMat, NPC_COUNT);
  const armGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.55, 7);
  armGeo.translate(0, -0.275, 0);
  const armL = new THREE.InstancedMesh(armGeo, coatMat, NPC_COUNT);
  const armR = new THREE.InstancedMesh(armGeo, coatMat, NPC_COUNT);
  const hatGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.12, 0.13, 0.10, 9); g.translate(0, 0.14, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.19, 0.19, 0.025, 12); g.translate(0, 0.09, 0); return g; })(),
  ]);
  const hats = new THREE.InstancedMesh(hatGeo, new THREE.MeshStandardMaterial({ roughness: 0.8 }), NPC_COUNT);
  const faceGeo = new THREE.PlaneGeometry(0.14, 0.10);
  const faces = new THREE.InstancedMesh(faceGeo, new THREE.MeshStandardMaterial({
    map: faceTexture(), alphaTest: 0.4, roughness: 0.6,
  }), NPC_COUNT);
  const visorGeo = new THREE.PlaneGeometry(0.15, 0.04);
  const visors = new THREE.InstancedMesh(visorGeo, new THREE.MeshBasicMaterial({}), NPC_COUNT);
  const skin = new THREE.Color();
  street.npcs.forEach((n, i) => {
    bodies.setColorAt(i, new THREE.Color(n.coat));
    heads.setColorAt(i, skin.set(SKIN_TONES[n.skin] ?? SKIN_TONES[0]));
    hats.setColorAt(i, new THREE.Color(HAT_COLORS[n.hat % HAT_COLORS.length]));
    visors.setColorAt(i, new THREE.Color(VISOR_COLORS[i % VISOR_COLORS.length]));
    // Arms read coat color so they vanish into the silhouette.
    armL.setColorAt(i, new THREE.Color(n.coat));
    armR.setColorAt(i, new THREE.Color(n.coat));
  });
  for (const m of [bodies, heads, hats, visors, armL, armR]) {
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  group.add(bodies, heads, legL, legR, armL, armR, hats, faces, visors);
  const rig = { bodies, heads, legL, legR, armL, armR, hats, faces, visors, dummy };
  updateNPCs(rig, street);
  return { group, ...rig };
}

function mergeHat() {
  const crown = new THREE.CylinderGeometry(0.15, 0.16, 0.12, 9);
  crown.translate(0, 0.06, 0);
  const brim = new THREE.CylinderGeometry(0.24, 0.24, 0.03, 12);
  const g = [crown, brim];
  // Minimal merge without the addon: same attribute layout, both indexed.
  const merged = new THREE.BufferGeometry();
  const pos = [];
  const norm = [];
  const uv = [];
  const idx = [];
  let base = 0;
  for (const geo of g) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const u = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      norm.push(n.getX(i), n.getY(i), n.getZ(i));
      uv.push(u.getX(i), u.getY(i));
    }
    const ix = geo.index;
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  merged.setIndex(idx);
  return merged;
}

const _fwd = new THREE.Vector3();

export function updateNPCs(rig, street) {
  const { bodies, heads, legL, legR, armL, armR, hats, faces, visors, dummy } = rig;
  street.npcs.forEach((n, i) => {
    const yaw = n.axis === 'x' ? (n.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (n.dir > 0 ? 0 : Math.PI);
    const moving = !isDark(street, zoneAt(n.z));
    const bob = moving ? Math.abs(Math.sin(n.phase)) * 0.05 : 0;
    const swing = moving ? Math.sin(n.phase) * 0.5 : 0;
    const flip = n.dir > 0 ? 1 : -1;
    dummy.position.set(n.x, bob, n.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(n.bulk ?? 1, n.h, 1);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    dummy.scale.set(1, n.h, 1);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const lx = n.axis === 'x' ? n.x : n.x + 0.13 * flip;
    const lz = n.axis === 'x' ? n.z + 0.13 * flip : n.z;
    const rx = n.axis === 'x' ? n.x : n.x - 0.13 * flip;
    const rz = n.axis === 'x' ? n.z - 0.13 * flip : n.z;
    dummy.position.set(lx, 0.85 * n.h + bob, lz);
    dummy.rotation.set(swing, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    legL.setMatrixAt(i, dummy.matrix);
    dummy.position.set(rx, 0.85 * n.h + bob, rz);
    dummy.rotation.set(-swing, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    legR.setMatrixAt(i, dummy.matrix);
    // Arms hang from the shoulders, counter-swinging the legs.
    const sx = 0.26 * (n.bulk ?? 1);
    const sy = 1.42 * n.h + bob;
    dummy.position.set(n.x + Math.cos(yaw) * sx, sy, n.z - Math.sin(yaw) * sx);
    dummy.rotation.set(-swing * 0.7, yaw, 0, 'YXZ');
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    armL.setMatrixAt(i, dummy.matrix);
    dummy.position.set(n.x - Math.cos(yaw) * sx, sy, n.z + Math.sin(yaw) * sx);
    dummy.rotation.set(swing * 0.7, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    armR.setMatrixAt(i, dummy.matrix);
    // Hat sits on the head; face + visor ride the forward vector.
    const hy = 1.68 * n.h + bob;
    if (n.hat) {
      dummy.position.set(n.x, hy - 0.04, n.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
    } else {
      dummy.position.set(n.x, hy, n.z);
      dummy.scale.set(0, 0, 0);
    }
    dummy.updateMatrix();
    hats.setMatrixAt(i, dummy.matrix);
    dummy.position.set(n.x + _fwd.x * 0.105, hy + 0.01, n.z + _fwd.z * 0.105);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    faces.setMatrixAt(i, dummy.matrix);
    if (n.cyber) {
      dummy.position.set(n.x + _fwd.x * 0.115, hy + 0.025, n.z + _fwd.z * 0.115);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
    } else {
      dummy.scale.set(0, 0, 0);
    }
    dummy.updateMatrix();
    visors.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [bodies, heads, legL, legR, armL, armR, hats, faces, visors]) {
    m.instanceMatrix.needsUpdate = true;
  }
}
