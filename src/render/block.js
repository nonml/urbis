// Neon street block geometry. Everything repeated is instanced or merged —
// per-object draws for repeated things are banned (charter law #4).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadPBRMaps, loadPolyHavenMaps, standardFromMaps, facadeMaterial, concreteFacadeMaterial } from './materials.js';

const STREET_LEN = 200;
const ROAD_HALF = 3.5;

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
  const mats = {};
  const asphalt = loadPBRMaps(texLoader, maxAniso, 'asphalt', 'albedo', 2, 30);
  const roadMat = standardFromMaps(asphalt, { roughness: 0.38, envMapIntensity: 1.4, color: 0x7e838d });
  const roadMain = new THREE.PlaneGeometry(ROAD_HALF * 2, STREET_LEN);
  roadMain.rotateX(-Math.PI / 2);
  const roadEast = new THREE.PlaneGeometry(ROAD_HALF * 2, STREET_LEN);
  roadEast.rotateX(-Math.PI / 2);
  roadEast.translate(44, 0, 0);
  const roadWest = new THREE.PlaneGeometry(ROAD_HALF * 2, STREET_LEN);
  roadWest.rotateX(-Math.PI / 2);
  roadWest.translate(-44, 0, 0);
  const roadCross = new THREE.PlaneGeometry(104, ROAD_HALF * 2);
  roadCross.rotateX(-Math.PI / 2);
  roadCross.translate(0, 0, 40);
  const roadSouth = new THREE.PlaneGeometry(58, ROAD_HALF * 2);
  roadSouth.rotateX(-Math.PI / 2);
  roadSouth.translate(22, 0, -64);
  const roadMesh = new THREE.Mesh(mergeGeometries([roadMain, roadEast, roadWest, roadCross, roadSouth]), roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  mats.road = roadMat;

  const paving = loadPBRMaps(texLoader, maxAniso, 'paving_slabs', 'albedo', 1.5, 60);
  const walkMat = standardFromMaps(paving, { roughness: 0.6, envMapIntensity: 0.7, color: 0x9aa0ab });
  const walks = mergeGeometries([
    box(3, 0.24, STREET_LEN, -(ROAD_HALF + 1.5), 0.0, 0),
    box(3, 0.24, STREET_LEN, ROAD_HALF + 1.5, 0.0, 0),
    box(3, 0.24, STREET_LEN, 44 - (ROAD_HALF + 1.5), 0.0, 0),
    box(3, 0.24, STREET_LEN, 44 + (ROAD_HALF + 1.5), 0.0, 0),
    box(3, 0.24, STREET_LEN, -44 - (ROAD_HALF + 1.5), 0.0, 0),
    box(3, 0.24, STREET_LEN, -44 + (ROAD_HALF + 1.5), 0.0, 0),
    box(104, 0.24, 2.4, 0, 0.0, 40 - (ROAD_HALF + 1.2)),
    box(104, 0.24, 2.4, 0, 0.0, 40 + (ROAD_HALF + 1.2)),
    box(58, 0.24, 3, 22, 0.0, -64 - (ROAD_HALF + 1.5)),
    box(58, 0.24, 3, 22, 0.0, -64 + (ROAD_HALF + 1.5)),
    box(22, 0.24, 9, -17, 0.0, -32),
  ]);
  const walkMesh = new THREE.Mesh(walks, walkMat);
  walkMesh.receiveShadow = true;
  group.add(walkMesh);
  mats.walk = walkMat;

  const concrete = loadPBRMaps(texLoader, maxAniso, 'concrete', 'albedo', 1, 40);
  const curbMat = standardFromMaps(concrete, { roughness: 0.75, envMapIntensity: 0.4, color: 0x7d828c });
  const curbs = mergeGeometries([
    box(0.22, 0.15, STREET_LEN, -(ROAD_HALF + 0.11), 0.075, 0),
    box(0.22, 0.15, STREET_LEN, ROAD_HALF + 0.11, 0.075, 0),
    box(0.22, 0.15, STREET_LEN, 44 - (ROAD_HALF + 0.11), 0.075, 0),
    box(0.22, 0.15, STREET_LEN, 44 + (ROAD_HALF + 0.11), 0.075, 0),
    box(0.22, 0.15, STREET_LEN, -44 - (ROAD_HALF + 0.11), 0.075, 0),
    box(0.22, 0.15, STREET_LEN, -44 + (ROAD_HALF + 0.11), 0.075, 0),
    box(58, 0.15, 0.22, 22, 0.075, -64 - (ROAD_HALF + 0.11)),
    box(58, 0.15, 0.22, 22, 0.075, -64 + (ROAD_HALF + 0.11)),
    box(104, 0.15, 0.22, 0, 0.075, 40 - (ROAD_HALF + 0.11)),
    box(104, 0.15, 0.22, 0, 0.075, 40 + (ROAD_HALF + 0.11)),
    box(0.35, 1.0, 9, -27.8, 0.5, -32),
  ]);
  const curbMesh = new THREE.Mesh(curbs, curbMat);
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

  // Curb clutter: bollards, drain grates, utility boxes — all merged, +0 draws.
  const clutter = [];
  // Bollards at regular intervals along each avenue curb.
  for (const ax of [0, 44, -44]) {
    for (let z = -80; z <= 80; z += 16) {
      for (const side of [-1, 1]) {
        const bx = ax + side * (ROAD_HALF + 0.5);
        // Post
        clutter.push(box(0.12, 0.7, 0.12, bx, 0.35, z));
        // Cap
        clutter.push(box(0.18, 0.06, 0.18, bx, 0.73, z));
      }
    }
  }
  // Drain grates at intersections.
  for (const ax of [0, 44, -44]) {
    for (const gz of [40 - ROAD_HALF - 0.5, 40 + ROAD_HALF + 0.5]) {
      clutter.push(box(0.8, 0.02, 0.4, ax, 0.03, gz));
    }
  }
  // Utility boxes on the wider sidewalk sections.
  const boxPositions = [[-6.2, -40], [6.2, -20], [-50.2, 0], [50.2, 16], [-6.2, 36], [6.2, 56]];
  for (const [bx, bz] of boxPositions) {
    clutter.push(box(0.6, 1.0, 0.5, bx, 0.5, bz));
  }
  const clutterMesh = new THREE.Mesh(mergeGeometries(clutter), new THREE.MeshStandardMaterial({
    color: 0x2a2d33, roughness: 0.8, metalness: 0.3,
  }));
  clutterMesh.castShadow = true;
  clutterMesh.receiveShadow = true;
  group.add(clutterMesh);

  const groundBase = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 1, metalness: 0 })
  );
  groundBase.rotation.x = -Math.PI / 2;
  groundBase.position.y = -0.08;
  groundBase.receiveShadow = true;
  group.add(groundBase);
  const markings = buildMarkings();
  group.add(markings.group);
  return { group, mats, markings: markings.mats };
}

