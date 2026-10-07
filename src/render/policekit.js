// Every solid thing the police put in the street: cruisers from the M2.T3
// pipeline body (car.glb, credited in public/assets/CREDITS.md) in their own
// pool, and a barricade, a stinger and the helicopter sharing one instanced
// mesh. The cruiser keeps the model's own paint and trim materials, so it
// cannot ride the kit's single vertex-coloured material; its pool costs one
// draw per material however many cruisers deploy (law 4). The pool's paint
// mesh is `kit.mesh`, the mesh each cruiser's drawn pose is recorded on
// (M0-9); the folding barricade, stinger and helicopter mesh is `kit.props`.
//
// The kit holds three different things in one mesh the other way round: the
// geometry holds all three, each vertex knows which one it belongs to
// (aPart), each instance says which one it is (iPart), and the vertex shader
// folds every vertex of the other two onto a point, where their triangles
// have no area and draw nothing.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const KIT = { CRUISER: 0, BARRICADE: 1, STINGER: 2, HELI: 3 };
// Two barricades, two stingers, one helicopter; cruisers ride their own pool.
const MAX_KIT = 10;
// The M2.T3 pipeline body every cruiser renders from (M2-1).
export const POLICE_MODEL = 'assets/models/car/car.glb';
// Four cruisers at most: two chasing, two across a roadblock.
const MAX_CRUISERS = 4;

// Black-and-white: the model's paint tinted near-black, white doors and roof.
// It reads as police at night because the white is what the street lights find.
const LIVERY_TINT = new THREE.Color(0x141518);
const LIVERY_WHITE = 0xdcd8cf;
const GLASS = 0x0b1119;
const HELI_NAVY = 0x1f2836;
const HELI_GREY = 0x2a2d31;
const ROTOR = 0x121212;
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

function tube(r, len, x, y, z, hex, axis = 'y', seg = 10) {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
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

// --- Cruisers: the pipeline body, not boxes --------------------------------
// No BoxGeometry in any car body (M2-1): paint, trim and wheels come from
// car.glb, the white doors and roof are flat panels sitting proud of the tub,
// and the push bar and light-bar housing are cylinders and one extrusion.
// The model is 4.41 m on a +Z nose with its roof at 1.11 m; the lamps in
// police.js sit on those numbers.
function cruiserPanels() {
  const parts = [];
  for (const s of [1, -1]) {
    const g = new THREE.PlaneGeometry(1.9, 0.38);
    g.rotateY(s * Math.PI / 2);
    g.translate(s * 0.92, 0.62, -0.05);
    parts.push(g);
  }
  const roof = new THREE.PlaneGeometry(1.1, 1.0);
  roof.rotateX(-Math.PI / 2);
  roof.translate(0, 1.125, -0.2);
  parts.push(roof);
  return parts;
}

function cruiserBars() {
  const parts = [];
  const bar = (r, len, x, y, z, axis) => {
    const g = new THREE.CylinderGeometry(r, r, len, 10);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(x, y, z);
    parts.push(g);
  };
  bar(0.035, 1.2, 0, 0.55, 2.24, 'x');
  bar(0.035, 0.42, -0.42, 0.6, 2.2, 'y');
  bar(0.035, 0.42, 0.42, 0.6, 2.2, 'y');
  const shape = new THREE.Shape();
  shape.moveTo(-0.55, -0.045);
  shape.lineTo(0.55, -0.045);
  shape.lineTo(0.55, 0.045);
  shape.lineTo(-0.55, 0.045);
  const housing = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: false });
  housing.translate(0, 1.17, -0.32);
  parts.push(housing);
  return parts;
}

// One loaded mesh into paint or trim. Wheels wear the dark trim material, as
// the hero sort in traffic.js found.
function policeSort(mesh, out) {
  const baked = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
  if (mesh.material?.map) {
    out.paintGeos.push(baked);
    out.paintMat = out.paintMat ?? mesh.material;
  } else {
    out.trimGeos.push(baked);
    out.trimMat = out.trimMat ?? mesh.material;
  }
}

