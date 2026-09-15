// Neon street block geometry. Everything repeated is instanced or merged —
// per-object draws for repeated things are banned (charter law #4).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadPBRMaps, standardFromMaps } from './materials.js';

const STREET_LEN = 120;
const ROAD_HALF = 4;

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// Scale box UVs to world meters so the facade texture tiles every TILE m.
function worldUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const sx = Math.max(w, d) / tile;
  const sy = h / tile;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  return geo;
}

export function buildGround(texLoader, maxAniso) {
  const group = new THREE.Group();
  const asphalt = loadPBRMaps(texLoader, maxAniso, 'asphalt', 'albedo', 2, 30);
  const roadMat = standardFromMaps(asphalt, { roughness: 0.45, envMapIntensity: 1.4, color: 0x8a8f99 });
  const roadMain = new THREE.PlaneGeometry(ROAD_HALF * 2, STREET_LEN);
  roadMain.rotateX(-Math.PI / 2);
  const roadEast = new THREE.PlaneGeometry(ROAD_HALF * 2, STREET_LEN);
  roadEast.rotateX(-Math.PI / 2);
  roadEast.translate(44, 0, 0);
  const roadSouth = new THREE.PlaneGeometry(58, ROAD_HALF * 2);
  roadSouth.rotateX(-Math.PI / 2);
  roadSouth.translate(22, 0, -64);
  group.add(new THREE.Mesh(mergeGeometries([roadMain, roadEast, roadSouth]), roadMat));

  const paving = loadPBRMaps(texLoader, maxAniso, 'paving_slabs', 'albedo', 1.5, 60);
  const walkMat = standardFromMaps(paving, { roughness: 0.7, envMapIntensity: 0.7, color: 0x9aa0ab });
  const walks = mergeGeometries([
    box(3, 0.24, STREET_LEN, -(ROAD_HALF + 1.5), 0.0, 0),
    box(3, 0.24, STREET_LEN, ROAD_HALF + 1.5, 0.0, 0),
    box(3, 0.24, STREET_LEN, 44 - (ROAD_HALF + 1.5), 0.0, 0),
    box(3, 0.24, STREET_LEN, 44 + (ROAD_HALF + 1.5), 0.0, 0),
    box(58, 0.24, 3, 22, 0.0, -64 - (ROAD_HALF + 1.5)),
    box(58, 0.24, 3, 22, 0.0, -64 + (ROAD_HALF + 1.5)),
  ]);
  group.add(new THREE.Mesh(walks, walkMat));

  const concrete = loadPBRMaps(texLoader, maxAniso, 'concrete', 'albedo', 1, 40);
  const curbMat = standardFromMaps(concrete, { roughness: 0.85, envMapIntensity: 0.4, color: 0x7d828c });
  const curbs = mergeGeometries([
    box(0.3, 0.3, STREET_LEN, -(ROAD_HALF + 0.15), 0.03, 0),
    box(0.3, 0.3, STREET_LEN, ROAD_HALF + 0.15, 0.03, 0),
    box(0.3, 0.3, STREET_LEN, 44 - (ROAD_HALF + 0.15), 0.03, 0),
    box(0.3, 0.3, STREET_LEN, 44 + (ROAD_HALF + 0.15), 0.03, 0),
    box(58, 0.3, 0.3, 22, 0.03, -64 - (ROAD_HALF + 0.15)),
    box(58, 0.3, 0.3, 22, 0.03, -64 + (ROAD_HALF + 0.15)),
  ]);
  group.add(new THREE.Mesh(curbs, curbMat));

  group.add(buildMarkings());
  return group;
}

function buildMarkings() {
  const quads = [];
  const dash = new THREE.PlaneGeometry(0.15, 2);
  for (const ax of [0, 44]) {
    for (let z = -STREET_LEN / 2 + 3; z < STREET_LEN / 2 - 3; z += 5) {
      const q = dash.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(ax, 0.02, z);
      quads.push(q);
    }
  }
  const dashX = new THREE.PlaneGeometry(2, 0.15);
  for (let x = -4; x <= 48; x += 5) {
    const q = dashX.clone();
    q.rotateX(-Math.PI / 2);
    q.translate(x, 0.02, -64);
    quads.push(q);
  }
  const stripe = new THREE.PlaneGeometry(0.5, ROAD_HALF * 2 - 1);
  for (let i = -3; i <= 3; i++) {
    const q = stripe.clone();
    q.rotateX(-Math.PI / 2);
    q.rotateY(Math.PI / 2);
    q.translate(0, 0.02, 20 + i * 1.1);
    quads.push(q);
  }
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd8dce2, emissive: 0x8f959e, emissiveIntensity: 0.08, roughness: 0.6,
  });
  return new THREE.Mesh(mergeGeometries(quads), mat);
}

const TOWERS = [
  // side, z-center, width, height, depth
  [-1, -48, 12, 34, 10], [-1, -32, 10, 22, 10], [-1, -14, 14, 44, 11],
  [-1, 6, 11, 28, 10], [-1, 24, 13, 38, 10], [-1, 44, 10, 24, 10],
  [1, -44, 11, 26, 10], [1, -26, 13, 40, 11], [1, -6, 10, 30, 10],
  [1, 12, 12, 24, 10], [1, 30, 14, 46, 11], [1, 50, 10, 22, 10],
];