function buildMarkings() {
  const quads = [[], []];
  const push = (q, z) => quads[z < 0 ? 0 : 1].push(q);
  // Center dashes: 10cm wide, 3m long, 6m gap (real road standard).
  const dash = new THREE.PlaneGeometry(0.10, 3);
  for (const ax of [0, 44, -44]) {
    for (let z = -STREET_LEN / 2 + 3; z < STREET_LEN / 2 - 3; z += 6) {
      const q = dash.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(ax, 0.02, z);
      push(q, z);
    }
  }
  const dashX = new THREE.PlaneGeometry(2, 0.10);
  for (let x = -4; x <= 48; x += 5) {
    const q = dashX.clone();
    q.rotateX(-Math.PI / 2);
    q.translate(x, 0.02, -64);
    push(q, -64);
  }
  for (let x = -50; x <= 50; x += 5) {
    const q = dashX.clone();
    q.rotateX(-Math.PI / 2);
    q.translate(x, 0.02, 40);
    push(q, 40);
  }
  // Crosswalk stripes: 35cm wide, tight 70cm pitch.
  const stripe = new THREE.PlaneGeometry(0.35, ROAD_HALF * 2 - 1);
  for (let i = -3; i <= 3; i++) {
    const q = stripe.clone();
    q.rotateX(-Math.PI / 2);
    q.rotateY(Math.PI / 2);
    q.translate(0, 0.02, 20 + i * 0.7);
    push(q, 20);
  }
  const stripeE = new THREE.PlaneGeometry(0.35, ROAD_HALF * 2 - 1);
  for (let i = -3; i <= 3; i++) {
    const q = stripeE.clone();
    q.rotateX(-Math.PI / 2);
    q.rotateY(Math.PI / 2);
    q.translate(44, 0.02, -20 + i * 0.7);
    push(q, -20);
  }
  const stripeW = new THREE.PlaneGeometry(0.35, ROAD_HALF * 2 - 1);
  for (let i = -3; i <= 3; i++) {
    const q = stripeW.clone();
    q.rotateX(-Math.PI / 2);
    q.rotateY(Math.PI / 2);
    q.translate(-44, 0.02, 10 + i * 0.7);
    push(q, 10);
  }
  // Zebra crossings over the E-W connector (z=40) at each avenue.
  const stripeC = new THREE.PlaneGeometry(0.35, ROAD_HALF * 2 - 1);
  for (const ax of [-44, 0, 44]) {
    for (let i = -3; i <= 3; i++) {
      const q = stripeC.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(ax + i * 0.7, 0.02, 40);
      push(q, 40);
    }
  }
  // Edge lines split at the zone boundary — same look, two draws.
  const edge = new THREE.PlaneGeometry(0.10, STREET_LEN / 2);
  for (const ax of [0, 44, -44]) {
    for (const ex of [ax - 3.7, ax + 3.7]) {
      for (const [zc, zs] of [[-STREET_LEN / 4, 0], [STREET_LEN / 4, 1]]) {
        const q = edge.clone();
        q.rotateX(-Math.PI / 2);
        q.translate(ex, 0.02, zc);
        quads[zs].push(q);
      }
    }
  }
  const mats = [];
  const meshes = quads.map((list) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xb8bcc2, emissive: 0x6a7078, emissiveIntensity: 0.015, roughness: 0.6,
    });
    mats.push(mat);
    return new THREE.Mesh(mergeGeometries(list), mat);
  });
  const manholes = [];
  const mh = new THREE.CircleGeometry(0.55, 14);
  for (const ax of [0, 44, -44]) {
    for (let z = -48; z <= 48; z += 24) {
      const q = mh.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(ax + (z % 48 === 0 ? -1.8 : 1.8), 0.022, z);
      manholes.push(q);
    }
  }
  const mhMesh = new THREE.Mesh(
    mergeGeometries(manholes),
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.7, metalness: 0.4 })
  );
  const g = new THREE.Group();
  for (const m of meshes) g.add(m);
  g.add(mhMesh);
  return { group: g, mats };
}

