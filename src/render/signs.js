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

function signTexture(main, sub, color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 384);
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.shadowColor = color;
  g.shadowBlur = 18;
  g.strokeRect(10, 10, 108, 364);
  g.textAlign = 'center';
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.font = 'bold 64px sans-serif';
  const chars = [...main];
  chars.forEach((ch, i) => g.fillText(ch, 64, 120 + i * 68));
  g.shadowBlur = 20;
  g.font = 'bold 30px sans-serif';
  g.fillText(sub, 64, 330);
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.font = 'bold 64px sans-serif';
  chars.forEach((ch, i) => g.globalAlpha && g.fillText(ch, 64, 120 + i * 68));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

function addGlowSprite(group, color, x, y, z, sx, sy, opacity, meta) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTex(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(sx, sy, 1);
  group.add(s);
  if (meta) meta.sprites.push({ mat, zone: meta.zone, seed: meta.seed, baseOp: opacity });
}

// Returns { group, pools } — pools are {x,z,size,color} quads merged later.
export function buildSigns() {
  const group = new THREE.Group();
  const pools = [];
  const mats = [];
  const arms = [];
  const zoneMats = [];
  const zoneSprites = [];
  const streakSources = [];
  for (const [idx, s] of SIGNS.entries()) {
    const zone = s.z < 0 ? 0 : 1;
    const ax = s.ax ?? 0;
    const faceSouth = s.face === 'south';
    const x = faceSouth ? ax : ax + s.side * 6.4;
    const z = faceSouth ? s.z : s.z;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 4.5),
      new THREE.MeshBasicMaterial({ map: signTexture(s.text, s.sub, s.color) })
    );
    mats.push(plane.material);
    zoneMats.push({ mat: plane.material, zone, seed: idx * 2.3 + 1 });
    plane.position.set(x, s.y, z);
    plane.rotation.y = faceSouth ? Math.PI : s.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(plane);
    addGlowSprite(group, s.color, x, s.y, z, 7, 9, 0.32, { sprites: zoneSprites, zone, seed: idx * 2.3 + 5 });
    const arm = new THREE.BoxGeometry(faceSouth ? 0.12 : 2.8, 0.12, faceSouth ? 1.4 : 0.12);
    arm.translate(faceSouth ? x : s.side * 7.5 + ax, s.y + 2.1, faceSouth ? s.z - 0.7 : s.z);
    arms.push(arm);
    pools.push({ x: faceSouth ? x : x - s.side * 2.5, z: faceSouth ? z + 2.5 : s.z, size: 9, color: s.color, zone });
    streakSources.push({ x, z, color: s.color, len: 8, width: 1.4 });
  }
  const armMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10 });
  group.add(new THREE.Mesh(mergeGeometries(arms), armMat));
  const alleys = buildAlleyGlows(zoneMats);
  group.add(alleys);
  return { group, pools, mats, zoneMats, zoneSprites, streakSources, tick: tickSigns };
}

// Per-fixture zone brightness with seeded sputter mid-phase.
function tickSigns(zoneMats, zoneSprites, glows, time, night) {
  for (const e of zoneMats) {
    const v = glows[e.zone];
    const b = v >= 1 ? 1 : v <= 0 ? 0 : blink(time, e.seed);
    e.mat.color.setScalar((0.3 + 0.7 * night) * (0.06 + 0.94 * b));
  }
  for (const e of zoneSprites) {
    const v = glows[e.zone];
    const b = v >= 1 ? 1 : v <= 0 ? 0 : blink(time, e.seed);
    e.mat.opacity = e.baseOp * night * b;
  }
}

function buildAlleyGlows(zoneMats) {
  const g = new THREE.Group();
  const defs = [
    { x: -13, z: -41, color: '#1e4d6b' },
    { x: 13, z: 21, color: '#5b1e4d' },
  ];
  for (const [di, d] of defs.entries()) {
    const mat = new THREE.MeshBasicMaterial({
      map: getGlowTex(), color: d.color, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 10), mat);
    m.userData.mirror = true; // street-level wash: the one sign-layer thing road puddles can see
    m.position.set(d.x, 5, d.z);
    m.rotation.y = d.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(m);
    zoneMats.push({ mat, zone: d.z < 0 ? 0 : 1, seed: di * 3.1 + 2 });
  }
  return g;
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
