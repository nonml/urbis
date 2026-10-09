// The outskirts: the low-density edge the city thins out into — lanes, field
// hedgerows, post-and-rail fences, yards with sheds and drums, telegraph poles,
// scrub. Streamed tile by tile by render/chunks.js.
//
// Why this is instance pools and not meshes.
//
// A tile that builds its own meshes costs its own draws, and twenty-five
// resident tiles then cost twenty-five times whatever one tile costs. At a 175
// draw budget that is dead on arrival. So the world owns exactly one
// InstancedMesh per prop kind, sized once at boot, and a tile claims *slots* in
// those pools and hands them back when it goes. Outskirts therefore cost a
// fixed 9 draws whether one tile is resident or forty.
//
// The consequence for chunks.js: a builder here returns a claim handle, not an
// Object3D. Nothing is added to the scene per tile and nothing is disposed per
// tile — the manager calls release() and the slots go back on the free list.
//
// The ground under all this is one static merged slab, not a per-tile one, for
// the same reason: per-tile ground is exactly the thing that blows the budget.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { displaceToTerrain } from './landscape.js';
import { heightAt, ROAD_HALF_WIDTH, WALKWAY_WIDTH } from '../sim/world.js';
import { vistasOf } from '../sim/vistas.js';
import { worldMap } from '../sim/patrol.js';
import { graphBounds } from '../sim/map.js';
import { tileSeed } from './chunks.js';
import { mulberry32 } from '../sim/rng.js';

// Where the outskirts are allowed to be: two bands south and east of the city.
// The hand map keeps HAND_BANDS; a generated city lays them past its town's own
// outline with bandsFor.
//
// They wrap the south and the east only. West and north are the mountain
// ranges: they stand MOUNTAIN_CLEAR outside the walk box to the west and north
// (render/landscape.js), and a shed inside a mountain is worse than no shed.
// The west edge also stops short of the river strip (x -38..-26).
//
// Every bound sits on x,z = 2 (mod 4), which is the lattice the 700 m ground
// plane's 4 m grid lands on, so the slab below cannot interpenetrate it.
// `inner` names the edge that faces the city — the only one close enough to be
// looked at, and so the only one the ground slab bothers to fade out along.
export const HAND_BANDS = [
  { x0: -22, x1: 86, z0: -206, z1: -122, inner: 'z' },   // south of the district
  { x0: 86, x1: 190, z0: -206, z1: 74, inner: 'x' },     // east of the district
];

const BAND_GAP = 8;      // fields start this far past the last tower
const SOUTH_DEPTH = 84;  // the hand bands' own depth
const EAST_WIDTH = 104;  // the hand bands' own width

// The nearest bound on the 2 (mod 4) ground lattice, outward.
const onLattice = (v, up) => (up ? Math.ceil((v - 2) / 4) : Math.floor((v - 2) / 4)) * 4 + 2;

// The town's outline: the box the town's own roads span. The downtown district
// the map keeps and every cell of the town plan are cut inside it, and the
// arterials that join the cells run out to its edge, so a band laid just past it
// stands past every road the town has — a district's own walk box is a third of
// that, and laying the bands off it put hedgerows, sheds and scrub inside the
// town's outer districts.
export function outlineFor(map) {
  return map?.graph ? graphBounds(map.graph) : null;
}

// A district's own outline, for a caller holding no town: the box its roads and
// its park span. bandsFor's default, so the hand map and the district tests lay
// their bands exactly where they always did.
const districtOutline = (district) => ({
  minX: district.drive.minX, maxX: district.walk.maxX,
  minZ: district.walk.minZ, maxZ: district.walk.maxZ,
});