// Model parts merge only with matching attributes, so scrub both sides to
// position/normal/uv first (the traffic.js fleet shape).
function modelClean(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  }
  if (!g.attributes.uv) {
    const n = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

function cruiserMesh(geo, mat, name, shadow) {
  const mesh = new THREE.InstancedMesh(geo, mat, MAX_CRUISERS);
  mesh.name = name;
  mesh.userData.model = POLICE_MODEL;
  mesh.frustumCulled = false;
  mesh.castShadow = shadow;
  mesh.count = 0;
  mesh.visible = false;
  return mesh;
}

// The pool's meshes exist from frame one as empty stand-ins, as the traffic
// fleet's shells do, so the drawn pose kit.mesh records for a cruiser exists
// before the GLB lands (M0-9) and the model swaps the geometry and material in
// place. Lamps draw from frame one, bodies follow. Paint alone casts: the
// shadow reads from the shell.
function buildCruiserPool() {
  const group = new THREE.Group();
  const shell = (name, shadow) => cruiserMesh(
    new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(), name, shadow
  );
  const pool = {
    group,
    paint: shell('police-cruiser-body', true),
    trim: shell('police-cruiser-trim', false),
    livery: shell('police-cruiser-livery', false),
    n: 0, ready: false,
  };
  group.add(pool.paint, pool.trim, pool.livery);
  new GLTFLoader().loadAsync(POLICE_MODEL).then((gltf) => {
    gltf.scene.updateMatrixWorld(true);
    const out = { paintGeos: [], trimGeos: [], paintMat: null, trimMat: null };
    gltf.scene.traverse((o) => { if (o.isMesh) policeSort(o, out); });
    if (!out.paintGeos.length || !out.trimGeos.length || !out.trimMat) return;
    const paint = mergeGeometries(out.paintGeos.map(modelClean));
    const trim = mergeGeometries([...out.trimGeos, ...cruiserBars()].map(modelClean));
    const livery = mergeGeometries(cruiserPanels().map(modelClean));
    if (!paint || !trim || !livery) return;
    pool.paint.geometry.dispose();
    pool.paint.geometry = paint;
    pool.paint.material = out.paintMat;
    for (let i = 0; i < MAX_CRUISERS; i++) pool.paint.setColorAt(i, LIVERY_TINT);
    pool.paint.instanceColor.needsUpdate = true;
    pool.trim.geometry.dispose();
    pool.trim.geometry = trim;
    pool.trim.material = out.trimMat;
    pool.livery.geometry.dispose();
    pool.livery.geometry = livery;
    pool.livery.material = new THREE.MeshStandardMaterial({
      color: LIVERY_WHITE, roughness: 0.35, metalness: 0.1,
    });
    pool.ready = true;
  }).catch(() => {});
  return pool;
}

function placeCruiser(pool, dummy, x, y, z, yaw) {
  if (pool.n >= MAX_CRUISERS) return;
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, yaw, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  pool.paint.setMatrixAt(pool.n, dummy.matrix);
  pool.trim.setMatrixAt(pool.n, dummy.matrix);
  pool.livery.setMatrixAt(pool.n, dummy.matrix);
  pool.n++;
}

// A type III barricade: two posts, three striped boards, a lamp housing on each
// post. Boards run along local x; the face looks down local z. Posts and feet
// are cylinders and each board is one striped extrusion, so no box geometry.
export const BARRICADE_POSTS = [-0.85, 0.85];
function stripedBoard(y) {
  const shape = new THREE.Shape();
  shape.moveTo(-1, -0.1);
  shape.lineTo(1, -0.1);
  shape.lineTo(1, 0.1);
  shape.lineTo(-1, 0.1);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
  g.translate(0, 0, 0.045);
  const geo = plain(g);
  const light = new THREE.Color(0xe6e2d8);
  const orange = new THREE.Color(0xd4521c);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.min(7, Math.max(0, Math.floor((pos.getX(i) + 1) / 0.25)));
    const c = seg % 2 ? orange : light;
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.translate(0, y, 0);
  return geo;
}
function barricadeGeo() {
  const parts = [];
  for (const x of BARRICADE_POSTS) {
    parts.push(tube(0.045, 1.45, x, 0.725, 0, 0x8a8d90));
    parts.push(tube(0.05, 0.7, x, 0.035, 0, 0x2a2c2e, 'z', 8));
    parts.push(tube(0.08, 0.12, x, 1.5, 0, 0x1a1a1a));
  }
  for (const y of [0.45, 0.85, 1.25]) parts.push(stripedBoard(y));
  return mergeGeometries(parts);
}

// A stinger across local x: an accordion of dark links, a steel line of spikes
// on top that catches headlights, and its yellow deployment case at one end.
// Links are flat diamond extrusions, the rail a steel cylinder, the case one
// extrusion: no box geometry.
export const STINGER_HALF = 1.8;
const STINGER_LINKS = 14;
function linkGeo(x, i) {
  const s = new THREE.Shape();
  s.moveTo(-0.15, 0);
  s.lineTo(0, 0.1);
  s.lineTo(0.15, 0);
  s.lineTo(0, -0.1);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.rotateY(i % 2 ? 0.5 : -0.5);
  g.translate(x, 0, 0);
  return tinted(g, 0x1c1e22);
}
function stingerGeo() {
  const parts = [];
  const pitch = (STINGER_HALF * 2) / STINGER_LINKS;
  for (let i = 0; i < STINGER_LINKS; i++) {
    const x = -STINGER_HALF + (i + 0.5) * pitch;
    parts.push(linkGeo(x, i));
    const spike = new THREE.ConeGeometry(0.025, 0.08, 4);
    spike.translate(x, 0.08, 0);
    parts.push(tinted(spike, 0xc4c8ce));
  }
  parts.push(tube(0.015, STINGER_HALF * 2, 0, 0.05, 0, 0xb8bcc2, 'x', 8));
  const shape = new THREE.Shape();
  shape.moveTo(-0.18, -0.065);
  shape.lineTo(0.18, -0.065);
  shape.lineTo(0.18, 0.065);
  shape.lineTo(-0.18, 0.065);
  const kase = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
  kase.translate(STINGER_HALF + 0.2, 0.065, -0.15);
  parts.push(tinted(kase, 0xcfa52a));
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
  // Barricade, stinger and helicopter fold into one mesh (M2-6): the sweep
  // reads the kit tag, the way it reads the cruiser pool's model file.
  mesh.userData.model = 'police-kit';
  mesh.customDepthMaterial = patchKit(
    new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'police-kit-depth', false
  );
  mesh.castShadow = true;
  // Instances roam the whole map and an instanced mesh culls by one body at the
  // origin; count and visibility do the culling here instead.
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.count = 0;
  const cruisers = buildCruiserPool();
  // kit.mesh is the mesh the frame records each cruiser's drawn pose on (M0-9),
  // as the old one-part kit did; the barricade, stinger and helicopter fold
  // into props.
  return {
    mesh: cruisers.paint, props: mesh,
    mat, parts: mesh.geometry.attributes.iPart, n: 0, dummy: new THREE.Object3D(), cruisers,
  };
}

export function beginKit(kit, rotorAngle) {
  kit.n = 0;
  kit.cruisers.n = 0;
  kit.mat.userData.uRotor.value = rotorAngle;
}

// One instance of `part` at (x, y, z) turned to `yaw`; `stretch` scales local x.
// CRUISER rides the model pool, everything else the folding props mesh.
export function placeKit(kit, part, x, y, z, yaw, stretch = 1) {
  if (part === KIT.CRUISER) {
    placeCruiser(kit.cruisers, kit.dummy, x, y, z, yaw);
    return;
  }
  if (kit.n >= MAX_KIT) return;
  kit.dummy.position.set(x, y, z);
  kit.dummy.rotation.set(0, yaw, 0);
  kit.dummy.scale.set(stretch, 1, 1);
  kit.dummy.updateMatrix();
  kit.props.setMatrixAt(kit.n, kit.dummy.matrix);
  kit.parts.setX(kit.n, part);
  kit.n++;
}

export function endKit(kit, castShadow) {
  kit.props.count = kit.n;
  kit.props.visible = kit.n > 0;
  kit.props.castShadow = castShadow;
  kit.props.instanceMatrix.needsUpdate = true;
  kit.parts.needsUpdate = true;
  const c = kit.cruisers;
  if (!c.ready) return;
  for (const m of [c.paint, c.trim, c.livery]) {
    m.count = c.n;
    m.visible = c.n > 0;
    m.instanceMatrix.needsUpdate = true;
  }
  c.paint.castShadow = castShadow;
}
