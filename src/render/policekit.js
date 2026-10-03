// Every solid thing the police put in the street — a cruiser, a barricade, a
// stinger, the helicopter — as one instanced mesh, one draw (plus its shadow
// by day), whatever the tier has deployed.
//
// Law 4 says instance repeated things; these are four different things, so
// they share an instanced mesh the other way round: the geometry holds all
// four, each vertex knows which one it belongs to (aPart), each instance says
// which one it is (iPart), and the vertex shader folds every vertex of the
// other three onto a point, where their triangles have no area and draw
// nothing. A cruiser pays for a few hundred idle vertices; the frame saves
// three draws at the top tier, which is where the budget is tightest.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bodyGeo, trimGeo, wheelGeo, carGlassMesh } from './traffic.js';

export const KIT = { CRUISER: 0, BARRICADE: 1, STINGER: 2, HELI: 3 };
// Four cruisers, two barricades, two stingers, one helicopter.
const MAX_KIT = 10;

// Black-and-white: black body, white doors and roof. It reads as police at
// night because the white is what the street lights find.
const LIVERY_BLACK = 0x0d0f12;
const LIVERY_WHITE = 0xdcd8cf;
const TRIM = 0x15171b;
const GLASS = 0x0b1119;
const HELI_NAVY = 0x1f2836;
const HELI_GREY = 0x2a2d31;
const ROTOR = 0x121212;
const WHEEL_BASE = new THREE.Color(0xc2c8d0);
const KEEP = ['position', 'normal', 'color'];

function plain(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  return g;
}

