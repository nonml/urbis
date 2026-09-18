// Valley landscape: river west, mountain ring, grass banks + park, grass tufts.
// Static merges. Water normal scrolls; everything else sleeps.
//
// The heightfield itself lives in sim/world.js — a mover has to ask how high the
// ground is, and it must not reach into the renderer to do it (law 5). This file
// owns only the part that needs a BufferGeometry: displacing a mesh onto it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../sim/rng.js';
import { heightAt, RIVER_CHANNEL } from '../sim/world.js';

// Lift every vertex of an already-positioned geometry onto the field. A slab's
// top and bottom move together, so its thickness and its vertical sides survive
// and no face cracks open.
export function displaceToTerrain(geo) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, pos.getY(i) + heightAt(pos.getX(i), pos.getZ(i)));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// Narrower than the 9 m it was authored at, because 9 m is wider than the
// corridor can carry without undercutting the walkway. Both edges sit ~0.5 m
// below the bank, so the water never stands proud of the ground it runs through.
const RIVER_WIDE = 6;

// Why the river rendered as a hole in the ground, and what actually fixes it.
//
// It is tempting to blame metalness 0.85 for eating the reflection. It does not:
// three's IBL adds a white specularF90 grazing term, so at the 75-89 degrees
// this river is actually viewed from, the old material was already reflecting
// 0.30 to 1.07 of the environment. The reflection was never the problem.
//
// The problem is that there is nothing to reflect. scene.environment is a PMREM
// of RoomEnvironment, which is near-black along the horizon — and a horizontal
// mirror viewed at a grazing angle samples exactly that horizon. So the water
// returned almost nothing, and metalness 0.85 had suppressed the diffuse term
// to 15% of an already near-black colour, leaving it no body to fall back on.
// A dark mirror with nothing to mirror is a void.
//
// So: metalness 0, which is what water is anyway.
//
// And then envMapIntensity down to almost nothing, which is the part that took
// two tries. scene.environment does not dim — but updateDaylight() takes every
// real light down at dusk (sun 2.3 -> 0, hemi 0.75 -> 0.25, moon 0 -> 0.25). A
// material leaning on the environment therefore holds its brightness while the
// city falls away around it, and by midnight the river was the brightest thing
// in the frame: a glowing blue stripe. Nothing was wired wrong; a constant term
// simply outlived everything it was supposed to sit beside.
//
// Leaning on the lights instead is what makes the river track the day cycle,
// because they already do. No night factor has to be plumbed in and no call
// site has to change: remove the constant and the water dims with the street.
//
// Which leaves the colour to do the work, and it has to land in a window. Above
// the ground plane (albedo 0.0085) or the river is a hole again; below the
// grass banks it runs between (0.0247) or it glows. 0x0d2030 sits at 0.0133 —
// 0.58 to 0.76 of the bank at night across the whole range the environment
// might plausibly be, and 0.55 of it at noon. Dark water between lit banks,
// which is what a river looks like from a towpath at either hour.

export function buildRiver(texLoader, maxAniso) {
  const normal = texLoader.load('assets/asphalt/normal.jpg');
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  // Tiles every 2 m across and 3.1 m along. The old 3 x 7 m tile was asphalt
  // grain the size of a car: chop, not ripple. It never mattered before, because
  // the surface it was perturbing returned nothing either way — see below.
  normal.repeat.set(3, 90);
  normal.anisotropy = maxAniso;
  // Roughness is the one cue left. With the environment gone, the only thing
  // that says "liquid" is the sun and the moon glinting off the ripple, and
  // those track the day cycle for free. 0.18 spreads each glint into a smear
  // rather than a hard point, which survives being 80 m away without shimmering.
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0d2030, metalness: 0.0, roughness: 0.18,
    normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 0.06,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(RIVER_WIDE, 280), mat);
  // Opaque on purpose: it hides the bed, so the bank mesh under it never has to
  // be beautiful and the coarse ground plane's seam can never show through.
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(RIVER_CHANNEL[0], -0.5, RIVER_CHANNEL[1]);
  return { mesh, normal };
}

export function tickRiver(river, dt) {
  river.normal.offset.y -= dt * 0.03;
}

// One vertex every GRASS_CELL metres, the same cadence as the ground plane, so
// the two surfaces bend together and the plane cannot poke up through a verge.
const GRASS_CELL = 4;
// The banks fall 1.1 m over a 2.5 m run. At 4 m cells that slope is one segment
// and the grass cuts the corner straight through the water surface.
const BANK_CELL = 1;

// The strip the bank mesh owns outright. block.js cuts this footprint out of the
// 700 m ground plane, because a 4 m grid bridges a 9 m trench: its quads
// interpolate straight across and the channel renders 0.3-0.4 m shallower than
// the field says it is. Both edges land on the plane's own 4 m grid lines, and
// the bank's side faces — 0.3 m deep, top 0.13 m proud of the plane — cover the
// cut. One constant, so the hole and the thing filling it cannot drift apart.
export const RIVER_STRIP = { x0: -38, x1: -26, z0: -146, z1: 138 };

export function buildGrassGround() {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1c3020, roughness: 1.0, envMapIntensity: 0.2 });
  const geos = [];
  const slab = (w, d, x, z, cell = GRASS_CELL) => {
    const cells = (m) => Math.max(1, Math.round(m / cell));
    const g = new THREE.BoxGeometry(w, 0.3, d, cells(w), 1, cells(d));
    g.translate(x, -0.1, z);
    geos.push(g);
  };
  slab(2.5, 280, -50.75, -5); // far-west verge (west of the avenue)
  const rs = RIVER_STRIP;
  slab(rs.x1 - rs.x0, rs.z1 - rs.z0, (rs.x0 + rs.x1) / 2, (rs.z0 + rs.z1) / 2, BANK_CELL);
  slab(15, 32, 61, 5); // pocket park east
  slab(60, 4, 22, -71.5); // connector verge south
  slab(60, 4, 22, -56.5); // connector verge north
  const mesh = new THREE.Mesh(displaceToTerrain(mergeGeometries(geos)), mat);
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
    if (x > -36.1 && x < -29.5) continue; // open water
    const s = 0.7 + rand() * 0.9;
    dummy.position.set(x, heightAt(x, z) + 0.02, z);
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