const SOUTH_TOWERS = [
  // x-center, width, height (front face z=-61, facing the connector)
  [-2, 12, 30], [10, 10, 42], [22, 14, 26], [34, 11, 36], [46, 12, 28],
];

export function buildTowers(texLoader, maxAniso) {
  const avenues = [0, 44];
  const group = new THREE.Group();
  const color = texLoader.load('re-assets/facade_glass_night/color.jpg');
  color.colorSpace = THREE.SRGBColorSpace;
  const emission = texLoader.load('re-assets/facade_glass_night/emission.jpg');
  emission.colorSpace = THREE.SRGBColorSpace;
  const normal = texLoader.load('re-assets/facade_glass_night/normal.jpg');
  const rough = texLoader.load('re-assets/facade_glass_night/roughness.jpg');
  const metal = texLoader.load('re-assets/facade_glass_night/metalness.jpg');
  for (const t of [color, emission, normal, rough, metal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
  }
  const facadeMatA = new THREE.MeshStandardMaterial({
    map: color, emissiveMap: emission, emissive: 0xffffff, emissiveIntensity: 0.75,
    normalMap: normal, roughnessMap: rough, roughness: 1.0,
    metalnessMap: metal, metalness: 1.0,
    color: 0x565c68, envMapIntensity: 1.1,
  });
  const facadeMatB = facadeMatA.clone();
  facadeMatB.color = new THREE.Color(0x4a5a6e);
  const podiumMapsA = loadPBRMaps(texLoader, maxAniso, 'plaster_rough', 'color', 3, 2);
  const podiumMatA = standardFromMaps(podiumMapsA, { roughness: 0.95, envMapIntensity: 0.25, color: 0x54575f });
  const podiumMapsB = loadPBRMaps(texLoader, maxAniso, 'plaster_painted', 'color', 3, 2);
  const podiumMatB = standardFromMaps(podiumMapsB, { roughness: 0.9, envMapIntensity: 0.25, color: 0x4e5158 });
  const facadesA = [];
  const facadesB = [];
  const podiumsA = [];
  const podiumsB = [];
  const caps = [];
  // Every tower: podium base, shaft, optional setback crown, parapet lip, roof clutter.
  function emitTower(cx, cz, w, h, d, idx) {
    (idx % 2 === 0 ? podiumsA : podiumsB).push(box(w + 1.2, 4.2, d + 1.2, cx, 2.1, cz));
    // Stone trim course capping the podium — one thin ring, catches lamp light.
    caps.push(box(w + 1.5, 0.22, d + 1.5, cx, 4.3, cz));
    (idx % 2 === 0 ? facadesA : facadesB).push(worldUVs(box(w, h, d, cx, h / 2, cz), w, h, d, 11));
    let topY = h;
    if (h >= 30 && idx % 2 === 0) {
      const uw = w * 0.72;
      const uh = h * 0.3;
      const ud = d * 0.72;
      facadesA.push(worldUVs(box(uw, uh, ud, cx, h + uh / 2, cz), uw, uh, ud, 11));
      topY = h + uh;
    }
    caps.push(box(w + 0.4, 0.5, d + 0.4, cx, h + 0.25, cz));
    caps.push(box(w + 0.9, 0.35, d + 0.9, cx, topY + 0.1, cz));
    const ux = cx + (idx % 3 - 1) * w * 0.22;
    const uz = cz + ((idx + 1) % 3 - 1) * d * 0.22;
    caps.push(box(2.2, 1.4, 1.8, ux, topY + 0.9, uz));
    caps.push(box(1.4, 1.0, 1.2, cx - (idx % 2 ? 1 : -1) * w * 0.25, topY + 0.7, cz));
  }
  let idx = 0;
  for (const ax of avenues) {
    for (const [side, z, w, h, d] of TOWERS) {
      emitTower(ax + side * (8.5 + d / 2), z, w, h, d, idx++);
    }
  }
  for (const [x, w, h] of SOUTH_TOWERS) {
    emitTower(x, -66, w, h, 10, idx++);
  }
  group.add(new THREE.Mesh(mergeGeometries(facadesA), facadeMatA));
  group.add(new THREE.Mesh(mergeGeometries(facadesB), facadeMatB));
  group.add(new THREE.Mesh(mergeGeometries(podiumsA), podiumMatA));
  group.add(new THREE.Mesh(mergeGeometries(podiumsB), podiumMatB));
  const capMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.9 });
  group.add(new THREE.Mesh(mergeGeometries(caps), capMat));

  const silhouettes = [
    box(20, 60, 16, -32, 30, -30), box(24, 74, 18, 34, 37, -8),
    box(18, 52, 14, -30, 26, 26), box(22, 66, 16, 32, 33, 38),
    box(22, 62, 16, 74, 31, -20), box(20, 56, 16, 72, 28, 30),
    box(26, 48, 16, 22, 24, -100),
  ];
  const silMat = new THREE.MeshBasicMaterial({ color: 0x080c16 });
  group.add(new THREE.Mesh(mergeGeometries(silhouettes), silMat));
  return group;
}
