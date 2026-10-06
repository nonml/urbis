// Pedestrians: one instanced pool with a baked walk (a vertex animation
// texture). Per-instance body, coat tint and phase; 1 main + 1 shadow draw
// for every walker. The sim owns the phase, so a frozen walker holds its pose.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blend, drawAlpha } from '../game/loop.js';
import { bakeVerticalShade, coatFabric, weaveUVs } from './player.js';
import { NPC_COUNT, SKIN_TONES, isDark, zoneAt } from '../sim/street.js';

const HAT_COLORS = [0x14161c, 0x3a2a1a, 0x1a3a4a, 0x5c1f2e];
// Black, tortoiseshell, gunmetal. Lit, not basic: an unlit lens ignores the
// street's light and reads as a glowing slit in every dark doorway.
const GLASSES_COLORS = [0x111214, 0x3b2618, 0x2e3136];

// M2.T8's baked pool (walkers.glb + walkers_vat.png: 4 bodies x a 32-frame
// walk). The pool bakes that same gait to a float VAT at build, so it needs
// no async load and still draws every walker from one InstancedMesh.
const WALKERS_GLB = 'assets/models/walkers.glb';
const WALKERS_VAT = 'assets/models/walkers_vat.png';
const VAT_BODIES = [[1.0, 1.0], [1.06, 0.92], [0.94, 1.12], [0.98, 1.22]];
const WALK_N = 32;
const HIP_Y = 0.85;
const ARM_Y = 1.42;

// One material for the whole walker: tag each part with its walk bone (0
// torso, 1/2 legs, 3/4 arms), its tint zone (0 coat, 1 skin, 2 dark, 3 hat)
// and its baked shade, so the VAT shader can move and tint it per instance.
function tagPart(geo, bone, zone) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aBone', new THREE.BufferAttribute(new Float32Array(n).fill(bone), 1));
  geo.setAttribute('aZone', new THREE.BufferAttribute(new Float32Array(n).fill(zone), 1));
  const col = geo.attributes.color;
  const shade = new Float32Array(n);
  for (let i = 0; i < n; i += 1) shade[i] = col ? col.getX(i) : 1;
  geo.setAttribute('aShade', new THREE.BufferAttribute(shade, 1));
  geo.deleteAttribute('color');
  return geo;
}

