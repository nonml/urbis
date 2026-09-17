// Valley landscape: river west, mountain ring, grass banks + park, grass tufts.
// Static merges. Water normal scrolls; everything else sleeps.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../sim/rng.js';

export function buildRiver(texLoader, maxAniso) {
  const normal = texLoader.load('re-assets/asphalt/normal.jpg');
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(3, 40);
  normal.anisotropy = maxAniso;
  const mat = new THREE.MeshStandardMaterial({
    color: 0x10222f, metalness: 0.85, roughness: 0.14,
    normalMap: normal, normalScale: new THREE.Vector2(0.6, 0.6),
    envMapIntensity: 1.6,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 280), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(-34, -0.5, -5);
  return { mesh, normal };
}

export function tickRiver(river, dt) {
  river.normal.offset.y -= dt * 0.03;
}

export function buildGrassGround() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c3020, roughness: 1.0, envMapIntensity: 0.2 });
  const geos = [];
  const slab = (w, d, x, z) => {
    const g = new THREE.BoxGeometry(w, 0.3, d);
    g.translate(x, -0.1, z);
    geos.push(g);
  };
  slab(2.5, 280, -50.75, -5); // far-west verge (west of the avenue)
  slab(11, 280, -32.5, -5); // river bank (avenue runs clear between them)
  slab(15, 32, 61, 5); // pocket park east
  slab(60, 4, 22, -71.5); // connector verge south
  slab(60, 4, 22, -56.5); // connector verge north
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.receiveShadow = true;
  return mesh;
}

function bladeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 9; i++) {
    const x = 4 + i * 7;
    const h = 30 + ((i * 37) % 28);
    const grad = g.createLinearGradient(0, 64, 0, 64 - h);
    grad.addColorStop(0, '#0c1a10');
    grad.addColorStop(1, '#2d5a2e');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x, 64);
    g.lineTo(x + 3, 64 - h);
    g.lineTo(x + 6, 64);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TUFT_RECTS = [
  { x0: -52, x1: -50, z0: -60, z1: 55 }, // far-west verge (west of the avenue)
  { x0: -38, x1: -29, z0: -60, z1: 55 }, // river bank (east of the avenue)
  { x0: 54, x1: 68, z0: -10, z1: 20 }, // park
  { x0: -7, x1: 51, z0: -73, z1: -70 }, // connector verges
];

export function buildGrassTufts() {
  const rand = mulberry32(9001);
  const blade = new THREE.PlaneGeometry(0.9, 0.7);
  blade.translate(0, 0.35, 0);
  const cross = mergeGeometries([blade, blade.clone().rotateY(Math.PI / 2)]);
  const mat = new THREE.MeshStandardMaterial({
    map: bladeTexture(), alphaTest: 0.45, side: THREE.DoubleSide,
    roughness: 1.0, color: 0xbcc8b0,
  });
  const N = 1300;
  const inst = new THREE.InstancedMesh(cross, mat, N);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < N && guard++ < N * 20) {
    const r = TUFT_RECTS[Math.floor(rand() * TUFT_RECTS.length)];
    const x = r.x0 + rand() * (r.x1 - r.x0);
    const z = r.z0 + rand() * (r.z1 - r.z0);
    if (x > -38.5 && x < -29.5) continue; // open water
    const s = 0.7 + rand() * 0.9;
    dummy.position.set(x, 0.02, z);
    dummy.rotation.set(0, rand() * Math.PI, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    inst.setMatrixAt(placed++, dummy.matrix);
  }
  inst.count = placed;
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

export function buildMountains() {
  const rand = mulberry32(133);
  const rock = [];
  const snow = [];
  const ridge = (cx, cz, n, alongX) => {
    for (let i = 0; i < n; i++) {
      const r = 24 + rand() * 16;
      const h = 60 + rand() * 50;
      const px = alongX ? cx + i * 26 + rand() * 10 : cx + (rand() - 0.5) * 24;
      const pz = alongX ? cz + (rand() - 0.5) * 24 : cz + i * 26 + rand() * 10;
      const cone = new THREE.ConeGeometry(r, h, 6);
      cone.translate(px, h / 2 - 4, pz);
      rock.push(cone);
      const sr = r * 0.42;
      const sh = h * 0.42;
      const cap = new THREE.ConeGeometry(sr, sh, 6);
      cap.translate(px, h - 4 - sh / 2 + 1, pz);
      snow.push(cap);
    }
  };
  ridge(-88, -150, 12, false); // west range
  ridge(-70, 140, 9, true); // north range
  const rockMesh = new THREE.Mesh(
    mergeGeometries(rock),
    new THREE.MeshStandardMaterial({ color: 0x232c3a, roughness: 1.0, flatShading: true })
  );
  const snowMesh = new THREE.Mesh(
    mergeGeometries(snow),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f2, roughness: 0.9, flatShading: true })
  );
  const g = new THREE.Group();
  g.add(rockMesh, snowMesh);
  return g;
}