const TOWERS = [
  // side, z-center, width, height, depth
  // (west row omits z=-32: the promenade gap to the river)
  [-1, -48, 12, 34, 10], [-1, -14, 14, 44, 11],
  [-1, 6, 11, 28, 10], [-1, 24, 13, 38, 10], [-1, 44, 10, 24, 10],
  [1, -44, 11, 26, 10], [1, -26, 13, 40, 11], [1, -6, 10, 30, 10],
  [1, 12, 12, 24, 10], [1, 30, 14, 46, 11], [1, 50, 10, 22, 10],
  // North district (z 64–92, mirrored on every avenue)
  [-1, 68, 12, 36, 10], [1, 78, 14, 48, 11], [-1, 90, 10, 28, 10],
];

const SOUTH_TOWERS = [
  // x-center, width, height (front face z=-61, facing the connector)
  [-2, 12, 30], [10, 10, 42], [22, 14, 26], [34, 11, 36], [46, 12, 28],
];

// Mid-block infill (x,z,w,h,d): fills the dark voids between avenues so the
// district reads as city blocks, not three streets. Merged into the same
// facade draws (+0 draws). Keeps clear of roads (x=0/±44 ±4, z=40 ±4, z=-64 ±4).
const INFILL_TOWERS = [
  [22, -48, 14, 30, 12], [-22, -48, 12, 26, 10],
  [22, -24, 12, 38, 11], [-22, -24, 14, 32, 12],
  [22, -4, 10, 24, 10], [-22, -4, 12, 28, 11],
  [22, 14, 13, 36, 11], [-22, 14, 11, 26, 10],
  [22, 28, 10, 22, 10], [-22, 28, 12, 30, 11],
  [22, 70, 12, 34, 11], [-22, 70, 14, 40, 12],
  [22, 88, 10, 26, 10], [-22, 88, 12, 32, 11],
  [66, -20, 12, 30, 11], [66, 30, 14, 38, 12],
];

