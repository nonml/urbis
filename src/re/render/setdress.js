// Set dressing: lit shopfronts, merged puddle mirrors, animated steam vents.
// Shops + puddles are static merges (2 draws); steam is 3 live sprites.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { getGlowTex } from './signs.js';
import { mulberry32 } from '../sim/rng.js';

const SHOPS = [
  { x: -6.0, z: -12, ry: Math.PI / 2, kind: 0 },
  { x: 6.0, z: 2, ry: -Math.PI / 2, kind: 1 },
  { x: -6.0, z: 22, ry: Math.PI / 2, kind: 2 },
  { x: 35.5, z: -20, ry: Math.PI / 2, kind: 1 },
  { x: 50.0, z: 14, ry: -Math.PI / 2, kind: 0 },
  { x: 10, z: -60.9, ry: Math.PI, kind: 2 },
];

const SHOP_STYLES = [
  { glow: '#ff9a3c', name: 'RAMEN' },
  { glow: '#35e0ff', name: 'PAWN' },
  { glow: '#52ff9e', name: 'CLINIC' },
];

function shopTexture(kind) {
  const st = SHOP_STYLES[kind];
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#05070c';
  g.fillRect(0, 0, 256, 160);
  g.shadowColor = st.glow;
  g.shadowBlur = 16;
  g.fillStyle = st.glow;
  g.fillRect(0, 0, 256, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#000';
  g.font = 'bold 24px sans-serif';
  g.textAlign = 'center';
  g.fillText(st.name, 128, 25);
  for (let i = 0; i < 4; i++) {
    const x = 14 + i * 62;
    const lit = (i + kind) % 3 !== 0;
    g.fillStyle = lit ? '#ffe9c4' : '#131a24';
    g.shadowColor = st.glow;
    g.shadowBlur = lit ? 12 : 0;
    g.fillRect(x, 52, 48, 88);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(x, 52, 48, 12);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildShops() {
  const group = new THREE.Group();
  const texes = [shopTexture(0), shopTexture(1), shopTexture(2)];
  const canopies = [];
  const mats = [];
  for (const [si, s] of SHOPS.entries()) {
    const mat = new THREE.MeshBasicMaterial({ map: texes[s.kind] });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.4), mat);
    m.position.set(s.x, 2.0, s.z);
    m.rotation.y = s.ry;
    group.add(m);
    mats.push({ mat, zone: s.z < 0 ? 0 : 1, seed: si * 1.9 + 3 });
    const dirX = Math.sin(s.ry);
    const dirZ = Math.cos(s.ry);
    const cap = new THREE.BoxGeometry(7.0, 0.14, 1.1);
    cap.translate(s.x + dirX * 0.5, 3.85, s.z + dirZ * 0.5);
    canopies.push(cap);
  }
  const capMat = new THREE.MeshStandardMaterial({ color: 0x0d1016, roughness: 0.7, metalness: 0.3 });
  group.add(new THREE.Mesh(mergeGeometries(canopies), capMat));
  return { group, mats };
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(64, 64, 52, 34, 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    g.beginPath();
    g.ellipse(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 34, 8 + (i % 5) * 3, 6, a, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

const PUDDLES = [
  // x, z, size, surface y (0.025 road / 0.145 sidewalk)
  [-1.5, 12, 7, 0.025], [2.2, -8, 9, 0.025], [42.5, 4, 8, 0.025], [46, -24, 6, 0.025],
  [20, -64, 8, 0.025], [1.2, 34, 6, 0.025], [43, 30, 7, 0.025],
  [-5.9, -3, 4, 0.145], [5.9, 30, 4, 0.145], [38.2, 22, 4, 0.145],
  [49.8, -12, 4, 0.145], [16, -69.3, 5, 0.145], [0.5, 2, 6, 0.025],
];

export function buildPuddles() {
  const geos = [];
  for (const [x, z, size, y] of PUDDLES) {
    const q = new THREE.PlaneGeometry(size, size * 0.7);
    q.rotateX(-Math.PI / 2);
    q.rotateY((x * 7 + z * 3) % 3);
    q.translate(x, y, z);
    geos.push(q);
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0x11161f, metalness: 0.95, roughness: 0.05, envMapIntensity: 2.4,
    transparent: true, alphaMap: blobTexture(), depthWrite: false,
  });
  return new THREE.Mesh(mergeGeometries(geos), mat);
}

const VENTS = [
  { x: -5.5, z: -30, phase: 0 },
  { x: 46.5, z: 8, phase: 0.8 },
  { x: -5.5, z: -14, phase: 1.6 },
];

// Aviation beacons on tall crowns: one merged mesh, one synced pulse.
// Stars: one static dome of points above the fog.

export function buildBeacons(points) {
  const geos = [];
  for (const [x, y, z] of points) {
    const g = new THREE.SphereGeometry(0.28, 8, 6);
    g.translate(x, y, z);
    geos.push(g);
  }
  const mat = new THREE.MeshBasicMaterial({ color: 0xff2a20 });
  return { mesh: new THREE.Mesh(mergeGeometries(geos), mat), mat };
}

export function buildStars() {
  const rand = mulberry32(4242);
  const N = 450;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rand() * Math.PI * 2;
    const e = 0.12 + rand() * 1.4;
    const r = 320;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    pos[i * 3 + 1] = Math.sin(e) * r;
    pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xaac4e8, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.75, fog: false, depthWrite: false,
  }));
  points.frustumCulled = false;
  return points;
}

export function buildSteam() {
  const group = new THREE.Group();
  const sprites = [];
  for (const v of VENTS) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getGlowTex(), color: 0xbccbe0, transparent: true, opacity: 0.2,
      depthWrite: false,
    }));
    s.userData = v;
    group.add(s);
    sprites.push(s);
  }
  return { group, sprites, erupt: [0, 0] };
}

export function tickSteam(rig, elapsed, dt) {
  for (let zi = 0; zi < 2; zi++) rig.erupt[zi] = Math.max(0, rig.erupt[zi] - dt * 0.8);
  for (const s of rig.sprites) {
    const zone = s.userData.z < 0 ? 0 : 1;
    const e = rig.erupt[zone];
    const prog = ((elapsed * (0.45 + e * 1.6) + s.userData.phase) % 2.2) / 2.2;
    s.position.set(s.userData.x, 0.4 + prog * (3.2 + e * 3.5), s.userData.z);
    const sc = (1.4 + prog * 3.0) * (1 + e * 0.7);
    s.scale.set(sc, sc, 1);
    s.material.opacity = Math.min(0.7, 0.36 * (1 - prog) * (1 + e * 2.4));
  }
}