function tinted(geo, hex) {
  const g = plain(geo);
  const c = new THREE.Color(hex);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

function box(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return tinted(g, hex);
}

// Rotor 0 is fixed, 1 the main rotor, 2 the tail rotor.
function tagged(geo, part, rotor = 0) {
  const n = geo.attributes.position.count;
  geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
  geo.setAttribute('aRotor', new THREE.BufferAttribute(new Float32Array(n).fill(rotor), 1));
  return geo;
}

// The traffic wheel carries its tyre/rim shade as vertex colour against a grey
// material; here there is one material for everything, so bake it in.
function bakedWheels() {
  const g = plain(wheelGeo);
  const col = g.attributes.color;
  for (let i = 0; i < col.count; i++) {
    const s = col.getX(i);
    col.setXYZ(i, WHEEL_BASE.r * s, WHEEL_BASE.g * s, WHEEL_BASE.b * s);
  }
  return g;
}

// The traffic body with a black-and-white livery, push bar and light-bar
// housing. The glass gives up its own material and sheen to ride along: from
// behind at chase distance it reads as dark glass in a frame, which is what
// slice 026 needed it to read as.
function cruiserGeo() {
  return mergeGeometries([
    tinted(carGlassMesh().geometry, GLASS),
    tinted(bodyGeo, LIVERY_BLACK),
    box(0.02, 0.4, 2.0, -0.905, 0.64, -0.1, LIVERY_WHITE),
    box(0.02, 0.4, 2.0, 0.905, 0.64, -0.1, LIVERY_WHITE),
    box(1.5, 0.02, 0.96, 0, 1.445, -0.32, LIVERY_WHITE),
    tinted(trimGeo, TRIM),
    box(1.2, 0.08, 0.3, 0, 1.45, -0.2, TRIM),
    box(1.2, 0.3, 0.07, 0, 0.6, 2.33, TRIM),
    box(0.07, 0.42, 0.07, -0.42, 0.62, 2.28, TRIM),
    box(0.07, 0.42, 0.07, 0.42, 0.62, 2.28, TRIM),
    bakedWheels(),
  ]);
}

// A type III barricade: two posts, three striped boards, a lamp housing on each
// post. Boards run along local x; the face looks down local z.
export const BARRICADE_POSTS = [-0.85, 0.85];
function barricadeGeo() {
  const parts = [];
  for (const x of BARRICADE_POSTS) {
    parts.push(box(0.09, 1.45, 0.09, x, 0.725, 0, 0x8a8d90));
    parts.push(box(0.1, 0.06, 0.7, x, 0.03, 0, 0x2a2c2e));
    parts.push(box(0.16, 0.1, 0.12, x, 1.5, 0, 0x1a1a1a));
  }
  const SEGMENTS = 8;
  for (const y of [0.45, 0.85, 1.25]) {
    for (let i = 0; i < SEGMENTS; i++) {
      const x = -1 + (i + 0.5) * (2 / SEGMENTS);
      parts.push(box(2 / SEGMENTS, 0.2, 0.03, x, y, 0.06, i % 2 ? 0xe6e2d8 : 0xd4521c));
    }
  }
  return mergeGeometries(parts);
}

// A stinger across local x: an accordion of dark links, a steel line of spikes
// on top that catches headlights, and its yellow deployment case at one end.
export const STINGER_HALF = 1.8;
const STINGER_LINKS = 14;
function stingerGeo() {
  const parts = [];
  const pitch = (STINGER_HALF * 2) / STINGER_LINKS;
  for (let i = 0; i < STINGER_LINKS; i++) {
    const x = -STINGER_HALF + (i + 0.5) * pitch;
    const link = new THREE.BoxGeometry(0.3, 0.04, 0.2);
    link.rotateY(i % 2 ? 0.5 : -0.5);
    link.translate(x, 0.02, 0);
    parts.push(tinted(link, 0x1c1e22));
    const spike = new THREE.ConeGeometry(0.025, 0.08, 4);
    spike.translate(x, 0.08, 0);
    parts.push(tinted(spike, 0xc4c8ce));
  }
  parts.push(box(STINGER_HALF * 2, 0.015, 0.03, 0, 0.05, 0, 0xb8bcc2));
  parts.push(box(0.36, 0.13, 0.3, STINGER_HALF + 0.2, 0.065, 0, 0xcfa52a));
  return mergeGeometries(parts);
}

const MAIN_HUB = [0, 1.18, 0.2];
const TAIL_HUB = [0.12, 0.6, -5.4];
const TAIL_SPIN_RATIO = 2.6;

function shaped(geo, [sx, sy, sz], [x, y, z], hex, rotX = 0) {
  geo.scale(sx, sy, sz);
  if (rotX) geo.rotateX(rotX);
  geo.translate(x, y, z);
  return tinted(geo, hex);
}

// A light police helicopter, nose down local z, rotor blades on their own
// rotor tag so the shader can spin them.
function heliGeo() {
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const ONE = [1, 1, 1];
  const fixed = [
    shaped(new THREE.SphereGeometry(1, 14, 10), [0.85, 0.8, 1.7], [0, 0, 0.3], HELI_NAVY),
    shaped(new THREE.SphereGeometry(1, 12, 8), [0.7, 0.55, 0.9], [0, 0.15, 1.15], GLASS),
    shaped(new THREE.CylinderGeometry(0.16, 0.3, 4.4, 8), ONE, [0, 0.15, -3.3], HELI_NAVY, Math.PI / 2),
    shaped(B(0.06, 1.0, 0.7), ONE, [0, 0.6, -5.4], HELI_NAVY),
    shaped(B(1.2, 0.05, 0.3), ONE, [0, 0.2, -4.6], HELI_NAVY),
    ...[-0.75, 0.75].map((x) => shaped(B(0.07, 0.07, 2.8), ONE, [x, -1.05, 0.3], HELI_GREY)),
    ...[[-0.7, -0.4], [0.7, -0.4], [-0.7, 1.0], [0.7, 1.0]].map(([x, z]) => (
      shaped(B(0.05, 0.3, 0.05), ONE, [x, -0.88, z], HELI_GREY))),
    shaped(new THREE.CylinderGeometry(0.09, 0.12, 0.4, 8), ONE, [0, 0.95, 0.2], HELI_GREY),
    shaped(new THREE.CylinderGeometry(0.15, 0.15, 0.25, 10), ONE, [0, -0.72, 1.4], HELI_GREY),
  ].map((g) => tagged(g, KIT.HELI));
  const main = [B(10, 0.03, 0.26), B(0.26, 0.03, 10)].map((g) => tagged(shaped(g, ONE, MAIN_HUB, ROTOR), KIT.HELI, 1));
  const tail = tagged(shaped(B(0.03, 1.2, 0.14), ONE, TAIL_HUB, ROTOR), KIT.HELI, 2);
  return mergeGeometries([...fixed, ...main, tail]);
}

function kitGeo() {
  const merged = mergeGeometries([
    tagged(cruiserGeo(), KIT.CRUISER),
    tagged(barricadeGeo(), KIT.BARRICADE),
    tagged(stingerGeo(), KIT.STINGER),
    heliGeo(),
  ]);
  merged.setAttribute('iPart', new THREE.InstancedBufferAttribute(new Float32Array(MAX_KIT), 1));
  return merged;
}

const ROTOR_GLSL = `
  if (aRotor > 0.5) {
    bool tailRotor = aRotor > 1.5;
    vec3 hub = tailRotor ? vec3(${TAIL_HUB.join(', ')}) : vec3(${MAIN_HUB.join(', ')});
    float a = tailRotor ? uRotor * ${TAIL_SPIN_RATIO.toFixed(1)} : uRotor;
    float ca = cos(a);
    float sa = sin(a);
    vec3 p = transformed - hub;
    p = tailRotor
      ? vec3(p.x, ca * p.y - sa * p.z, sa * p.y + ca * p.z)
      : vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
    transformed = p + hub;
  }`;

// Shared by the lit material and the shadow caster: a shadow of the wrong part
// is as wrong as drawing it.
const KIT_DECLS = 'attribute float aPart;\nattribute float aRotor;\nattribute float iPart;\nuniform float uRotor;\n';

function patchKit(mat, key, spin) {
  mat.userData.uRotor = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRotor = mat.userData.uRotor;
    sh.vertexShader = (KIT_DECLS + sh.vertexShader).replace('#include <begin_vertex>', `#include <begin_vertex>
      if (abs(aPart - iPart) > 0.5) transformed = vec3(0.0);
      ${spin ? ROTOR_GLSL : ''}`);
    if (!sh.vertexShader.includes('aPart - iPart')) console.error(`[${key}] kit patch missed`);
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

export function buildKit() {
  const mat = patchKit(new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.4, metalness: 0.18, envMapIntensity: 1.0,
  }), 'police-kit', true);
  const mesh = new THREE.InstancedMesh(kitGeo(), mat, MAX_KIT);
  mesh.customDepthMaterial = patchKit(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'police-kit-depth', false
  );
  mesh.castShadow = true;
  // Instances roam the whole map and an instanced mesh culls by one body at the
  // origin; count and visibility do the culling here instead.
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.count = 0;
  return { mesh, mat, parts: mesh.geometry.attributes.iPart, n: 0, dummy: new THREE.Object3D() };
}

export function beginKit(kit, rotorAngle) {
  kit.n = 0;
  kit.mat.userData.uRotor.value = rotorAngle;
}

// One instance of `part` at (x, y, z) turned to `yaw`; `stretch` scales local x.
export function placeKit(kit, part, x, y, z, yaw, stretch = 1) {
  if (kit.n >= MAX_KIT) return;
  kit.dummy.position.set(x, y, z);
  kit.dummy.rotation.set(0, yaw, 0);
  kit.dummy.scale.set(stretch, 1, 1);
  kit.dummy.updateMatrix();
  kit.mesh.setMatrixAt(kit.n, kit.dummy.matrix);
  kit.parts.setX(kit.n, part);
  kit.n++;
}

export function endKit(kit, castShadow) {
  kit.mesh.count = kit.n;
  kit.mesh.visible = kit.n > 0;
  kit.mesh.castShadow = castShadow;
  kit.mesh.instanceMatrix.needsUpdate = true;
  kit.parts.needsUpdate = true;
}
