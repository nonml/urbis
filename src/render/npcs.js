// Pedestrians: flared raincoats, faces, skin tones, swinging arms + legs,
// hats, glasses — all instanced. Matrices from sim; swing freezes when
// the walker freezes. Hats/glasses hide via zero-scale for wearers without.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blend, drawAlpha } from '../game/loop.js';
import { bakeVerticalShade, coatFabric, weaveUVs } from './player.js';
import { NPC_COUNT, SKIN_TONES, isDark, zoneAt } from '../sim/street.js';

const HAT_COLORS = [0x14161c, 0x3a2a1a, 0x1a3a4a, 0x5c1f2e];
// Black, tortoiseshell, gunmetal. Lit, not basic: an unlit lens ignores the
// street's light and reads as a glowing slit in every dark doorway.
const GLASSES_COLORS = [0x111214, 0x3b2618, 0x2e3136];

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

// Skull plus a hair cap in one mesh. The cap is not a second draw and not a
// second material: it rides a vertex-colour multiplier, so the instance's skin
// tone darkens to hair where the cap is. A bare sphere at head scale is the
// detail the eye uses to decide a crowd is made of dolls.
const HAIR_SHADE = 0.17;
function headWithHairGeo() {
  const skull = new THREE.SphereGeometry(0.11, 10, 8);
  skull.scale(0.92, 1.12, 1.0);
  skull.translate(0, 1.68, 0);
  // The cap has to out-tessellate the skull as well as out-scale it: a
  // 6-segment shell sags inside a 10-segment sphere between its own vertices,
  // and every walker was showing scalp through its own hair.
  const hair = new THREE.SphereGeometry(0.128, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
  hair.scale(0.90, 1.08, 1.02);
  hair.translate(0, 1.676, -0.006);
  const geo = mergeGeometries([skull, hair]);
  const n = skull.attributes.position.count;
  const shade = new Float32Array(geo.attributes.position.count * 3).fill(1);
  for (let i = n; i < geo.attributes.position.count; i++) {
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = HAIR_SHADE;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  return geo;
}

export function buildNPCs(street) {
  const group = new THREE.Group();
  const dummy = new THREE.Object3D();
  // Short rain jacket + long legs + small head: human ratio, not garden gnome.
  // Jacket hem sits at 0.70 so most of the leg reads; head is ~1/8 of height.
  // Hem 0.31 under a 0.21 shoulder is a cone that flares outward all the way
  // down, which is a chess pawn from every angle — the same profile bug the
  // hero had. The shoulder is the widest point on a person, and the hem
  // hangs just inside it.
  const profile = [[0.245, 0], [0.238, 0.25], [0.214, 0.55], [0.243, 0.72], [0.228, 0.85]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const coatLathe = new THREE.LatheGeometry(profile, 9);
  coatLathe.translate(0, 0.70, 0);
  // Wide across, thin front-to-back, with a shoulder line the head sits
  // between. A body of revolution with a ball on top is a chess pawn from
  // every angle, and that is what a crowd of these read as at play distance.
  coatLathe.scale(1.02, 1, 0.68);
  const coatGeo = mergeGeometries([
    coatLathe,
    (() => { const g = new THREE.BoxGeometry(0.48, 0.12, 0.24); g.translate(0, 1.46, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.10, 0.12, 0.13, 9); g.translate(0, 1.56, 0); return g; })(),
  ]);
    // Instance tint multiplies the baked shade, so every walker keeps its own
  // coat colour and gains the same sky-on-the-shoulders, dark-at-the-hem
  // gradient the hero has. One attribute, no extra draw, no extra material.
  const armGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.55, 7);
  armGeo.translate(0, -0.275, 0);
  bakeVerticalShade(weaveUVs(coatGeo), 0.02);
  bakeVerticalShade(weaveUVs(armGeo), 1.42);
  const coatMat = new THREE.MeshStandardMaterial({
    roughness: 0.65, metalness: 0.05, envMapIntensity: 1.1, vertexColors: true,
    ...coatFabric(0.42),
  });
  const bodies = new THREE.InstancedMesh(coatGeo, coatMat, NPC_COUNT);
  bodies.name = 'npc-body';
  bodies.castShadow = true;
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, vertexColors: true });
  const heads = new THREE.InstancedMesh(headWithHairGeo(), headMat, NPC_COUNT);
  // Shoe merged into the leg: rides the walk cycle, costs nothing.
  const legGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.08, 0.10, 0.85, 8); g.translate(0, -0.425, 0); return g; })(),
    (() => { const g = new THREE.BoxGeometry(0.14, 0.09, 0.27); g.translate(0, -0.805, 0.045); return g; })(),
  ]);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.85 });
  const legL = new THREE.InstancedMesh(legGeo, legMat, NPC_COUNT);
  const legR = new THREE.InstancedMesh(legGeo, legMat, NPC_COUNT);
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
  const glassesGeo = new THREE.PlaneGeometry(0.15, 0.04);
  const glasses = new THREE.InstancedMesh(glassesGeo, new THREE.MeshStandardMaterial({ roughness: 0.2 }), NPC_COUNT);
  const skin = new THREE.Color();
  street.npcs.forEach((n, i) => {
    bodies.setColorAt(i, new THREE.Color(n.coat));
    heads.setColorAt(i, skin.set(SKIN_TONES[n.skin] ?? SKIN_TONES[0]));
    hats.setColorAt(i, new THREE.Color(HAT_COLORS[n.hat % HAT_COLORS.length]));
    glasses.setColorAt(i, new THREE.Color(GLASSES_COLORS[i % GLASSES_COLORS.length]));
    // Arms read coat color so they vanish into the silhouette.
    armL.setColorAt(i, new THREE.Color(n.coat));
    armR.setColorAt(i, new THREE.Color(n.coat));
  });
  for (const m of [bodies, heads, hats, glasses, armL, armR]) {
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  group.add(bodies, heads, legL, legR, armL, armR, hats, faces, glasses);
  const rig = {
    bodies, heads, legL, legR, armL, armR, hats, faces, glasses, dummy,
    // One blended pose per walker, reused every frame (M0-9).
    poses: street.npcs.map(() => ({})),
  };
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
  const { bodies, heads, legL, legR, armL, armR, hats, faces, glasses, dummy, poses } = rig;
  const alpha = drawAlpha();
  street.npcs.forEach((n, i) => {
    // Draw between the last two sim steps (M0-9); flags that are not numbers
    // ride through from the live walker.
    const p = blend(n, alpha, poses[i]);
    p.axis = n.axis;
    p.glasses = n.glasses;
    if (n.out === false) {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      for (const m of [bodies, heads, legL, legR, armL, armR, hats, faces, glasses]) m.setMatrixAt(i, dummy.matrix);
      return;
    }
    const yaw = p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
    const moving = !isDark(street, zoneAt(p.z));
    const bob = moving ? Math.abs(Math.sin(p.phase)) * 0.05 : 0;
    const swing = moving ? Math.sin(p.phase) * 0.5 : 0;
    const flip = p.dir > 0 ? 1 : -1;
    dummy.position.set(p.x, bob, p.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(p.bulk ?? 1, p.h, 1);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    dummy.scale.set(1, p.h, 1);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    _fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
    const lx = p.axis === 'x' ? p.x : p.x + 0.13 * flip;
    const lz = p.axis === 'x' ? p.z + 0.13 * flip : p.z;
    const rx = p.axis === 'x' ? p.x : p.x - 0.13 * flip;
    const rz = p.axis === 'x' ? p.z - 0.13 * flip : p.z;
    dummy.position.set(lx, 0.85 * p.h + bob, lz);
    dummy.rotation.set(swing, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    legL.setMatrixAt(i, dummy.matrix);
    dummy.position.set(rx, 0.85 * p.h + bob, rz);
    dummy.rotation.set(-swing, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    legR.setMatrixAt(i, dummy.matrix);
    // Arms hang from the shoulders, counter-swinging the legs.
    const sx = 0.268 * (p.bulk ?? 1);
    const sy = 1.42 * p.h + bob;
    dummy.position.set(p.x + Math.cos(yaw) * sx, sy, p.z - Math.sin(yaw) * sx);
    dummy.rotation.set(-swing * 0.7, yaw, 0, 'YXZ');
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    armL.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x - Math.cos(yaw) * sx, sy, p.z + Math.sin(yaw) * sx);
    dummy.rotation.set(swing * 0.7, yaw, 0, 'YXZ');
    dummy.updateMatrix();
    armR.setMatrixAt(i, dummy.matrix);
    // Hat sits on the head; face + glasses ride the forward vector.
    const hy = 1.68 * p.h + bob;
    if (p.hat) {
      dummy.position.set(p.x, hy - 0.04, p.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
    } else {
      dummy.position.set(p.x, hy, p.z);
      dummy.scale.set(0, 0, 0);
    }
    dummy.updateMatrix();
    hats.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x + _fwd.x * 0.105, hy + 0.01, p.z + _fwd.z * 0.105);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    faces.setMatrixAt(i, dummy.matrix);
    if (p.glasses) {
      dummy.position.set(p.x + _fwd.x * 0.115, hy + 0.025, p.z + _fwd.z * 0.115);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
    } else {
      dummy.scale.set(0, 0, 0);
    }
    dummy.updateMatrix();
    glasses.setMatrixAt(i, dummy.matrix);
  });
  for (const m of [bodies, heads, legL, legR, armL, armR, hats, faces, glasses]) {
    m.instanceMatrix.needsUpdate = true;
  }
}
