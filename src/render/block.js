// Street block geometry. Everything repeated is instanced or merged —
// per-object draws for repeated things are banned (charter law #4).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  FACADE_TILE, loadPBRMaps, loadPolyHavenMaps, standardFromMaps, facadeMaterial, concreteFacadeMaterial,
  zoneLit, zoneView, withZone,
} from './materials.js';
import { displaceToTerrain } from './landscape.js';
import {
  ROAD_HALF_WIDTH as ROAD_HALF, WALKWAY_WIDTH, AVENUES, AVENUE_X, CROSSINGS,
  isAvenue, way, wayCenter, wayLength,
} from '../sim/world.js';

// Where the city is comes from sim/world.js — this file draws the road graph,
// it does not get a second opinion about where the roads are.
const PLAZA = way('plaza');
const SOUTH = way('south');
// Every avenue runs the same span today, and the markings that straddle the
// zone boundary at z = 0 are cut against it.
const STREET_LEN = wayLength(way('main'));
// The ground under and beyond the city. One mesh, one draw — subdividing it is
// what lets it carry a Y (law 4 bans splitting it, not refining it). 4 m cells
// resolve the lip where relief meets the flat road corridor, which blends over
// 11 m; anything coarser turns that slope into three facets.
const GROUND_EXTENT = 700;
const GROUND_CELL = 4;

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

// The carriageways, in the order the street was merged in: avenues north-south,
// then the crossings east-west.
const ROADS = [...AVENUES, ...CROSSINGS];

// A way's tarmac as one quad: full width across, its own span along.
function carriageway(w) {
  const len = wayLength(w);
  const geo = isAvenue(w)
    ? new THREE.PlaneGeometry(ROAD_HALF * 2, len)
    : new THREE.PlaneGeometry(len, ROAD_HALF * 2);
  const c = wayCenter(w);
  geo.rotateX(-Math.PI / 2);
  geo.translate(c.x, 0, c.z);
  return geo;
}

// A pair of slabs flanking a way, one per side, sitting just off the kerb face.
function flankingSlabs(w, width, height, y) {
  const len = wayLength(w);
  const c = wayCenter(w);
  const off = ROAD_HALF + width / 2;
  return [-1, 1].map((side) => (isAvenue(w)
    ? box(width, height, len, c.x + side * off, y, c.z)
    : box(len, height, width, c.x, y, c.z + side * off)));
}

const WALK_RISE = 0.24;
// The plaza's footways are narrower than the standard: they give the width back
// to the 104 m of carriageway they flank.
const PLAZA_WALK_WIDTH = 2.4;
const KERB_WIDTH = 0.22;
const KERB_RISE = 0.15;
// The painted edge line, measured out from the centre-line like every other
// marking. It lands on the kerb face rather than beside it — inherited, and not
// this refactor's to move.
const EDGE_LINE_OUT = ROAD_HALF + 0.2;

