// Blade signs, alley glow, and merged ground light-pools.
import * as THREE from 'three';
import { blink } from '../sim/street.js';

import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import SIGN_DEFS from '../content/signs.json';
import { worldSigns } from '../sim/streetscape.js';
import { WORLD_PLAN } from '../sim/layout.js';
import { worldMap } from '../sim/patrol.js';

// Runtime guard: content errors must degrade to a missing sign, never a dead boot.
function validSign(s) {
  return s && typeof s.text === 'string' && typeof s.sub === 'string'
    && /^#[0-9a-fA-F]{6}$/.test(s.color || '') && [-1, 0, 1].includes(s.side)
    && typeof s.z === 'number' && typeof s.y === 'number';
}
const SIGN_W = 1.5;
const SIGN_H = 4.5;
const CELL_W = 128;
const CELL_H = 384;
const ATLAS_COLS = 4;
const QUAD_VERTS = 4;

// A sign is a lit box: a painted face in the shop's own colour, backlit, in a
// dark metal cabinet. The old cells were glowing tube outlines with white-hot
// letters, a look this city retired (VGA-083).
const CABINET = '#15171a';
const FRAME = 9;
const INK_ON_DARK = '#f4ecdc';
const INK_ON_PALE = '#1c1814';
const PALE_FACE_LUMA = 0.55;       // a face brighter than this takes dark letters
const EDGE_FALLOFF = 'rgba(0,0,0,0.3)';
const NAME_TOP = 30;
const NAME_BOTTOM = 290;           // leaves room for the rule and the sub line
const NAME_STEP_MAX = 68;
const NAME_FONT_FILL = 0.9;
const RULE_Y = 302;
const RULE_W = 76;
const RULE_H = 3;
const SUB_Y = 336;
const SUB_PAD = 4;                 // keeps a long sub line off the frame
const SUB_FONT = 'bold 26px sans-serif';
// A vertical column of Japanese sets the long-vowel mark vertical too; the
// horizontal dash reads as a stray hyphen between the kana.
const VERTICAL_FORMS = { 'ー': '｜' };

function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const luma = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return luma > PALE_FACE_LUMA ? INK_ON_PALE : INK_ON_DARK;
}

// The tubes run down the middle of the box, so the face is brightest there
// and falls off toward the frame. That falloff is what makes it read as lit
// from behind rather than painted flat.
function paintLitFace(g, color, ox, oy) {
  g.fillStyle = CABINET;
  g.fillRect(ox, oy, CELL_W, CELL_H);
  const [x, y, w, h] = [ox + FRAME, oy + FRAME, CELL_W - 2 * FRAME, CELL_H - 2 * FRAME];
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  const falloff = g.createLinearGradient(x, 0, x + w, 0);
  falloff.addColorStop(0, EDGE_FALLOFF);
  falloff.addColorStop(0.5, 'rgba(0,0,0,0)');
  falloff.addColorStop(1, EDGE_FALLOFF);
  g.fillStyle = falloff;
  g.fillRect(x, y, w, h);
}

// Letters step down the column and shrink to fit, so a five-letter HOTEL no
// longer runs off the bottom of its face and over its own sub line.
function paintSignCell(g, main, sub, color, ox, oy) {
  paintLitFace(g, color, ox, oy);
  const cx = ox + CELL_W / 2;
  const chars = [...main].map((ch) => VERTICAL_FORMS[ch] ?? ch);
  const step = Math.min(NAME_STEP_MAX, (NAME_BOTTOM - NAME_TOP) / chars.length);
  const top = NAME_TOP + (NAME_BOTTOM - NAME_TOP - step * chars.length) / 2;
  g.fillStyle = inkFor(color);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${Math.round(step * NAME_FONT_FILL)}px sans-serif`;
  chars.forEach((ch, i) => g.fillText(ch, cx, oy + top + step * (i + 0.5)));
  g.fillRect(cx - RULE_W / 2, oy + RULE_Y, RULE_W, RULE_H);
  g.font = SUB_FONT;
  g.fillText(sub, cx, oy + SUB_Y, CELL_W - 2 * (FRAME + SUB_PAD));
}

// One texture for every sign is what lets ten faces merge into one draw.
function signAtlas(signs, atlasRows) {
  const c = document.createElement('canvas');
  c.width = ATLAS_COLS * CELL_W;
  c.height = atlasRows * CELL_H;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  signs.forEach((s, i) => paintSignCell(
    g, s.text, s.sub, s.color, (i % ATLAS_COLS) * CELL_W, Math.floor(i / ATLAS_COLS) * CELL_H
  ));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Point a sign's UVs at its atlas cell. Canvas row 0 is the top and a
// CanvasTexture flips Y, so row 0 lives at the top of UV space.
function uvCell(geo, index, atlasRows) {
  const uv = geo.attributes.uv;
  const u0 = (index % ATLAS_COLS) / ATLAS_COLS;
  const v0 = 1 - (Math.floor(index / ATLAS_COLS) + 1) / atlasRows;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, u0 + uv.getX(i) / ATLAS_COLS, v0 + uv.getY(i) / atlasRows);
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
// A diffused lit box throws a soft wash on wet air, not a tube's halo; at the
// old 0.32 it dyed the whole tower behind each sign in the sign's colour.
const GLOW_OPACITY = 0.2;

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

function faceGeometry(s, p, index, atlasRows) {
  const geo = uvCell(new THREE.PlaneGeometry(SIGN_W, SIGN_H), index, atlasRows);
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
export function buildSigns(map = worldMap()) {
  // A generated map carries its placed signs; the hand preset draws `defs`.
  const SIGNS = worldSigns(SIGN_DEFS.filter((s, i) => validSign(s) || (console.error(`[signs] bad def ${i}, skipped`), false)), map);
  const ATLAS_ROWS = Math.max(1, Math.ceil(SIGNS.length / ATLAS_COLS));
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
    faces.push(faceGeometry(s, p, idx, ATLAS_ROWS));
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
  group.add(new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: signAtlas(SIGNS, ATLAS_ROWS), vertexColors: true })));
  const glows = buildGlows(glowPlacements);
  group.add(glows);
  group.add(new THREE.Mesh(mergeGeometries(arms), new THREE.MeshBasicMaterial({ color: 0x0a0c10 })));
  const alleys = buildAlleyGlows(zoneMats);
  if (alleys.mesh) group.add(alleys.mesh);
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
    if (alleyAttr) alleyAttr.needsUpdate = true;
    glows.instanceColor.needsUpdate = true;
  };
}

// A generated world has no alleys drawn yet, so it has no wash.
const ALLEYS = WORLD_PLAN ? [] : [
  { x: -13, z: -41, color: '#4d4032' },
  { x: 13, z: 21, color: '#52402c' },
];

function buildAlleyGlows(zoneMats) {
  if (!ALLEYS.length) return { mesh: null, attr: null };
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