// North terminus caps (z=104): close the avenue vistas so driving north
// ends in lit towers, not black void. Beyond playable bounds, visual only.
const TERMINUS_TOWERS = [
  [0, 104, 16, 44, 12], [44, 104, 14, 36, 11], [-44, 104, 14, 40, 12],
  [22, 106, 12, 52, 11], [-22, 106, 12, 48, 11],
];

const FACADE_MAPS = [
  ['color', 'color', true], ['emission', 'emission', true],
  ['normal', 'normal', false], ['rough', 'roughness', false], ['metal', 'metalness', false],
];

// Three facade architectures so the skyline is not one tower repeated: lit curtain
// glass in two tints, and poured concrete with the same windows punched through it.
// Each architecture carries a per-zone twin, because a blackout has to kill one
// zone's windows and leave the other burning. That is one draw per material and it
// is the price of the hack reading at all.
// What the pane emits, not what colour it is. A flat amber rectangle is a
// lightbox; a shop is a bright ceiling, a dim floor and stock in between, and
// at play distance that gradient plus a few dark verticals is the whole read.
// Every pane maps this once, so the district costs one 128x64 canvas.
function shopInteriorTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const wash = g.createLinearGradient(0, 0, 0, 64);
  wash.addColorStop(0, '#ffdcae');
  wash.addColorStop(0.28, '#e8a863');
  wash.addColorStop(0.72, '#8a5a30');
  wash.addColorStop(1, '#241708');
  g.fillStyle = wash;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(255,240,215,0.85)';
  g.fillRect(0, 2, 128, 5);           // ceiling strip
  g.fillStyle = 'rgba(20,12,6,0.72)';
  for (const [x, w, top] of [[12, 9, 22], [31, 6, 30], [58, 11, 18], [83, 7, 27], [104, 10, 24]]) {
    g.fillRect(x, top, w, 64 - top);  // shelving and stock
  }
  g.fillStyle = 'rgba(12,8,4,0.8)';
  g.fillRect(44, 34, 5, 30);          // a figure at the counter
  g.fillRect(43, 29, 7, 6);
  g.fillStyle = 'rgba(10,7,4,0.9)';
  g.fillRect(0, 58, 128, 6);          // the sill's own shadow
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function towerMaterials(texLoader, maxAniso) {
  const nightMaps = {};
  for (const [slot, file, srgb] of FACADE_MAPS) {
    const t = texLoader.load(`assets/facade_glass_night/${file}.jpg`);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
    nightMaps[slot] = t;
  }
  const dayColor = texLoader.load('assets/facade_glass/color.jpg');
  dayColor.colorSpace = THREE.SRGBColorSpace;
  dayColor.wrapS = dayColor.wrapT = THREE.RepeatWrapping;
  dayColor.anisotropy = maxAniso;
  const concrete = loadPolyHavenMaps(texLoader, maxAniso, 'concrete_wall_008', 1, 1);
  const kinds = [
    () => facadeMaterial(nightMaps, dayColor, 0x9aa2ae),
    () => facadeMaterial(nightMaps, dayColor, 0x8a94a8),
    () => concreteFacadeMaterial(concrete, nightMaps.emission, 0x767a83),
  ].map((make) => [make(), make()]);
  for (const zoned of kinds) for (const m of zoned) m.userData.baseTint = m.color.clone();
  const podium = [
    [loadPBRMaps(texLoader, maxAniso, 'plaster_rough', 'color', 3, 2), 0.85, 0x54575f],
    [loadPBRMaps(texLoader, maxAniso, 'plaster_painted', 'color', 3, 2), 0.8, 0x4e5158],
  ].map(([maps, roughness, color]) => standardFromMaps(maps, { roughness, envMapIntensity: 0.35, color }));
  // Ground-floor glazing, one material per power zone. It has to be zoned:
  // a shopfront still burning through a blackout is exactly the dishonesty
  // VGA-007 was opened for. Emissive is driven from main with the lamps.
  const interior = shopInteriorTexture();
  const shopGlass = [0, 1].map(() => {
    const m = new THREE.MeshStandardMaterial({
      color: 0x11161d, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: interior,
      roughness: 0.12, metalness: 0.55, envMapIntensity: 1.6,
    });
    m.userData.baseTint = m.color.clone();
    return m;
  });
  return {
    kinds,
    podium,
    shopGlass,
    // Only glass crossfades day to night in-shader; concrete looks the same at noon.
    facadeMats: [...kinds[0], ...kinds[1]],
    zoneMats: [[...kinds.map((twins) => twins[0]), shopGlass[0]],
      [...kinds.map((twins) => twins[1]), shopGlass[1]]],
  };
}