// Returns the two farmland bands — south and east of the skyline, never under
// it — for the given district and its planned vistas. `outline` is the town's
// own (outlineFor); a district's stands in for it when there is no town.
export function bandsFor(district, vistas, outline = districtOutline(district)) {
  const towers = [...vistas.caps, ...vistas.ring];
  const eastFace = Math.max(outline.maxX, ...towers.map((t) => t.x + t.w / 2));
  const southFace = Math.min(outline.minZ, ...towers.map((t) => t.z - t.d / 2));
  const x0 = onLattice(eastFace + BAND_GAP, true);
  const z1 = onLattice(southFace - BAND_GAP, false);
  const z0 = z1 - SOUTH_DEPTH;
  return [
    { x0: onLattice(outline.minX, true), x1: x0, z0, z1, inner: 'z' },
    { x0, x1: x0 + EAST_WIDTH, z0, z1: onLattice(outline.maxZ, false), inner: 'x' },
  ];
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// A bend pulled back onto its band.
const into = (b, x, z) => [clamp(x, b.x0, b.x1), clamp(z, b.z0, b.z1)];
const nearest = (list, key, v) => list.reduce((best, o) => (Math.abs(o[key] - v) < Math.abs(best[key] - v) ? o : best));

// Every way the town's roads run along — the downtown district's own, each
// cell's, and the arterials that join them, which is the set map.js cuts into
// one graph. A farm track leaves town on one of these, so it starts on a road a
// player can drive out of town on.
function waysOf(map) {
  const cells = map.cells ?? [];
  const arterials = map.town?.arterials ?? { avenues: [], crossings: [] };
  return {
    avenues: [map.district.avenues, ...cells.map((c) => c.avenues), arterials.avenues].flat(),
    crossings: [map.district.crossings, ...cells.map((c) => c.crossings), arterials.crossings].flat(),
  };
}

// The four tracks: an east-reaching crossing carried out east, a spine down
// the east band, a spine across the south band, an avenue carried out south.
// Every bend is a fraction of its band, so a band a kilometre long down a whole
// town gets a spine that runs its length and not one that wanders in a corner.
// `ways` is the town's own; a district's stands in for it (lanesFor's default).
export function lanesFor(district, [south, east], ways = district) {
  const far = Math.max(...ways.crossings.map((c) => c.x1));
  const crossing = nearest(ways.crossings.filter((c) => c.x1 === far), 'z', (east.z0 + east.z1) / 2);
  const avenue = nearest(ways.avenues, 'x', (south.x0 + south.x1) / 2);
  const ew = east.x1 - east.x0;
  const sw = south.x1 - south.x0;
  const ed = east.z1 - east.z0;
  const sd = south.z1 - south.z0;
  const cz = crossing.z;
  return [
    [[east.x0, cz], into(east, east.x0 + ew * 0.31, cz + 5), into(east, east.x0 + ew * 0.63, cz - 3), [east.x1, clamp(cz + 1, east.z0, east.z1)]],
    [into(east, east.x0 + ew * 0.09, east.z1 - ed * 0.69), into(east, east.x0 + ew * 0.12, east.z1 - ed * 0.40), into(east, east.x0 + ew * 0.10, east.z1 - ed * 0.15), into(east, east.x0 + ew * 0.08, east.z1 - ed * 0.02)],
    [into(south, south.x0, south.z1 - sd * 0.33), into(south, south.x0 + sw * 0.39, south.z1 - sd * 0.44), into(south, south.x0 + sw * 0.76, south.z1 - sd * 0.33), into(south, south.x1, south.z1 - sd * 0.42)],
    [[avenue.x, south.z1], into(south, avenue.x + 5, south.z1 - sd * 0.35), [avenue.x - 1, south.z0]],
  ];
}

// Lanes, authored as polylines the way every other placement list in this
// codebase is authored. They leave town on the lines the city's own roads
// already point down — the plaza crossing runs east at z = 40, the south
// connector heads out around x = 30 — so the track reads as a continuation and
// not as a stripe dropped on a field. A generated city lays its own with
// lanesFor.
export const HAND_LANES = [
  [[86, 40], [118, 45], [152, 37], [190, 41]],
  [[104, -62], [110, -4], [106, 44], [101, 74]],
  [[-22, -150], [20, -159], [60, -150], [86, -157]],
  [[30, -122], [35, -151], [29, -206]],
];

const LANE_STEP = 3;
const LANE_LIFT = 0.06;
const POLE_EVERY = 9;          // one pole per 27 m of lane
const POLE_OFFSET = 5.5;       // metres off the lane centre, on the left
const POLE_TOP = 6.9;

// Field boundaries live on a world grid, not inside a tile, so a hedgerow runs
// unbroken across every tile it crosses without any seam logic at all.
const FIELD = 27;
const FIELD_JITTER = 7;
const FIELD_SEED = 0x4f1e;
const HEDGE_STEP = 1.7;
const FENCE_STEP = 2.2;
const GATE_GAP = 6;            // a hedgerow opens where a lane crosses it
const HEDGE_TREE_EVERY = 9;    // ~15 m of hedge per candidate tree
const LANE_PAD = 12;           // lane steps this far outside a tile still matter

const SCRUB_PER_M2 = 1 / 60;
const YARD_SEED_SALT = 0x51a7;

// Pool capacities. The bands wrap a whole town now, not one district's edge, so
// a resident ring at the town's edge holds about 2,300 props against these —
// measured, with every kind's peak inside its capacity (tests/accept/
// m4-t13.spec.js fails the slice if any pool starves there). claim() degrades to
// "place less" rather than corrupting anything if a future world overruns them,
// and stats() reports the starvation so it cannot pass silently.
const CAPACITY = {
  track: 400, hedge: 4000, fence: 3500, scrub: 2400,
  shed: 140, pole: 120, wire: 120, drum: 260, tree: 400,
};

const NORMAL_STEP = 1.2;
const _m = new THREE.Matrix4();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _tint = new THREE.Color();
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

// 0..1 from a pair of integers. tileSeed is already the codebase's integer
// hash; this is the same determinism guarantee, one step further.
function r01(a, b, seed) {
  return tileSeed(a, b, seed) / 4294967296;
}

// ---------------------------------------------------------------------------
// Geometry. One merged, vertex-coloured buffer per kind: colour variety inside
// a prop costs nothing, and the per-instance tint on top of it is what stops a
// field of hedge blobs reading as one extruded worm.

function tinted(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function box(w, h, d, x, y, z, hex) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return tinted(g, hex);
}

// mergeGeometries returns null when the parts disagree — indexed against
// non-indexed is the one that bites, because half of three's primitives are one
// and half the other — and an InstancedMesh wrapping a null geometry does not
// complain until the renderer walks it, several frames and one confusing stack
// trace later. Fail here, where the mistake is.
function merged(parts) {
  const geo = mergeGeometries(parts);
  if (!geo) throw new Error('outskirts: geometry merge failed, mismatched attributes');
  return geo;
}

// A shed sits on a plinth that runs 0.6 m below its floor, because the ground
// it lands on rolls and a box placed at the highest corner would otherwise
// show daylight under the lowest one.
function shedGeometry() {
  const parts = [box(3.4, 2.9, 2.8, 0, 0.85, 0, 0x6b6257)];
  for (const side of [-1, 1]) {
    const roof = new THREE.BoxGeometry(3.8, 0.14, 1.62);
    roof.rotateX(side * 0.4);
    roof.translate(0, 2.62, side * 0.68);
    parts.push(tinted(roof, 0x7a4b34));
  }
  parts.push(box(0.92, 1.75, 0.1, 0.72, 0.875, 1.42, 0x302b25));
  parts.push(box(0.62, 0.52, 0.08, -0.82, 1.82, 1.42, 0x252b2c));
  return merged(parts);
}

// One post and the two rails that leave it, so a run is just this repeated
// along a line and the run ends without a stray post hanging off it.
function fenceGeometry() {
  return merged([
    box(0.1, 1.2, 0.1, -FENCE_STEP / 2, 0.55, 0, 0x5a4e3e),
    box(FENCE_STEP, 0.08, 0.05, 0, 0.92, 0, 0x6a5c49),
    box(FENCE_STEP, 0.08, 0.05, 0, 0.52, 0, 0x6a5c49),
  ]);
}

function hedgeGeometry() {
  const g = new THREE.IcosahedronGeometry(0.88, 0);
  g.scale(1, 0.82, 1);
  g.translate(0, 0.62, 0);
  return tinted(g, 0x2c4326);
}

function poleGeometry() {
  return merged([
    tinted(new THREE.CylinderGeometry(0.11, 0.15, 7.4, 6).translate(0, 3.5, 0), 0x4a3f33),
    box(1.5, 0.1, 0.1, 0, POLE_TOP, 0, 0x413729),
    box(1.0, 0.1, 0.1, 0, POLE_TOP - 0.62, 0, 0x413729),
  ]);
}

// Unit length along +z; the instance matrix stretches it to the span.
function wireGeometry() {
  return merged([
    box(0.05, 0.05, 1, -0.6, 0, 0, 0x14161a),
    box(0.05, 0.05, 1, 0.6, 0, 0, 0x14161a),
  ]);
}

// The hedgerow tree: scruffier and darker than the street trees in props.js,
// because it is the only thing out here tall enough to break the horizon and it
// has to read as countryside rather than as a planted avenue.
function treeGeometry() {
  // Non-indexed throughout: IcosahedronGeometry is, CylinderGeometry is not.
  const trunk = new THREE.CylinderGeometry(0.16, 0.3, 3.4, 5).toNonIndexed();
  trunk.translate(0, 1.7, 0);
  const parts = [tinted(trunk, 0x3b3128)];
  const clumps = [[0, 4.0, 0, 1.75], [0.95, 3.35, 0.45, 1.2], [-0.75, 3.6, -0.55, 1.15]];
  for (const [x, y, z, r] of clumps) {
    parts.push(tinted(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), 0x27401f));
  }
  return merged(parts);
}

