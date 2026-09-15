// Neon signage, alley glow, and merged ground light-pools.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SIGNS = [
  { text: 'ラーメン', sub: 'RAMEN', color: '#ff3b5c', side: -1, z: -22, y: 8.5 },
  { text: 'HOTEL', sub: '★★★', color: '#35e0ff', side: 1, z: -6, y: 11 },
  { text: 'BAR', sub: 'NEON', color: '#ff4df0', side: -1, z: 6, y: 7 },
  { text: '24H', sub: 'OPEN', color: '#ffb14e', side: 1, z: 24, y: 6.5 },
  { text: '酒場', sub: 'CAFE', color: '#52ff9e', side: -1, z: 36, y: 9 },
];

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

function addGlowSprite(group, color, x, y, z, sx, sy, opacity) {
  const mat = new THREE.SpriteMaterial({
    map: getGlowTex(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(sx, sy, 1);
  group.add(s);
}

// Returns { group, pools } — pools are {x,z,size,color} quads merged later.
export function buildSigns() {
  const group = new THREE.Group();
  const pools = [];
  const arms = [];
  for (const s of SIGNS) {
    const x = s.side * 7.7;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 4.5),
      new THREE.MeshBasicMaterial({ map: signTexture(s.text, s.sub, s.color) })
    );
    plane.position.set(x, s.y, s.z);
    plane.rotation.y = s.side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(plane);
    addGlowSprite(group, s.color, x, s.y, s.z, 7, 9, 0.32);
    const arm = new THREE.BoxGeometry(1.0, 0.12, 0.12);
    arm.translate(s.side * 8.1, s.y + 2.1, s.z);
    arms.push(arm);
    pools.push({ x: x - s.side * 2.5, z: s.z, size: 9, color: s.color });
  }
  const armMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10 });
  group.add(new THREE.Mesh(mergeGeometries(arms), armMat));
  group.add(buildAlleyGlows());
  return { group, pools };
}

function buildAlleyGlows() {
  const g = new THREE.Group();
  const defs = [
    { x: -13, z: -41, color: '#1e4d6b' },
    { x: 13, z: 21, color: '#5b1e4d' },
  ];
  for (const d of defs) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 10),
      new THREE.MeshBasicMaterial({
        map: getGlowTex(), color: d.color, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    m.position.set(d.x, 5, d.z);
    m.rotation.y = d.x > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(m);
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
