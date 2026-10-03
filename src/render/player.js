// Player avatar: lathe-profile raincoat, long legs, small head, backpack.
// Matches NPC fidelity — same silhouette language, hero-specific details.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../sim/rng.js';

function heroFaceTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#9a7b62';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#14100c';
  g.fillRect(0, 0, 64, 24);
  g.fillStyle = '#1a1210';
  g.beginPath(); g.ellipse(12, 36, 3, 4, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(20, 36, 3, 4, 0, 0, Math.PI * 2); g.fill();
  g.fillRect(12, 46, 8, 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Every surface in this city carries a normal map except the one the player
// looks at for the whole game. The hero's coat and the crowd's coats were
// flat colour next to PBR pavement and PBR walls, and that mismatch reads as
// "the character is from a different, cheaper game" long before any shape
// problem does. A woven height field, differenced into normals: 128x128,
// built once, shared by the hero and all 72 walkers.
let _fabric = null;

function fabricNormalMap() {
  if (_fabric) return _fabric;
  const S = 128;
  const rnd = mulberry32(0x5eed);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      h[y * S + x] = Math.sin(x * 1.55) * 0.3 + Math.sin(y * 1.55) * 0.3 + rnd() * 0.4;
    }
  }
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y += 1) {
    for (let x = 0; x < S; x += 1) {
      const nx = (at(x - 1, y) - at(x + 1, y)) * 1.4;
      const ny = (at(x, y - 1) - at(x, y + 1)) * 1.4;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * S + x) * 4;
      img.data[i] = (nx / len * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  _fabric = new THREE.CanvasTexture(c);
  _fabric.wrapS = THREE.RepeatWrapping;
  _fabric.wrapT = THREE.RepeatWrapping;
  _fabric.repeat.set(1, 1);
  return _fabric;
}

// A lathe gives each profile segment an equal slice of UV v regardless of how
// tall it is, so a 0.12m shoulder and a 0.30m skirt get the same slice and the
// weave bunches into a visible crosshatch over the lower coat. Project from
// world space instead and the cloth is the same density everywhere.
export function weaveUVs(geo, per = 6) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    uv[i * 2] = (pos.getX(i) + pos.getZ(i)) * per;
    uv[i * 2 + 1] = pos.getY(i) * per;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function coatFabric(scale) {
  return { normalMap: fabricNormalMap(), normalScale: new THREE.Vector2(scale, scale) };
}

// Cloth is never one value. A coat catches sky on the shoulders, goes dark in
// the waist break, and loses all light at the hem where the ground occludes it.
// Baked into the vertices, so the whole gradient costs no draw and no material.
const COAT_RAMP = [[0.68, 0.46], [0.90, 0.74], [1.18, 0.57], [1.40, 0.95], [1.62, 1.0]];

function rampAt(y) {
  if (y <= COAT_RAMP[0][0]) return COAT_RAMP[0][1];
  for (let i = 1; i < COAT_RAMP.length; i += 1) {
    const [y1, v1] = COAT_RAMP[i];
    if (y > y1) continue;
    const [y0, v0] = COAT_RAMP[i - 1];
    return v0 + (v1 - v0) * ((y - y0) / (y1 - y0));
  }
  return COAT_RAMP[COAT_RAMP.length - 1][1];
}

export function bakeVerticalShade(geo, yOffset, ramp = rampAt) {
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const v = ramp(pos.getY(i) + yOffset);
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Flat vertex tint on one part before it is merged into a shared mesh: the
// cheap way to give one material several readable values.
function shade(geo, [x, y, z], v) {
  geo.translate(x, y, z);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3).fill(v);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function buildPlayer() {
  const group = new THREE.Group();
  // A cone flaring wider at the hem than at the shoulder is a chess pawn, and a
  // flat yoke box laid across the top is a coat hanger. Let the lathe itself
  // carry the slope: hem -> waist nip -> widest shoulder -> neck, so the top
  // runs into the head instead of stopping under a lid.
  const coatProfile = [
    [0.255, 0.66], [0.247, 0.86], [0.222, 1.10], [0.240, 1.28],
    [0.252, 1.44], [0.205, 1.52], [0.120, 1.585],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const coatLathe = new THREE.LatheGeometry(coatProfile, 18);
  // Wide across, thin front-to-back: a true body of revolution alone is a
  // chess pawn from every angle.
  coatLathe.scale(1.02, 1, 0.68);
  const coatGeo = mergeGeometries([
    coatLathe,
    // Collar and neck, both round, so the head sits on a person's neck.
    (() => { const g = new THREE.CylinderGeometry(0.115, 0.088, 0.07, 16); g.translate(0, 1.55, -0.005); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.072, 0.085, 0.15, 16); g.translate(0, 1.60, 0); return g; })(),
  ]);
  bakeVerticalShade(weaveUVs(coatGeo), 0);
  const coatMat = new THREE.MeshStandardMaterial({
    color: 0x112b32, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.9, vertexColors: true,
    ...coatFabric(0.5),
  });
  const coat = new THREE.Mesh(coatGeo, coatMat);
  coat.castShadow = true;
  const headGeo = new THREE.SphereGeometry(0.13, 18, 12);
  headGeo.scale(0.92, 1.12, 1.0);
  const head = new THREE.Mesh(
    headGeo,
    new THREE.MeshStandardMaterial({ map: heroFaceTexture(), roughness: 0.6 })
  );
  head.position.y = 1.70;
  const legMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, roughness: 0.85 });
  // Trousers with a knee: the calf steps forward out of the thigh, so the leg
  // bends where a leg bends instead of at the midpoint of one flat cylinder.
  // The foot is a flattened capsule — a rounded toe at the front, a rounded
  // heel at the back, merged in so both ride the walk cycle for free.
  const legGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.088, 0.075, 0.34, 16); g.translate(0, -0.17, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.075, 0.060, 0.30, 16); g.translate(0, -0.49, 0.016); return g; })(),
    (() => {
      const g = new THREE.CapsuleGeometry(0.052, 0.16, 4, 16);
      g.rotateX(Math.PI / 2);
      g.scale(0.92, 0.72, 1.0);
      g.translate(0, -0.684, 0.045);
      return g;
    })(),
  ]);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.11, 0.72, 0);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0.11, 0.72, 0);
  // A sleeve that ends in a wrist and a hand, not a capped pipe: the capsule
  // rounds the cuff, the palm is a small sphere below it.
  const armGeo = mergeGeometries([
    (() => { const g = new THREE.CapsuleGeometry(0.055, 0.34, 4, 16); g.translate(0, -0.225, 0); return g; })(),
    (() => { const g = new THREE.SphereGeometry(0.058, 16, 10); g.translate(0, -0.448, 0.004); return g; })(),
  ]);
  bakeVerticalShade(weaveUVs(armGeo), 1.40);
  const armL = new THREE.Mesh(armGeo, coatMat);
  armL.position.set(-0.278, 1.40, 0);
  const armR = new THREE.Mesh(armGeo, coatMat);
  armR.position.set(0.278, 1.40, 0);
  // One dark-kit mesh: a capsule pack with a rounded flap, capsule straps, the
  // belt and buckle, and the hair cap. All one material, so the back of the
  // hero gains the only object the player stares at all game without costing a
  // draw. The shades are vertex multipliers on a near-black base — a black pack
  // on a dark coat is a silhouette with nothing in it, and that read as one
  // shape rather than a person carrying something.
  const kitGeo = mergeGeometries([
    (() => { const g = new THREE.CapsuleGeometry(0.125, 0.15, 6, 16); g.scale(1.05, 1, 0.60); return shade(g, [0, 1.30, -0.25], 2.3); })(),
    (() => { const g = new THREE.CapsuleGeometry(0.12, 0.10, 4, 16); g.scale(1.08, 0.5, 0.62); return shade(g, [0, 1.455, -0.255], 3.9); })(),
    // Belt. A coat with a waist is a garment; a coat without one is a cone
    // with a gradient painted on it, and the vertex ramp alone was never
    // going to carry the break on its own.
    (() => {
      const g = new THREE.TorusGeometry(0.247, 0.026, 16, 24);
      g.rotateX(Math.PI / 2);
      g.scale(1.02, 1, 0.70);
      g.translate(0, 1.07, 0);
      return shade(g, [0, 0, 0], 1.5);
    })(),
    (() => { const g = new THREE.SphereGeometry(0.035, 16, 10); return shade(g, [0.055, 1.07, 0.176], 3.4); })(),
    (() => { const g = new THREE.CapsuleGeometry(0.018, 0.20, 3, 16); return shade(g, [-0.105, 1.40, -0.165], 1.6); })(),
    (() => { const g = new THREE.CapsuleGeometry(0.018, 0.20, 3, 16); return shade(g, [0.105, 1.40, -0.165], 1.6); })(),
    (() => {
      const g = new THREE.SphereGeometry(0.152, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
      g.scale(0.90, 1.08, 1.02);
      g.translate(0, 1.695, -0.012);
      return shade(g, [0, 0, 0], 1);
    })(),
  ]);
  const backpack = new THREE.Mesh(
    kitGeo,
    new THREE.MeshStandardMaterial({
      color: 0x0a0e14, roughness: 0.8, metalness: 0.2, vertexColors: true,
    })
  );
  group.add(coat, head, legL, legR, armL, armR, backpack);
  return { group, legL, legR, armL, armR };
}

export function updatePlayer(avatar, player) {
  avatar.group.position.set(player.x, player.y, player.z);
  avatar.group.rotation.y = player.yaw;
  const swing = Math.sin(player.walkPhase) * Math.min(1, player.speed / 3) * 0.55;
  avatar.legL.rotation.x = swing;
  avatar.legR.rotation.x = -swing;
  avatar.armL.rotation.x = -swing * 0.7;
  avatar.armR.rotation.x = swing * 0.7;
  avatar.group.position.y = player.y + Math.abs(Math.sin(player.walkPhase)) * 0.03 * Math.min(1, player.speed / 3);
}