// A box laid flat against a podium face. `alongZ` says the face normal points
// down X, so the pane's width runs in Z instead.
function faceBox(wide, tall, thick, x, y, z, alongZ) {
  return alongZ ? box(thick, tall, wide, x, y, z) : box(wide, tall, thick, x, y, z);
}

export function buildTowers(texLoader, maxAniso) {
  const avenues = [0, 44, -44];
  const group = new THREE.Group();
  const mats = towerMaterials(texLoader, maxAniso);
  const facades = mats.kinds.map(() => [[], []]);
  const podiums = mats.podium.map(() => []);
  const caps = [];
  const shopGeos = [[], []];
  const shopPools = [];
  const beaconPts = [];
  // The eye-level pass. A 4.2m plaster box with one narrow door is the single
  // biggest reason the street reads as a model: at walking distance a wall has
  // to have a base, a rhythm, a shopfront and something casting a shadow on it.
  // Everything here merges into a mesh that already exists except the glazing,
  // which needs its own material because it lights up — and its own per-zone
  // twin, because a lit shopfront surviving a blackout is a lie.
  const SHOP_SILL = 0.55;
  const SHOP_HEAD = 3.15;
  const SHOP_MARGIN = 1.5;     // solid pier each side of the glazing
  const AWNING_OUT = 0.85;
  const SPILL_OUT = 1.9;       // pool centre, just off the kerb side of the glass
  function dressGroundFloor(cx, cz, w, d, zone, [fx, fz], pod) {
    const alongZ = fx !== 0;
    const pw = w + 1.2;
    const pd = d + 1.2;
    const span = alongZ ? pd : pw;
    const dir = alongZ ? fx : fz;
    const out = (alongZ ? pw : pd) / 2;
    const ox = alongZ ? cx + dir * out : cx;
    const oz = alongZ ? cz : cz + dir * out;
    // u runs across the face, t stands off it — both in the face's own frame.
    const at = (u, t) => (alongZ
      ? [ox + dir * t, oz + u]
      : [ox + u, oz + dir * t]);
    // Plinth: a dark stone base the whole podium stands on. Without it the
    // wall grows out of the pavement like a decal.
    caps.push(box(pw + 0.16, 0.5, pd + 0.16, cx, 0.25, cz));
    const run = span - SHOP_MARGIN * 2;
    const midY = (SHOP_SILL + SHOP_HEAD) / 2;
    const gh = SHOP_HEAD - SHOP_SILL;
    if (run > 1.2) {
      // Separate tenancies, not one continuous ribbon of light. A single 12m
      // pane reads as a lightbox stuck to the wall; piers every ~3.5m make the
      // block read as four shops that each happen to be open.
      const bays = Math.max(1, Math.round(run / 3.6));
      const pier = bays > 1 ? 0.5 : 0;
      const bayW = (run - pier * (bays - 1)) / bays;
      for (let i = 0; i < bays; i++) {
        const u = -run / 2 + i * (bayW + pier) + bayW / 2;
        const [gx, gz] = at(u, 0.02);
        shopGeos[zone].push(faceBox(bayW, gh, 0.08, gx, midY, gz, alongZ));
        // Spill on the pavement. A lit window with dark ground under it is a
        // sticker; this rides the existing per-zone pool mesh, so it is free
        // and it dies in a blackout with everything else.
        const [lx, lz] = at(u, SPILL_OUT);
        shopPools.push({ x: lx, z: lz, size: Math.min(bayW * 1.5, 7), color: '#ffb066', zone });
        // Mullions inside a bay: the vertical rhythm that says shopfront.
        for (const mu of [-bayW / 4, bayW / 4]) {
          const [mx, mz] = at(u + mu, 0.09);
          caps.push(faceBox(0.09, gh, 0.1, mx, midY, mz, alongZ));
        }
        if (i < bays - 1) {
          const [px, pz] = at(u + bayW / 2 + pier / 2, 0.08);
          pod.push(faceBox(pier, gh + 0.5, 0.18, px, midY + 0.1, pz, alongZ));
        }
      }
      // Sill under the glass, awning over it: two horizontal shadow lines.
      const [sx, sz] = at(0, 0.12);
      caps.push(faceBox(run + 0.3, 0.14, 0.24, sx, SHOP_SILL - 0.05, sz, alongZ));
      const [ax2, az2] = at(0, AWNING_OUT / 2);
      caps.push(faceBox(run + 0.5, 0.12, AWNING_OUT, ax2, SHOP_HEAD + 0.18, az2, alongZ));
    }
    // Pilasters in podium plaster, so they self-shadow and the lamps rake them.
    for (const u of [-span / 2 + 0.45, span / 2 - 0.45]) {
      const [px, pz] = at(u, 0.11);
      pod.push(faceBox(0.55, 4.2, 0.22, px, 2.1, pz, alongZ));
    }
  }
  // Every tower: podium base, shaft, optional setback crown, parapet lip, roof clutter.
  function emitTower(cx, cz, w, h, d, idx, face) {
    const zone = cz < 0 ? 0 : 1;
    const shaft = facades[idx % facades.length][zone];
    const pod = podiums[idx % podiums.length];
    pod.push(box(w + 1.2, 4.2, d + 1.2, cx, 2.1, cz));
    // Stone trim course capping the podium — one thin ring, catches lamp light.
    caps.push(box(w + 1.5, 0.22, d + 1.5, cx, 4.3, cz));
    // Door recess: dark inset on the street-facing podium face.
    const doorW = Math.min(w * 0.35, 2.4);
    const doorH = 3.0;
    const faceZ = cz + (d + 1.2) / 2 + 0.01;
    caps.push(box(doorW, doorH, 0.06, cx, doorH / 2, faceZ));
    // Small canopy over the door.
    caps.push(box(doorW + 0.6, 0.1, 0.8, cx, doorH + 0.15, faceZ + 0.35));
    if (face) dressGroundFloor(cx, cz, w, d, zone, face, pod);
    shaft.push(worldUVs(box(w, h, d, cx, h / 2, cz), w, h, d, 11));
    let topY = h;
    if (h >= 30 && idx % 2 === 0) {
      const uw = w * 0.72;
      const uh = h * 0.3;
      const ud = d * 0.72;
      shaft.push(worldUVs(box(uw, uh, ud, cx, h + uh / 2, cz), uw, uh, ud, 11));
      topY = h + uh;
    }
    caps.push(box(w + 0.4, 0.5, d + 0.4, cx, h + 0.25, cz));
    caps.push(box(w + 0.9, 0.35, d + 0.9, cx, topY + 0.1, cz));
    const ux = cx + (idx % 3 - 1) * w * 0.22;
    const uz = cz + ((idx + 1) % 3 - 1) * d * 0.22;
    caps.push(box(2.2, 1.4, 1.8, ux, topY + 0.9, uz));
    caps.push(box(1.4, 1.0, 1.2, cx - (idx % 2 ? 1 : -1) * w * 0.25, topY + 0.7, cz));
    if (topY >= 38) beaconPts.push([cx, topY + 0.7, cz]);
  }
  let idx = 0;
  for (const ax of avenues) {
    for (const [side, z, w, h, d] of TOWERS) {
      // The dressed face is the one the avenue sees, not an arbitrary +Z.
      emitTower(ax + side * (8.5 + d / 2), z, w, h, d, idx++, [-side, 0]);
    }
  }
  for (const [x, w, h] of SOUTH_TOWERS) {
    emitTower(x, -66, w, h, 10, idx++, [0, 1]);
  }
  for (const [x, z, w, h, d] of INFILL_TOWERS) {
    emitTower(x, z, w, h, d, idx++, [x > 0 ? -1 : 1, 0]);
  }
  for (const [x, z, w, h, d] of TERMINUS_TOWERS) {
    emitTower(x, z, w, h, d, idx++, [0, -1]);
  }
  const batches = [
    ...facades.flatMap((zoned, kind) => zoned.map((geos, zone) => [geos, mats.kinds[kind][zone]])),
    ...podiums.map((geos, i) => [geos, mats.podium[i]]),
  ];
  for (const [geos, mat] of batches) {
    if (!geos.length) throw new Error('buildTowers: empty batch would leave a material unlit');
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  // Mirror proxy (VGA-002): one merged copy of every facade per power zone, so
  // the reflection probe redraws the city in two passes instead of six. Water
  // cannot tell glass from concrete at reflection scale, so all three
  // architectures borrow the glass material — and each zone still dies with
  // its own lights.
  const mirrorProxies = facades[0].map((_, zone) => {
    const geos = facades.flatMap((zoned) => zoned[zone]);
    const m = new THREE.Mesh(mergeGeometries(geos), mats.kinds[0][zone]);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  });
  const capMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.9 });
  const capMesh = new THREE.Mesh(mergeGeometries(caps), capMat);
  capMesh.castShadow = true;
  group.add(capMesh);
  // Two draws for every shopfront in the district — one per power zone.
  shopGeos.forEach((geos, zone) => {
    if (!geos.length) throw new Error('buildTowers: a zone has no shopfronts');
    group.add(new THREE.Mesh(mergeGeometries(geos), mats.shopGlass[zone]));
  });

  const silhouettes = [
    box(20, 60, 16, -58, 30, -30), box(24, 74, 18, 34, 37, -8),
    box(18, 52, 14, -56, 26, 26), box(22, 66, 16, 32, 33, 38),
    box(22, 62, 16, 74, 31, -20), box(20, 56, 16, 72, 28, 30),
    box(26, 48, 16, 22, 24, -100),
  ];
  const silMat = new THREE.MeshBasicMaterial({ color: 0x080c16 });
  group.add(new THREE.Mesh(mergeGeometries(silhouettes), silMat));
  return {
    group, beacons: beaconPts, facadeMats: mats.facadeMats,
    zoneMats: mats.zoneMats, mirrorProxies, shopPools,
  };
}

