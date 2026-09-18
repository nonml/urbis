// Neon signage, alley glow, and merged ground light-pools.
import * as THREE from 'three';
import { blink } from '../sim/street.js';

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import SIGN_DEFS from '../content/signs.json';

// Runtime guard: content errors must degrade to a missing sign, never a dead boot.
function validSign(s) {
  return s && typeof s.text === 'string' && typeof s.sub === 'string'
    && /^#[0-9a-fA-F]{6}$/.test(s.color || '') && [-1, 0, 1].includes(s.side)
    && typeof s.z === 'number' && typeof s.y === 'number';
}
const SIGNS = SIGN_DEFS.filter((s, i) => validSign(s) || (console.error(`[signs] bad def ${i}, skipped`), false));

const SIGN_W = 1.5;
const SIGN_H = 4.5;
const CELL_W = 128;
const CELL_H = 384;
const ATLAS_COLS = 4;
const ATLAS_ROWS = Math.max(1, Math.ceil(SIGNS.length / ATLAS_COLS));
const QUAD_VERTS = 4;

function paintSignCell(g, main, sub, color, ox, oy) {
  g.save();
  // Every sign used to own a 128x384 canvas, so a 26px shadowBlur was clipped
  // by the canvas edge. On a shared atlas it would spill into the neighbour.
  g.beginPath();
  g.rect(ox, oy, CELL_W, CELL_H);
  g.clip();
  g.fillStyle = '#000';
  g.fillRect(ox, oy, CELL_W, CELL_H);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeRect(ox + 10, oy + 10, 108, 364);
  g.textAlign = 'center';
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.font = 'bold 64px sans-serif';
  const chars = [...main];
  chars.forEach((ch, i) => g.fillText(ch, ox + 64, oy + 120 + i * 68));
  g.shadowBlur = 20;
  g.font = 'bold 30px sans-serif';
  g.fillText(sub, ox + 64, oy + 330);
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.font = 'bold 64px sans-serif';
  chars.forEach((ch, i) => g.fillText(ch, ox + 64, oy + 120 + i * 68));
  g.restore();
}

// One texture for every sign is what lets ten faces merge into one draw.
function signAtlas() {
  const c = document.createElement('canvas');
  c.width = ATLAS_COLS * CELL_W;
  c.height = ATLAS_ROWS * CELL_H;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  SIGNS.forEach((s, i) => paintSignCell(
    g, s.text, s.sub, s.color, (i % ATLAS_COLS) * CELL_W, Math.floor(i / ATLAS_COLS) * CELL_H
  ));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Point a sign's UVs at its atlas cell. Canvas row 0 is the top and a
// CanvasTexture flips Y, so row 0 lives at the top of UV space.
function uvCell(geo, index) {
  const uv = geo.attributes.uv;
  const u0 = (index % ATLAS_COLS) / ATLAS_COLS;
  const v0 = 1 - (Math.floor(index / ATLAS_COLS) + 1) / ATLAS_ROWS;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, u0 + uv.getX(i) / ATLAS_COLS, v0 + uv.getY(i) / ATLAS_ROWS);
  }
  return geo;
}

// Per-fixture brightness on a merged mesh: one grey per quad, carried in a
// vertex colour where each sign used to carry its own material.color.
function quadColors(quads) {
  const attr = new THREE.BufferAttribute(new Float32Array(quads * QUAD_VERTS * 3).fill(1), 3);
  return attr.setUsage(THREE.DynamicDrawUsage);
}

function setQuadColor(attr, quad, r, g, b) {
  for (let i = quad * QUAD_VERTS; i < (quad + 1) * QUAD_VERTS; i += 1) attr.setXYZ(i, r, g, b);
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export const glowTex = { current: null };
export function getGlowTex() {
  if (!glowTex.current) glowTex.current = glowTexture();
  return glowTex.current;
}

const GLOW_W = 7;
const GLOW_H = 9;
const GLOW_OPACITY = 0.32;

// A Sprite billboards and an InstancedMesh does not, so the quad is built in
// view space instead: same face-the-camera result, one draw for all of them.
function billboardGlowMaterial() {
  const mat = new THREE.MeshBasicMaterial({
    map: getGlowTex(), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', [
      'vec4 mvPosition = modelViewMatrix * vec4( instanceMatrix[3].xyz, 1.0 );',
      'mvPosition.xy += position.xy * vec2( length( instanceMatrix[0].xyz ), length( instanceMatrix[1].xyz ) );',
      'gl_Position = projectionMatrix * mvPosition;',
    ].join('\n'));
    if (!sh.vertexShader.includes('instanceMatrix[3]')) console.error('[signs] glow billboard patch missed');
  };
  mat.customProgramCacheKey = () => 'signGlowBillboard';
  return mat;
}