// Bake the walk: frame f of body b rotates each limb about its pivot by the
// swing the parts used to pose per frame, so the pool keeps the same gait.
function bakeWalkVAT(geo) {
  const pos = geo.attributes.position;
  const bone = geo.attributes.aBone;
  const n = pos.count;
  const rows = VAT_BODIES.length * WALK_N;
  const data = new Float32Array(n * rows * 4);
  for (let b = 0; b < VAT_BODIES.length; b += 1) {
    const h = VAT_BODIES[b][0];
    const w = VAT_BODIES[b][1];
    for (let f = 0; f < WALK_N; f += 1) {
      const sw = Math.sin((f / WALK_N) * Math.PI * 2) * 0.5;
      const bob = Math.abs(Math.sin((f / WALK_N) * Math.PI * 2)) * 0.05;
      for (let i = 0; i < n; i += 1) {
        const bi = bone.getX(i);
        const piv = (bi === 1 || bi === 2 ? HIP_Y : bi === 3 || bi === 4 ? ARM_Y : 0) * h;
        const ang = bi === 1 ? sw : bi === 2 ? -sw : bi === 3 ? -sw * 0.7 : bi === 4 ? sw * 0.7 : 0;
        const dy = pos.getY(i) * h - piv;
        const dz = pos.getZ(i) * w;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const o = ((b * WALK_N + f) * n + i) * 4;
        data[o] = pos.getX(i) * w;
        data[o + 1] = piv + dy * c - dz * s + bob;
        data[o + 2] = dy * s + dz * c;
        data[o + 3] = 1;
      }
    }
  }
  const tex = new THREE.DataTexture(data, n, rows, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

const VAT_DECLS = `attribute float aZone;
attribute float aShade;
attribute float aVat;
attribute float aBody;
attribute float aPhase;
attribute vec3 aSkin;
attribute vec4 aHat;
uniform sampler2D uVat;
uniform float uVerts;
uniform float uRows;
uniform float uWalkN;
uniform vec3 uDark;
varying vec3 vVatTint;`;

const VAT_BEGIN = `#include <begin_vertex>
{
  float cyc = fract(aPhase * 0.15915494); // vatWalk
  float fw = cyc * uWalkN;
  float f0 = floor(fw);
  float uu = (aVat + 0.5) / uVerts;
  float base = aBody * uWalkN;
  vec3 wp0 = texture2D(uVat, vec2(uu, (base + f0 + 0.5) / uRows)).rgb;
  vec3 wp1 = texture2D(uVat, vec2(uu, (base + mod(f0 + 1.0, uWalkN) + 0.5) / uRows)).rgb;
  vec3 animated = mix(wp0, wp1, fw - f0);
  if (aZone > 2.5 && aHat.a < 0.5) animated = vec3(0.0);
  vec3 zone = instanceColor;
  if (aZone > 0.5 && aZone < 1.5) zone = aSkin;
  else if (aZone > 1.5 && aZone < 2.5) zone = uDark;
  else if (aZone > 2.5) zone = aHat.rgb;
  transformed = animated;
  vVatTint = aShade * zone;
}`;

function walkerMaterial(vat, verts) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.65, metalness: 0.05, envMapIntensity: 1.1, ...coatFabric(0.42),
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uVat = { value: vat };
    sh.uniforms.uVerts = { value: verts };
    sh.uniforms.uRows = { value: VAT_BODIES.length * WALK_N };
    sh.uniforms.uWalkN = { value: WALK_N };
    sh.uniforms.uDark = { value: new THREE.Color(0x0b0d11) };
    sh.vertexShader = `${VAT_DECLS}\n${sh.vertexShader}`.replace('#include <begin_vertex>', VAT_BEGIN);
    if (!sh.vertexShader.includes('vatWalk')) console.error('[npcs] walker VAT patch missed');
    sh.fragmentShader = `varying vec3 vVatTint;\n${sh.fragmentShader}`
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vVatTint;');
    if (!sh.fragmentShader.includes('vVatTint')) console.error('[npcs] walker tint patch missed');
  };
  mat.customProgramCacheKey = () => 'walker-vat';
  return mat;
}

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
  // Shoe merged into the leg: rides the walk cycle, costs nothing.
  const legGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.08, 0.10, 0.85, 8); g.translate(0, -0.425, 0); return g; })(),
    (() => { const g = new THREE.BoxGeometry(0.14, 0.09, 0.27); g.translate(0, -0.805, 0.045); return g; })(),
  ]);
  const hatGeo = mergeGeometries([
    (() => { const g = new THREE.CylinderGeometry(0.12, 0.13, 0.10, 9); g.translate(0, 0.14, 0); return g; })(),
    (() => { const g = new THREE.CylinderGeometry(0.19, 0.19, 0.025, 12); g.translate(0, 0.09, 0); return g; })(),
  ]);
  const geo = mergeGeometries([
    tagPart(coatGeo, 0, 0),
    tagPart(headWithHairGeo(), 0, 1),
    tagPart(legGeo.clone().translate(-0.13, HIP_Y, 0), 1, 2),
    tagPart(legGeo.clone().translate(0.13, HIP_Y, 0), 2, 2),
    tagPart(armGeo.clone().translate(-0.268, ARM_Y, 0), 3, 0),
    tagPart(armGeo.clone().translate(0.268, ARM_Y, 0), 4, 0),
    tagPart(hatGeo.translate(0, 1.64, 0), 0, 3),
  ]);
  const count = geo.attributes.position.count;
  const ids = new Float32Array(count);
  for (let i = 0; i < count; i += 1) ids[i] = i;
  geo.setAttribute('aVat', new THREE.BufferAttribute(ids, 1));
  const walkers = new THREE.InstancedMesh(geo, walkerMaterial(bakeWalkVAT(geo), count), NPC_COUNT);
  walkers.name = 'npc-walkers';
  walkers.castShadow = true;
  walkers.frustumCulled = false;
  // The baked pool's source files (M2.T8); the tag stays for the M2-6 sweep.
  walkers.userData.model = WALKERS_GLB;
  walkers.userData.vat = WALKERS_VAT;
  const skin = new THREE.Color();
  const hat = new THREE.Color();
  const coat = new THREE.Color();
  const bodies = new Float32Array(NPC_COUNT);
  const phases = new Float32Array(NPC_COUNT);
  const skins = new Float32Array(NPC_COUNT * 3);
  const hats = new Float32Array(NPC_COUNT * 4);
  street.npcs.forEach((n, i) => {
    walkers.setColorAt(i, coat.set(n.coat));
    bodies[i] = i % VAT_BODIES.length;
    phases[i] = n.phase;
    skin.set(SKIN_TONES[n.skin] ?? SKIN_TONES[0]);
    skins[i * 3] = skin.r; skins[i * 3 + 1] = skin.g; skins[i * 3 + 2] = skin.b;
    hat.set(HAT_COLORS[n.hat % HAT_COLORS.length]);
    hats[i * 4] = hat.r; hats[i * 4 + 1] = hat.g; hats[i * 4 + 2] = hat.b;
    hats[i * 4 + 3] = n.hat ? 1 : 0;
  });
  const aPhase = new THREE.InstancedBufferAttribute(phases, 1);
  aPhase.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aBody', new THREE.InstancedBufferAttribute(bodies, 1));
  geo.setAttribute('aPhase', aPhase);
  geo.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skins, 3));
  geo.setAttribute('aHat', new THREE.InstancedBufferAttribute(hats, 4));
  if (walkers.instanceColor) walkers.instanceColor.needsUpdate = true;
  group.add(walkers);
  const rig = {
    walkers, dummy, aPhase,
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
  const alpha = drawAlpha();
  // The pool draws every part in one mesh; the M0-9 rig wears nine recorders.
  // Both get the same blended body matrix, and the pool reads its walk phase.
  const parts = [rig.walkers, rig.bodies, rig.heads, rig.legL, rig.legR,
    rig.armL, rig.armR, rig.hats, rig.faces, rig.glasses]
    .filter((m) => m && typeof m.setMatrixAt === 'function');
  street.npcs.forEach((n, i) => {
    const p = blend(n, alpha, rig.poses[i]);
    rig.dummy.position.set(p.x, 0, p.z);
    if (n.out === false) {
      rig.dummy.rotation.set(0, 0, 0);
      rig.dummy.scale.set(0, 0, 0);
    } else {
      rig.dummy.rotation.set(0, typeof p.yaw === 'number' ? p.yaw : 0, 0);
      rig.dummy.scale.set(p.bulk ?? 1, p.h, 1);
    }
    rig.dummy.updateMatrix();
    for (const m of parts) m.setMatrixAt(i, rig.dummy.matrix);
    if (rig.aPhase) rig.aPhase.array[i] = p.phase;
  });
  for (const m of parts) {
    if (m.instanceMatrix) m.instanceMatrix.needsUpdate = true;
  }
  if (rig.aPhase) rig.aPhase.needsUpdate = true;
}