export function buildGround(texLoader, maxAniso) {
  const group = new THREE.Group();
  const mats = {};
  const asphalt = loadPBRMaps(texLoader, maxAniso, 'asphalt', 'albedo', 2, 30);
  const roadMat = standardFromMaps(asphalt, { roughness: 0.38, envMapIntensity: 1.4, color: 0x7e838d });
  const roadMesh = new THREE.Mesh(mergeGeometries(ROADS.map(carriageway)), roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  mats.road = roadMat;

  const paving = loadPBRMaps(texLoader, maxAniso, 'paving_slabs', 'albedo', 1.5, 60);
  const walkMat = standardFromMaps(paving, { roughness: 0.6, envMapIntensity: 0.7, color: 0x9aa0ab });
  const walks = mergeGeometries([
    ...AVENUES.flatMap((av) => flankingSlabs(av, WALKWAY_WIDTH, WALK_RISE, 0.0)),
    ...flankingSlabs(PLAZA, PLAZA_WALK_WIDTH, WALK_RISE, 0.0),
    ...flankingSlabs(SOUTH, WALKWAY_WIDTH, WALK_RISE, 0.0),
    box(22, WALK_RISE, 9, -17, 0.0, -32),   // river promenade slab
  ]);
  const walkMesh = new THREE.Mesh(walks, walkMat);
  walkMesh.receiveShadow = true;
  group.add(walkMesh);
  mats.walk = walkMat;

  const concrete = loadPBRMaps(texLoader, maxAniso, 'concrete', 'albedo', 1, 40);
  const curbMat = standardFromMaps(concrete, { roughness: 0.75, envMapIntensity: 0.4, color: 0x7d828c });
  const kerbRails = (w) => flankingSlabs(w, KERB_WIDTH, KERB_RISE, KERB_RISE / 2);
  const curbs = mergeGeometries([
    ...AVENUES.flatMap(kerbRails),
    ...kerbRails(SOUTH),
    ...kerbRails(PLAZA),
    box(0.35, 1.0, 9, -27.8, 0.5, -32),     // river promenade parapet
  ]);
  const curbMesh = new THREE.Mesh(curbs, curbMat);
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

  // Curb clutter: bollards, drain grates, utility boxes — all merged, +0 draws.
  const clutter = [];
  // Bollards at regular intervals along each avenue curb.
  for (const ax of AVENUE_X) {
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
  for (const ax of AVENUE_X) {
    for (const gz of [PLAZA.z - ROAD_HALF - 0.5, PLAZA.z + ROAD_HALF + 0.5]) {
      clutter.push(box(0.8, 0.02, 0.4, ax, 0.03, gz));
    }
  }
  // Utility boxes on the wider sidewalk sections, out against the building line.
  const [MAIN_X, EAST_X, WEST_X] = AVENUE_X;
  const UTILITY_OUT = ROAD_HALF + 2.7;
  const boxPositions = [
    [MAIN_X - UTILITY_OUT, -40], [MAIN_X + UTILITY_OUT, -20],
    [WEST_X - UTILITY_OUT, 0], [EAST_X + UTILITY_OUT, 16],
    [MAIN_X - UTILITY_OUT, 36], [MAIN_X + UTILITY_OUT, 56],
  ];
  for (const [bx, bz] of boxPositions) {
    clutter.push(box(0.6, 1.0, 0.5, bx, 0.5, bz));
  }
  for (const ax of AVENUE_X) for (const side of [-1, 1]) pavementFurniture(clutter, ax, side);
  const clutterMesh = new THREE.Mesh(
    mergeGeometries(clutter.map((g) => (g.attributes.color ? g : tint(g, 1)))),
    new THREE.MeshStandardMaterial({
      color: 0x2a2d33, roughness: 0.8, metalness: 0.3, vertexColors: true,
    })
  );
  clutterMesh.castShadow = true;
  clutterMesh.receiveShadow = true;
  group.add(clutterMesh);

  group.add(terrainBase());
  const markings = buildMarkings();
  group.add(markings.group);
  return { group, mats, markings: markings.mats };
}

function terrainBase() {
  const cells = GROUND_EXTENT / GROUND_CELL;
  const geo = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, cells, cells);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    displaceToTerrain(geo),
    new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 1, metalness: 0 })
  );
  mesh.position.y = -0.08;
  mesh.receiveShadow = true;
  return mesh;
}