// Additive blending multiplies colour by alpha, so folding each sign's opacity
// into its instance colour is exactly what per-sprite opacity used to do.
function buildGlows(placements) {
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), billboardGlowMaterial(), placements.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.scale.set(GLOW_W, GLOW_H, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, color.copy(p.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  return mesh;
}

function signPlacement(s) {
  const ax = s.ax ?? 0;
  const faceSouth = s.face === 'south';
  return { ax, faceSouth, zone: s.z < 0 ? 0 : 1, x: faceSouth ? ax : ax + s.side * 6.4, z: s.z };
}

function faceGeometry(s, p, index) {
  const geo = uvCell(new THREE.PlaneGeometry(SIGN_W, SIGN_H), index);
  geo.rotateY(p.faceSouth ? Math.PI : s.side > 0 ? -Math.PI / 2 : Math.PI / 2);
  geo.translate(p.x, s.y, p.z);
  return geo;
}

function armGeometry(s, p) {
  const geo = new THREE.BoxGeometry(p.faceSouth ? 0.12 : 2.8, 0.12, p.faceSouth ? 1.4 : 0.12);
  geo.translate(p.faceSouth ? p.x : s.side * 7.5 + p.ax, s.y + 2.1, p.faceSouth ? s.z - 0.7 : s.z);
  return geo;
}

// Returns { group, pools } — pools are {x,z,size,color} quads merged later.
export function buildSigns() {
  const group = new THREE.Group();
  const pools = [];
  const arms = [];
  const faces = [];
  const glowPlacements = [];
  const zoneMats = [];
  const zoneSprites = [];
  const streakSources = [];
  const faceAttr = quadColors(SIGNS.length);
  SIGNS.forEach((s, idx) => {
    const p = signPlacement(s);
    faces.push(faceGeometry(s, p, idx));
    arms.push(armGeometry(s, p));
    zoneMats.push({ zone: p.zone, seed: idx * 2.3 + 1, attr: faceAttr, quad: idx });
    const tint = new THREE.Color(s.color).multiplyScalar(GLOW_OPACITY);
    glowPlacements.push({ x: p.x, y: s.y, z: p.z, color: tint });
    zoneSprites.push({ zone: p.zone, seed: idx * 2.3 + 5, index: idx, color: tint });
    const poolX = p.faceSouth ? p.x : p.x - s.side * 2.5;
    pools.push({ x: poolX, z: p.faceSouth ? p.z + 2.5 : s.z, size: 9, color: s.color, zone: p.zone });
    streakSources.push({ x: p.x, z: p.z, color: s.color, len: 8, width: 1.4 });
  });
  const faceGeo = mergeGeometries(faces);
  faceGeo.setAttribute('color', faceAttr);
  group.add(new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: signAtlas(), vertexColors: true })));
  const glows = buildGlows(glowPlacements);
  group.add(glows);
  group.add(new THREE.Mesh(mergeGeometries(arms), new THREE.MeshBasicMaterial({ color: 0x0a0c10 })));
  const alleys = buildAlleyGlows(zoneMats);
  group.add(alleys.mesh);
  const tick = makeTick(faceAttr, alleys.attr, glows);
  return { group, pools, zoneMats, zoneSprites, streakSources, tick };
}

function phase(glow, time, seed) {
  return glow >= 1 ? 1 : glow <= 0 ? 0 : blink(time, seed);
}

// Per-fixture zone brightness with seeded sputter mid-phase. Signature is kept
// for main.js: it owns the entry lists, this owns the buffers they write into.
function makeTick(faceAttr, alleyAttr, glows) {
  const tinted = new THREE.Color();
  return (zoneMats, zoneSprites, glowsByZone, time, night) => {
    for (const e of zoneMats) {
      const b = phase(glowsByZone[e.zone], time, e.seed);
      const v = (0.3 + 0.7 * night) * (0.06 + 0.94 * b);
      setQuadColor(e.attr, e.quad, v, v, v);
    }
    for (const e of zoneSprites) {
      const b = phase(glowsByZone[e.zone], time, e.seed);
      glows.setColorAt(e.index, tinted.copy(e.color).multiplyScalar(night * b));
    }
    faceAttr.needsUpdate = true;
    alleyAttr.needsUpdate = true;
    glows.instanceColor.needsUpdate = true;
  };
}

const ALLEYS = [
  { x: -13, z: -41, color: '#1e4d6b' },
  { x: 13, z: 21, color: '#5b1e4d' },
];

function buildAlleyGlows(zoneMats) {
  const geos = [];
  const attr = quadColors(ALLEYS.length);
  const color = new THREE.Color();
  ALLEYS.forEach((d, di) => {
    const geo = new THREE.PlaneGeometry(6, 10);
    geo.rotateY(d.x > 0 ? -Math.PI / 2 : Math.PI / 2);
    geo.translate(d.x, 5, d.z);
    geos.push(geo);
    // The zone tick drives these to a grey scalar, as it always has, so the
    // per-alley tint only shows before the first tick. Pre-existing.
    color.set(d.color);
    setQuadColor(attr, di, color.r, color.g, color.b);
    zoneMats.push({ zone: d.z < 0 ? 0 : 1, seed: di * 3.1 + 2, attr, quad: di });
  });
  const geo = mergeGeometries(geos);
  geo.setAttribute('color', attr);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map: getGlowTex(), transparent: true, opacity: 0.8, vertexColors: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  mesh.userData.mirror = true; // street-level wash: the one sign-layer thing road puddles can see
  return { mesh, attr };
}

// One additive draw for every light pool on the wet road.
export function buildPools(quads) {
  const geos = [];
  const color = new THREE.Color();
  for (const q of quads) {
    const p = new THREE.PlaneGeometry(q.size, q.size);
    p.rotateX(-Math.PI / 2);
    p.translate(q.x, 0.03, q.z);
    color.set(q.color);
    const n = p.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b; }
    p.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geos.push(p);
  }
  const mat = new THREE.MeshBasicMaterial({
    map: getGlowTex(), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, vertexColors: true,
  });
  return new THREE.Mesh(mergeGeometries(geos), mat);
}