function drumGeometry() {
  return tinted(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 8).translate(0, 0.44, 0), 0x4c5a4a);
}

function trackGeometry() {
  // Longer than LANE_STEP so consecutive quads overlap through a bend.
  const g = new THREE.PlaneGeometry(3.2, LANE_STEP + 0.5);
  g.rotateX(-Math.PI / 2);
  return tinted(g, 0x4a4034);
}

// Dry roadside weed, drawn once into a canvas and crossed into two quads.
function scrubTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 11; i++) {
    const x = 2 + i * 5.6;
    const h = 22 + ((i * 29) % 34);
    const grad = g.createLinearGradient(0, 64, 0, 64 - h);
    grad.addColorStop(0, '#1f2c17');
    grad.addColorStop(1, '#6d7a45');
    g.strokeStyle = grad;
    g.lineWidth = 1.6 + (i % 3) * 0.5;
    g.beginPath();
    g.moveTo(x, 64);
    g.quadraticCurveTo(x + 3, 64 - h * 0.6, x + 7 - (i % 4) * 3, 64 - h);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function scrubGeometry() {
  const blade = new THREE.PlaneGeometry(1.35, 0.95);
  blade.translate(0, 0.4, 0);
  return tinted(merged([blade, blade.clone().rotateY(Math.PI / 2)]), 0xffffff);
}

// ---------------------------------------------------------------------------
// Pools. A slot is claimed, written, and eventually handed back; nothing is
// ever created or disposed after boot.

function createPool(name, geometry, material, capacity) {
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = `outskirts ${name}`;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Its instances span the whole world, so its bounds would cover the whole
  // world too: culling can only ever say yes, and computing it is stale the
  // moment a tile streams.
  mesh.frustumCulled = false;
  // Every slot starts hidden and white: an unwritten instanceColor is zeroed,
  // which is black, and a slot claimed before its colour lands would flicker.
  _tint.setRGB(1, 1, 1);
  for (let i = 0; i < capacity; i++) {
    mesh.setMatrixAt(i, HIDDEN);
    mesh.setColorAt(i, _tint);
  }
  const free = [];
  for (let i = capacity - 1; i >= 0; i--) free.push(i);
  const live = new Uint8Array(capacity);
  let top = 0;
  let starved = 0;
  mesh.count = 0;

  return {
    name,
    mesh,
    claim() {
      const i = free.pop();
      if (i === undefined) {
        starved++;
        return -1;
      }
      live[i] = 1;
      if (i >= top) top = i + 1;
      mesh.count = top;
      return i;
    },
    set(i, matrix, tint) {
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, tint);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
    free(i) {
      mesh.setMatrixAt(i, HIDDEN);
      mesh.instanceMatrix.needsUpdate = true;
      live[i] = 0;
      free.push(i);
      while (top > 0 && !live[top - 1]) top--;
      mesh.count = top;
    },
    stats: () => ({ used: capacity - free.length, capacity, starved }),
  };
}

function createClaim() {
  const taken = [];
  return {
    place(pool, matrix, tint) {
      const i = pool.claim();
      if (i < 0) return false;
      pool.set(i, matrix, tint ?? _tint.setRGB(1, 1, 1));
      taken.push(pool, i);
      return true;
    },
    size: () => taken.length / 2,
    release() {
      for (let i = 0; i < taken.length; i += 2) taken[i].free(taken[i + 1]);
      taken.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Placement maths.

// Upright, yaw only. y is the field unless a caller has already worked out a
// better one (a shed wants its highest corner).
function upright(x, z, yaw, scale, y) {
  _m.makeRotationY(yaw);
  _m.scale(_scale.setScalar(scale));
  _m.setPosition(x, y ?? heightAt(x, z), z);
  return _m;
}

// Flush on the field: +y is the terrain normal, +z the heading flattened into
// it. A quad laid with a plain yaw cuts into every slope it crosses.
function onGround(x, z, dirX, dirZ, lift) {
  const gx = (heightAt(x + NORMAL_STEP, z) - heightAt(x - NORMAL_STEP, z)) / (2 * NORMAL_STEP);
  const gz = (heightAt(x, z + NORMAL_STEP) - heightAt(x, z - NORMAL_STEP)) / (2 * NORMAL_STEP);
  _up.set(-gx, 1, -gz).normalize();
  _fwd.set(dirX, 0, dirZ).normalize();
  _right.crossVectors(_fwd, _up).normalize();
  _fwd.crossVectors(_up, _right).normalize();
  return _m.makeBasis(_right, _up, _fwd).setPosition(x, heightAt(x, z) + lift, z);
}

function span(ax, ay, az, bx, by, bz) {
  _fwd.set(bx - ax, by - ay, bz - az);
  const len = _fwd.length();
  _fwd.divideScalar(len);
  _right.set(bz - az, 0, -(bx - ax)).normalize();
  _up.crossVectors(_right, _fwd).normalize();
  _m.makeBasis(_right, _up, _fwd.multiplyScalar(len));
  return _m.setPosition((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
}

// Walk a polyline at a fixed arc-length step, carrying the remainder across
// corners so the step index is global and poles stay in phase between tiles.
function walkLane(lane, step, visit) {
  let index = 0;
  let carry = 0;
  for (let s = 0; s < lane.length - 1; s++) {
    const [ax, az] = lane[s];
    const [bx, bz] = lane[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const dx = (bx - ax) / len;
    const dz = (bz - az) / len;
    let d = carry;
    while (d < len) {
      visit(ax + dx * d, az + dz * d, dx, dz, index++);
      d += step;
    }
    carry = d - len;
  }
}

// The whole lane network, stepped once per map. It is world-static, so no tile
// ever recomputes it and every tile sees the same steps.
function laneStepsOf(lanes) {
  return lanes.map((lane) => {
    const steps = [];
    walkLane(lane, LANE_STEP, (x, z, dx, dz, i) => steps.push({ x, z, dx, dz, i }));
    return steps;
  });
}

// The roads the player has laid since boot (M3.T27). The lanes above are
// world-static, but the map's graph is live: every edge is stepped once per map
// version — an op bumps it — and bucketed by tile, so a tile build reads only
// its own neighbourhood and the cache holds until the map actually changes.
const ROAD_BUCKET = 64;
const ROAD_PAD = 12;    // metres of halo a tile reads past its own edge
// Carriageway plus footway, and a metre of verge: a prop inside this of a road
// centre-line is standing in the road.
const ROAD_CLEAR = ROAD_HALF_WIDTH + WALKWAY_WIDTH + 1;

function roadBucketsOf(map) {
  const buckets = new Map();
  if (!map?.graph) return buckets;
  const nodes = new Map(map.graph.nodes.map((n) => [n.id, n]));
  for (const edge of map.graph.edges) {
    const a = nodes.get(edge.a);
    const b = nodes.get(edge.b);
    if (!a || !b) continue;
    walkLane([[a.x, a.z], [b.x, b.z]], LANE_STEP, (x, z) => {
      const key = `${Math.floor(x / ROAD_BUCKET)},${Math.floor(z / ROAD_BUCKET)}`;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = []));
      bucket.push({ x, z, clear: ROAD_CLEAR });
    });
  }
  return buckets;
}

function nearbyRoadSteps(bounds, buckets) {
  const steps = [];
  const x0 = bounds.minX - ROAD_PAD;
  const x1 = bounds.maxX + ROAD_PAD;
  const z0 = bounds.minZ - ROAD_PAD;
  const z1 = bounds.maxZ + ROAD_PAD;
  for (let tx = Math.floor(x0 / ROAD_BUCKET); tx <= Math.floor(x1 / ROAD_BUCKET); tx++) {
    for (let tz = Math.floor(z0 / ROAD_BUCKET); tz <= Math.floor(z1 / ROAD_BUCKET); tz++) {
      const bucket = buckets.get(`${tx},${tz}`);
      if (!bucket) continue;
      for (const s of bucket) {
        if (s.x < x0 || s.x > x1 || s.z < z0 || s.z > z1) continue;
        steps.push(s);
      }
    }
  }
  return steps;
}

// Half-open on the high side: two rects that share an edge must not both place
// the thing standing on it.
const inRect = (r, x, z) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;

// The town's water, grown by its own bank run (map.town.river, townplan's
// BANK_RUN): the map says how wide its bank is, so no number lives here. Same
// [centre x, centre z, half width, half depth] shape as the map's own rects.
function waterKeep(map) {
  const keep = map.town?.river?.bankRun ?? 0;
  return (map.water ?? []).map(([cx, cz, hw, hd]) => [cx, cz, hw + keep, hd + keep]);
}

// A band cut into the rects that avoid the water. The river runs out past the
// town on both sides (townplan's RIVER_OVERHANG), so a band down the east face
// crosses it wherever the town's outline reaches the stream: without this the
// east band grows sheds in the water. Each piece is at most four rects, and the
// bank stop is the one a real field makes. `water` holds [cx, cz, hw, hd].
function cutWater(rects, water) {
  let parts = rects;
  for (const [cx, cz, hw, hd] of water) {
    const x0 = cx - hw, x1 = cx + hw;
    const z0 = cz - hd, z1 = cz + hd;
    const next = [];
    for (const r of parts) {
      const lo = Math.max(r.x0, x0);
      const hi = Math.min(r.x1, x1);
      const zo = Math.max(r.z0, z0);
      const zi = Math.min(r.z1, z1);
      if (lo >= hi || zo >= zi) {
        next.push(r);
        continue;
      }
      if (x0 > r.x0) next.push({ ...r, x1: x0 });
      if (x1 < r.x1) next.push({ ...r, x0: x1 });
      if (z0 > r.z0) next.push({ x0: lo, x1: hi, z0: r.z0, z1: z0 });
      if (z1 < r.z1) next.push({ x0: lo, x1: hi, z0: z1, z1: r.z1 });
    }
    parts = next;
  }
  return parts;
}

function eligibleRects(bounds, bands, water) {
  const rects = [];
  for (const b of bands) {
    const r = {
      x0: Math.max(b.x0, bounds.minX), x1: Math.min(b.x1, bounds.maxX),
      z0: Math.max(b.z0, bounds.minZ), z1: Math.min(b.z1, bounds.maxZ),
    };
    if (r.x1 - r.x0 > 1 && r.z1 - r.z0 > 1) rects.push(r);
  }
  return cutWater(rects, water).filter((r) => r.x1 - r.x0 > 1 && r.z1 - r.z0 > 1);
}

function nearbyLaneSteps(rect, laneSteps) {
  const near = [];
  for (const steps of laneSteps) {
    for (const s of steps) {
      if (s.x < rect.x0 - LANE_PAD || s.x > rect.x1 + LANE_PAD) continue;
      if (s.z < rect.z0 - LANE_PAD || s.z > rect.z1 + LANE_PAD) continue;
      near.push({ ...s, steps, own: inRect(rect, s.x, s.z) });
    }
  }
  return near;
}

function nearLane(near, x, z, radius) {
  for (const s of near) {
    const clear = s.clear ?? radius;
    if (Math.abs(s.x - x) < clear && Math.abs(s.z - z) < clear) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Emitters. Each takes the claim it fills and returns nothing: a pool that runs
// out simply stops placing, which is the only failure mode worth having.

function emitLanes(claim, pools, near, roads) {
  for (const s of near) {
    if (!s.own) continue;
    // A road laid across a lane takes its piece: no dirt track poking through
    // the asphalt, no pole standing in the carriageway (M3.T27).
    if (nearLane(roads, s.x, s.z, ROAD_CLEAR)) continue;
    claim.place(pools.track, onGround(s.x, s.z, s.dx, s.dz, LANE_LIFT),
      _tint.setScalar(0.82 + r01(s.i, 7, FIELD_SEED) * 0.36));
    if (s.i % POLE_EVERY !== 0) continue;
    const px = s.x + s.dz * POLE_OFFSET;
    const pz = s.z - s.dx * POLE_OFFSET;
    if (nearLane(roads, px, pz, ROAD_CLEAR)) continue;
    claim.place(pools.pole, upright(px, pz, r01(s.i, 3, FIELD_SEED) * Math.PI, 1),
      _tint.setScalar(0.85 + r01(s.i, 4, FIELD_SEED) * 0.3));
    // The wire wants a pole at its far end. A span reaching across the water's
    // cut — where the bank stops the track — would hang from one end with
    // nothing holding the other up.
    const next = near.find((n) => n.own && n.i === s.i + POLE_EVERY && n.steps === s.steps);
    if (!next) continue;
    const nx = next.x + next.dz * POLE_OFFSET;
    const nz = next.z - next.dx * POLE_OFFSET;
    claim.place(pools.wire,
      span(px, heightAt(px, pz) + POLE_TOP, pz, nx, heightAt(nx, nz) + POLE_TOP, nz));
  }
}

function fieldLine(axis, i) {
  const rand = mulberry32(tileSeed(i, axis, FIELD_SEED));
  return {
    at: i * FIELD + (rand() - 0.5) * 2 * FIELD_JITTER,
    live: rand() < 0.72,
    hedge: rand() < 0.66,
  };
}

function emitLine(claim, pools, rect, near, axis, line) {
  const step = line.hedge ? HEDGE_STEP : FENCE_STEP;
  const from = axis ? rect.z0 : rect.x0;
  const to = axis ? rect.z1 : rect.x1;
  for (let k = Math.ceil(from / step); k * step < to; k++) {
    const t = k * step;
    const x = axis ? line.at : t;
    const z = axis ? t : line.at;
    if (nearLane(near, x, z, GATE_GAP)) continue;
    if (!line.hedge) {
      claim.place(pools.fence, upright(x, z, axis ? Math.PI / 2 : 0, 1),
        _tint.setScalar(0.86 + r01(k, axis + 61, FIELD_SEED) * 0.28));
      continue;
    }
    const jog = (r01(k, axis + 11, FIELD_SEED) - 0.5) * 0.8;
    const scale = 0.78 + r01(k, axis + 21, FIELD_SEED) * 0.55;
    claim.place(pools.hedge,
      upright(axis ? x + jog : x, axis ? z : z + jog, r01(k, axis + 31, FIELD_SEED) * Math.PI, scale),
      _tint.setRGB(0.8 + r01(k, axis + 41, FIELD_SEED) * 0.45, 0.9 + r01(k, axis + 51, FIELD_SEED) * 0.3, 0.8));
    // A tree stood in the hedge it grew out of, every 15 m or so. Nothing else
    // out here is tall enough to break the horizon.
    if (k % HEDGE_TREE_EVERY || r01(k, axis + 71, FIELD_SEED) > 0.55) continue;
    claim.place(pools.tree,
      upright(x, z, r01(k, axis + 81, FIELD_SEED) * Math.PI, 0.82 + r01(k, axis + 91, FIELD_SEED) * 0.5),
      _tint.setRGB(0.78 + r01(k, axis + 101, FIELD_SEED) * 0.5, 0.86 + r01(k, axis + 111, FIELD_SEED) * 0.34, 0.8));
  }
}

function emitFields(claim, pools, rect, near) {
  for (const axis of [0, 1]) {
    const lo = axis ? rect.x0 : rect.z0;
    const hi = axis ? rect.x1 : rect.z1;
    const i0 = Math.floor((lo - FIELD_JITTER) / FIELD);
    const i1 = Math.ceil((hi + FIELD_JITTER) / FIELD);
    for (let i = i0; i <= i1; i++) {
      const line = fieldLine(axis, i);
      if (!line.live || line.at < lo || line.at >= hi) continue;
      emitLine(claim, pools, rect, near, axis, line);
    }
  }
}

const YARD_HALF_X = 5;
const YARD_HALF_Z = 4;

function emitYardFence(claim, pools, cx, cz, yaw, rand) {
  const gate = Math.floor(rand() * 4);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  for (let side = 0; side < 4; side++) {
    if (side === gate) continue;
    const alongX = side % 2 === 0;
    const run = alongX ? YARD_HALF_X * 2 : YARD_HALF_Z * 2;
    const off = side < 2 ? 1 : -1;
    for (let d = -run / 2 + FENCE_STEP / 2; d < run / 2; d += FENCE_STEP) {
      const lx = alongX ? d : off * YARD_HALF_X;
      const lz = alongX ? off * YARD_HALF_Z : d;
      const x = cx + lx * cos + lz * sin;
      const z = cz - lx * sin + lz * cos;
      claim.place(pools.fence, upright(x, z, yaw + (alongX ? 0 : Math.PI / 2), 1),
        _tint.setScalar(0.8 + rand() * 0.3));
    }
  }
}

// Corner heights, highest wins: the plinth covers the rest. A shed that
// averaged them would bury its uphill wall.
function shedY(cx, cz) {
  let y = -Infinity;
  for (const sx of [-1.9, 1.9]) {
    for (const sz of [-1.6, 1.6]) y = Math.max(y, heightAt(cx + sx, cz + sz));
  }
  return y;
}

function emitYard(claim, pools, cx, cz, yaw, rand) {
  emitYardFence(claim, pools, cx, cz, yaw, rand);
  const sx = cx + (rand() - 0.5) * 3;
  const sz = cz + (rand() - 0.5) * 2.5;
  claim.place(pools.shed, upright(sx, sz, yaw + (rand() - 0.5) * 0.25, 0.9 + rand() * 0.45, shedY(sx, sz)),
    _tint.setRGB(0.82 + rand() * 0.4, 0.84 + rand() * 0.32, 0.8 + rand() * 0.3));
  const drums = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < drums; i++) {
    const dx = sx + (rand() - 0.5) * 6;
    const dz = sz + (rand() - 0.5) * 5;
    claim.place(pools.drum, upright(dx, dz, rand() * Math.PI, 0.9 + rand() * 0.3),
      _tint.setRGB(0.7 + rand() * 0.7, 0.8 + rand() * 0.4, 0.7 + rand() * 0.4));
  }
}

// Yards sit off a lane where there is one, because a shed in the middle of a
// field with no way to reach it is the tell that a generator placed it.
function emitYards(claim, pools, rect, near, rand) {
  const onLane = near.filter((s) => s.own);
  const count = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    let cx;
    let cz;
    let yaw;
    if (onLane.length) {
      const s = onLane[Math.floor(rand() * onLane.length)];
      const side = rand() < 0.5 ? 1 : -1;
      const off = 9 + rand() * 4;
      cx = s.x - s.dz * off * side;
      cz = s.z + s.dx * off * side;
      yaw = Math.atan2(s.dx, s.dz);
    } else {
      cx = rect.x0 + rand() * (rect.x1 - rect.x0);
      cz = rect.z0 + rand() * (rect.z1 - rect.z0);
      yaw = rand() * Math.PI * 2;
    }
    if (!inRect(rect, cx, cz)) continue;
    emitYard(claim, pools, cx, cz, yaw, rand);
  }
}

function emitScrub(claim, pools, rect, near, rand) {
  const count = Math.round((rect.x1 - rect.x0) * (rect.z1 - rect.z0) * SCRUB_PER_M2);
  for (let i = 0; i < count; i++) {
    const x = rect.x0 + rand() * (rect.x1 - rect.x0);
    const z = rect.z0 + rand() * (rect.z1 - rect.z0);
    if (nearLane(near, x, z, 2.4)) continue;
    claim.place(pools.scrub, upright(x, z, rand() * Math.PI, 0.7 + rand() * 0.9),
      _tint.setRGB(0.8 + rand() * 0.3, 0.86 + rand() * 0.28, 0.72 + rand() * 0.22));
  }
}

// ---------------------------------------------------------------------------
// The ground they stand on. One merged slab over both bands — a per-tile
// ground mesh is a draw per tile, which is the whole thing this file avoids.
// Same 0.3 m box and 4 m cell as the river banks in landscape.js, so the two
// surfaces bend together and neither pokes through the other.
const GROUND_CELL = 4;
// Scrub colour, and the 700 m plane's colour it has to arrive at. A slab that
// simply stops leaves a ruled line across the middle distance, which is the one
// thing that says "a rectangle was pasted here" from half a kilometre away.
const SCRUB_FLOOR = new THREE.Color(0x1b2318);
const PLANE_FLOOR = new THREE.Color(0x14171c);
const FADE_RUN = 14;

function fadeToPlane(geo, band) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const inset = band.inner === 'x' ? pos.getX(i) - band.x0 : band.z1 - pos.getZ(i);
    c.copy(PLANE_FLOOR).lerp(SCRUB_FLOOR, smoothFade(inset / FADE_RUN));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function smoothFade(t) {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
}

function buildOutskirtGround(bands) {
  const geos = bands.map((b) => {
    const w = b.x1 - b.x0;
    const d = b.z1 - b.z0;
    const g = new THREE.BoxGeometry(w, 0.3, d, Math.round(w / GROUND_CELL), 1, Math.round(d / GROUND_CELL));
    g.translate((b.x0 + b.x1) / 2, -0.1, (b.z0 + b.z1) / 2);
    return fadeToPlane(g, b);
  });
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, envMapIntensity: 0.2 });
  const mesh = new THREE.Mesh(displaceToTerrain(merged(geos)), mat);
  mesh.name = 'outskirts ground';
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------

function buildPools() {
  // One material for every solid kind: they differ by geometry and by vertex
  // colour, not by surface, and seven copies of the same description would
  // compile the same program seven times over.
  const solid = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.94, metalness: 0, envMapIntensity: 0.25,
  });
  const weed = new THREE.MeshStandardMaterial({
    map: scrubTexture(), alphaTest: 0.42, side: THREE.DoubleSide,
    vertexColors: true, roughness: 1, color: 0x8f9a74,
  });
  return {
    track: createPool('track', trackGeometry(), solid, CAPACITY.track),
    hedge: createPool('hedge', hedgeGeometry(), solid, CAPACITY.hedge),
    fence: createPool('fence', fenceGeometry(), solid, CAPACITY.fence),
    scrub: createPool('scrub', scrubGeometry(), weed, CAPACITY.scrub),
    shed: createPool('shed', shedGeometry(), solid, CAPACITY.shed),
    pole: createPool('pole', poleGeometry(), solid, CAPACITY.pole),
    wire: createPool('wire', wireGeometry(), solid, CAPACITY.wire),
    drum: createPool('drum', drumGeometry(), solid, CAPACITY.drum),
    tree: createPool('tree', treeGeometry(), solid, CAPACITY.tree),
  };
}

// The whole outskirts system: the meshes to add to the scene once, and the
// builder to register with the chunk manager. build() returns a claim handle —
// a release(), no Object3D — which is what tells chunks.js to hand slots back
// instead of disposing geometry.
export function buildOutskirts(map = worldMap()) {
  // A generated map lays its bands and its tracks around its own town; the hand
  // preset keeps its tables.
  const vistas = vistasOf(map);
  const outline = vistas ? outlineFor(map) ?? districtOutline(map.district) : null;
  const bands = vistas ? bandsFor(map.district, vistas, outline) : HAND_BANDS;
  const lanes = vistas ? lanesFor(map.district, bands, waysOf(map)) : HAND_LANES;
  const laneSteps = laneStepsOf(lanes);
  const water = waterKeep(map);
  const pools = buildPools();
  const ground = buildOutskirtGround(bands);
  const meshes = [ground, ...Object.values(pools).map((p) => p.mesh)];

  // The live graph, cached by version: a tile rebuilt after an op has to see
  // the road the op laid, and a version that changes nothing re-reads nothing.
  let roadsVersion = -1;
  let roadBuckets = new Map();
  function roadsNow() {
    if (map.version !== roadsVersion) {
      roadsVersion = map.version;
      roadBuckets = roadBucketsOf(map);
    }
    return roadBuckets;
  }

  function build(bounds) {
    const rects = eligibleRects(bounds, bands, water);
    if (!rects.length) return null;
    const roadSteps = nearbyRoadSteps(bounds, roadsNow());
    const claim = createClaim();
    rects.forEach((rect, i) => {
      const rand = mulberry32(tileSeed(i, bounds.tz, bounds.seed ^ YARD_SEED_SALT));
      const near = [...nearbyLaneSteps(rect, laneSteps), ...roadSteps];
      emitLanes(claim, pools, near, roadSteps);
      emitFields(claim, pools, rect, near);
      emitYards(claim, pools, rect, near, rand);
      emitScrub(claim, pools, rect, near, rand);
    });
    return claim.size() ? claim : null;
  }

  return {
    meshes,
    build,
    draws: () => meshes.length,
    stats: () => Object.fromEntries(Object.entries(pools).map(([k, p]) => [k, p.stats()])),
  };
}