function buildMarkings() {
  const quads = [[], []];
  const push = (q, z) => quads[z < 0 ? 0 : 1].push(q);
  // Center dashes: 10cm wide, 3m long, 6m gap (real road standard).
  const dash = new THREE.PlaneGeometry(0.10, 3);
  for (const av of AVENUES) {
    for (let z = av.z0 + 3; z < av.z1 - 3; z += 6) {
      const q = dash.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(av.x, 0.02, z);
      push(q, z);
    }
  }
  // Along a crossing, stopping short of the junction mouth at either end.
  const dashX = new THREE.PlaneGeometry(2, 0.10);
  const crossDashes = (cr, inset) => {
    for (let x = cr.x0 + inset; x <= cr.x1 - inset; x += 5) {
      const q = dashX.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(x, 0.02, cr.z);
      push(q, cr.z);
    }
  };
  crossDashes(SOUTH, 3);
  crossDashes(PLAZA, 2);
  // Crosswalk stripes: 35cm wide, tight 70cm pitch. One mid-block crossing per
  // avenue, each at its own z so the three do not line up across the district.
  for (const [id, cz] of [['main', 20], ['east', -20], ['west', 10]]) {
    const stripe = new THREE.PlaneGeometry(0.35, ROAD_HALF * 2 - 1);
    for (let i = -3; i <= 3; i++) {
      const q = stripe.clone();
      q.rotateX(-Math.PI / 2);
      q.rotateY(Math.PI / 2);
      q.translate(way(id).x, 0.02, cz + i * 0.7);
      push(q, cz);
    }
  }
  // Zebra crossings over the plaza connector at each avenue.
  const stripeC = new THREE.PlaneGeometry(0.35, ROAD_HALF * 2 - 1);
  for (const ax of [...AVENUE_X].sort((a, b) => a - b)) {
    for (let i = -3; i <= 3; i++) {
      const q = stripeC.clone();
      q.rotateX(-Math.PI / 2);
      q.translate(ax + i * 0.7, 0.02, PLAZA.z);
      push(q, PLAZA.z);
    }
  }
  // Edge lines split at the zone boundary — same look, two draws.
  const edge = new THREE.PlaneGeometry(0.10, STREET_LEN / 2);
  for (const ax of AVENUE_X) {
    for (const ex of [ax - EDGE_LINE_OUT, ax + EDGE_LINE_OUT]) {
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
  for (const ax of AVENUE_X) {
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
  // (west row omits z=-32: the gap onto the promenade deck)
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
// A blackout has to kill one zone's windows and leave the other burning; each
// material lights both zones from a per-vertex zone (zoneLit), so that costs no
// draw of its own.
// What the pane emits, not what colour it is. A flat amber rectangle is a
// lightbox; a shop is a bright ceiling, a dim floor and stock in between, and
// at play distance that gradient plus a few dark verticals is the whole read.
//
// Four of them, in one 256x128 atlas, because the thing that gave the old
// single-cell version away was not any one pane — it was twenty identical
// amber panes in a row down the block. Each trade also gets its own colour
// temperature, so the street stops being lit by one bulb.
const SHOP_KINDS = [
  { wash: ['#eef6ff', '#d4e3f4', '#9db2c8', '#3c4a5a'], spill: '#dbe8ff' },  // grocery
  { wash: ['#ffe0b0', '#efad70', '#9a663a', '#4a301a'], spill: '#ffb066' },  // noodle bar
  { wash: ['#dff6ff', '#a8dcef', '#5d8b9e', '#2c424c'], spill: '#bfe4f5' },  // laundromat
  { wash: ['#fff2e6', '#f2d6c4', '#a4806c', '#4c362c'], spill: '#ffdcc4' },  // boutique
];

function paintShopCell(g, kind, ox, oy) {
  const w = 128;
  const h = 64;
  const wash = g.createLinearGradient(0, oy, 0, oy + h);
  const stops = SHOP_KINDS[kind].wash;
  [0, 0.28, 0.72, 1].forEach((t, i) => wash.addColorStop(t, stops[i]));
  g.fillStyle = wash;
  g.fillRect(ox, oy, w, h);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.fillRect(ox, oy + 2, w, 5);                                  // ceiling strip
  const ink = 'rgba(14,10,6,0.74)';
  g.fillStyle = ink;
  if (kind === 0) {
    for (const x of [10, 34, 58, 82, 106]) g.fillRect(ox + x, oy + 20, 12, 44);
    g.fillRect(ox, oy + 40, w, 2);                               // aisle shelf line
  } else if (kind === 1) {
    g.fillRect(ox + 8, oy + 46, w - 16, 12);                     // counter
    g.fillRect(ox + 52, oy + 24, 7, 18);                         // cook behind it
    g.fillRect(ox + 51, oy + 18, 9, 7);
    for (const x of [22, 46, 70, 94]) g.fillRect(ox + x, oy + 7, 3, 9);  // pendant stems
  } else if (kind === 2) {
    for (const x of [14, 44, 74, 104]) {                         // washer drums
      g.fillRect(ox + x - 10, oy + 26, 22, 30);
      g.fillStyle = 'rgba(230,248,255,0.55)';
      g.beginPath(); g.arc(ox + x, oy + 40, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink;
    }
  } else {
    for (const x of [30, 96]) {                                  // two mannequins
      g.fillRect(ox + x - 3, oy + 22, 6, 34);
      g.fillRect(ox + x - 5, oy + 16, 10, 7);
    }
    g.fillRect(ox + 56, oy + 44, 18, 20);                        // a low plinth
  }
  g.fillStyle = 'rgba(10,7,4,0.9)';
  g.fillRect(ox, oy + h - 6, w, 6);                              // the sill's shadow
}

function shopInteriorAtlas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  for (let k = 0; k < 4; k += 1) paintShopCell(g, k, (k % 2) * 128, k < 2 ? 0 : 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // No mips: a half-resolution mip of a 2x2 atlas bleeds the noodle bar into
  // the laundromat, and these panes are never far enough away to need them.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// Point a pane's UVs at one atlas cell. Canvas row 0 is the top, and a
// CanvasTexture flips Y, so cells 0 and 1 live in the upper half of UV space.
function uvCell(geo, kind) {
  const uv = geo.attributes.uv;
  const cu = (kind % 2) * 0.5;
  const cv = kind < 2 ? 0.5 : 0;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, cu + uv.getX(i) * 0.5, cv + uv.getY(i) * 0.5);
  }
  return geo;
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
    facadeMaterial(nightMaps, dayColor, 0x9aa2ae),
    facadeMaterial(nightMaps, dayColor, 0x8a94a8),
    concreteFacadeMaterial(concrete, nightMaps.emission, 0x767a83),
  ];
  for (const m of kinds) m.userData.baseTint = m.color.clone();
  const podium = [
    [loadPBRMaps(texLoader, maxAniso, 'plaster_rough', 'color', 3, 2), 0.85, 0x54575f],
    [loadPBRMaps(texLoader, maxAniso, 'plaster_painted', 'color', 3, 2), 0.8, 0x4e5158],
  ].map(([maps, roughness, color]) => standardFromMaps(maps, { roughness, envMapIntensity: 0.35, color }));
  // Ground-floor glazing, lit per power zone. It has to be zoned: a shopfront
  // still burning through a blackout is exactly the dishonesty VGA-007 was
  // opened for. Emissive is driven from main with the lamps.
  const interior = shopInteriorAtlas();
  const shopGlass = zoneLit(new THREE.MeshStandardMaterial({
    color: 0x11161d, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: interior,
    roughness: 0.12, metalness: 0.55, envMapIntensity: 1.6,
  }), 'shop-glass');
  shopGlass.userData.baseTint = shopGlass.color.clone();
  // A tower's windows go dark at noon. A shop's do not — its lights stay on
  // all day, and without that floor the glazing reads as a black hole punched
  // in a sunlit wall, which is the loudest "toy" tell left at eye level.
  shopGlass.userData.emissiveScale = 0.34;
  shopGlass.userData.dayFloor = 0.3;
  return {
    kinds,
    podium,
    shopGlass,
    // Only glass crossfades day to night in-shader; concrete looks the same at noon.
    facadeMats: [kinds[0], kinds[1]],
    zoneMats: [0, 1].map((zone) => [...kinds, shopGlass].map((m) => zoneView(m, zone))),
  };
}

// One flat colour multiplier baked into a part before it joins the shared
// clutter mesh. Per channel, so a crate can be warm timber and a downpipe
// cold steel out of the same material and the same draw.
function tint(geo, r, g = r, b = r) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) { col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Everything a real pavement has and a modelled one does not: meters to walk
// past, bikes locked to hoops, stock waiting outside a back door, and the
// plant on the wall behind it all. Every piece merges into the clutter mesh
// that already exists, so a street's worth of life costs no draw at all.
function pavementFurniture(out, ax, side) {
  const kerb = ax + side * 4.35;
  const mid = ax + side * 6.1;
  const wall = ax + side * 7.62;
  for (let z = -72; z <= 72; z += 16) {
    out.push(tint(box(0.09, 1.1, 0.09, kerb, 0.55, z + 8), 0.9));
    out.push(tint(box(0.17, 0.3, 0.13, kerb, 1.2, z + 8), 1.0));
    out.push(tint(box(0.12, 0.12, 0.02, kerb - side * 0.07, 1.24, z + 8), 2.6, 2.3, 1.4));
  }
  for (let z = -66; z <= 66; z += 22) {
    // Downpipe with its hopper: the one thing that stops a podium wall being
    // a painted plane, and it reads at every distance.
    out.push(tint(box(0.17, 4.2, 0.17, wall, 2.1, z), 0.8));
    out.push(tint(box(0.34, 0.3, 0.3, wall, 4.05, z), 0.8));
    out.push(tint(box(0.26, 0.26, 0.26, wall, 0.5, z), 0.8));
  }
  for (let z = -55; z <= 60; z += 38) {
    // Condenser on a bracket, high enough to clear a head.
    out.push(tint(box(0.78, 0.6, 0.46, ax + side * 7.4, 3.72, z), 1.5));
    out.push(tint(box(0.9, 0.08, 0.1, ax + side * 7.5, 3.38, z), 0.7));
  }
  for (let z = -48; z <= 60; z += 27) {
    // Bike hoop: two posts and a bar, the cheapest object that says people
    // arrive here under their own power.
    for (const dz of [-0.36, 0.36]) out.push(tint(box(0.07, 0.78, 0.07, mid, 0.39, z + dz), 1.1));
    out.push(tint(box(0.07, 0.07, 0.79, mid, 0.78, z), 1.1));
  }
  for (const z of [-34, 14, 52]) {
    // Stock crates by a back door. Warm timber against all that cold steel.
    out.push(tint(box(0.78, 0.5, 0.62, ax + side * 7.1, 0.25, z), 2.5, 1.95, 1.15));
    out.push(tint(box(0.62, 0.44, 0.5, ax + side * 7.1, 0.72, z + 0.1), 2.2, 1.7, 1.0));
  }
  for (const z of [-24, 6, 44]) {
    // A-board: two leaves leaning into each other. One plate is a blank
    // panel standing in the street; two is a thing somebody put out.
    for (const lean of [0.19, -0.19]) {
      const a = box(0.6, 0.8, 0.05, 0, 0, 0);
      a.rotateX(lean);
      a.rotateY(side > 0 ? -1.35 : 1.35);
      a.translate(mid + side * 0.35 + lean * 0.4, 0.39, z);
      out.push(tint(a, 0.85));
    }
  }
}

// Only one face of each podium gets a shopfront — the one its avenue sees.
// The other three were flat plaster slabs four metres tall, and from any
// cross street that is a grey void where a building should be. Every face
// gets the rhythm instead: pilasters, a corner downpipe with its hopper and
// shoe, and a condenser where a back-of-house wall would carry one. All of
// it merges into the podium and trim meshes that already exist.
function podiumSkin(cx, cz, pw, pd, caps, pod) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = cx + sx * (pw / 2 + 0.16);
      const z = cz + sz * (pd / 2 + 0.16);
      caps.push(box(0.19, 4.2, 0.19, x, 2.1, z));
      caps.push(box(0.36, 0.3, 0.36, x, 4.06, z));
      caps.push(box(0.28, 0.26, 0.28, x, 0.5, z));
    }
  }
  // Pilasters on the two faces the avenue never sees, at the same 0.55 width
  // and 4.2 height the dressed face uses, so the block reads consistent.
  for (const sz of [-1, 1]) {
    for (const u of [-pw / 2 + 0.5, 0, pw / 2 - 0.5]) {
      pod.push(box(0.55, 4.2, 0.22, cx + u, 2.1, cz + sz * (pd / 2 + 0.11)));
    }
  }
  for (const sx of [-1, 1]) {
    for (const u of [-pd / 2 + 0.5, 0, pd / 2 - 0.5]) {
      pod.push(box(0.22, 4.2, 0.55, cx + sx * (pw / 2 + 0.11), 2.1, cz + u));
    }
  }
  caps.push(box(0.8, 0.62, 0.48, cx + pw / 2 + 0.34, 3.5, cz + pd * 0.28));
  caps.push(box(0.48, 0.62, 0.8, cx - pw * 0.3, 3.5, cz - pd / 2 - 0.34));
}