// Horizon promise (VGA-054): lit-window ring beyond the playable blocks.
// One merged mesh, dimmed to silhouette by day from main.
export function buildSkyline(texLoader, maxAniso) {
  const emission = texLoader.load('assets/facade_glass_night/emission.jpg');
  emission.colorSpace = THREE.SRGBColorSpace;
  emission.wrapS = emission.wrapT = THREE.RepeatWrapping;
  emission.anisotropy = maxAniso;
  const RING = [
    // x, z, w, h, d — east wall, north rim, south rim (west stays open river valley)
    [110, -70, 22, 64, 18], [128, -30, 26, 88, 20], [112, 10, 20, 52, 16],
    [130, 50, 24, 72, 18], [108, 82, 20, 58, 16],
    [-20, 112, 24, 66, 18], [20, 118, 20, 84, 16], [60, 110, 26, 56, 20],
    [-30, -102, 22, 60, 18], [15, -108, 24, 78, 20], [58, -100, 18, 50, 16],
    [-62, 60, 18, 54, 16], [-64, -60, 20, 68, 18],
  ];
  const geos = RING.map(([x, z, w, h, d]) => worldUVs(box(w, h, d, x, h / 2, z), w, h, d, 9));
  const mat = new THREE.MeshBasicMaterial({ map: emission });
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}