// Flyposting. A podium wall with pilasters on it is still a clean wall, and
// clean is the last thing a ground floor is: the surface people can reach is
// the one that gets covered. Four bills in a 2x2 atlas, planted in clusters
// with a little rotation and a little overlap, on every face of every podium
// — one mesh, one material, one draw for the whole district.
const POSTER_INK = ['#c8342a', '#1d5ca8', '#d8a417', '#2a8f68'];

function paintPoster(g, k, ox, oy) {
  const S = 128;
  g.fillStyle = k % 2 ? '#d8d2c4' : '#b9b3a6';
  g.fillRect(ox, oy, S, S);
  g.fillStyle = POSTER_INK[k];
  if (k === 0) {
    g.fillRect(ox + 8, oy + 10, S - 16, 44);
    g.fillStyle = '#1b1712';
    for (let i = 0; i < 5; i += 1) g.fillRect(ox + 14, oy + 66 + i * 11, S - 28 - (i % 3) * 18, 5);
  } else if (k === 1) {
    g.beginPath(); g.arc(ox + S / 2, oy + 52, 34, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#17141a';
    g.fillRect(ox + 10, oy + 96, S - 20, 8);
    g.fillRect(ox + 26, oy + 110, S - 52, 6);
  } else if (k === 2) {
    for (let i = 0; i < 4; i += 1) g.fillRect(ox + 10, oy + 12 + i * 30, S - 20, 18);
    g.fillStyle = '#1b1712';
    g.fillRect(ox + 10, oy + 116, S - 20, 6);
  } else {
    g.fillRect(ox + 12, oy + 14, 46, S - 30);
    g.fillStyle = '#17141a';
    for (let i = 0; i < 7; i += 1) g.fillRect(ox + 66, oy + 20 + i * 14, 48 - (i % 2) * 16, 6);
  }
  g.fillStyle = 'rgba(12,10,8,0.5)';
  g.fillRect(ox, oy, S, 3);
  g.fillRect(ox, oy + S - 3, S, 3);
}

function posterAtlas() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  for (let k = 0; k < 4; k += 1) paintPoster(g, k, (k % 2) * 128, k < 2 ? 0 : 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function posterCell(geo, k) {
  const uv = geo.attributes.uv;
  const cu = (k % 2) * 0.5;
  const cv = k < 2 ? 0.5 : 0;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, cu + uv.getX(i) * 0.5, cv + uv.getY(i) * 0.5);
  return geo;
}

// Bills go on all four faces, seeded off the tower index so the same wall
// carries the same bills every run. They cluster and overlap rather than
// spacing out politely: evenly spaced posters read as signage, and a stack
// of them half over each other reads as a wall nobody owns. Pasted at 0.03
// off the plaster so they sit behind the pilasters, not in front of them.
function posterCluster(out, at, span, base, idx, f) {
  const n = 2 + ((idx * 7 + f) % 3);
  for (let i = 0; i < n; i += 1) {
    const seed = idx * 31 + f * 11 + i * 7 + base * 3;
    const h = 0.58 + ((seed % 5) * 0.11);
    const geo = posterCell(new THREE.PlaneGeometry(h * 0.72, h), (seed * 5) % 4);
    geo.rotateZ((((seed * 13) % 11) - 5) * 0.014);
    at(geo, base + (((seed * 23) % 100) / 100 - 0.5) * 0.9, 1.45 + ((seed % 7) * 0.17));
    if (Math.abs(base) < span / 2) out.push(geo);
  }
}

function posterWall(out, cx, cz, pw, pd, idx) {
  for (let f = 0; f < 4; f += 1) {
    const alongZ = f < 2;
    const dir = f % 2 ? 1 : -1;
    const span = (alongZ ? pd : pw) - 1.6;
    const t = (alongZ ? pw : pd) / 2 + 0.03;
    const at = (geo, u, y) => {
      geo.rotateY(alongZ ? dir * Math.PI / 2 : (dir > 0 ? 0 : Math.PI));
      geo.translate(alongZ ? cx + dir * t : cx + u, y, alongZ ? cz + u : cz + dir * t);
    };
    for (const base of [-span * 0.28, span * 0.3]) posterCluster(out, at, span, base, idx, f);
  }
}

// A box laid flat against a podium face. `alongZ` says the face normal points
// down X, so the pane's width runs in Z instead.
function faceBox(wide, tall, thick, x, y, z, alongZ) {
  return alongZ ? box(thick, tall, wide, x, y, z) : box(wide, tall, thick, x, y, z);
}

// The ground a merged box covers, as a centre and a size.
function footprintOf(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  return { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2, w: max.x - min.x, d: max.z - min.z };
}

export function buildTowers(texLoader, maxAniso) {
  const group = new THREE.Group();
  const mats = towerMaterials(texLoader, maxAniso);
  const facades = mats.kinds.map(() => [[], []]);
  const podiums = mats.podium.map(() => []);
  const caps = [];
  const shopGeos = [[], []];
  const shopPools = [];
  const beaconPts = [];
  const posters = [];
  // Where every tower stands, podium included: a crane on a growth lot zones
  // its jib around these (render/zoning.js).
  const footprints = [];
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
  function dressGroundFloor(cx, cz, w, d, zone, [fx, fz], pod, idx) {
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
        // Which trade this tenancy is. Stepping by a number coprime with 4
        // across both the block index and the bay index means no two
        // neighbours match and no block repeats the block before it.
        const kind = (idx * 3 + i) % SHOP_KINDS.length;
        shopGeos[zone].push(uvCell(faceBox(bayW, gh, 0.08, gx, midY, gz, alongZ), kind));
        // Spill on the pavement. A lit window with dark ground under it is a
        // sticker; this rides the existing per-zone pool mesh, so it is free
        // and it dies in a blackout with everything else.
        const [lx, lz] = at(u, SPILL_OUT);
        shopPools.push({
          x: lx, z: lz, size: Math.min(bayW * 1.5, 7), color: SHOP_KINDS[kind].spill, zone,
        });
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
      // A canopy is a plate held up by something, with an edge that hangs.
      // Without the valance and the brackets it is a slab floating off a
      // wall, which is most of why the awnings read as black voids rather
      // than as awnings.
      const [vx, vz] = at(0, AWNING_OUT - 0.04);
      caps.push(faceBox(run + 0.5, 0.26, 0.07, vx, SHOP_HEAD + 0.01, vz, alongZ));
      const stays = Math.max(2, Math.round(run / 3.2));
      for (let k = 0; k <= stays; k += 1) {
        const u = -run / 2 + (run / stays) * k;
        const [bx, bz] = at(u, AWNING_OUT / 2);
        const b = alongZ
          ? new THREE.BoxGeometry(AWNING_OUT * 1.25, 0.07, 0.07)
          : new THREE.BoxGeometry(0.07, 0.07, AWNING_OUT * 1.25);
        b.translate(0, 0, 0);
        b.rotateZ(alongZ ? dir * 0.42 : 0);
        b.rotateX(alongZ ? 0 : -dir * 0.42);
        b.translate(bx, SHOP_HEAD - 0.06, bz);
        caps.push(b);
      }
    }
    // Pilasters in podium plaster, so they self-shadow and the lamps rake them.
    for (const u of [-span / 2 + 0.45, span / 2 - 0.45]) {
      const [px, pz] = at(u, 0.11);
      pod.push(faceBox(0.55, 4.2, 0.22, px, 2.1, pz, alongZ));
    }
  }
  // Every tower: podium base, shaft, optional setback crown, parapet lip, roof clutter.
  // `name` says which table row this is, so the overlap check can point at it.
  function emitTower(cx, cz, w, h, d, idx, face, name) {
    const zone = cz < 0 ? 0 : 1;
    const shaft = facades[idx % facades.length][zone];
    const pod = podiums[idx % podiums.length];
    pod.push(box(w + 1.2, 4.2, d + 1.2, cx, 2.1, cz));
    podiumSkin(cx, cz, w + 1.2, d + 1.2, caps, pod);
    posterWall(posters, cx, cz, w + 1.2, d + 1.2, idx);
    // Stone trim course capping the podium — one thin ring, catches lamp light.
    caps.push(box(w + 1.5, 0.22, d + 1.5, cx, 4.3, cz));
    // Door recess: dark inset on the street-facing podium face.
    const doorW = Math.min(w * 0.35, 2.4);
    const doorH = 3.0;
    const faceZ = cz + (d + 1.2) / 2 + 0.01;
    caps.push(box(doorW, doorH, 0.06, cx, doorH / 2, faceZ));
    // Small canopy over the door.
    caps.push(box(doorW + 0.6, 0.1, 0.8, cx, doorH + 0.15, faceZ + 0.35));
    if (face) dressGroundFloor(cx, cz, w, d, zone, face, pod, idx);
    shaft.push(worldUVs(box(w, h, d, cx, h / 2, cz), w, h, d, FACADE_TILE));
    let topY = h;
    if (h >= 30 && idx % 2 === 0) {
      const uw = w * 0.72;
      const uh = h * 0.3;
      const ud = d * 0.72;
      shaft.push(worldUVs(box(uw, uh, ud, cx, h + uh / 2, cz), uw, uh, ud, FACADE_TILE));
      topY = h + uh;
    }
    caps.push(box(w + 0.4, 0.5, d + 0.4, cx, h + 0.25, cz));
    caps.push(box(w + 0.9, 0.35, d + 0.9, cx, topY + 0.1, cz));
    const ux = cx + (idx % 3 - 1) * w * 0.22;
    const uz = cz + ((idx + 1) % 3 - 1) * d * 0.22;
    caps.push(box(2.2, 1.4, 1.8, ux, topY + 0.9, uz));
    caps.push(box(1.4, 1.0, 1.2, cx - (idx % 2 ? 1 : -1) * w * 0.25, topY + 0.7, cz));
    if (topY >= 38) beaconPts.push([cx, topY + 0.7, cz]);
    footprints.push({ x: cx, z: cz, w: w + 1.2, d: d + 1.2, name });
  }
  let idx = 0;
  for (const ax of AVENUE_X) {
    TOWERS.forEach(([side, z, w, h, d], i) => {
      // The dressed face is the one the avenue sees, not an arbitrary +Z.
      emitTower(ax + side * (8.5 + d / 2), z, w, h, d, idx++, [-side, 0], `TOWERS[${i}] avenue x=${ax}`);
    });
  }
  SOUTH_TOWERS.forEach(([x, w, h], i) => {
    emitTower(x, -66, w, h, 10, idx++, [0, 1], `SOUTH_TOWERS[${i}]`);
  });
  INFILL_TOWERS.forEach(([x, z, w, h, d], i) => {
    emitTower(x, z, w, h, d, idx++, [x > 0 ? -1 : 1, 0], `INFILL_TOWERS[${i}]`);
  });
  TERMINUS_TOWERS.forEach(([x, z, w, h, d], i) => {
    emitTower(x, z, w, h, d, idx++, [0, -1], `TERMINUS_TOWERS[${i}]`);
  });
  // Zone 0's shafts then zone 1's, each stamped with its zone: one mesh per
  // architecture lights both halves of the district.
  for (const zoned of facades) zoned.forEach((geos, zone) => geos.forEach((g) => withZone(g, zone)));
  const batches = [
    ...facades.map((zoned, kind) => [zoned.flat(), mats.kinds[kind]]),
    ...podiums.map((geos, i) => [geos, mats.podium[i]]),
  ];
  for (const [geos, mat] of batches) {
    if (!geos.length) throw new Error('buildTowers: empty batch would leave a material unlit');
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  // Mirror proxy (VGA-002): one merged copy of every facade, so the reflection
  // probe redraws the city in one pass instead of six. Water cannot tell glass
  // from concrete at reflection scale, so all three architectures borrow the
  // glass material — and each zone still dies with its own lights, because the
  // proxy carries the same zone stamp.
  const mirrorProxy = new THREE.Mesh(
    mergeGeometries([0, 1].flatMap((zone) => facades.flatMap((zoned) => zoned[zone]))),
    mats.kinds[0],
  );
  mirrorProxy.castShadow = false;
  mirrorProxy.receiveShadow = false;
  const mirrorProxies = [mirrorProxy];
  const capMat = new THREE.MeshStandardMaterial({
    color: 0x1b1f27, roughness: 0.78, metalness: 0.15, envMapIntensity: 0.7,
  });
  const posterMesh = new THREE.Mesh(mergeGeometries(posters), new THREE.MeshStandardMaterial({
    map: posterAtlas(), roughness: 0.94, metalness: 0, side: THREE.DoubleSide,
  }));
  posterMesh.receiveShadow = true;
  group.add(posterMesh);
  const capMesh = new THREE.Mesh(mergeGeometries(caps), capMat);
  capMesh.castShadow = true;
  group.add(capMesh);
  // One draw for every shopfront in the district, both power zones.
  shopGeos.forEach((geos, zone) => {
    if (!geos.length) throw new Error('buildTowers: a zone has no shopfronts');
    for (const g of geos) withZone(g, zone);
  });
  group.add(new THREE.Mesh(mergeGeometries(shopGeos.flat()), mats.shopGlass));

  const silhouettes = [
    box(20, 60, 16, -58, 30, -30), box(24, 74, 18, 34, 37, -8),
    box(18, 52, 14, -56, 26, 26), box(22, 66, 16, 32, 33, 38),
    box(22, 62, 16, 74, 31, -20), box(20, 56, 16, 72, 28, 30),
    box(26, 48, 16, 22, 24, -100),
  ];
  const silMat = new THREE.MeshBasicMaterial({ color: 0x080c16 });
  group.add(new THREE.Mesh(mergeGeometries(silhouettes), silMat));
  footprints.push(...silhouettes.map((g, i) => ({ ...footprintOf(g), name: `silhouettes[${i}]` })));
  return {
    group, beacons: beaconPts, facadeMats: mats.facadeMats,
    zoneMats: mats.zoneMats, kinds: mats.kinds, mirrorProxies, shopPools, footprints,
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
    // x, z, w, h, d — east wall, north rim, south rim (west stays open valley)
    [110, -70, 22, 64, 18], [128, -30, 26, 88, 20], [112, 10, 20, 52, 16],
    [130, 50, 24, 72, 18], [108, 82, 20, 58, 16],
    [-20, 112, 24, 66, 18], [20, 118, 20, 84, 16], [60, 110, 26, 56, 20],
    [-30, -102, 22, 60, 18], [15, -108, 24, 78, 20], [58, -100, 18, 50, 16],
    [-62, 60, 18, 54, 16], [-64, -60, 20, 68, 18],
  ];
  const geos = RING.map(([x, z, w, h, d]) => worldUVs(box(w, h, d, x, h / 2, z), w, h, d, 9));
  const mat = new THREE.MeshBasicMaterial({ map: emission });
  const footprints = geos.map((g, i) => ({ ...footprintOf(g), name: `RING[${i}]` }));
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.frustumCulled = false;
  return { mesh, mat, footprints };
}
